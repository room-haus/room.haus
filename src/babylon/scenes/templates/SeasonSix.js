import * as BABYLON from 'babylonjs';
import {WaterMaterial} from 'babylonjs-materials';

// eslint-disable-next-line import/prefer-default-export
export const builder = ({scene}) => {
  scene.clearColor = new BABYLON.Color3(0, 0, 0);

  // scene.debugLayer.show();

  const camera = scene.activeCamera;
  const betaLimit = Math.PI / 2;
  camera.upperBetaLimit = betaLimit;
  camera.lowerBetaLimit = betaLimit;

  const light = new BABYLON.HemisphericLight('light', new BABYLON.Vector3(0, 1, 0), scene);
  light.intensity = 10;
  const light2 = new BABYLON.HemisphericLight('light', new BABYLON.Vector3(0, 1, 0), scene);
  light2.intensity = 1;

  const spotLight = new BABYLON.SpotLight(
    'spot-light',
    camera.position,
    new BABYLON.Vector3(0, 0, 1),
    Math.PI / 1.5,
    2,
    scene,
  );
  spotLight.position = new BABYLON.Vector3(0, 0.7, -3.5);
  spotLight.intensity = 1;
  spotLight.shadowEnabled = true;
  spotLight.excludedMeshes.push(scene.getMeshByName('MetalCD'), scene.getMeshByName('CD_Insert_Solid'));

  camera.onViewMatrixChangedObservable.add((cam) => {
    spotLight.setDirectionToTarget(cam.getTarget());
    const distance = 0.8;
    spotLight.position = cam.position.multiply(new BABYLON.Vector3(distance, 1, distance));
    spotLight.position.y = 0.7;
  });

  const shadowGenerator = new BABYLON.ShadowGenerator(1024 * 8, spotLight);
  shadowGenerator.getShadowMap().renderList.push(...scene.getTransformNodeByName('CDChassis').getChildren());

  const background = BABYLON.MeshBuilder.CreatePlane('background', {size: 10}, scene);
  background.position = new BABYLON.Vector3(0, 0, 7);
  const material = new BABYLON.StandardMaterial('bg-mat', scene);
  material.diffuseColor = new BABYLON.Color3(1, 1, 1);
  background.parent = camera;
  background.material = material;
  background.receiveShadows = true;
  light.excludedMeshes.push(background);

  const water = BABYLON.MeshBuilder.CreatePlane('water', {width: 10, height: 10, updatable: true});
  water.position = new BABYLON.Vector3(0, -2, 6);
  water.parent = camera;
  const waterMaterial = new WaterMaterial('waterMaterial', scene, new BABYLON.Vector2(512, 512));
  waterMaterial.bumpTexture = new BABYLON.Texture('//www.babylonjs.com/assets/waterbump.png', scene);
  // waterMaterial.windForce = -10;
  // waterMaterial.waveHeight = 0.1;
  // waterMaterial.bumpHeight = 0.2;
  // waterMaterial.waveLength = 0.1;
  // waterMaterial.waveSpeed = 50.0;
  waterMaterial.colorBlendFactor = 0;
  waterMaterial.windDirection = new BABYLON.Vector2(1, 1);
  waterMaterial.colorBlendFactor = 0;
  water.material = waterMaterial;

  waterMaterial.addToRenderList(background);
  scene
    .getTransformNodeByName('CDChassis')
    .getChildren()
    .forEach((c) => waterMaterial.addToRenderList(c));

  let t = 0;
  scene.registerBeforeRender(() => {
    const r = Math.sin(t);
    const g = Math.cos(t);
    const b = Math.sin(t) * Math.cos(t);
    material.diffuseColor = new BABYLON.Color3(r, g, b);
    t += 0.01;
  });

  return scene;
};
