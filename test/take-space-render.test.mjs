import assert from 'node:assert/strict';
import test from 'node:test';
import {SPACE_TAKE_DEFAULTS} from '../src/experiences/takes/recipe.mjs';
import {TAKE_SOURCE_SAMPLE_RATE as RATE} from '../src/experiences/takes/source.mjs';

const settings = {...SPACE_TAKE_DEFAULTS, delayFrames: 4800, feedback: 0.4, wetLevel: 1, stereoWidth: 1};
const length = RATE * 2;
const middle = 28_800;
const before = middle - 1;
const after = 36_000;
const gesture = {id: 'throw', startFrame: middle, endFrame: after, settings};
const recipe = {
  schema: 1, experiment: 'audio-space', rendererVersion: 1, parentId: null,
  passage: {sourceId: 'mx029', revision: 'fixture', startFrame: 120_000, endFrame: 120_000 + length},
  initialSettings: settings, gestures: [gesture],
};

function sourceFor(impulses = [before, middle, after], frameCount = length) {
  const pcm = new Uint8Array(frameCount * 4);
  const data = new DataView(pcm.buffer);
  for (const frame of impulses) {
    data.setInt16(frame * 4, 24_576, true);
    data.setInt16(frame * 4 + 2, 8192, true);
  }
  return {pcm, sampleRate: RATE, channels: 2, frameCount, format: 's16le'};
}

function sample(pcm, frame, channel) {
  return new DataView(pcm.buffer, pcm.byteOffset, pcm.byteLength).getInt16(frame * 4 + channel * 2, true);
}

test('the send is half-open and never removes dry audio at either edge', async () => {
  const {renderTake} = await import('../src/experiences/takes/render.mjs');
  const rendered = renderTake(recipe, sourceFor());
  const isolated = renderTake(recipe, sourceFor([middle]));
  for (const frame of [before, middle, after]) {
    assert.equal(sample(rendered.dry, frame, 0), 12_288);
    assert.equal(sample(rendered.dry, frame, 1), 4096);
    for (const channel of [0, 1]) {
      assert.equal(sample(rendered.take, frame, channel), sample(rendered.dry, frame, channel));
    }
  }
  for (let byte = 0; byte < rendered.take.length; byte += 2) {
    const frame = Math.floor(byte / 4);
    const channel = (byte / 2) % 2;
    assert.equal(sample(rendered.take, frame, channel) - sample(rendered.dry, frame, channel),
      sample(isolated.take, frame, channel) - sample(isolated.dry, frame, channel));
  }
});

test('left and right taps retain the calibrated delay and feedback after release', async () => {
  const {renderTake} = await import('../src/experiences/takes/render.mjs');
  const rendered = renderTake(recipe, sourceFor([middle]));
  const leftTap = middle + 4800;
  const rightTap = middle + 5184;
  assert.equal(sample(rendered.take, leftTap - 1, 0), 0);
  assert.ok(sample(rendered.take, leftTap, 0) > sample(rendered.take, leftTap, 1));
  assert.ok(sample(rendered.take, rightTap, 1) > sample(rendered.take, rightTap, 0));
  assert.ok(middle + 2 * settings.delayFrames > gesture.endFrame);
  assert.ok(sample(rendered.take, middle + 2 * settings.delayFrames + 4, 0) > 50);
  assert.ok(rendered.measurements.returnRms > 0);
});

test('an out point inside an echo cuts both outputs to the exact source range', async () => {
  const {renderTake} = await import('../src/experiences/takes/render.mjs');
  const frameCount = middle + settings.delayFrames + 4;
  const passage = {...recipe.passage, endFrame: recipe.passage.startFrame + frameCount};
  const gestures = [{...gesture, endFrame: middle + 1}];
  const rendered = renderTake({...recipe, passage, gestures}, sourceFor([middle], frameCount));
  assert.equal(rendered.frameCount, frameCount);
  assert.equal(rendered.sampleRate, RATE);
  assert.equal(rendered.channels, 2);
  assert.equal(rendered.format, 's16le');
  assert.equal(rendered.dry.byteLength, frameCount * 4);
  assert.equal(rendered.take.byteLength, frameCount * 4);
  assert.ok(sample(rendered.take, frameCount - 1, 0) > 0);
});

test('empty and zero-level gestures give a sample-identical comparison', async () => {
  const {renderTake} = await import('../src/experiences/takes/render.mjs');
  for (const gestures of [[], [{...gesture, settings: {...settings, wetLevel: 0}}]]) {
    const rendered = renderTake({...recipe, gestures}, sourceFor());
    assert.deepEqual(rendered.dry, rendered.take);
    assert.deepEqual(rendered.measurements, {dryPeak: 0.375, takePeak: 0.375, returnRms: 0});
  }
});

