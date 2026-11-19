// Read-only verifier for the one-capture repeat → moved dissolve handoff.
// Compare to an offline source, without importing the recorder, renderer or service.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {open, readFile} from 'node:fs/promises';
import {join} from 'node:path';

const rate = 48000,
  stride = 4;
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const [parentLink, childLink] = process.argv.slice(2);
if (!parentLink || !childLink) throw Error('Usage: node scripts/check-fragment-handoff.mjs PARENT_URL CHILD_URL');
const fixtureDigest = '8fd47d3d93f1723b1b0f41e9dad4806038c06ed0e51ff04dc9487a4ae36dcbbb';

async function independentPassage(passage) {
  const {startFrame, endFrame, revision} = passage;
  assert.ok(Number.isSafeInteger(startFrame) && startFrame >= 0 && Number.isSafeInteger(endFrame));
  assert.ok(endFrame > startFrame && endFrame - startFrame <= 30 * rate);
  const pcm = Buffer.alloc((endFrame - startFrame) * stride);
  if (revision === 'fixture-v1-' + fixtureDigest) {
    // The public harness repeats this independently pinned stereo test tone.
    // Each channel has a different frequency, level and decay constant.
    const period = Buffer.alloc(rate * stride);
    for (const [channel, magnitude, decay, frequency] of [
      [0, 18000, 1250, 0.043],
      [1, 12000, 800, 0.061],
    ]) {
      for (let i = 0; i < rate; i++) {
        const envelope = Math.exp(-(i % (rate / 2)) / decay);
        period.writeInt16LE(Math.round(magnitude * envelope * Math.cos(frequency * i)), i * stride + channel * 2);
      }
    }
    assert.equal(digest(period), fixtureDigest, 'local stereo fixture oracle');
    for (let i = startFrame; i < endFrame; i++) {
      pcm.writeUInt32LE(period.readUInt32LE((i % rate) * stride), (i - startFrame) * stride);
    }
    return pcm;
  }
  const lock = JSON.parse(await readFile(new URL('./fixtures/mx029-take-source.json', import.meta.url), 'utf8'));
  assert.equal(passage.sourceId, lock.id);
  assert.equal(revision, lock.canonicalSha256, 'expected pinned MX029 revision');
  assert.ok(endFrame <= lock.totalFrames);
  const master = await open(join(process.env.ROOM_TAKE_SOURCE_DIR || '.cache/take-source', 'initial-continuous.pcm'));
  try {
    assert.equal((await master.stat()).size, lock.totalFrames * stride);
    const hash = createHash('sha256');
    for await (const chunk of master.createReadStream({autoClose: false})) hash.update(chunk);
    assert.equal(hash.digest('hex'), lock.canonicalSha256, 'entire continuously decoded master');
    const {bytesRead} = await master.read(pcm, 0, pcm.length, startFrame * stride);
    assert.equal(bytesRead, pcm.length, 'complete positional read');
  } finally {
    await master.close();
  }
  return pcm;
}

async function get(url) {
  const response = await fetch(url, {redirect: 'error', signal: AbortSignal.timeout(30000)});
  assert.equal(response.status, 200, url.href);
  return response;
}

