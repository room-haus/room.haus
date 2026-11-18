import assert from 'node:assert/strict';
import {test} from 'node:test';
import {NarrationDirector} from '../src/experiences/underlevel/director/Narration.ts';
import {createDungeon} from '../src/experiences/underlevel/world/DungeonGraph.ts';

const dungeon = createDungeon();
const audio = {
  time: 0, playing: true, available: false, rms: 0, sub: 0, bass: 0, lowMid: 0,
  mid: 0, high: 0, brightness: 0, onset: 0, intensity: 0, bpm: 0, beatConfidence: 0,
};
const view = (x = 0, z = 0) => ({mode: 'EXPLORE', pose: {x, y: 1.65, z, yaw: 0}, resumeOffered: false});
const encounter = {
  enemies: [], selectedId: null, message: '', reaction: 0, action: 'attack', mana: 0.35,
};
const frame = (time = 0, extra = {}) => ({
  audio: {...audio, time},
  director: {time, cycleTime: time % 150, chapter: 'THE HALL', gateOpen: 0, events: []},
  navigation: view(),
  encounters: encounter,
  ...extra,
});

test('room narration follows actual position rather than the music chapter', () => {
  for (const [z, expected] of [[0, 'corridor'], [24, 'chamber'], [44, 'hall']]) {
    const narration = new NarrationDirector(dungeon);
    assert.equal(narration.update(frame(88, {navigation: view(0, z)}))?.kind, expected);
  }
  const narration = new NarrationDirector(dungeon);
  const gate = frame(80, {navigation: view(0, 28)});
  gate.director.gateOpen = 1;
  assert.equal(narration.update(gate)?.kind, 'gate');
});

test('lines hold then leave a gap, and pause preserves the current message', () => {
  const narration = new NarrationDirector(dungeon);
  assert.equal(narration.update(frame(0, {audio: {...audio, playing: false}})), null);
  const first = narration.update(frame(0));
  assert.ok(first);
  assert.equal(narration.update(frame(6.9)), first);
  const paused = frame(6.9);
  paused.audio.playing = false;
  assert.equal(narration.update(paused), first);
  assert.equal(narration.update(frame(9)), null);
  assert.equal(narration.update(frame(12.9)), null);
  assert.notEqual(narration.update(frame(19))?.id, first.id);
});

test('audible properties are mentioned only with eligible analysis', () => {
  const cases = [
    ['quiet', {}],
    ['fast', {rms: 0.2, bpm: 160, beatConfidence: 0.8}],
    ['bright', {rms: 0.2, brightness: 0.8, high: 0.8}],
    ['bass', {rms: 0.2, bass: 0.8}],
  ];
  for (const [kind, features] of cases) {
    const fresh = () => new NarrationDirector(dungeon);
    const noRoom = view(100, 100);
    assert.equal(fresh().update(frame(0, {navigation: noRoom, audio: {...audio, ...features, available: true}}))?.kind, kind);
    assert.equal(fresh().update(frame(0, {navigation: noRoom, audio: {...audio, ...features}}))?.kind, 'surreal');
  }

  const uncertain = {...audio, available: true, rms: 0.2, bpm: 170, beatConfidence: 0.3};
  assert.equal(new NarrationDirector(dungeon).update(frame(0, {navigation: view(100, 100), audio: uncertain}))?.kind, 'surreal');
});

test('sustained music changes queue a line without interrupting a hold or gap', () => {
  const cases = [
    {earlier: 0.4, changed: 0.04, rms: 0.03, kind: 'quiet-passed'},
    {earlier: 0.2, changed: 0.86, rms: 0.25, kind: 'build-passed'},
  ];
  for (const {earlier, changed, rms, kind} of cases) {
    for (const available of [true, false]) {
      const narration = new NarrationDirector(dungeon);
      const sample = (time, intensity, level) => narration.update(frame(time, {
        audio: {...audio, time, available, intensity, rms: level},
      }));
      const first = sample(0, earlier, 0.3);
      assert.equal(first?.kind, 'corridor');
      for (let t = 0.25; t <= 12.75; t += 0.25) {
        const activeChange = t >= 6 && t < 9;
        const line = sample(t, activeChange ? changed : earlier, activeChange ? rms : 0.3);
        if (t < 7) assert.equal(line, first);
        if (t >= 9) assert.equal(line, null);
      }
      let second;
      for (let t = 13; t <= 19; t += 0.25) {
        second = sample(t, earlier, 0.3);
        if (second) break;
      }
      assert.equal(second?.kind, available ? kind : 'surreal');
    }
  }
});

test('attacks, dispersals and casts respect the current line and quiet gap', () => {
  for (const [kind, after] of [
    ['attack', {...encounter, enemies: [{health: 1}], reaction: 1}],
    ['defeat', {...encounter, enemies: [{health: 0, defeated: true}], reaction: 1}],
    ['cast', {...encounter, enemies: [{health: 2}], mana: 0.15, reaction: 1, message: 'STATIC crawls over the stone.'}],
  ]) {
    const narration = new NarrationDirector(dungeon);
    const before = {
      ...encounter, enemies: [{id: 'bone-listener', health: 2, visible: true}], mana: 0.75, selectedId: 'bone-listener',
    };
    const first = narration.update(frame(0, {encounters: before}));
    assert.equal(first?.kind, 'bone');
    assert.equal(narration.update(frame(1, {encounters: before})), first);
    assert.equal(narration.update(frame(2, {encounters: after})), first);
    assert.equal(narration.update(frame(9, {encounters: after})), null);
    assert.equal(narration.update(frame(19, {encounters: after}))?.kind, kind);
  }
});

test('long playback avoids recent lines across loops and seeded replay is reproducible', () => {
  const narration = new NarrationDirector(dungeon, 618);
  const collect = () => Array.from({length: 90}, (_, i) => narration.update(frame(i * 20)));
  const first = collect();
  for (const [index, line] of first.entries()) {
    assert.ok(line);
    assert.ok(!first.slice(Math.max(0, index - 14), index).some(prior => prior.id === line.id));
  }
  for (const text of [
    'You remembered your middle school crush. You are devastated.',
    'Man, this kind of sucks.',
    'You got an alert from your bank. You chose to ignore it.',
    'You miss your dog',
    'You question the competency of your government',
  ]) assert.ok(first.some(line => line.text === text), text);
  narration.reset();
  assert.deepEqual(collect(), first);
});

test('a media repeat preserves history while an explicit seek resets the narrator', () => {
  const narration = new NarrationDirector(dungeon);
  const first = narration.update(frame(0));
  narration.update(frame(149.9));
  assert.notEqual(narration.update(frame(0))?.id, first?.id);
  narration.reset();
  assert.deepEqual(narration.update(frame(0)), first);
});