test('aligned tails can trigger the same fixed output ceiling without changing dry gain', async () => {
  const {renderTake} = await import('../src/experiences/takes/render.mjs');
  const impulses = Array.from({length: 11}, (_, i) => 4800 * (i + 1));
  const syncFrame = 62_400;
  const gestures = impulses.map((startFrame, i) => ({
    id: `throw-${i}`, startFrame, endFrame: startFrame + 1,
    settings: {...settings, delayFrames: syncFrame - startFrame, feedback: 0},
  }));
  const rendered = renderTake({...recipe, gestures}, sourceFor([...impulses, syncFrame + 2]));
  assert.equal(rendered.measurements.dryPeak, 0.375);
  assert.equal(rendered.measurements.takePeak, Math.floor(0.98 * 32768) / 32768);
  assert.equal(sample(rendered.take, syncFrame + 2, 0), Math.floor(0.98 * 32768));
  assert.equal(sample(rendered.dry, syncFrame + 2, 0), 12_288);
});

test('version one rejects PCM that does not match the selected source frames and format', async () => {
  const {renderTake} = await import('../src/experiences/takes/render.mjs');
  const source = sourceFor();
  assert.throws(() => renderTake(recipe, {...source, frameCount: length - 1}), /PCM/);
  assert.throws(() => renderTake(recipe, {...source, pcm: source.pcm.subarray(1)}), /PCM/);
  assert.throws(() => renderTake(recipe, {...source, sampleRate: 44_100}), /PCM/);
});

test('different block partitions produce the same canonical stereo PCM', async () => {
  const {renderTake} = await import('../src/experiences/takes/render.mjs');
  const {createSpaceRender} = await import('../src/experiences/takes/space-render.mjs');
  const source = sourceFor([...Array.from({length: 49}, (_, i) => middle + 117 * i), before, after]);
  const rendered = renderTake(recipe, source);
  const input = new DataView(source.pcm.buffer);
  const asFloat = channel => Float32Array.from({length}, (_, i) => input.getInt16(i * 4 + channel * 2, true) / 32768);
  const [left, right] = [asFloat(0), asFloat(1)];

  for (const blockSizes of [[1], [127, 2, 1024, 11], [length]]) {
    const engine = createSpaceRender(RATE, 1, length, recipe.gestures);
    const [dryLeft, dryRight, takeLeft, takeRight] = Array.from({length: 4}, () => new Float32Array(length));
    let block = 0;
    for (let start = 0; start < length; ) {
      const end = Math.min(length, start + blockSizes[block++ % blockSizes.length]);
      engine.processBlock(left, right, dryLeft, dryRight, takeLeft, takeRight, start, end);
      start = end;
    }
    for (const [expected, channels] of [[rendered.dry, [dryLeft, dryRight]], [rendered.take, [takeLeft, takeRight]]]) {
      const pcm = new DataView(expected.buffer);
      for (let i = 0; i < length; i++) {
        assert.equal(Math.round(channels[0][i] * 32768) + 0, pcm.getInt16(i * 4, true));
        assert.equal(Math.round(channels[1][i] * 32768) + 0, pcm.getInt16(i * 4 + 2, true));
      }
    }
  }
});

test('live open and close keep past audio intact and use the released gate for later blocks', async () => {
  const {renderTake} = await import('../src/experiences/takes/render.mjs');
  const {createSpaceRender} = await import('../src/experiences/takes/space-render.mjs');
  const source = sourceFor();
  const output = renderTake(recipe, source);
  const engine = createSpaceRender(RATE, 1, length, []);
  const left = new Float32Array(length);
  const right = new Float32Array(length);
  for (const frame of [before, middle, after]) {
    left[frame] = 0.75;
    right[frame] = 0.25;
  }
  const takeLeft = new Float32Array(length);
  const takeRight = new Float32Array(length);
  const process = (from, to) => engine.processBlock(left, right, undefined, undefined, takeLeft, takeRight, from, to);
  process(0, middle - 1024);
  assert.throws(() => engine.open({...gesture, startFrame: 3}), /late/i);
  engine.open({...gesture, endFrame: length});
  assert.throws(() => engine.open({...gesture, id: 'overlap'}), /overlap/i);
  process(middle - 1024, middle + 1024);
  assert.throws(() => engine.close(gesture.id, middle + 25), /late/i);
  engine.close(gesture.id, after);
  process(middle + 1024, length);
  const pcm = new DataView(output.take.buffer);
  for (let i = 0; i < length; i++) {
    assert.equal(Math.round(takeLeft[i] * 32768) + 0, pcm.getInt16(i * 4, true));
    assert.equal(Math.round(takeRight[i] * 32768) + 0, pcm.getInt16(i * 4 + 2, true));
  }
});
