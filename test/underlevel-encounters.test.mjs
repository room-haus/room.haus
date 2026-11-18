import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createDungeon} from '../src/experiences/underlevel/world/DungeonGraph.ts';
import {NavigationController} from '../src/experiences/underlevel/world/NavigationController.ts';
import {ExperienceDirector} from '../src/experiences/underlevel/director/ExperienceDirector.ts';
import {EncounterController, ENEMIES, SPELL_COST} from '../src/experiences/underlevel/interaction/EncounterController.ts';
import {mapSignals} from '../src/experiences/underlevel/interaction/SignalMapper.ts';
import {TempoPhase} from '../src/experiences/underlevel/audio/TempoEstimator.ts';

const audio = {
  time: 0, playing: true, available: true, rms: 0, sub: 0, bass: 0,
  lowMid: 0, mid: 0, high: 0, brightness: 0, onset: 0,
  intensity: 0, bpm: 0, beatConfidence: 0,
};
const nav = (mode = 'DRIFT', x = 0, z = 0, yaw = 0) => ({
  mode, pose: {x, y: 1.65, z, yaw}, resumeOffered: false,
});
const [bone, eye, moth] = ENEMIES.map(enemy => enemy.id);
const tick = (controller, time = 0, navigation = nav(), gateOpen = 1) =>
  controller.update({...audio, time}, navigation, false, 1, 0.016, gateOpen);
const find = (snapshot, id) => snapshot.enemies.find(enemy => enemy.id === id);

test('DRIFT and STILL acknowledge without damage, while EXPLORE applies cooldown and disperses on the third hit', () => {
  let now = 0;
  const controller = new EncounterController(createDungeon(), () => now);
  let snapshot = tick(controller);
  assert.equal(snapshot.selectedId, bone);
  controller.activate(bone, 'DRIFT');
  assert.equal(find(snapshot, bone).health, 3);
  assert.equal(find(snapshot, bone).acknowledged, true);
  assert.equal(snapshot.reaction, 1);
  now += 700;
  controller.activate(bone, 'STILL');
  assert.equal(find(snapshot, bone).health, 3);
  snapshot = tick(controller, 0, nav('EXPLORE'));
  assert.equal(snapshot.action, 'attack');

  now += 700;
  controller.activate(bone, 'EXPLORE');
  controller.activate(bone, 'EXPLORE');
  assert.equal(find(snapshot, bone).health, 2);
  now += 600;
  controller.activate(bone, 'EXPLORE');
  assert.equal(find(snapshot, bone).health, 2);
  now += 100;
  controller.activate(bone, 'EXPLORE');
  assert.equal(find(snapshot, bone).health, 1);
  now += 700;
  controller.activate(bone, 'EXPLORE');
  snapshot = tick(controller, 0, nav('EXPLORE'));
  assert.equal(find(snapshot, bone).defeated, true);
  assert.equal(find(snapshot, bone).visible, false);
  assert.equal(snapshot.selectedId, null);
  assert.match(snapshot.message, /disperses/);
});

test('seeking, crossing a cycle boundary, or re-entering restores health and clears acknowledgment', () => {
  const controller = new EncounterController(createDungeon());
  tick(controller, 0);
  controller.activate(bone, 'EXPLORE');
  controller.reset();
  let snapshot = tick(controller, 149.9);
  assert.equal(find(snapshot, bone).health, 3);
  assert.equal(find(snapshot, bone).acknowledged, false);
  assert.equal(snapshot.message, '');
  assert.equal(snapshot.reaction, 0);

  controller.activate(bone, 'EXPLORE');
  snapshot = tick(controller, 150);
  assert.equal(find(snapshot, bone).health, 3);
  controller.activate(bone, 'EXPLORE');
  snapshot = tick(controller, 0);
  assert.equal(find(snapshot, bone).health, 3);
  controller.activate(bone, 'EXPLORE');
  assert.equal(find(snapshot, bone).health, 2);
  controller.reset();
  snapshot = tick(controller);
  assert.equal(find(snapshot, bone).health, 3);
});

test('a forward playback jump within a cycle keeps encounter health', () => {
  const controller = new EncounterController(createDungeon());
  tick(controller);
  controller.activate(bone, 'EXPLORE');
  const snapshot = tick(controller, 9);
  assert.equal(find(snapshot, bone).health, 2);
});