async function inspect(link) {
  const url = new URL(link);
  const id = url.searchParams.get('id');
  assert.match(id, /^[a-f0-9]{32}$/);
  const path = '/v1/takes/' + id;
  const record = await (await get(new URL(path, url))).json();
  assert.equal(record.id, id);
  assert.equal(record.recipe.experiment, 'audio-memory');
  assert.equal(record.recipe.schema, 1);
  assert.equal(record.recipe.rendererVersion, 1);
  assert.equal(record.recipe.gestures.length, 1);
  assert.equal(record.fragments.length, 1);
  const gesture = record.recipe.gestures[0],
    ref = gesture.fragmentRef;
  const {passage} = record.recipe;
  assert.equal(ref.sourceId, passage.sourceId);
  assert.equal(ref.revision, passage.revision);
  assert.ok(Number.isSafeInteger(ref.startFrame) && Number.isSafeInteger(ref.endFrame));
  assert.ok(ref.startFrame >= passage.startFrame && ref.endFrame <= passage.endFrame);
  assert.ok(ref.frameCount >= rate / 4 && ref.frameCount <= rate * 2);
  assert.equal(ref.frameCount, ref.endFrame - ref.startFrame);
  assert.deepEqual(record.fragments[0], {
    ...ref,
    byteLength: ref.frameCount * stride,
    url: path + '/fragments/' + ref.sha256,
  });

  async function bytes(descriptor, suffix, frames) {
    assert.equal(descriptor.url, path + suffix);
    assert.equal(descriptor.sampleRate, rate);
    assert.equal(descriptor.channels, 2);
    assert.equal(descriptor.format, 's16le');
    assert.equal(descriptor.frameCount, frames);
    assert.equal(descriptor.byteLength, frames * stride);
    const audio = Buffer.from(await (await get(new URL(descriptor.url, url))).arrayBuffer());
    assert.equal(audio.length, frames * stride);
    assert.equal(digest(audio), descriptor.sha256, 'downloaded PCM digest: ' + descriptor.url);
    return audio;
  }
  const frames = passage.endFrame - passage.startFrame;
  const [fragment, dry, take] = await Promise.all([
    bytes(record.fragments[0], '/fragments/' + ref.sha256, ref.frameCount),
    bytes(record.dry, '/dry', frames),
    bytes(record.take, '/take', frames),
  ]);
  return {record, gesture, fragment, dry, take};
}

// Independently evaluate the v1 seeded grain picker with unsigned integer
// arithmetic. Each 62.5 ms tick selects one of eight offsets in the capture.
function grainIndex(tick) {
  if (tick === 0) return 0;
  let seed = BigInt(tick) + 0x529an;
  for (let round = 0; round < 2; round++) {
    seed = BigInt.asUintN(32, (seed ^ (seed >> 16n)) * 0x45d9f3bn);
  }
  const choice = Number((seed ^ (seed >> 16n)) >> 29n);
  const scan = Math.min(7, Math.floor((1200 + tick * 3000) / 72000));
  return Math.min(7, Math.max(0, scan + (choice % 3) - 1));
}

function expectedLayer(g, fragment, frames) {
  assert.ok(Number.isInteger(g.startFrame) && g.startFrame >= 0);
  assert.ok(Number.isInteger(g.endFrame) && g.endFrame > g.startFrame && g.endFrame <= frames);
  assert.ok(Number.isInteger(g.density) && g.density >= 1 && g.density <= 8);
  assert.ok(Number.isFinite(g.level) && g.level > 0 && g.level <= 1);
  assert.equal(g.seedVersion, 1);
  const repeat = g.treatment === 'repeat';
  const captureLength = fragment.length / stride;
  const length = repeat ? captureLength : Math.min(9600, captureLength);
  const ticksPerVoice = repeat
    ? Math.ceil((captureLength / 3000) * (1 + (8 - g.density) / 4))
    : Math.ceil(8 / g.density);
  const gain = g.level * (repeat ? 0.5 : 0.36);
  const duration = Math.min(12 * rate, g.endFrame - g.startFrame);
  // Work in signed PCM units. Explicit Float32 window and accumulation steps
  // reproduce v1 rounding independently of its block mixer and planar buffers.
  const wet = new Float32Array(duration * 2);
  const offsets = [];
  for (let tick = 0; ; tick += ticksPerVoice) {
    const onset = 1200 + tick * 3000;
    const played = Math.min(length, duration - onset);
    if (played <= 0 || (tick > 0 && played < length)) break;
    const offset = repeat ? 0 : Math.round(((captureLength - length) * grainIndex(tick)) / 7);
    offsets.push(offset);
    for (let age = 0; age < played; age++) {
      const envelope = repeat
        ? Math.min(1, age / 720, (length - 1 - age) / 720)
        : (1 - Math.cos((2 * Math.PI * age) / (length - 1))) / 2;
      const voiceGain = played < length ? gain * Math.min(1, (played - 1 - age) / 720) : gain;
      for (let ch = 0; ch < 2; ch++) {
        const sample = fragment.readInt16LE((offset + age) * stride + ch * 2);
        wet[(onset + age) * 2 + ch] += Math.fround(sample * envelope) * voiceGain;
      }
    }
  }
  return {wet, offsets};
}

