import type {Dungeon, Tile, Waypoint} from '../contracts';

const TILE_SIZE = 4;
const TURN = Math.PI / 2;
const DURATION = 150;
const GATE = {x: 0, z: 8};
const ARTIFACT = {x: 1, z: 6};

function routePoint(time: number, x: number, z: number, yaw = 0): Waypoint {
  return {time, x: x * TILE_SIZE, z: z * TILE_SIZE, yaw};
}

export function createDungeon(seed = 29): Dungeon {
  const tiles: Tile[] = [];
  let randomState = seed >>> 0;

  function addZone(zone: Tile['zone'], minX: number, maxX: number, minZ: number, maxZ: number) {
    for (let z = minZ; z <= maxZ; z++) {
      for (let x = minX; x <= maxX; x++) {
        randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
        tiles.push({x, z, zone, variant: randomState >>> 30});
      }
    }
  }

  addZone('corridor', 0, 0, 0, 4);
  addZone('chamber', -1, 1, 5, 7);
  addZone('chamber', GATE.x, GATE.x, GATE.z, GATE.z);
  addZone('hall', -3, 3, 9, 14);

  const route = [
    routePoint(0, 0, 0),
    routePoint(22, 0, 4),
    routePoint(32, 0, 6),
    routePoint(37, 0, 6, TURN),
    routePoint(58, 0, 6, TURN),
    routePoint(63, 0, 6),
    routePoint(68, 0, 7),
    routePoint(78, 0, 7),
    routePoint(82, 0, 8),
    routePoint(86, 0, 9),
    routePoint(91, 0, 12),
    routePoint(94, 0, 12, TURN),
    routePoint(99, 2, 12, TURN),
    routePoint(103, 2, 12, TURN * 2),
    routePoint(110, 2, 9, TURN * 2),
    routePoint(113, 2, 9, -TURN),
    routePoint(118, 0, 9, -TURN),
    routePoint(121, 0, 9, TURN * 2),
    routePoint(125, 0, 8, TURN * 2),
    routePoint(129, 0, 7, TURN * 2),
    routePoint(148, 0, 0, TURN * 2),
    routePoint(DURATION, 0, 0),
  ];

  return {seed, tileSize: TILE_SIZE, tiles, route, gate: {...GATE}, artifact: {...ARTIFACT}, duration: DURATION};
}
