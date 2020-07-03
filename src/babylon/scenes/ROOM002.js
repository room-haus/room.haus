import * as BABYLON from 'babylonjs';
import CaseTexture from '../../images/mix-art/rm002.jpg';
import CDLabelTexture from '../../images/mix-labels/cd_template_RM002.png';
import {colorGenerator} from '../BabylonHelpers';

export const caseTexture = CaseTexture;
export const cdLabelTexture = CDLabelTexture;

// eslint-disable-next-line import/prefer-default-export
export const build = ({scene, engine, audio}) => {
  scene.clearColor = new BABYLON.Color3(0, 0, 0);
  scene.ambientColor = new BABYLON.Color3(1, 1, 1);
  const lol = new BABYLON.HemisphericLight('light', new BABYLON.Vector3(0, 0, 1), scene);
  lol.intensity = 1;

  // const CD = scene.getTransformNodeByName('CDChassis');
  // CD.getChildren().forEach((child) => {
  //   child.material.emmissiveColor = new BABYLON.Color3(1, 1, 1);
  // });

  const camera = scene.activeCamera;

  const createStrobe = (position, rotate) => {
    // Create the "God Rays" effect (volumetric light scattering)
    // const mesh = new BABYLON.MeshBuilder.CreateBox('sphere', {updatable: true}, scene);
    // const mesh = new BABYLON.MeshBuilder.CreateSphere('sphere', {updatable: true}, scene);
    const mesh = new BABYLON.MeshBuilder.CreatePlane('sphere', {updatable: true}, scene);
    mesh.material = new BABYLON.StandardMaterial('sphere_mat', scene);
    // mesh.material.diffuseColor = new BABYLON.Color3(0, 0, 0);
    // mesh.material.backFaceCulling = false;
    if (rotate) {
      mesh.rotation.y = Math.PI;
    }
    mesh.material.diffuseTexture = new BABYLON.Texture(
      'https://playground.babylonjs.com/textures/sun.png',
      scene,
      true,
      false,
      BABYLON.Texture.BILINEAR_SAMPLINGMODE,
    );
    mesh.material.diffuseTexture.hasAlpha = true;
    const size = 50;
    mesh.scaling = new BABYLON.Vector3(size, size, size);
    mesh.position = position;

    const godrays = new BABYLON.VolumetricLightScatteringPostProcess(
      'godrays',
      2.0,
      camera,
      mesh,
      100,
      BABYLON.Texture.BILINEAR_SAMPLINGMODE,
      engine,
      false,
      scene,
    );
    godrays.exposure = 0.2;
    godrays.decay = 0.96815;
    godrays.weight = 0.58767;
    godrays.density = 0.926;

    godrays.useDiffuseColor = true;

    const light = new BABYLON.PointLight('Omni', position, scene);

    godrays.light = light;
    return godrays;
  };

  const light = new BABYLON.PointLight('Omni', new BABYLON.Vector3(0, 0, -100), scene);
  const strobes = [
    createStrobe(new BABYLON.Vector3(0, 0, 100)),
    // createStrobe(new BABYLON.Vector3(0, 0, -100), true),
    // createStrobe(new BABYLON.Vector3(100, 0, 0)),
    // createStrobe(new BABYLON.Vector3(-100, 0, 0)),
    // createStrobe(new BABYLON.Vector3(0, 100, 0)),
    // createStrobe(new BABYLON.Vector3(0, -100, 0)),
  ];
  // const strobe = createStrobe(new BABYLON.Vector3(0, 0, 100));

  const colors = colorGenerator(['#F1E201', '#FF0286', '#37BE02', '#2775FD']);
  audio.startWorklet();
  audio.setOnsetCallback(() => {
    const color = colors.next().value;
    // strobe.mesh.material.diffuseColor = color;
    // scene.clearColor = color;
    strobes.forEach((strobe) => {
      strobe.mesh.material.diffuseColor = color;
    });
  });

  // let color = colorGenerator.next().value;

  // audio.makeBand('low', {
  //   lowPass: 90,
  //   highPass: 30,
  // });

  // let t = 0;
  // scene.registerBeforeRender(() => {
  //   const lowAmp = audio.getAverageAmplitude('low');
  //   const amount = (lowAmp - 120) / 20;
  //   lol.intensity = amount * 3 || 1;

  //   strobes.forEach((strobe) => {
  //     strobe.exposure = amount * 0.3;
  //     strobe.density = amount;
  //     strobe.light.position = strobe.mesh.position;
  //   });

  //   // const size = ((lowAmp - 120) / 20) * 5;
  //   // godrays.mesh.scaling = new BABYLON.Vector3(size, size, size);
  //   // console.log(lowAmp, light.intensity);
  //   // godrays.mesh.position.x = Math.sin(t) * 100;
  //   // godrays.mesh.position.z = Math.cos(t) * 100;
  //   // godrays.mesh.rotation.z += t / 100;
  //   // godrays.mesh.rotation.y += t / 150;
  //   // godrays.mesh.rotation.x += t / 250;
  //   t += 0.002;
  // });

  return scene;
};
