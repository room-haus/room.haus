// The CAD export duplicates its position, normal and UV for every triangle corner.
// Keep the original export editable and index identical corners when webpack emits it.
module.exports = function indexModel(source) {
  const model = JSON.parse(source);
  for (const mesh of model.meshes) {
    const vertices = new Map();
    const positions = [];
    const normals = [];
    const uvs = [];
    const [sub] = mesh.subMeshes;
    const otherStreams = [mesh.tangents, mesh.colors, mesh.matricesIndices, mesh.matricesWeights,
      mesh.matricesIndicesExtra, mesh.matricesWeightsExtra, mesh.uvs2, mesh.uvs3, mesh.uvs4, mesh.uvs5, mesh.uvs6];
    if (mesh.subMeshes.length !== 1 || sub.indexStart !== 0 || sub.indexCount !== mesh.indices.length ||
        otherStreams.some(stream => stream?.length)) {
      throw Error('The MX018 export changed its vertex layout for ' + mesh.name);
    }
    mesh.indices = mesh.indices.map(index => {
      const p = mesh.positions.slice(index * 3, index * 3 + 3);
      const n = mesh.normals.slice(index * 3, index * 3 + 3);
      const uv = mesh.uvs.slice(index * 2, index * 2 + 2);
      const key = [...p, ...n, ...uv].join(',');
      let vertex = vertices.get(key);
      if (vertex === undefined) {
        vertex = vertices.size;
        vertices.set(key, vertex);
        positions.push(...p);
        normals.push(...n);
        uvs.push(...uv);
      }
      return vertex;
    });
    Object.assign(mesh, {positions, normals, uvs});
    sub.verticesStart = 0;
    sub.verticesCount = vertices.size;
  }
  return JSON.stringify(model);
};