test('mana charges from analyzed playback and casting reacts without harming targets', () => {
  let now = 0;
  const controller = new EncounterController(createDungeon(), () => now);
  const view = nav('EXPLORE');
  const snapshot = tick(controller, 0, view);
  assert.equal(snapshot.mana, 0.35);
  assert.equal(controller.cast('EXPLORE'), false);
  const rich = {...audio, mid: 1, intensity: 1};
  controller.update({...rich, time: 10}, view, false, 1, 0.016);
  assert.ok(snapshot.mana < 0.36);
  const manaAfterJump = snapshot.mana;
  controller.update({...rich, time: 11, playing: false}, view, false, 1, 0.1);
  controller.update({...rich, time: 12, available: false}, view, false, 1, 0.1);
  controller.update({...rich, time: 12}, view, false, 1, 0.1);
  assert.equal(snapshot.mana, manaAfterJump);

  for (let i = 1; i <= 50; i++) {
    controller.update({...rich, time: 12 + i / 10}, view, false, 1, 0.1);
  }
  const charged = snapshot.mana;
  assert.ok(charged >= SPELL_COST && charged <= 1);
  assert.equal(controller.cast('DRIFT'), false);
  assert.equal(controller.cast('STILL'), false);
  tick(controller, 17, nav('EXPLORE', 0, 0, Math.PI));
  assert.equal(controller.cast('EXPLORE'), false);
  tick(controller, 17, view);
  controller.activate(bone, 'EXPLORE');
  assert.equal(controller.cast('EXPLORE'), false);
  assert.equal(snapshot.mana, charged);
  now += 700;
  assert.equal(controller.cast('EXPLORE'), true);
  assert.equal(snapshot.mana, charged - SPELL_COST);
  assert.equal(find(snapshot, bone).health, 2);
  assert.equal(find(snapshot, bone).reaction, 1);
  assert.equal(snapshot.reaction, 1);
  assert.match(snapshot.message, /STATIC/);
  controller.reset();
  assert.equal(tick(controller).mana, 0.35);
});

test('wall, facing direction and closed gate prevent targeting', () => {
  const controller = new EncounterController(createDungeon());
  assert.equal(find(tick(controller, 0, nav('EXPLORE', 0, 0, Math.PI)), bone).visible, false);
  const aroundCorner = nav('EXPLORE', 1.5, 12, Math.atan2(1.5, 12));
  assert.equal(find(tick(controller, 0, aroundCorner), eye).visible, false);
  const gateApproach = nav('EXPLORE', 0, 28, Math.atan2(4, 16));
  let snapshot = tick(controller, 70, gateApproach, 0);
  assert.equal(find(snapshot, moth).visible, false);
  controller.activate(moth, 'EXPLORE');
  assert.equal(find(snapshot, moth).health, 3);
  snapshot = tick(controller, 80, gateApproach, 1);
  assert.equal(find(snapshot, moth).visible, true);
});

test('an uninterrupted authored drift route exposes all three enemies', () => {
  const dungeon = createDungeon();
  const controller = new EncounterController(dungeon);
  const director = new ExperienceDirector();
  const navigation = new NavigationController(dungeon);
  const seen = new Set();
  for (let i = 0; i < dungeon.duration * 10; i++) {
    const frame = {...audio, time: i / 10};
    const state = director.update(frame);
    const view = navigation.update(frame.time, 0.1, state, false);
    const snapshot = controller.update(frame, view, false, 1, 0.1, state.gateOpen);
    for (const enemy of snapshot.enemies) {
      if (enemy.visible) seen.add(enemy.id);
    }
  }
  assert.deepEqual(seen, new Set([bone, eye, moth]));
});

test('a narrow camera frustum excludes targets that are visible in the default view', () => {
  const controller = new EncounterController(createDungeon());
  const hallView = nav('EXPLORE', 0, 40);
  assert.equal(find(tick(controller, 90, hallView), moth).visible, true);
  const mobileHalfAngle = 37.36 * Math.PI / 180;
  const snapshot = controller.update({...audio, time: 90}, hallView, false, 1, 0.016, 1, mobileHalfAngle);
  assert.equal(find(snapshot, moth).visible, false);
  controller.activate(moth, 'EXPLORE');
  assert.equal(find(snapshot, moth).health, 3);
});

test('paused analysis and cue-only fallback label the source with no fake bands', () => {
  const controller = new EncounterController(createDungeon());
  const snapshot = tick(controller);
  controller.activate(bone, 'DRIFT');
  const paused = {...audio, playing: false, bass: 1, intensity: 1};
  const director = new ExperienceDirector().update(paused);
  const stopped = controller.update(paused, nav(), false, 1, 0);
  assert.equal(stopped.reaction, 0);
  assert.equal(stopped.message, '');
  const response = mapSignals(paused, director, stopped, false, 1);
  assert.equal(response.source, 'paused');
  for (const key of ['intensity', 'cadence', 'lantern', 'runes', 'dust', 'resonance', 'fog', 'enemyEnergy', 'reaction']) {
    assert.equal(response[key], 0, key);
  }
  const cue = mapSignals({...audio, available: false, bass: 1}, {...director, atmosphere: 0.6}, snapshot, false, 1);
  assert.equal(cue.source, 'cue');
  assert.equal(cue.lantern, 0);
  assert.equal(cue.fog, 0.6);
});

