import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

import {readPassage} from '../services/takes/passage.mjs';

// An asymmetric continuous decode, in signed 16-bit little-endian stereo.
const continuous = Buffer.from(
  '0080ff7f 0100feff 2c01a8fd f00000f0 d4fe2b01 0080ffff'.replaceAll(' ', ''),
  'hex',
);
const expected = Array.from({length: 6}, (_, frame) => [
  continuous.readInt16LE(frame * 4),
  continuous.readInt16LE(frame * 4 + 2),
]);
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const chunks = new Map();
const source = {
  id: 'fixture',
  revision: sha256(continuous),
  sampleRate: 48_000,
  channels: 2,
  totalFrames: 6,
  chunks: [[0, 2], [2, 3], [5, 1]].map(([startFrame, frameCount]) => {
    const bytes = continuous.subarray(startFrame * 4, (startFrame + frameCount) * 4);
    const hash = sha256(bytes);
    chunks.set(hash, bytes);
    return {startFrame, frameCount, sha256: hash};
  }),
  peaks: [],
  curatedRange: {startFrame: 0, endFrame: 2},
  denseRange: {startFrame: 2, endFrame: 5},
};
const catalog = [source];
const store = {
  async readChunk(hash) {
    assert.ok(chunks.has(hash), 'reader requests a catalog chunk digest');
    return chunks.get(hash);
  },
};
const bounds = (startFrame, endFrame, revision = source.revision) => ({
  sourceId: source.id,
  revision,
  startFrame,
  endFrame,
});

for (const [description, startFrame, endFrame] of [
  ['first frame', 0, 1],
  ['frames across two chunks', 1, 4],
  ['final frame', 5, 6],
]) {
  test(`a passage reads the ${description} from the continuous stereo decode`, async () => {
    const passage = await readPassage(catalog, bounds(startFrame, endFrame), store);
    assert.equal(passage.sampleRate, 48_000);
    assert.equal(passage.channels, 2);
    assert.equal(passage.format, 's16le');
    assert.equal(passage.frameCount, endFrame - startFrame);
    const pcm = Buffer.from(passage.pcm);
    assert.equal(pcm.byteLength, (endFrame - startFrame) * 4);
    const decoded = Array.from({length: passage.frameCount}, (_, frame) => [
      pcm.readInt16LE(frame * 4),
      pcm.readInt16LE(frame * 4 + 2),
    ]);
    assert.deepEqual(decoded, expected.slice(startFrame, endFrame));
  });
}

test('invalid passage endpoints and unknown revisions fail before reading a chunk', async () => {
  const unreadable = {readChunk: () => assert.fail('an invalid request read a chunk')};
  for (const invalid of [
    bounds(1, 1),
    bounds(3, 1),
    bounds(0.5, 1),
    bounds(0, 1.5),
    bounds(-1, 1),
    bounds(0, 7),
    bounds(0, Infinity),
    bounds(0, 1, 'unpublished'),
    {...bounds(0, 1), sourceId: 'other-source'},
  ]) {
    await assert.rejects(readPassage(catalog, invalid, unreadable), RangeError);
  }
});

test('a chunk with the wrong contents fails even when it has the expected length', async () => {
  const corrupt = {readChunk: async hash => Buffer.alloc(chunks.get(hash).byteLength)};
  await assert.rejects(readPassage(catalog, bounds(0, 1), corrupt), /chunk integrity/);
});

test('a gap in the chunk index cannot return a partially zero-filled passage', async () => {
  const brokenCatalog = [{...source, chunks: source.chunks.slice(1)}];
  await assert.rejects(readPassage(brokenCatalog, bounds(1, 4), store), /chunk coverage/);
});

test('the source index preserves PCM digests and signed stereo peaks across chunk boundaries', async t => {
  const {indexSourcePcm} = await import('../scripts/prepare-take-source.mjs');
  const directory = await mkdtemp(join(tmpdir(), 'room-take-index-'));
  t.after(() => rm(directory, {recursive: true, force: true}));
  const input = join(directory, 'whole.pcm');
  const output = join(directory, 'chunks');
  await writeFile(input, continuous);

  const index = await indexSourcePcm(input, output, {framesPerChunk: 4, peakResolutions: [3, 6]});
  assert.equal(index.revision, sha256(continuous));
  assert.equal(index.totalFrames, 6);
  assert.deepEqual(index.chunks, [
    {startFrame: 0, frameCount: 4, sha256: sha256(continuous.subarray(0, 16))},
    {startFrame: 4, frameCount: 2, sha256: sha256(continuous.subarray(16))},
  ]);
  const files = await Promise.all(index.chunks.map(chunk => readFile(join(output, chunk.sha256 + '.pcm'))));
  assert.deepEqual(Buffer.concat(files), continuous);
  assert.deepEqual(index.peaks, [
    {framesPerPeak: 3, values: [[-32768, 300, -600, 32767], [-32768, 240, -4096, 299]]},
    {framesPerPeak: 6, values: [[-32768, 300, -4096, 32767]]},
  ]);
});

test('the index rejects a decode ending midway through a stereo frame', async t => {
  const {indexSourcePcm} = await import('../scripts/prepare-take-source.mjs');
  const directory = await mkdtemp(join(tmpdir(), 'room-take-index-'));
  t.after(() => rm(directory, {recursive: true, force: true}));
  const input = join(directory, 'incomplete.pcm');
  await writeFile(input, continuous.subarray(0, 23));
  await assert.rejects(indexSourcePcm(input, join(directory, 'chunks')), /whole stereo frames/);
});
