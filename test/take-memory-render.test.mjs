import test from 'node:test';
import assert from 'node:assert/strict';
import {captureFragment, verifyFragmentBytes} from '../src/experiences/takes/fragment-asset.mjs';
import {editGesture, forkTake} from '../src/experiences/takes/edits.mjs';
import {normalizeRecipe} from '../src/experiences/takes/recipe.mjs';
import {renderTake} from '../src/experiences/takes/render.mjs';

const rate = 48000, count = 72000;
const passage = {sourceId: 'MX029', revision: 'test', startFrame: 84000, endFrame: 84000 + count};
const pcm = new Uint8Array(count * 4), view = new DataView(pcm.buffer);
for (let i = 0; i < count; i++) {
  view.setInt16(i * 4, (i % 12000) % 343 * 20 - 3000, true);
  view.setInt16(i * 4 + 2, (i % 12000) % 127 * 70 - 4000, true);
}
const source = {pcm, frameCount: count, channels: 2, sampleRate: rate, format: 's16le'};
const {ref, pcm: captured} = await captureFragment(source, passage, passage.startFrame + 12000, 12000);
const materials = new Map([[ref.sha256, captured]]);
const trigger = {id: 'first', startFrame: 1000, endFrame: 49000, fragmentRef: ref,
  treatment: 'repeat', density: 8, level: 1, seedVersion: 1};
const recipe = {schema: 1, experiment: 'audio-memory', rendererVersion: 1, passage, gestures: [trigger], parentId: null};
function wet(draft) {
  const {dry, take} = renderTake(draft, source, materials);
  const d = new DataView(dry.buffer), t = new DataView(take.buffer);
  return Int32Array.from({length: count * 2}, (_, i) => t.getInt16(i * 2, true) - d.getInt16(i * 2, true));
}

test('move shifts the stereo layer sample-for-sample, retreatment and level preserve capture', async () => {
  const original = wet(recipe), delta = 5000;
  const moved = editGesture(recipe, {type: 'move', id: 'first', startFrame: trigger.startFrame + delta});
  const shifted = wet(moved);
  assert.ok(original.some(x => x > 500));
  assert.deepEqual(shifted.slice(delta * 2), original.slice(0, -delta * 2));
  assert.ok(shifted.slice(0, delta * 2).every(x => x === 0));
  for (const settings of [{treatment: 'dissolve'}, {level: .25}]) {
    const changed = editGesture(moved, {type: 'update', id: 'first', ...settings});
    assert.notDeepEqual(wet(changed), shifted);
    assert.deepEqual(changed.gestures[0].fragmentRef, ref);
    assert.deepEqual((await verifyFragmentBytes(ref, passage, captured)).pcm, captured);
  }
  assert.equal(recipe.gestures[0].startFrame, 1000);
});

test('no-edit fork preserves both references and same-digest distinct capture coordinates', () => {
  const next = {...ref, startFrame: ref.endFrame, endFrame: ref.endFrame + ref.frameCount};
  const draft = editGesture(recipe, {type: 'add', gesture: {...trigger, id: 'second', fragmentRef: next}});
  const child = forkTake({id: 'saved', recipe: draft});
  assert.deepEqual(child.gestures.map(g => g.fragmentRef), [ref, next]);
  assert.deepEqual(renderTake(child, source, materials), renderTake(draft, source, materials));
});

test('memory rejects unknown versions, out-of-range controls and absent material', () => {
  for (const fields of [{density: 2.5}, {density: 0}, {density: 9}, {level: 1.1}, {level: NaN},
    {treatment: 'scrub'}, {seedVersion: 2}, {endFrame: count + 1}]) {
    assert.throws(() => normalizeRecipe({...recipe, gestures: [{...trigger, ...fields}]}));
  }
  assert.throws(() => renderTake(recipe, source), /material/i);
});

test('independent trigger schedule survives seek, render block size and interruption', async () => {
  const {createMemoryRender, memorySchedule} = await import('../src/experiences/takes/memory-render.mjs');
  for (const treatment of ['repeat', 'dissolve']) {
    const gestures = [trigger, {...trigger, id: 'second', startFrame: 7001, endFrame: 55001, treatment}];
    const events = memorySchedule(gestures, count);
    assert.equal(events[0].startFrame, trigger.startFrame + 1200);
    assert.equal(events.find(e => e.gestureId === 'second').startFrame, 8201);
    assert.ok(events.every(e => e.endFrame <= gestures.find(g => g.id === e.gestureId).endFrame));
    const collect = (size, start) => {
      const engine = createMemoryRender(gestures, count, materials);
      engine.seek(start);
      const l = new Float32Array(count - start), r = new Float32Array(count - start);
      for (let i = 0; i < l.length; i += size) engine.processBlock(undefined, undefined, undefined, undefined, l, r, i, Math.min(l.length, i + size));
      engine.seek(5000);
      engine.dispose();
      engine.processBlock(undefined, undefined, undefined, undefined, l, r, 0, 1);
      assert.equal(l[0], 0);
      return [l.slice(1), r.slice(1)];
    };
    const whole = collect(128, 0), afterSeek = collect(777, 8000);
    whole.forEach((ch, i) => assert.deepEqual(afterSeek[i], ch.slice(8000)));
  }
  const {memorySchedule: schedule} = await import('../src/experiences/takes/memory-render.mjs');
  assert.throws(() => schedule(Array.from({length: 17}, (_, i) => ({...trigger, id: String(i)})), count), /voices/i);
});

test('full-length Memory uses the 12-second cap, free-time grid and bounded grain bank', async () => {
  const {memorySchedule} = await import('../src/experiences/takes/memory-render.mjs');
  const long = {...trigger, startFrame: 500, endFrame: 15 * rate, treatment: 'dissolve'};
  const dense = memorySchedule([long], 18 * rate);
  assert.ok(dense.at(-1).endFrame <= long.startFrame + 12 * rate);
  assert.ok(dense.at(-1).endFrame > long.startFrame + 11.9 * rate);
  assert.equal(dense[0].grain, 0);
  assert.equal(new Set(dense.map(e => e.grain)).size, 8);
  assert.ok(dense.every((e, i) => e.startFrame === 1700 + 3000 * i && e.endFrame - e.startFrame === 9600));
  const sparse = memorySchedule([{...long, density: 1}], rate);
  assert.ok(sparse.every((e, i) => e.startFrame === 1700 + 24000 * i && e.endFrame <= rate));
});