test('live signals drive distinct stepped controls and reduced motion removes cadence and dust', () => {
  const director = new ExperienceDirector().update(audio);
  const encounters = tick(new EncounterController(createDungeon()));
  for (const [band, channel] of [['bass', 'lantern'], ['mid', 'runes'], ['high', 'dust'], ['lowMid', 'resonance']]) {
    const response = mapSignals({...audio, [band]: 1}, director, encounters, false, 1);
    assert.ok(response[channel] >= 0.6);
    for (const other of ['lantern', 'runes', 'dust', 'resonance', 'fog', 'enemyEnergy']) {
      if (other !== channel) assert.equal(response[other], 0, other);
    }
  }
  const beat = {...audio, time: 0.25, bpm: 120, beatConfidence: 0.8, bass: 1, high: 1, intensity: 1};
  const full = mapSignals(beat, director, encounters, false, 1);
  assert.equal(full.cadence, 1);
  assert.ok(full.fog > 0);
  assert.equal(full.enemyEnergy, 1);
  assert.equal(mapSignals({...beat, beatConfidence: 0.2}, director, encounters, false, 1).cadence, 0);
  const still = mapSignals(beat, director, encounters, true, 1);
  assert.ok(still.lantern > 0 && still.lantern < full.lantern);
  assert.equal(still.cadence, 0);
  assert.equal(still.dust, 0);
  assert.equal(still.enemyEnergy, 0);
});

test('torch pulses follow measured tempo and color progresses over eight beats', () => {
  const director = new ExperienceDirector().update(audio);
  const encounters = tick(new EncounterController(createDungeon()));
  const sample = (bpm, time) => mapSignals({...audio, bpm, time, beatConfidence: 1}, director, encounters, false, 1);
  assert.equal(sample(60, 0.5).tempoPulse, -1);
  assert.equal(sample(120, 0.5).tempoPulse, 1);
  assert.equal(sample(120, 1).tempoPulse, sample(120, 0).tempoPulse);
  assert.equal(sample(180, 1 / 3).tempoPulse, -1);
  assert.equal(sample(180, 2 / 3).tempoPulse, 1);
  assert.equal(sample(60, 2).tempoColor, 1);
  assert.equal(sample(120, 1).tempoColor, 1);
  assert.equal(sample(120, 3).tempoColor, -1);
});

test('the tempo clock keeps lighting phase continuous across estimate changes', () => {
  const director = new ExperienceDirector().update(audio);
  const encounters = tick(new EncounterController(createDungeon()));
  const clock = new TempoPhase();
  const sample = (time, bpm, confidence = 1) => {
    clock.sample(time, bpm, confidence);
    return mapSignals({
      ...audio, time, bpm, beatConfidence: confidence, tempoBeats: clock.beats, tempoPulses: clock.pulses,
    }, director, encounters, false, 1);
  };
  sample(0, 120);
  const beforeCorrection = sample(90, 120);
  const afterCorrection = sample(90, 121);
  assert.equal(afterCorrection.tempoPulse, beforeCorrection.tempoPulse);
  assert.equal(afterCorrection.tempoColor, beforeCorrection.tempoColor);
  sample(91, 121);
  assert.ok(Math.abs(clock.beats - (180 + 121 / 60)) < 1e-9);

  const beforeHalfRate = sample(92, 150);
  assert.equal(sample(92, 151).tempoPulse, beforeHalfRate.tempoPulse);
  const pulses = clock.pulses;
  sample(93, 151);
  assert.ok(Math.abs(clock.pulses - pulses - 151 / 120) < 1e-9);

  assert.equal(sample(94, 151, 0.2).tempoPulse, 0);
  const beatsBeforeQuiet = clock.beats;
  sample(95, 151, 0.2);
  assert.equal(clock.beats, beatsBeforeQuiet);
  clock.reset();
  sample(110, 120);
  assert.equal(clock.beats, 0);
  assert.equal(clock.pulses, 0);
});

test('torch tempo modulation is neutral without a usable estimate or motion', () => {
  const director = new ExperienceDirector().update(audio);
  const encounters = tick(new EncounterController(createDungeon()));
  const estimated = {...audio, time: 0.25, bpm: 120, beatConfidence: 1, bass: 1};
  const cases = [
    [{...estimated, beatConfidence: 0.64}, false, 1],
    [{...estimated, bpm: 0}, false, 1],
    [{...estimated, playing: false}, false, 1],
    [{...estimated, available: false}, false, 1],
    [estimated, true, 1],
    [estimated, false, 0],
  ];
  for (const [frame, reducedMotion, motion] of cases) {
    const response = mapSignals(frame, director, encounters, reducedMotion, motion);
    assert.equal(response.tempoPulse, 0);
    assert.equal(response.tempoColor, 0);
  }
  assert.ok(mapSignals(estimated, director, encounters, true, 1).lantern > 0);
});
