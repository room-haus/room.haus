import * as BABYLON from 'babylonjs';
import {WaterMaterial} from 'babylonjs-materials';
import HLS from 'hls.js';
import waterbump from './waterbump.png';

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
  room.updateFacetData();
  const url = 'https://roomhauscdnprd.blob.core.windows.net/assets/MX045/video/background.m3u8';

  const vid = document.createElement('video');
  const hls = new HLS();
  hls.loadSource(url);
  hls.attachMedia(vid);
  const mat = new BABYLON.StandardMaterial('mat', scene);
  const videoTexture = new BABYLON.VideoTexture('video', vid, scene, true, true);
  mat.diffuseTexture = videoTexture;
  mat.emissiveColor = new BABYLON.Vector3(1, 1, 1);
  room.material = mat;
  return room;
};

const generateLines = (scene) => {
  const points = [];
  const colors = [];
  const size = 3;
  for (let i = 0; i < 100; i++) {
    const vec = new BABYLON.Vector3(Math.random(), Math.random(), Math.random());
    points.push(vec.multiplyByFloats(size * 2, size * 2, size * 2).subtractFromFloats(size, size, size));
    colors.push(new BABYLON.Color4(vec.x, vec.y, vec.z, 1));
  }
  return BABYLON.MeshBuilder.CreateLines('lines', {points, colors}, scene);
};

const generateWater = (scene, renderList = []) => {
  const bottomWaterMesh = new BABYLON.MeshBuilder.CreateGround(
    'waterMesh',
    {width: 8, height: 8, updatable: true},
    scene,
  );
  const topWatterMesh = new BABYLON.MeshBuilder.CreateGround(
    'waterMesh',
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

  // generateLines(scene);
  generateWater(scene, [room, ...CD.getChildren()]);

  return scene;
};
