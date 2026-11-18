import test from 'node:test';
import assert from 'node:assert/strict';
import {ExperienceDirector, resolveGateClearance} from '../src/experiences/underlevel/director/ExperienceDirector.ts';
const frame = (time, overrides = {}) => ({time, playing:true, available:true, rms:.5,sub:.4,bass:.5,lowMid:.4,mid:.5,high:.3,brightness:.3,onset:0,intensity:.5,bpm:120,beatConfidence:.8,...overrides});
test('authored cue opens the gate; a kick cannot open it early', () => {
  const d = new ExperienceDirector();
  assert.equal(d.update(frame(20, {onset:1, intensity:1})).gateOpen, 0);
  assert.equal(d.update(frame(87)).gateOpen, 1);
  assert.equal(d.update(frame(110)).gateOpen, 1);
});
test('seeking reconstructs chapter and gate, without replaying stale events', () => {
  const d = new ExperienceDirector();
  d.update(frame(87));
  const back = d.update(frame(3));
  assert.equal(back.chapter, 'THRESHOLD');
  assert.equal(back.gateOpen, 0);
  assert.deepEqual(back.events, []);
  const forward = d.update(frame(90));
  assert.equal(forward.chapter, 'THE HALL');
  assert.deepEqual(forward.events, []);
});
test('repeat loops have deterministic states and cue IDs are unique by cycle', () => {
  const d = new ExperienceDirector();
  assert.equal(d.update(frame(237)).gateOpen, d.update(frame(87)).gateOpen);
  d.update(frame(77.9));
  const first = d.update(frame(78.1)).events;
  assert.equal(first.length, 1);
  assert.deepEqual(d.update(frame(78.1)).events, []);
  d.update(frame(227.9));
  const second = d.update(frame(228.1)).events;
  assert.notEqual(first[0].id, second[0].id);
});
test('paused signal emits no reactive events and live features shape mood without changing layout', () => {
  const a = new ExperienceDirector();
  a.update(frame(77.9));
  assert.deepEqual(a.update(frame(78.1,{playing:false})).events, []);
  const quiet = a.update(frame(70,{intensity:0,brightness:0}));
  const loud = new ExperienceDirector().update(frame(70,{intensity:1,brightness:1}));
  assert.ok(loud.atmosphere > quiet.atmosphere);
  assert.equal(loud.gateOpen, quiet.gateOpen);
});

test('a camera in the gate clearance keeps physical door open across a backwards seek', () => {
  const state = new ExperienceDirector().update(frame(0));
  const world = {gate:{x:0,z:8}, tileSize:4};
  assert.equal(resolveGateClearance(state,{x:0,y:1.65,z:32,yaw:0},world).gateOpen,1);
  assert.equal(resolveGateClearance(state,{x:0,y:1.65,z:28,yaw:0},world).gateOpen,0);
  assert.equal(state.gateOpen,0);
});
