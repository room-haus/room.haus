import * as BABYLON from 'babylonjs';
import {WaterMaterial} from 'babylonjs-materials';
import {scaleLinear} from 'd3';
import waterbump from './assets/waterbump.png';
import CaseTexture from '../../images/mix-art/rm001.jpg';
import CDLabelTexture from '../../images/mix-labels/cd_template_RM001.png';

export const caseTexture = CaseTexture;
export const cdLabelTexture = CDLabelTexture;

BABYLON.Mesh.prototype.createSurfacePoints = function(pointDensity) {
  var positions = this.getVerticesData(BABYLON.VertexBuffer.PositionKind);
  var indices = this.getIndices();

  var point = BABYLON.Vector3.Zero();
  var points = [];

  var randX = 0;
  var randY = 0;
  var randZ = 0;

  var index = 0;
  var id0 = 0;
  var id1 = 0;
  var id2 = 0;
  var v0X = 0;
  var v0Y = 0;
  var v0Z = 0;
  var v1X = 0;
  var v1Y = 0;
  var v1Z = 0;
  var v2X = 0;
  var v2Y = 0;
  var v2Z = 0;
  var vertex0 = BABYLON.Vector3.Zero();
  var vertex1 = BABYLON.Vector3.Zero();
  var vertex2 = BABYLON.Vector3.Zero();
  var vec0 = BABYLON.Vector3.Zero();
  var vec1 = BABYLON.Vector3.Zero();
  var vec2 = BABYLON.Vector3.Zero();

  var a = 0; //length of side of triangle
  var b = 0; //length of side of triangle
  var c = 0; //length of side of triangle
  var p = 0; //perimeter of triangle
  var area = 0;
  var nbPoints = 0; //nbPoints per triangle

  var lamda = 0;
  var mu = 0;

  for (var index = 0; index < indices.length / 3; index++) {
    id0 = indices[3 * index];
    id1 = indices[3 * index + 1];
    id2 = indices[3 * index + 2];
    v0X = positions[3 * id0];
    v0Y = positions[3 * id0 + 1];
    v0Z = positions[3 * id0 + 2];
    v1X = positions[3 * id1];
    v1Y = positions[3 * id1 + 1];
    v1Z = positions[3 * id1 + 2];
    v2X = positions[3 * id2];
    v2Y = positions[3 * id2 + 1];
    v2Z = positions[3 * id2 + 2];
    vertex0.set(v0X, v0Y, v0Z);
    vertex1.set(v1X, v1Y, v1Z);
    vertex2.set(v2X, v2Y, v2Z);
    vertex1.subtractToRef(vertex0, vec0);
    vertex2.subtractToRef(vertex1, vec1);
    vertex2.subtractToRef(vertex0, vec2);
    a = vec0.length();
    b = vec1.length();
    c = vec2.length();
    p = (a + b + c) / 2;
    area = Math.sqrt(p * (p - a) * (p - b) * (p - c));
    nbPoints = Math.round(pointDensity * area);
    for (var i = 0; i < nbPoints; i++) {
      //form a point inside the facet v0, v1, v2;
      lamda = BABYLON.Scalar.RandomRange(0, 1);
      mu = BABYLON.Scalar.RandomRange(0, 1);
      const facetPoint = vertex0.add(vec0.scale(lamda)).add(vec1.scale(lamda * mu));
      points.push(facetPoint);
    }
  }
  return points;
};

const setUpLights = (scene) => {
  // const color = new BABYLON.Color3(240 / 255, 230 / 255, 194 / 255);
  const color = new BABYLON.Color3(1, 1, 1);
  const top = new BABYLON.HemisphericLight('topLight', new BABYLON.Vector3(0, 1, 0), scene);
  top.diffuse = color;
  top.intensity = 1.0;

  const intensity = 1;
  const bottom = new BABYLON.HemisphericLight('bottomLight', new BABYLON.Vector3(0, -1, 0), scene);
  bottom.diffuse = color;
  bottom.intensity = intensity;

  // const left = new BABYLON.HemisphericLight('leftLight', new BABYLON.Vector3(-5, 0, 0), scene);
  // left.diffuse = color;
  // left.intensity = intensity;

  // const right = new BABYLON.HemisphericLight('bottomLight', new BABYLON.Vector3(5, 0, 0), scene);
  // right.diffuse = color;
  // right.intensity = intensity;

  // const front = new BABYLON.DirectionalLight('frontLight', new BABYLON.Vector3(0, 0, -1), scene);
  // front.diffuse = color;
  // front.intensity = intensity;
};

const generateRoom = (scene) => {
  const roomMeshOptions = {
    height: 3,
    width: 8,
    depth: 8,
    updatable: true,
    sideOrientation: BABYLON.Mesh.BACKSIDE,
  };
  const room = new BABYLON.MeshBuilder.CreateBox('room', roomMeshOptions, scene);
  room.position = new BABYLON.Vector3(0, 0, 0);
  // room.updateFacetData();
  // const url = 'https://roomhauscdnprd.blob.core.windows.net/assets/MX046/video/background.m3u8';

  // const vid = document.createElement('video');
  // const hls = new HLS();
  // hls.loadSource(url);
  // hls.attachMedia(vid);
  // const mat = new BABYLON.StandardMaterial('mat', scene);
  // const videoTexture = new BABYLON.VideoTexture('video', vid, scene, true, true);
  // mat.diffuseTexture = videoTexture;
  // mat.emissiveColor = new BABYLON.Vector3(1, 1, 1);
  // room.material = mat;
  room.material = new BABYLON.StandardMaterial(null, scene);
  room.material.diffuseColor = new BABYLON.Color3(0, 0, 0);
  return room;
};

