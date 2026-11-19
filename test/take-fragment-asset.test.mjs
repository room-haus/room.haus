import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as service from '../services/takes/passage.mjs';

const passage = {sourceId: 'mx029', revision: 'fixture', startFrame: 6000, endFrame: 30000};
const ref = {...passage, endFrame: 18000, frameCount: 12000, channels: 2, sampleRate: 48000,
  format: 's16le', sha256: 'b72a5e603ef9b3c51ab6d585861560c13cde38d561b04c6d511344863ebbdad6'};

// Independent interleaved LE fixture. The same sequence appears twice in MX029.
function fixture() {
  const raw = Buffer.alloc(48000);
  raw.writeInt16LE(-12488, 0);
  raw.writeInt16LE(21947, 23998);
  raw.writeInt16LE(783, 47996);
  const body = Buffer.concat([raw, raw]);
  const whole = Buffer.concat([Buffer.alloc(24000), body]);
  const chunks = new Map();
  const catalog = [{id: passage.sourceId, revision: passage.revision, sampleRate: 48000,
    channels: 2, totalFrames: 30000, chunks: [[0,12001],[12001,17999]].map(([startFrame, frameCount]) => {
      const bytes = whole.subarray(startFrame * 4, (startFrame + frameCount) * 4);
      const sha256 = createHash('sha256').update(bytes).digest('hex');
      chunks.set(sha256, bytes);
      return {sha256, startFrame, frameCount};
    })}];
  return {raw, source: {pcm: body, channels: 2, format: 's16le', sampleRate: 48000, frameCount: 24000},
    catalog, store: {readChunk: hash => chunks.get(hash)}};
}
const asset = () => import('../src/experiences/takes/fragment-asset.mjs');

test('capture freezes the complete stereo fixture and distinguishes provenance for identical bytes', async () => {
  const {captureFragment} = await asset();
  const {source, raw} = fixture();
  const pending = captureFragment(source, passage, 18000, 12000);
  source.pcm.fill(0, 0, 48000);
  const first = await pending;
  assert.deepEqual(first.ref, ref);
  assert.deepEqual(Buffer.from(first.pcm), raw);
  const second = await captureFragment(source, passage, 30000, 12000);
  assert.deepEqual(second.ref, {...ref, startFrame: 18000, endFrame: 30000});
  assert.deepEqual(second.pcm, first.pcm);
});

test('service reconstructs across the chunk boundary and validates durable parent material', async () => {
  const {verifyFragmentBytes} = await asset();
  const {catalog, store, raw} = fixture();
  const fresh = await service.reconstructFragment(catalog, passage, ref, store);
  assert.deepEqual(Buffer.from(fresh.pcm), raw);
  assert.deepEqual(fresh.ref, ref);
  const inherited = await verifyFragmentBytes(ref, passage, raw);
  raw.fill(0);
  assert.deepEqual(inherited, fresh);
  await assert.rejects(verifyFragmentBytes(ref, passage, inherited.pcm.subarray(4)), /length/i);
  const corrupt = Buffer.from(inherited.pcm);
  corrupt[1] ^= 1;
  await assert.rejects(verifyFragmentBytes(ref, passage, corrupt), /digest/i);
});

test('source format, complete bounds, silence, provenance and content digest are checked independently', async () => {
  const {captureFragment} = await asset();
  const {catalog, store, source} = fixture();
  for (const change of [{format:'f32le'}, {channels:1}, {sampleRate:44100}, {frameCount:24001},
    {pcm:source.pcm.subarray(4)}, {pcm:Buffer.alloc(96000)}]) {
    await assert.rejects(captureFragment({...source,...change}, passage, 18000, 12000));
  }
  for (const [end, length] of [[18000,'12000'], [17999,12000], [18000,11999], [30001,12000], [18000,96001]]) {
    await assert.rejects(captureFragment(source, passage, end, length));
  }
  for (const change of [{format:'f32le'}, {channels:1}, {sampleRate:44100}, {frameCount:11999},
    {sourceId:'other'}, {revision:'other'}, {startFrame:5999}, {endFrame:30001}, {sha256:'f'.repeat(64)}]) {
    await assert.rejects(service.reconstructFragment(catalog, passage, {...ref,...change}, store));
  }
});