function measure({record, gesture: g, fragment, dry, take}, source) {
  const frames = dry.length / stride;
  const {wet, offsets} = expectedLayer(g, fragment, frames);
  const first = [null, null],
    last = [null, null],
    peak = [0, 0];
  // Verify the entire passage, including silent gaps and the last grain's
  // release. Reconstruct both channels at common gain and the v1 peak guard.
  const guard = Math.floor(0.98 * 32768);
  for (let i = 0; i < frames; i++) {
    for (let ch = 0; ch < 2; ch++) {
      const byte = i * stride + ch * 2;
      const raw = source.readInt16LE(byte),
        d = dry.readInt16LE(byte),
        t = take.readInt16LE(byte);
      assert.equal(d, Math.round(raw / 2) || 0, 'dry PCM sample differs at ' + i + '/' + ch);
      const layer = wet[(i - g.startFrame) * 2 + ch] ?? 0;
      const expected = Math.min(guard, Math.max(-guard, Math.round(Math.fround((raw + layer) / 2)))) || 0;
      if (t !== expected) {
        assert.fail(`wrong ${g.treatment} sample at frame ${i}, channel ${ch}: expected ${expected}, got ${t}`);
      }
      const added = Math.abs(t - d);
      if (added) {
        first[ch] ??= i;
        last[ch] = i;
        peak[ch] = Math.max(peak[ch], added);
      }
    }
  }
  assert.ok(
    peak.every((v) => v > 1),
    'both channels must contain measurable added audio',
  );
  return {
    id: record.id,
    treatment: g.treatment,
    startFrame: g.startFrame,
    endFrame: g.endFrame,
    firstWetFrame: first,
    lastWetFrame: last,
    peakAddedPCM16: peak,
    checkedStereoFrames: frames,
    voiceSourceOffsets: offsets,
    drySha256: digest(dry),
    takeSha256: digest(take),
  };
}

const parent = await inspect(parentLink),
  child = await inspect(childLink);
assert.equal(new URL(parentLink).origin, new URL(childLink).origin);
assert.equal(parent.record.parentId, null);
assert.equal(parent.record.recipe.parentId, null);
assert.equal(child.record.parentId, parent.record.id);
assert.equal(child.record.recipe.parentId, parent.record.id);
assert.notEqual(parent.record.id, child.record.id);
const {passage} = parent.record.recipe;
assert.deepEqual(child.record.recipe.passage, passage);
const g = parent.gesture,
  delta = child.gesture.startFrame - g.startFrame;
assert.equal(g.treatment, 'repeat');
assert.notEqual(delta, 0, 'expected a moved trigger');
assert.deepEqual(child.gesture, {
  ...g,
  treatment: 'dissolve',
  startFrame: g.startFrame + delta,
  endFrame: g.endFrame + delta,
});
const source = await independentPassage(passage);
const ref = g.fragmentRef;
const expected = source.subarray(
  (ref.startFrame - passage.startFrame) * stride,
  (ref.endFrame - passage.startFrame) * stride,
);
for (const {fragment} of [parent, child]) {
  assert.ok(expected.equals(fragment), 'captured interval differs from the independently prepared raw stereo source');
}
assert.ok(parent.dry.equals(child.dry), 'variation changed the dry passage');
assert.ok(!parent.take.equals(child.take), 'variation did not change the performed layer');
const a = measure(parent, source),
  b = measure(child, source);
for (const ch of [0, 1]) {
  assert.equal(Math.sign(b.firstWetFrame[ch] - a.firstWetFrame[ch]), Math.sign(delta), 'measured onset must move');
}
console.log(
  JSON.stringify(
    {passage, fragment: {...ref, sha256: digest(expected)}, triggerDelta: delta, parent: a, child: b},
    null,
    2,
  ),
);
