import assert from 'node:assert/strict';
import test from 'node:test';
import {ExperienceDirector} from '../src/experiences/underlevel/director/ExperienceDirector.ts';
import {createDungeon} from '../src/experiences/underlevel/world/DungeonGraph.ts';
import {NavigationController} from '../src/experiences/underlevel/world/NavigationController.ts';

function director(time, gateOpen = 0) {
  return {
    time,
    cycleTime: time % 150,
    chapter: 'THRESHOLD',
    gateOpen,
    reveal: 0,
    artifact: 0,
    atmosphere: 0,
    palette: 'ember',
    events: [],
  };
}

function key(x, z) {
  return `${x},${z}`;
}

function poseKey(pose, size) {
  return key(Math.round(pose.x / size), Math.round(pose.z / size));
}

test('decoration seeds preserve connected topology and the authored route', () => {
  const dungeon = createDungeon();
  const variant = createDungeon(71);
  assert.deepEqual(createDungeon(), dungeon);
  assert.notDeepEqual(variant.tiles, dungeon.tiles);
  assert.deepEqual(
    variant.tiles.map(({x, z}) => [x, z]),
    dungeon.tiles.map(({x, z}) => [x, z]),
  );
  assert.deepEqual(variant.route, dungeon.route);

  const unvisited = new Set(dungeon.tiles.map(({x, z}) => key(x, z)));
  const frontier = [[0, 0]];
  for (const [x, z] of frontier) {
    if (unvisited.delete(key(x, z))) frontier.push([x + 1, z], [x - 1, z], [x, z + 1], [x, z - 1]);
  }
  assert.equal(unvisited.size, 0);
});

test('drift samples remain inside floor tiles over consecutive loops and match after seeking', () => {
  const dungeon = createDungeon();
  const nav = new NavigationController(dungeon);
  const timeline = new ExperienceDirector();
  const audio = {
    time: 0,
    playing: true,
    available: true,
    rms: 0,
    sub: 0,
    bass: 0,
    lowMid: 0,
    mid: 0,
    high: 0,
    brightness: 0,
    onset: 0,
    intensity: 0,
    bpm: 0,
    beatConfidence: 0,
  };
  const zoneByTile = new Map(dungeon.tiles.map(({x, z, zone}) => [key(x, z), zone]));
  const zones = new Set();
  let last;
  for (let tick = 0; tick < dungeon.duration * 60; tick++) {
    audio.time = tick / 20;
    const state = timeline.update(audio);
    const pose = nav.update(audio.time, 0.05, state, false).pose;
    zones.add(zoneByTile.get(poseKey(pose, dungeon.tileSize)));
    if (last) assert.ok(Math.hypot(last.x - pose.x, last.z - pose.z) < 0.15);
    if (poseKey(pose, dungeon.tileSize) === key(dungeon.gate.x, dungeon.gate.z)) {
      assert.ok(state.gateOpen >= 0.85);
    }
    last = pose;
  }
  assert.deepEqual(zones, new Set(['corridor', 'chamber', 'hall']));

  const first = nav.update(76, 0, director(76), false).pose;
  nav.update(4, 0, director(4), false);
  assert.deepEqual(nav.update(376, 0, director(376), false).pose, first);
  assert.deepEqual(nav.update(376, 1, director(376), false).pose, first);
});

test('manual movement is eased and waits for an open gate', () => {
  const nav = new NavigationController(createDungeon());
  const initial = nav.update(78, 0, director(78), false).pose;
  nav.input('forward', 0);
  const blocked = nav.update(78, 0.3, director(78, 0.5), false);
  assert.equal(nav.mode, 'EXPLORE');
  assert.deepEqual(blocked.pose, initial);
  nav.update(78, 0, director(78, 1), false);
  nav.input('forward', 1);
  const midway = nav.update(78, 0.15, director(78, 1), false).pose;
  const destination = nav.update(78, 0.15, director(78, 1), false).pose;
  assert.ok(initial.z < midway.z && midway.z < destination.z);
  assert.equal(destination.z, 32);
});