const pointScale = scaleLinear()
  .domain([-1, 1])
  .range([-0.0005, 0.0005])
  .clamp(true);
const adjustPoints = (points, t) => {
  for (let i = 0; i < points.length; i++) {
    // const index = i * 3;
    // const [x, y, z] = [
    //   pointScale(noiseData[index]),
    //   pointScale(noiseData[index + 1]),
    //   pointScale(noiseData[index + 2]),
    // ];
    const [x, y, z] = [pointScale(Math.sin(t)), pointScale(Math.sin(t * 2)), pointScale(Math.cos(t))];

    points[i].x += x;
    points[i].y += y;
    points[i].z += z;
  }
};

const generateTubes = (scene, instance, points) => {
  const params = {path: points, radius: 0.01, updatable: true};
  if (instance) {
    params.instance = instance;
    return BABYLON.MeshBuilder.CreateTube(null, params);
  }
  const lines = BABYLON.MeshBuilder.CreateTube('tube', params, scene);
  lines.material = new BABYLON.StandardMaterial(null, scene);
  const base = 255;
  const color = new BABYLON.Color3(94 / base, 132 / base, 241 / base);
  lines.material.diffuseColor = color;
  lines.material.emissiveColor = color;
  lines.material.ambientColor = color;
  return lines;
};

const generateWater = (scene, renderList = []) => {
  const bottomWaterMesh = new BABYLON.MeshBuilder.CreateGround(
    'bottom-water-mesh',
    {width: 8, height: 8, updatable: true},
    scene,
  );
  const topWatterMesh = new BABYLON.MeshBuilder.CreateGround(
    'top-water-mesh',
    {width: 8, height: 8, updatable: true},
    scene,
  );
  const water = new WaterMaterial('watermat', scene);
  water.bumpTexture = new BABYLON.Texture(waterbump, scene);
  water.windForce = -5;
  water.waveHeight = 0;
  water.bumpHeight = 0.1;
  water.waterColor = new BABYLON.Color4(0.6, 0.6, 0.9);
  water.colorBlendFactor = 0.1;
  water.backFaceCulling = false;
  renderList.forEach((item) => water.addToRenderList(item));
  bottomWaterMesh.material = water;
  topWatterMesh.material = water;
  bottomWaterMesh.position = new BABYLON.Vector3(0, -1.25, 0);
  topWatterMesh.position = new BABYLON.Vector3(0, 1.25, 0);

  // const sphere = new BABYLON.MeshBuilder.CreateSphere('sphere', {segments: 20, diameter: 0.5, updatable: true}, scene);
  // sphere.position = new BABYLON.Vector3(1, 0, 1);
  // sphere.material = water;
  // const light = new BABYLON.PointLight('plight', sphere.position, scene);
  // light.emissiveColor = new BABYLON.Color3(0.3, 0.3, 0.7);
};

// eslint-disable-next-line import/prefer-default-export
export const build = ({scene, audio}) => {
  const CD = scene.getTransformNodeByName('CDChassis');
  // Make sure the CD is rendered in front of everything else i.e. top layer
  // CD.getChildren().forEach((child) => (child.renderingGroupId = 1)); // eslint-disable-line no-return-assign
  scene.clearColor = new BABYLON.Color4(0.1, 0.1, 0.1, 0);

  setUpLights(scene);
  const room = generateRoom(scene);

  const camera = scene.activeCamera;
  const betaLimit = Math.PI / 2;
  camera.upperBetaLimit = betaLimit;
  camera.lowerBetaLimit = betaLimit;

  // const lines = generateLines(scene);
  const boundingMesh = new BABYLON.MeshBuilder.CreateSphere(
    null,
    {segments: 40, diameterX: 8, diameterY: 3, diameterZ: 8},
    scene,
  );
  boundingMesh.position = BABYLON.Vector3.Zero();
  boundingMesh.isVisible = false;
  // boundingMesh.backFaceCulling = false;
  let allPoints = boundingMesh.createSurfacePoints(30);
  let points = [];
  let numPoints = 1024;
  let offset = Math.floor(allPoints.length / numPoints);
  for (let i = 0; i < numPoints; i++) {
    points.push(allPoints[i * offset]);
  }
  let lines = generateTubes(scene, null, points);
  generateWater(scene, [lines, ...CD.getChildren()]);

  const gl = new BABYLON.GlowLayer('glow', scene, {mainTextureSamples: 8});
  gl.blurKernelSize = 64;
  gl.addIncludedOnlyMesh(lines);
  gl.intensity = 0.4;

  // audio.makeBand('low', {
  //   lowPass: 120,
  //   highPass: 90,
  // });

  const rotScale = scaleLinear()
    .domain([-1, 1])
    .range([-0.1, 0.1])
    .clamp(true);
  // const noise = new BABYLON.NoiseProceduralTexture('perlin', 128, scene);
  let t = 0;
  scene.registerBeforeRender(() => {
    lines.rotation.y -= 0.001;
    lines.rotation.x = rotScale(Math.sin(t));
    // console.log(Math.sin(t), lines.rotation.x);
    // const color = interpolateReds(Math.abs(Math.sin(t)));
    // lines.material.emissiveColor = rbgToColor3(color);
    t += 0.005;
  });

  return scene;
};
