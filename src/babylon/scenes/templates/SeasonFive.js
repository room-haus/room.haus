import * as BABYLON from 'babylonjs';
import {scaleLinear} from 'd3';
// import {hexToColor3} from '../../BabylonHelpers';

// function* colorGenerator(colors = []) {
//   let index = 0;
//   while (true) {
//     if (index >= colors.length) {
//       index = 0;
//     }
//     yield colors[index++];
//   }
// }

// eslint-disable-next-line import/prefer-default-export
export const builder = (sphereMap) => ({scene, audio}) => {
  scene.clearColor = new BABYLON.Color3(0, 0, 0);
  // scene.ambientColor = new BABYLON.Color3(1, 1, 1);

  const camera = scene.activeCamera;
  const betaLimit = Math.PI / 2;
  camera.upperBetaLimit = betaLimit;
  camera.lowerBetaLimit = betaLimit;

  const pipeline = new BABYLON.DefaultRenderingPipeline('default', true, scene, [scene.activeCamera]);
  pipeline.depthOfFieldBlurLevel = BABYLON.DepthOfFieldEffectBlurLevel.Medium;
  pipeline.depthOfFieldEnabled = true;
  pipeline.depthOfField.focalLength = 180;
  pipeline.depthOfField.fStop = 10;
  pipeline.depthOfField.focusDistance = 2000;

  const glass = BABYLON.MeshBuilder.CreatePlane('glass', {width: 5, height: 5}, scene);
  glass.position = new BABYLON.Vector3(0, -1, 0);
  glass.rotation = new BABYLON.Vector3(Math.PI / 2, 0, 0);
  glass.computeWorldMatrix(true);
  const glass_worldMatrix = glass.getWorldMatrix();
  const glass_vertexData = glass.getVerticesData('normal');
  let glassNormal = new BABYLON.Vector3(glass_vertexData[0], glass_vertexData[1], glass_vertexData[2]);
  // Use worldMatrix to transform normal into its current value
  glassNormal = new BABYLON.Vector3.TransformNormal(glassNormal, glass_worldMatrix);

  // Create reflecting surface for mirror surface
  const reflector = new BABYLON.Plane.FromPositionAndNormal(glass.position, glassNormal.scale(-1));

  // Create the mirror material
  const mirrorMaterial = new BABYLON.StandardMaterial('mirror', scene);
  mirrorMaterial.reflectionTexture = new BABYLON.MirrorTexture('mirror', 1024, scene, true);
  mirrorMaterial.reflectionTexture.mirrorPlane = reflector;
  mirrorMaterial.reflectionTexture.level = 0.3;

  glass.material = mirrorMaterial;

  const shell = BABYLON.Mesh.CreateSphere('sphere', 8, 50, scene, true);
  const mat = new BABYLON.StandardMaterial('mat', scene);
  mat.backFaceCulling = false;
  mat.alpha = 1;
  // const c = [0, 255, 0].map((x) => x / 255);
  mat.bumpTexture = new BABYLON.Texture('http://www.synergy-development.fr/equalonyzer/images/grained_uv.png', scene);
  const scale = 0.15;
  mat.bumpTexture.uScale = scale;
  mat.bumpTexture.vScale = scale;
  mat.reflectionTexture = new BABYLON.Texture(
    sphereMap,
    // 'http://www.synergy-development.fr/equalonyzer/images/spheremap.jpg',
    scene,
  );
  mat.reflectionTexture.level = 2;
  mat.reflectionTexture.coordinatesMode = BABYLON.Texture.SPHERICAL_MODE;
  // mat.diffuseColor = new BABYLON.Color3(0, 0, 0);

  shell.material = mat;

  const light = new BABYLON.HemisphericLight('light', new BABYLON.Vector3(0, 1, 0), scene);
  light.intensity = 10;
  light.excludedMeshes.push(shell, glass);
  const CD = scene.getTransformNodeByName('CDChassis');
  mirrorMaterial.reflectionTexture.renderList.push(shell);
  CD.getChildren((child) => mirrorMaterial.reflectionTexture.renderList.push(child));

  audio.makeBand('low', {
    lowPass: 90,
    highPass: 30,
  });
  audio.makeBand('high', {
    highPass: 5000,
  });
  const lowScale = scaleLinear()
    .domain([127, 130])
    .range([10, 200]);
  lowScale.clamp(true);
  const highScale = scaleLinear()
    .domain([0, 100000])
    .range([1, 1.5]);
  highScale.clamp(true);

  scene.registerBeforeRender(() => {
    const highEnergy = audio.getTotalEnergy('high');
    shell.material.reflectionTexture.level = highScale(highEnergy);

    const lowAmp = audio.getAverageAmplitude('low');
    pipeline.depthOfField.fStop = lowScale(lowAmp);

    shell.rotation.x += 0.0001;
    shell.rotation.y += 0.0003;
    shell.rotation.z += 0.0002;
  });

  return scene;
};