test('manual control interrupts drift in place and offers an explicit resume after idle', () => {
  const nav = new NavigationController(createDungeon());
  const first = nav.update(10, 0, director(10), false).pose;
  nav.input('right', 20);
  const interrupted = nav.update(20, 0, director(20), false);
  assert.equal(interrupted.mode, 'EXPLORE');
  assert.deepEqual(interrupted.pose, first);
  const finished = nav.update(20, 0.3, director(20), false);
  assert.equal(finished.pose.yaw - first.yaw, Math.PI / 2);
  assert.equal(nav.update(20, 11.6, director(20), false).resumeOffered, false);
  const idle = nav.update(20, 0.2, director(20), false);
  assert.equal(idle.resumeOffered, true);
  assert.equal(idle.mode, 'EXPLORE');
  assert.deepEqual(idle.pose, finished.pose);
});

test('still and reduced motion hold position through changes in audio time', () => {
  const nav = new NavigationController(createDungeon(), true);
  const stationary = nav.update(13, 0.5, director(13), true);
  assert.equal(stationary.mode, 'STILL');
  assert.equal(stationary.pose.z, 0);
  assert.deepEqual(nav.update(48, 0.5, director(48), true).pose, stationary.pose);
  nav.setMode('DRIFT');
  assert.deepEqual(nav.update(48, 0.5, director(48), true).pose, stationary.pose);
  nav.setMode('STILL');
  nav.input('forward', 0);
  assert.deepEqual(nav.update(49, 0.5, director(49), false).pose, stationary.pose);
});

test('manual takeover from a partial turn blends to a cardinal heading', () => {
  const nav = new NavigationController(createDungeon());
  const from = nav.update(34.4, 0, director(34.4), false).pose;
  nav.input('forward', 0);
  assert.deepEqual(nav.update(34.4, 0, director(34.4), false).pose, from);
  const moved = nav.update(34.4, 0.3, director(34.4), false).pose;
  assert.equal(moved.z, 28);
  assert.equal(moved.yaw, 0);

  const turn = new NavigationController(createDungeon());
  turn.update(34.4, 0, director(34.4), false);
  turn.input('right', 0);
  assert.equal(turn.update(34.4, 0.3, director(34.4), false).pose.yaw, Math.PI / 2);
});

test('manual movement respects the relic occupying a chamber tile', () => {
  const nav = new NavigationController(createDungeon());
  const initial = nav.update(40, 0, director(40), false).pose;
  assert.equal(initial.yaw, Math.PI / 2);
  nav.input('forward', 0);
  assert.deepEqual(nav.update(40, 0.3, director(40), false).pose, initial);
});

test('resuming drift routes around the relic', () => {
  const dungeon = createDungeon();
  const nav = new NavigationController(dungeon);
  nav.update(27, 0, director(27), false);
  nav.input('right', 0);
  nav.update(27, 0.3, director(27), false);
  nav.input('forward', 1);
  const side = nav.update(27, 0.3, director(27), false).pose;
  assert.equal(poseKey(side, dungeon.tileSize), '1,5');

  nav.setMode('DRIFT');
  let pose;
  for (let tick = 0; tick < 100; tick++) {
    pose = nav.update(78, 0.05, director(78), false).pose;
    assert.notEqual(poseKey(pose, dungeon.tileSize), key(dungeon.artifact.x, dungeon.artifact.z));
  }
  assert.equal(poseKey(pose, dungeon.tileSize), '0,7');
});

test('resuming drift joins safely from the opposite side of the gate', () => {
  const dungeon = createDungeon();
  const nav = new NavigationController(dungeon);
  const initial = nav.update(92, 0, director(92), false).pose;
  nav.setMode('EXPLORE');
  nav.setMode('DRIFT');
  assert.deepEqual(nav.update(0, 0, director(0), false).pose, initial);

  let last = initial;
  for (let tick = 0; tick < 200; tick++) {
    const pose = nav.update(0, 0.05, director(0), false).pose;
    assert.ok(pose.z >= 34, 'closed gate must retain the camera on the hall side');
    assert.ok(Math.hypot(pose.x - last.x, pose.z - last.z) < 0.6, 'resume must stay continuous');
    last = pose;
  }

  const keys = new Set(dungeon.tiles.map(({x, z}) => key(x, z)));
  for (let tick = 0; tick < 400; tick++) {
    const pose = nav.update(0, 0.05, director(0, 1), false).pose;
    assert.ok(keys.has(poseKey(pose, dungeon.tileSize)));
    assert.ok(Math.hypot(pose.x - last.x, pose.z - last.z) < 0.6);
    last = pose;
  }
  assert.equal(last.z, 0);
});
