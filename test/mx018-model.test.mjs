import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import indexModel from '../scripts/index-mx018-model.cjs';

test('MX018 keeps its full authored triangles, normals, UV seams, materials and transforms', () => {
  const source = readFileSync(new URL('../src/babylon/models/MX018/jett.babylon', import.meta.url), 'utf8');
  const packed = indexModel(source);
  const {meshes: original, ...scene} = JSON.parse(source);
  const {meshes: indexed, ...packedScene} = JSON.parse(packed);
  assert.deepEqual(packedScene, scene);
  assert.deepEqual(indexed.map(mesh => mesh.name), ['InnerSphere', 'OuterSphere', 'MiddleSphere']);
  assert.ok(Buffer.byteLength(packed) < Buffer.byteLength(source) / 2);
  for (const [i, mesh] of original.entries()) {
    const {positions, normals, uvs, indices, subMeshes, ...metadata} = mesh;
    const compact = indexed[i];
    const {positions: p, normals: n, uvs: u, indices: ix, subMeshes: sub, ...rest} = compact;
    assert.deepEqual(rest, metadata);
    assert.deepEqual(sub, [{...subMeshes[0], verticesCount: p.length / 3}]);
    assert.equal(ix.length, indices.length);
    for (const [before, after, width] of [[positions, p, 3], [normals, n, 3], [uvs, u, 2]]) {
      for (let j = 0; j < indices.length; j++) {
        for (let k = 0; k < width; k++) {
          assert.equal(after[ix[j] * width + k], before[indices[j] * width + k]);
        }
      }
    }
  }
});
