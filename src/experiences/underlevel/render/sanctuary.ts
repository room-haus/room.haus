import {Masonry, arch, pier} from './masonry';
import type {Dungeon} from '../contracts';

const heights = {corridor: 3.6, chamber: 5.4, hall: 10.8};
const sides = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

export function sanctuary(world: Dungeon) {
  const stone = new Masonry(),
    paving = new Masonry(),
    iron = new Masonry();
  const gate = new Masonry(),
    relic = new Masonry(),
    lamps: number[] = [];
  const s = world.tileSize;
  const lookup = new Map(world.tiles.map((t) => [`${t.x},${t.z}`, t]));
  const lamp = (x: number, y: number, z: number, power: number) => {
    lamps.push(x, y, z, power);
    iron.box(x, y - 0.24, z, 0.28, 0.14, 0.28, 0.74);
    iron.box(x, y + 0.24, z, 0.24, 0.1, 0.24, 0.87);
    iron.box(x, y, z, 0.105, 0.47, 0.105, 1, 1);
    for (const dx of [-0.095, 0.095])
      for (const dz of [-0.095, 0.095]) iron.box(x + dx, y, z + dz, 0.026, 0.46, 0.026, 0.9);
  };
  const ax = world.artifact.x * s,
    az = world.artifact.z * s;
  const gx = world.gate.x * s,
    gz = world.gate.z * s;
  const hallTiles = world.tiles.filter((t) => t.zone === 'hall');
  const apseZ = Math.max(...hallTiles.map((t) => t.z)) * s + s / 2;
  for (const tile of world.tiles) {
    const x = tile.x * s,
      z = tile.z * s,
      h = heights[tile.zone];
    paving.box(x, -0.13, z, s, 0.26, s, 0.92 + (((tile.variant % 5) + 5) % 5) * 0.018);
    stone.box(x, h + 0.13, z, s, 0.26, s, 0.69);
    for (const [dx, dz] of sides) {
      const next = lookup.get(`${tile.x + dx},${tile.z + dz}`);
      const low = next ? heights[next.zone] : 0;
      if (low >= h) continue;
      const wx = x + (dx * s) / 2,
        wz = z + (dz * s) / 2;
      stone.box(wx, (h + low) / 2, wz, dx ? 0.26 : s, h - low, dz ? 0.26 : s, 0.98);
      if (next) continue;
      stone.box(wx, 0.18, wz, dx ? 0.41 : s, 0.36, dz ? 0.41 : s, 0.84);
      stone.box(wx, 0.39, wz, dx ? 0.48 : s, 0.1, dz ? 0.48 : s, 1.1);
      if (tile.zone === 'hall') {
        // Blind lancets are built into the enclosing masonry.
        const cx = wx - dx * 0.17,
          cz = wz - dz * 0.17;
        iron.prism(
          [
            [-0.63, 2.3],
            [0.63, 2.3],
            [0.63, 5.7],
            [0, 6.6],
            [-0.63, 5.7],
          ],
          cx,
          cz,
          0.12,
          0.57,
          0,
          !!dx,
        );
        arch(stone, cx, cz, 0.65, 5.7, 0.94, 0.19, 0.34, !!dx);
        for (const sign of [-1, 1])
          stone.box(
            cx + (dx ? 0 : sign * 0.75),
            4,
            cz + (dx ? sign * 0.75 : 0),
            dx ? 0.31 : 0.2,
            3.5,
            dx ? 0.2 : 0.31,
            0.94,
          );
      }
    }
    if (tile.zone === 'corridor') {
      const north = lookup.has(`${tile.x},${tile.z + 1}`);
      const south = lookup.has(`${tile.x},${tile.z - 1}`);
      const horizontal = !north && !south;
      for (const sign of [-1, 1]) {
        const offset = sign * (s / 2 - 0.18);
        pier(stone, x + (horizontal ? 0 : offset), z + (horizontal ? offset : 0), 0.39, 2.15);
        // Thin aisle border, cut into the flagstone.
        paving.box(
          x + (horizontal ? 0 : sign * 1.48),
          0.006,
          z + (horizontal ? sign * 1.48 : 0),
          horizontal ? s : 0.074,
          0.012,
          horizontal ? 0.074 : s,
          0.57,
        );
      }
      arch(stone, x, z, s / 2 - 0.39, 2.11, 1.12, 0.35, 0.44, horizontal);
    }
  }
  for (const [x, z] of [
    [-1.46, 4],
    [1.46, 12],
    [-5.46, 20],
    [1.46, gz - 1.4],
  ]) {
    lamp(gx + x, 2.07, z, 2.85);
    iron.box(gx + x + Math.sign(x) * 0.25, 1.82, z, 0.52, 0.11, 0.13, 0.87);
  }

  // A shallow blind apse silhouettes the bronze blades from the route.
  const backing = ax + s / 2 - 0.24;
  iron.prism(
    [
      [-2.28, 0.39],
      [2.28, 0.39],
      [2.28, 2.74],
      [1.72, 3.69],
      [0, 4.64],
      [-1.72, 3.69],
      [-2.28, 2.74],
    ],
    backing,
    az,
    0.19,
    0.37,
    0,
    true,
  );
  arch(stone, backing - 0.12, az, 2.27, 2.68, 1.94, 0.33, 0.46, true);
  for (const side of [-1, 1]) {
    pier(stone, backing - 0.12, az + side * 2.4, 0.43, 2.72);
    for (let i = 0; i < 4; i++) {
      const height = 2.14 + (3 - i) * 0.32;
      iron.box(backing - 0.15, height / 2 + 0.44, az + side * (1.06 + i * 0.27), 0.14, height, 0.07, 0.93);
    }
  }
  // Stepped plinth, hoist and suspension wires beneath the transmitter.
  for (let i = 0; i < 3; i++) {
    const width = 2.17 - i * 0.28;
    stone.box(ax, 0.09 + i * 0.15, az, width, 0.17, width, 0.89 + i * 0.13);
  }
  iron.box(ax, 5.06, az, 0.66, 0.18, 1.45, 0.91);
  for (const dz of [-0.31, 0.31]) iron.box(ax, 4.17, az + dz, 0.035, 1.72, 0.035, 0.93);
  // Split, faceted bronze tuning weight. Broken apertures leave air between
  // the two blades; narrow cuts catch the transmitter light.
  const blade = (sign: number) => {
    const profile: [number, number][] = [
      [0.075, 1.06],
      [0.63, 1.96],
      [0.49, 2.95],
      [0.16, 3.38],
      [0.08, 2.68],
    ];
    const points = profile.map(([u, y]): [number, number] => [u * sign, y]);
    if (sign < 0) points.reverse();
    relic.prism(points, 0, 0, 0.39, 0.84);
    // Hand-cut planes descend to an off-centre arris, giving each blade
    // an asymmetrical polished face and a darker oxidized bevel.
    const ridge: [number, number, number] = [sign * 0.36, 2.38, -0.36];
    for (let i = 0; i < points.length; i++) {
      const a = points[i],
        b = points[(i + 1) % points.length];
      relic.face([b[0], b[1], -0.195], [a[0], a[1], -0.195], ridge, ridge, 0.7 + i * 0.13);
    }
    relic.prism(
      [
        [sign * 0.13, 1.46],
        [sign * 0.17, 1.53],
        [sign * 0.22, 2.76],
        [sign * 0.16, 2.88],
      ],
      0,
      -0.315,
      0.03,
      1,
      2,
    );
  };
  blade(1);
  blade(-1);
  for (let i = 0; i < 5; i++) {
    const width = 0.89 - i * 0.085;
    relic.box(0, 2.61 + i * 0.115, 0, width, 0.046, 0.48, 1.07);
  }
  relic.box(0, 2.1, 0, 0.06, 1.81, 0.06, 1, 2);

  // The lifting pocket hides the raised gate above a low archivolt.
  stone.box(gx, 4.47, gz, 4, 1.9, 0.75, 0.87);
  for (const sign of [-1, 1]) pier(stone, gx + sign * 1.82, gz, 0.43, 2.5);
  arch(stone, gx, gz, 1.61, 2.46, 0.91, 0.33, 0.83);
  // The iron grille raises as one piece.
  for (let i = -4; i <= 4; i++) {
    const x = i * 0.38;
    gate.box(x, 1.69, 0, 0.09, 3.45, 0.17, 0.96);
    gate.prism(
      [
        [x - 0.09, 0.19],
        [x, 0.017],
        [x + 0.09, 0.19],
        [x + 0.055, 0.37],
        [x - 0.055, 0.37],
      ],
      0,
      0,
      0.23,
      1.06,
    );
  }
  for (const y of [0.95, 2.32, 2.83]) gate.box(0, y, 0, 3.67, 0.11, 0.24, 1.05);
  // The hall's central nave and arcades rise out of the low threshold.
  for (const col of [-1, 1]) {
    const px = gx + col * 6;
    for (let z = gz + 6; z < apseZ; z += 8) {
      pier(stone, px, z, 1.08, 6.65);
      for (const offset of [-0.51, 0.51]) stone.box(px + offset, 3.28, z, 0.24, 6.04, 0.47, 1.08);
      if (z + 8 < apseZ) arch(stone, px, z + 4, 3.73, 6.6, 2.92, 0.5, 0.82, true);
      if (col === 1) arch(stone, gx, z, 5.53, 6.62, 3.05, 0.55, 0.7);
      if (z < apseZ - 4) lamp(px - col * 0.74, 2.73, z, 3.3);
    }
  }
  // A tall sealed memorial on the far wall holds the sightline after reveal.
  const apse = apseZ - 0.23;
  for (const [width, height, depth] of [
    [5.8, 7.8, 0.32],
    [4.93, 7.2, 0.48],
    [4.2, 6.7, 0.62],
  ]) {
    iron.prism(
      [
        [-width / 2, 0.25],
        [width / 2, 0.25],
        [width / 2, height - 1.8],
        [0, height],
        [-width / 2, height - 1.8],
      ],
      gx,
      apse - depth / 2,
      depth,
      0.86,
    );
  }
  for (let i = -4; i <= 4; i++) {
    const height = 5.25 - Math.abs(i) * 0.48;
    iron.box(gx + i * 0.42, 1.12 + height / 2, apse - 0.68, 0.055, height, 0.07, 1, 2);
  }
  for (const sign of [-1, 1]) lamp(gx + sign * 3.25, 2.42, apse - 0.86, 4);
  while (lamps.length < 48) lamps.push(0, 0, 0, 0);
  return {stone, paving, iron, gate, relic, lamps: lamps.slice(0, 48), ax, az, gx, gz, apse};
}
