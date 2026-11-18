import assert from 'node:assert/strict';
import test from 'node:test';
import {emptyAudioFrame} from '../src/experiences/underlevel/audio/FeatureExtractor.ts';
import {RallySimulation} from '../src/experiences/endless-rally/RallySimulation.ts';
import * as geometry from '../src/experiences/endless-rally/geometry.ts';
const frame = (i, extra = {}) => ({
  dt: 1 / 60,
  simTime: i / 60,
  mediaTime: i / 60,
  features: emptyAudioFrame(),
  featureSequence: i,
  source: 'ambient',
  mode: 'watch',
  motion: 1,
  reducedMotion: false,
  ...extra,
});
function simulation(initial = {}) {
  return new RallySimulation(29, initial);
}
function run(sim, n, extra = {}) {
  for (let i = 0; i < n; i++) sim.step(frame(i, extra));
  return sim.snapshot();
}
const ball = (x, z, vx, vz) => ({x, z, vx, vz});
test('swept wall, paddle and bumper contacts reflect without tunnelling', () => {
  for (const [initial, axis, sign] of [
    [ball(1.89, 0, 2.4, 0), 'vx', -1],
    [ball(0, 2.49, 0, 2.4), 'vz', -1],
    [ball(0.75, -0.41, 0, 2.4), 'vz', -1],
  ]) {
    const s = simulation({ball: initial, speed: 2.4});
    const out = s.step(frame(0));
    assert.ok(out.ball[axis] * sign > 0);
    assert.equal(out.phase, 'rally');
    assert.ok(out.collisionSequence > 0);
  }
});
test('open goal misses recover in 1.2 seconds while intercepted balls reflect', () => {
  const s = simulation({ball: ball(1.8, 3.09, 0, 2.4), speed: 2.4});
  assert.equal(s.step(frame(0)).phase, 'returning');
  assert.equal(run(s, 72).phase, 'rally');
  assert.equal(s.snapshot().invalidRecoveries, 0);
  const hit = simulation({ball: ball(0.3, 2.49, 0, 2.4), speed: 2.4});
  const out = hit.step(frame(0));
  assert.equal(out.phase, 'rally');
  assert.ok(out.ball.vz < 0);
  assert.ok(Math.abs(out.ball.vz) >= Math.hypot(out.ball.vx, out.ball.vz) * 0.35);
  assert.ok(out.ball.vx > 0);
  assert.ok(Math.hypot(out.ball.vx, out.ball.vz) <= 2.4);
});
test('shared prediction is bounded, sees wall/bumper rebounds and never mutates snapshots', () => {
  const s = simulation({ball: ball(1.8, 1.5, 1, 1), speed: 1.5});
  const before = structuredClone(s.snapshot());
  const result = s.predict('near');
  assert.ok(Number.isFinite(result.x));
  assert.ok(result.contacts <= 8);
  assert.ok(result.time <= 2);
  assert.deepEqual(s.snapshot(), before);
  const miss = simulation({ball: ball(0, 0, 0, -0.6)}).predict('near');
  assert.equal(miss.x, null);
});
test('corner fixtures and overlapping geometry terminate within the contact budget', () => {
  assert.ok(geometry?.advanceBall, 'shared bounded geometry is available');
  const paddles = {near: {x: 1.35, velocity: 0}, far: {x: 0, velocity: 0}};
  const corner = geometry.advanceBall(ball(1.89, 2.49, 2, 2), paddles, 0.02);
  assert.ok(corner.ball.vx < 0 && corner.ball.vz < 0);
  assert.ok(corner.events.length <= 4);
  const trapped = geometry.advanceBall(ball(0.75, 0, 1, 0), paddles, 1);
  assert.ok(trapped.events.length <= 4);
  assert.ok(Object.values(trapped.ball).every(Number.isFinite));
  const fast = geometry.advanceBall(ball(0, 1, 1e6, 0), paddles, 1);
  assert.equal(fast.trapped, true);
  assert.equal(fast.events.length, 4);
});
test('stalled and nonfinite balls recover with distinct diagnostics', () => {
  const stalled = simulation({ball: ball(0, 0, 0, 0)});
  run(stalled, 120);
  assert.equal(stalled.snapshot().phase, 'returning');
  assert.equal(run(stalled, 72).phase, 'rally');
  assert.equal(stalled.snapshot().invalidRecoveries, 0);
  const invalid = simulation({ball: ball(NaN, 0, 0, 1)});
  assert.equal(invalid.step(frame(0)).phase, 'returning');
  assert.equal(invalid.snapshot().invalidRecoveries, 1);
  assert.equal(run(invalid, 72).phase, 'rally');
});
test('absolute slider and held drag control near paddle; Watch blends without snapping', () => {
  const s = simulation();
  assert.equal(s.act({type: 'set-value', control: 'paddle-position', value: 1}), true);
  assert.equal(s.snapshot().manualTarget, 1.35);
  assert.equal(s.snapshot().grabbedId, null);
  run(s, 60, {mode: 'control'});
  assert.ok(s.snapshot().near.x > 1);
  const before = s.snapshot().near.x;
  s.step(frame(61));
  assert.ok(Math.abs(s.snapshot().near.x - before) <= 0.05);
  assert.ok(s.snapshot().controlWeight > 0);
  run(s, 90);
  assert.equal(s.snapshot().controlWeight, 0);
  assert.equal(s.act({type: 'grab', targetId: 'near-paddle', x: -1, y: 0}), true);
  run(s, 200);
  assert.equal(s.snapshot().controlWeight, 1);
  assert.ok(s.snapshot().near.x < -1);
  s.act({type: 'release'});
  assert.equal(s.snapshot().grabbedId, null);
  assert.equal(s.act({type: 'move', x: 1, y: 0}), false);
  assert.equal(s.act({type: 'set-value', control: 'paddle-position', value: NaN}), false);
});
test('nudge cooldown is simulation-time based and unavailable while returning or inactive', () => {
  const s = simulation();
  assert.equal(s.act({type: 'command', command: 'nudge-ball'}), true);
  assert.equal(s.act({type: 'command', command: 'nudge-ball'}), false);
  run(s, 121);
  assert.equal(s.act({type: 'command', command: 'nudge-ball'}), true);
  s.step(frame(122, {source: 'inactive'}));
  assert.equal(s.act({type: 'command', command: 'nudge-ball'}), false);
  const returning = simulation({ball: ball(1.8, 3.09, 0, 2.4)});
  returning.step(frame(0));
  assert.equal(returning.act({type: 'command', command: 'nudge-ball'}), false);
});
test('host autonomy blends manual authority once and held drag retains authority', () => {
  const s = simulation();
  s.act({type: 'set-value', control: 'paddle-position', value: 1});
  s.step(frame(0, {mode: 'control', autonomy: 0.5}));
  assert.equal(s.snapshot().controlWeight, 0.5);
  for (let i = 1; i <= 45; i++) s.step(frame(i, {mode: i === 45 ? 'watch' : 'control', autonomy: 0.5 + i / 90}));
  assert.equal(s.snapshot().controlWeight, 0);
  s.act({type: 'grab', targetId: 'near-paddle', x: -1, y: 0});
  s.step(frame(46, {mode: 'watch', autonomy: 1}));
  assert.equal(s.snapshot().controlWeight, 1);
});
test('invalid features stay neutral and live travel speed eases over four seconds', () => {
  const a = simulation(),
    b = simulation();
  run(a, 300, {
    source: 'live',
    features: {
      ...emptyAudioFrame(),
      available: true,
      playing: true,
      intensity: NaN,
      bass: Infinity,
      onset: NaN,
      brightness: NaN,
      high: NaN,
    },
  });
  run(b, 300, {source: 'live', features: {...emptyAudioFrame(), available: true, playing: true}});
  assert.deepEqual(a.snapshot(), b.snapshot());
  const loud = simulation();
  run(loud, 240, {source: 'live', features: {...emptyAudioFrame(), available: true, playing: true, intensity: 1}});
  assert.ok(Math.abs(loud.snapshot().speed - 2.068908503) < 1e-8);
});
test('nudge enters Control without taking paddle ownership and Gentle caps its deflection', () => {
  const s = simulation();
  s.act({type: 'command', command: 'nudge-ball'});
  s.step(frame(0, {mode: 'control', autonomy: 0}));
  assert.equal(s.snapshot().controlWeight, 0);
  const normal = simulation(),
    gentle = simulation();
  gentle.step(frame(0, {reducedMotion: true}));
  normal.step(frame(0));
  const beforeNormal = Math.atan2(normal.snapshot().ball.vx, normal.snapshot().ball.vz),
    beforeGentle = Math.atan2(gentle.snapshot().ball.vx, gentle.snapshot().ball.vz);
  normal.act({type: 'command', command: 'nudge-ball'});
  gentle.act({type: 'command', command: 'nudge-ball'});
  const angle = (s) => Math.atan2(s.snapshot().ball.vx, s.snapshot().ball.vz);
  assert.ok(Math.abs(angle(gentle) - beforeGentle) < Math.abs(angle(normal) - beforeNormal));
});
test('return path travels outside the court before continuously reaching the serve', () => {
  const s = simulation({ball: ball(1.8, 3.09, 0, 2.4)});
  s.step(frame(0));
  run(s, 36);
  assert.ok(s.snapshot().ball.x > 2.1);
  assert.ok(s.snapshot().ball.z > 0 && s.snapshot().ball.z < 3.3);
  let prior = {...s.snapshot().ball};
  for (let i = 0; i < 36; i++) {
    s.step(frame(i));
    assert.ok(Math.hypot(s.snapshot().ball.x - prior.x, s.snapshot().ball.z - prior.z) < 0.3);
    prior = {...s.snapshot().ball};
  }
  assert.equal(s.snapshot().phase, 'rally');
  assert.ok(Math.abs(s.snapshot().ball.x) < 1e-8);
});
test('selection is allowed frozen and reset playhead deterministically changes the serve', () => {
  const s = simulation();
  s.step(frame(0, {source: 'inactive'}));
  assert.equal(s.act({type: 'select', targetId: 'near-paddle'}), true);
  const a = simulation(),
    b = simulation();
  a.reset(29, 20, 'seek');
  b.reset(29, 20, 'seek');
  assert.deepEqual(a.snapshot(), b.snapshot());
  const earlier = simulation();
  earlier.reset(29, 10, 'seek');
  assert.notDeepEqual(a.snapshot().ball, earlier.snapshot().ball);
});
test('equal-time wall and goal resolves solid first and prediction stops at eight contacts', () => {
  const paddles = {near: {x: 0, velocity: 0}, far: {x: 0, velocity: 0}};
  const result = geometry.advanceBall(ball(1.89, 3.09, 1, 1), paddles, 0.02);
  assert.deepEqual(
    result.events.map((e) => e.kind),
    ['wall', 'goal'],
  );
  assert.equal(result.goal, 'near');
  assert.ok(result.ball.vz > 0);
  const prediction = geometry.predictIntercept(ball(0, 1, 100, 0.01), paddles, 'near');
  assert.equal(prediction.contacts, 8);
  assert.equal(prediction.x, null);
  assert.ok(prediction.time < 2);
});
test('cached onsets accent once; frozen recovery state is exact; seek clears impacts', () => {
  const s = simulation();
  const features = {...emptyAudioFrame(), available: true, playing: true, onset: 1};
  run(s, 120, {source: 'live', features, featureSequence: 4});
  assert.equal(s.snapshot().onsetAccents, 1);
  const before = structuredClone(s.snapshot());
  run(s, 20, {source: 'inactive'});
  assert.deepEqual(s.snapshot(), before);
  s.reset(29, 80, 'seek');
  assert.equal(s.snapshot().collisionSequence, 0);
  assert.equal(s.snapshot().onsetAccents, 0);
  const returning = simulation({ball: ball(1.8, 3.09, 0, 2.4)});
  returning.step(frame(0));
  const frozen = structuredClone(returning.snapshot());
  run(returning, 100, {motion: 0});
  assert.deepEqual(returning.snapshot(), frozen);
  const gentle = simulation();
  run(gentle, 120, {source: 'live', features, reducedMotion: true});
  assert.equal(gentle.snapshot().onsetAccents, 0);
  assert.equal(gentle.snapshot().speed, 0.6);
});
test('same seed and inputs reproduce collision and recovery outcomes independently of snapshots', () => {
  const a = simulation(),
    b = simulation();
  for (let i = 0; i < 3000; i++) {
    a.step(frame(i));
    b.step(frame(i));
    if (i % 7 === 0) b.snapshot();
  }
  assert.deepEqual(a.snapshot(), b.snapshot());
});
test('inactive samples cannot replay an onset and Gentle collisions suppress elastic squash', () => {
  const s = simulation();
  const features = {...emptyAudioFrame(), playing: true, available: true, onset: 1};
  s.step(frame(0, {source: 'inactive', featureSequence: 9, features}));
  s.step(frame(1, {source: 'live', featureSequence: 9, features}));
  assert.equal(s.snapshot().onsetAccents, 0);
  const gentle = simulation({ball: ball(0.75, -0.401, 0, 0.6)});
  gentle.step(frame(0, {reducedMotion: true}));
  assert.ok(gentle.snapshot().collisionSequence > 0);
  assert.equal(gentle.snapshot().bumperCompression, 0);
});
test('30-minute passive soak keeps one finite bounded ball and no invalid recovery', () => {
  const s = simulation();
  for (let i = 0; i < 108000; i++) {
    const out = s.step(
      frame(i, {
        source: 'live',
        features: {...emptyAudioFrame(), playing: true, available: true, intensity: 1, bass: 1, high: 1, onset: 1},
      }),
    );
    assert.ok(Object.values(out.ball).every(Number.isFinite));
    assert.ok(Math.abs(out.ball.x) <= 2.5);
    assert.ok(Math.abs(out.ball.z) <= 3.5);
    for (const p of [out.near, out.far]) {
      assert.ok(Math.abs(p.x) <= 1.35);
      assert.ok(Math.abs(p.velocity) <= 3);
    }
    assert.equal(out.invalidRecoveries, 0);
    assert.ok(out.speed <= 2.4);
  }
  assert.ok(s.snapshot().collisionSequence > 100);
  assert.ok(s.snapshot().recoveries > 0);
});