async function device(t, {rate = 44100, latencyFrames = 0, timestamp = true} = {}) {
  const {TakeTransport} = await import('../src/experiences/takes/transport.ts');
  const {source} = fixture();
  const frames = 6 * 48000;
  const bytes = new Uint8Array(frames * 4);
  bytes.set(source.pcm);
  let ctx, wall = 0, error;
  const node = () => ({gain:{}, connect(){}, disconnect(){}, start(){}, stop(){}});
  const classes = {
    AudioContext: class {
      currentTime = 0; sampleRate = rate; state = 'running';
      baseLatency = .02; outputLatency = .03;
      getOutputTimestamp = timestamp ? () => ({contextTime: Math.max(0, this.currentTime - latencyFrames / rate), performanceTime: wall}) : undefined;
      constructor() { ctx = this; }
      createGain = node; createBufferSource = node;
      audioWorklet = {addModule: async () => {}};
      async resume() {} async close() {}
    },
    AudioBuffer: class {
      constructor({length}) { this.data = new Float32Array(length); }
      getChannelData() { return this.data; }
    },
    AudioWorkletNode: class {port = {close(){}}; connect(){} disconnect(){}},
  };
  for (const [name, value] of Object.entries(classes)) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, {value, configurable:true});
    t.after(() => previous ? Object.defineProperty(globalThis, name, previous) : delete globalThis[name]);
  }
  t.mock.method(performance, 'now', () => wall);
  const transport = new TakeTransport({passage:{...passage,endFrame:passage.startFrame+frames},gestures:[]},
    bytes.buffer, true, 0, {update(){},finish(_gestures, message){ error = message; }});
  await transport.start();
  transport.armRecent();
  return {transport, ctx, error:() => error, advance(outputFrames, extraWall = 0) {
    ctx.currentTime += outputFrames / ctx.sampleRate;
    wall += outputFrames / ctx.sampleRate * 1000 + extraWall;
  }};
}

test('44.1 kHz output captures the same 48 kHz interval, starting only after scheduled listening', async t => {
  const {transport, advance} = await device(t);
  advance(5292); // 120 ms scheduled lead.
  assert.equal(transport.recentFrames(), 0);
  advance(11024);
  await assert.rejects(transport.captureRecent(12000), /listen/i);
  advance(1);
  const captured = await transport.captureRecent(12000);
  assert.deepEqual(captured.ref, ref);
  advance(44100 * 4);
  assert.equal(transport.recentFrames(), 48000 * 4);
  transport.end();
  assert.equal(transport.recentFrames(), 0);
});

test('a disposed source or discontinuous clock during a pending hash invalidates the capture', async t => {
  const {transport, advance} = await device(t);
  advance(5292 + 11025);
  const pending = transport.captureRecent(12000);
  transport.dispose(); // seek, passage replacement and closing release the old source
  await assert.rejects(pending, /interrupt|stale/i);
  assert.equal(transport.recentFrames(), 0);
});

test('a clock stall between capture and hash completion rejects the old material', async t => {
  const {transport, advance, error} = await device(t);
  advance(5292 + 11025);
  const pending = transport.captureRecent(12000);
  advance(0, 500);
  await assert.rejects(pending, /interrupt|stale/i);
  assert.match(error(), /clock/i);
  assert.equal(transport.recentFrames(), 0);
});

for (const [rate, cursor, expected] of [[44100, 6027, 800], [48000, 5761, 1]]) {
  test('presented hardware frames map exactly to source frames at ' + rate, async t => {
    const latencyFrames = 1024;
    const {transport, advance} = await device(t, {rate, latencyFrames});
    advance(cursor + latencyFrames);
    assert.equal(transport.recentFrames(), expected);
    transport.dispose();
  });
}

test('fallback capture cursor accounts for reported graph and device latency', async t => {
  const {transport, advance} = await device(t, {rate:48000, timestamp:false});
  advance(5760 + 2400 + 12000);
  assert.deepEqual((await transport.captureRecent(12000)).ref, ref);
  transport.dispose();
});

for (const stall of ['render', 'presentation']) {
  test('short polls during a cumulative ' + stall + ' stall invalidate a pending capture', async t => {
    const {transport, ctx, advance, error} = await device(t);
    advance(5292 + 11025);
    const pending = transport.captureRecent(12000);
    const timestamp = ctx.getOutputTimestamp();
    if (stall === 'presentation') ctx.getOutputTimestamp = () => timestamp;
    for (let poll = 0; poll < 9; poll++) {
      if (stall === 'render') advance(0, 50);
      else advance(2205);
      transport.checkClock();
    }
    await assert.rejects(pending, /interrupt|stale/i);
    assert.match(error(), /clock/i);
    assert.equal(transport.recentFrames(), 0);
  });
}
