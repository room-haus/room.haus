import {execFile} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdir, mkdtemp, open, readFile, rename, rm, writeFile} from 'node:fs/promises';
import {basename, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {promisify} from 'node:util';
import {cacheVerifiedSource} from './lib/audio-processing-sources.mjs';
import {
  TAKE_SOURCE_BYTES_PER_FRAME,
  TAKE_SOURCE_CHANNELS,
  TAKE_SOURCE_FORMAT,
  TAKE_SOURCE_SAMPLE_RATE,
} from '../src/experiences/takes/source.mjs';

const cacheDirectory = fileURLToPath(new URL('../.cache/take-source/', import.meta.url));
const ffmpeg = promisify(execFile);
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const decodeArgs = [
  '-map', '0:a:0', '-vn', '-sn', '-dn',
  '-ar', String(TAKE_SOURCE_SAMPLE_RATE), '-ac', String(TAKE_SOURCE_CHANNELS),
  '-c:a', 'pcm_s16le', '-f', TAKE_SOURCE_FORMAT,
];

async function readFrames(file, startFrame, frameCount) {
  const bytes = Buffer.allocUnsafe(frameCount * TAKE_SOURCE_BYTES_PER_FRAME);
  let offset = 0;
  while (offset < bytes.byteLength) {
    const {bytesRead} = await file.read(
      bytes, offset, bytes.byteLength - offset, startFrame * TAKE_SOURCE_BYTES_PER_FRAME + offset,
    );
    if (!bytesRead) throw new Error('Source decode ended before the indexed frame count');
    offset += bytesRead;
  }
  return bytes;
}

function appendPeaks(level, bytes, startFrame, frameCount) {
  const endFrame = startFrame + frameCount;
  const {framesPerPeak, values} = level;
  let frame = startFrame;
  while (frame < endFrame) {
    const bucket = Math.floor(frame / framesPerPeak);
    const bucketEnd = Math.min(endFrame, (bucket + 1) * framesPerPeak);
    const peak = values[bucket] ??= [32767, -32768, 32767, -32768];
    for (; frame < bucketEnd; frame++) {
      const offset = (frame - startFrame) * TAKE_SOURCE_BYTES_PER_FRAME;
      const left = bytes.readInt16LE(offset);
      const right = bytes.readInt16LE(offset + 2);
      peak[0] = Math.min(peak[0], left);
      peak[1] = Math.max(peak[1], left);
      peak[2] = Math.min(peak[2], right);
      peak[3] = Math.max(peak[3], right);
    }
  }
}

export async function indexSourcePcm(input, chunksDirectory, {
  framesPerChunk = 10 * TAKE_SOURCE_SAMPLE_RATE,
  peakResolutions = [1, 4, 16].map(seconds => seconds * TAKE_SOURCE_SAMPLE_RATE),
} = {}) {
  const chunks = [];
  const peaks = peakResolutions.map(framesPerPeak => ({framesPerPeak, values: []}));
  const hash = createHash('sha256');
  const file = await open(input, 'r');
  try {
    const {size} = await file.stat();
    if (!size || size % TAKE_SOURCE_BYTES_PER_FRAME) {
      throw new Error('Canonical source must contain whole stereo frames');
    }
    const totalFrames = size / TAKE_SOURCE_BYTES_PER_FRAME;
    await mkdir(chunksDirectory, {recursive: true});
    for (let startFrame = 0; startFrame < totalFrames; startFrame += framesPerChunk) {
      const frameCount = Math.min(framesPerChunk, totalFrames - startFrame);
      const bytes = await readFrames(file, startFrame, frameCount);
      const digest = sha256(bytes);
      hash.update(bytes);
      chunks.push({startFrame, frameCount, sha256: digest});
      for (const level of peaks) appendPeaks(level, bytes, startFrame, frameCount);
      await writeFile(join(chunksDirectory, digest + '.pcm'), bytes);
    }
    return {revision: hash.digest('hex'), totalFrames, chunks, peaks};
  } finally {
    await file.close();
  }
}

async function cachePlaylist(fixture, lock, downloads) {
  const playlist = await cacheVerifiedSource(
    fixture.playlistUrl, fixture.playlistSha256, join(downloads, basename(new URL(fixture.playlistUrl).pathname)),
  );
  const segments = (await readFile(playlist, 'utf8')).split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'));
  const hashes = lock.segments;
  if (segments.length !== Object.keys(hashes).length || new Set(segments).size !== segments.length
    || segments.some(name => !/^MX029-\d{3}\.ts$/.test(name) || !/^[0-9a-f]{64}$/.test(hashes[name]))) {
    throw new Error('MX029 playlist segments differ from the pinned source lock');
  }

  const batchSize = 12;
  for (let offset = 0; offset < segments.length; offset += batchSize) {
    await Promise.all(segments.slice(offset, offset + batchSize).map(name => cacheVerifiedSource(
      new URL(name, fixture.playlistUrl).href, hashes[name], join(downloads, name),
    )));
  }
  return playlist;
}

async function decode(input, output, seconds) {
  await ffmpeg('ffmpeg', [
    '-nostdin', '-hide_banner', '-loglevel', 'error', '-n', '-i', input,
    ...(seconds === undefined ? [] : ['-t', String(seconds)]), ...decodeArgs, output,
  ]);
}

function correlation(reference, candidate, frameOffset) {
  let dot = 0;
  let referenceEnergy = 0;
  let candidateEnergy = 0;
  for (let byte = 0; byte < reference.byteLength; byte += 2) {
    const sample = reference.readInt16LE(byte);
    const aligned = candidate.readInt16LE(byte + frameOffset * TAKE_SOURCE_BYTES_PER_FRAME);
    dot += sample * aligned;
    referenceEnergy += sample * sample;
    candidateEnergy += aligned * aligned;
  }
  return dot / Math.sqrt(referenceEnergy * candidateEnergy);
}

async function verifyReference(kind, reference, fixture, lock, downloads, staging, continuous) {
  const passage = fixture.passages.find(entry => entry.segment === reference.segment);
  if (!passage) throw new Error(`Missing MX029 ${kind} reference fixture`);
  const segmentName = basename(new URL(passage.url).pathname);
  const expectedStart = Math.round(
    (reference.startPts90k - lock.playlistStartPts90k) * TAKE_SOURCE_SAMPLE_RATE / 90_000,
  );
  if (new URL(segmentName, fixture.playlistUrl).href !== passage.url
    || lock.segments[segmentName] !== passage.segmentSha256 || expectedStart !== reference.startFrame
    || reference.frameCount !== passage.seconds * TAKE_SOURCE_SAMPLE_RATE) {
    throw new Error(`MX029 ${kind} reference differs from the pinned source lock`);
  }

  const comparison = join(staging, kind + '.pcm');
  await decode(join(downloads, segmentName), comparison, passage.seconds);
  const isolated = await readFile(comparison);
  const endFrame = reference.startFrame + reference.frameCount;
  if (isolated.byteLength !== reference.frameCount * TAKE_SOURCE_BYTES_PER_FRAME) {
    throw new Error(`MX029 ${kind} reference was not decoded to its expected length`);
  }

  // Standalone AAC decode has a fresh decoder and resampler. Compare sustained
  // windows after startup priming, aligned to the presentation time of frame zero.
  const windowFrames = TAKE_SOURCE_SAMPLE_RATE / 4;
  const searchRadius = 16;
  const scores = [];
  for (const seconds of [0.25, 1, 3, 6]) {
    const windowStart = seconds * TAKE_SOURCE_SAMPLE_RATE;
    const firstByte = windowStart * TAKE_SOURCE_BYTES_PER_FRAME;
    const target = isolated.subarray(firstByte, firstByte + windowFrames * TAKE_SOURCE_BYTES_PER_FRAME);
    const region = await readFrames(
      continuous, reference.startFrame + windowStart - searchRadius, windowFrames + 2 * searchRadius,
    );
    const correlations = Array.from({length: 2 * searchRadius + 1}, (_, offset) =>
      correlation(target, region, offset));
    const best = Math.max(...correlations);
    if (best < 0.97 || correlations.indexOf(best) !== searchRadius) {
      throw new Error(`MX029 ${kind} reference alignment changed near ${seconds}s`);
    }
    scores.push({seconds, correlation: Number(best.toFixed(6))});
  }
  return {
    range: {startFrame: reference.startFrame, endFrame},
    evidence: {
      segment: reference.segment, playlistMediaTime: passage.mediaTime, startPts90k: reference.startPts90k, scores,
    },
  };
}

async function prepareTakeSource() {
  const fixtureBytes = await readFile(new URL('./fixtures/audio-processing-passages.json', import.meta.url));
  const lockBytes = await readFile(new URL('./fixtures/mx029-take-source.json', import.meta.url));
  const fixture = JSON.parse(fixtureBytes);
  const lock = JSON.parse(lockBytes);
  const ffmpegVersion = (await ffmpeg('ffmpeg', ['-version'])).stdout.split('\n', 1)[0];
  const downloads = join(cacheDirectory, 'downloads');
  const playlist = await cachePlaylist(fixture, lock, downloads);

  const staging = await mkdtemp(join(cacheDirectory, 'build-'));
  const pcm = join(staging, 'continuous.pcm');
  try {
    await decode(playlist, pcm);
    const stagedChunks = join(staging, 'chunks');
    const index = await indexSourcePcm(pcm, stagedChunks);
    if (index.revision !== lock.canonicalSha256 || index.totalFrames !== lock.totalFrames) {
      throw new Error(`Unexpected MX029 source revision: ${index.revision} (${index.totalFrames} frames)`);
    }
    const continuous = await open(pcm, 'r');
    let curated;
    let dense;
    try {
      curated = await verifyReference('curated', lock.references.curated, fixture, lock, downloads, staging, continuous);
      dense = await verifyReference('dense', lock.references.dense, fixture, lock, downloads, staging, continuous);
    } finally {
      await continuous.close();
    }

    const source = {
      id: lock.id,
      sampleRate: TAKE_SOURCE_SAMPLE_RATE,
      channels: TAKE_SOURCE_CHANNELS,
      ...index,
      curatedRange: curated.range,
      denseRange: dense.range,
      provenance: {
        playlistUrl: fixture.playlistUrl,
        playlistSha256: fixture.playlistSha256,
        inputLockSha256: sha256(lockBytes),
        segmentCount: Object.keys(lock.segments).length,
        playlistStartPts90k: lock.playlistStartPts90k,
        canonicalSha256: index.revision,
        ffmpegVersion,
        decodeArgs,
        references: {curated: curated.evidence, dense: dense.evidence},
      },
    };

    const chunks = join(cacheDirectory, 'chunks');
    await mkdir(chunks, {recursive: true});
    for (const digest of new Set(index.chunks.map(chunk => chunk.sha256))) {
      const name = digest + '.pcm';
      await rename(join(stagedChunks, name), join(chunks, name));
    }
    const catalog = join(cacheDirectory, 'catalog.json');
    const stagedCatalog = join(staging, 'catalog.json');
    await writeFile(stagedCatalog, JSON.stringify([source]) + '\n');
    await rename(stagedCatalog, catalog);
    console.log(`Prepared ${source.id} ${source.revision}, ${source.totalFrames} frames: ${catalog}`);
  } finally {
    await rm(staging, {recursive: true, force: true});
  }
}

if (import.meta.main) await prepareTakeSource();
