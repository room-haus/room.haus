import {Mesh, Scene, VertexData} from 'babylonjs';

export type Point = [number, number, number];

// Draw an entire material family in one indexed mesh. Facets have independent
// normals so a stone, its chipped bevel and its joint catch different light.
export class Masonry {
  private positions: number[] = [];
  private normals: number[] = [];
  private colors: number[] = [];
  private indices: number[] = [];

  face(a: Point, b: Point, c: Point, d: Point, shade = 1, emission = 0) {
    const i = this.positions.length / 3;
    const u = b.map((v, k) => v - a[k]);
    const v = c.map((n, k) => n - a[k]);
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const len = Math.hypot(...n) || 1;
    for (const p of [a, b, c, d]) {
      this.positions.push(...p);
      this.normals.push(n[0] / len, n[1] / len, n[2] / len);
      this.colors.push(shade, emission, 0, 1);
    }
    this.indices.push(i, i + 1, i + 2, i, i + 2, i + 3);
  }

  // Extrude a counterclockwise x/y cross-section front to back.
  prism(outline: [number, number][], x: number, z: number, depth: number, shade = 1, emission = 0, turn = false) {
    const point = ([u, y]: [number, number], side: number): Point =>
      turn ? [x + side, y, z - u] : [x + u, y, z + side];
    const near = outline.map((p) => point(p, -depth / 2));
    const far = outline.map((p) => point(p, depth / 2));
    for (let i = 1; i < near.length - 1; i++) {
      this.face(near[0], near[i + 1], near[i], near[i], shade, emission);
      this.face(far[0], far[i], far[i + 1], far[i + 1], shade, emission);
    }
    for (let i = 0; i < near.length; i++) {
      const j = (i + 1) % near.length;
      this.face(near[i], near[j], far[j], far[i], shade, emission);
    }
  }

  box(x: number, y: number, z: number, w: number, h: number, d: number, shade = 1, emission = 0) {
    this.prism(
      [
        [-w / 2, y - h / 2],
        [w / 2, y - h / 2],
        [w / 2, y + h / 2],
        [-w / 2, y + h / 2],
      ],
      x,
      z,
      d,
      shade,
      emission,
    );
  }

  mesh(name: string, scene: Scene) {
    const mesh = new Mesh(name, scene);
    const data = new VertexData();
    data.positions = this.positions;
    data.normals = this.normals;
    data.colors = this.colors;
    data.indices = this.indices;
    data.applyToMesh(mesh);
    return mesh;
  }
}

export function pier(stone: Masonry, x: number, z: number, w: number, h: number) {
  stone.box(x, 0.14, z, w * 1.44, 0.28, w * 1.44, 0.86);
  stone.box(x, 0.34, z, w * 1.18, 0.13, w * 1.18, 1.08);
  stone.box(x, h / 2, z, w, h - 0.45, w, 0.94);
  stone.box(x, h - 0.27, z, w * 1.18, 0.22, w * 1.18, 1.02);
  stone.box(x, h - 0.1, z, w * 1.46, 0.2, w * 1.46, 1.13);
}

export function arch(
  stone: Masonry,
  x: number,
  z: number,
  r: number,
  spring: number,
  rise: number,
  thick: number,
  depth: number,
  turn = false,
) {
  const count = 13;
  for (let i = 0; i < count; i++) {
    const a = ((i + 0.022) * Math.PI) / count,
      b = ((i + 0.978) * Math.PI) / count;
    const key = i === 6 ? thick * 0.35 : 0;
    const point = (angle: number, outer: boolean): [number, number] => [
      Math.cos(angle) * (r + (outer ? thick : 0)),
      spring + Math.sin(angle) * (rise + (outer ? thick + key : -key)),
    ];
    stone.prism(
      [point(a, false), point(a, true), point(b, true), point(b, false)],
      x,
      z,
      depth + key * 1.8,
      0.91 + ((i * 7) % 11) * 0.021,
      0,
      turn,
    );
  }
}
