import * as BABYLON from 'babylonjs';
import {makeGridGroup} from '../../BabylonHelpers';
// import {scaleLinear, interpolate} from 'd3';

function* colorGenerator(colors = []) {
  let index = 0;
  while (true) {
    if (index >= colors.length) {
      index = 0;
    }
    yield colors[index++];
  }
}

// eslint-disable-next-line import/prefer-default-export
export const build = ({scene, audio}) => {
  scene.clearColor = new BABYLON.Color3(0, 0, 0);
  scene.ambientColor = new BABYLON.Color3(1, 1, 1);
  const light = new BABYLON.HemisphericLight('light', new BABYLON.Vector3(0, 1, 0), scene);
  light.intensity = 10;

  // const grid = makeGridGroup(scene, BABYLON.Color3.White());
  const colors = [BABYLON.Color3.White(), BABYLON.Color3.Red(), BABYLON.Color3.Green(), BABYLON.Color3.Blue()];
  const generateLines = (size, density = 1) => {
    const lines = [];
    for (let y = -size / 2; y < size / 2; y += density) {
      lines.push([new BABYLON.Vector3(-4, y, -size), new BABYLON.Vector3(-4, y, size)]);
      lines.push([new BABYLON.Vector3(4, y, -size), new BABYLON.Vector3(4, y, size)]);

      lines.push([new BABYLON.Vector3(y, -4, -size), new BABYLON.Vector3(y, -4, size)]);
      lines.push([new BABYLON.Vector3(y, 4, -size), new BABYLON.Vector3(y, 4, size)]);

      lines.push([new BABYLON.Vector3(-size, y, -4), new BABYLON.Vector3(size, y, -4)]);
      lines.push([new BABYLON.Vector3(-size, y, 4), new BABYLON.Vector3(size, y, 4)]);
    }
    return lines;
  };
  const lines = generateLines(100, 1);
  const lineSystem = new BABYLON.MeshBuilder.CreateLineSystem('lines', {lines, updatable: true}, scene);
  const colorGen = colorGenerator(colors);

  audio.startWorklet();
  audio.setOnsetCallback(() => {
    lineSystem.color = colorGen.next().value;
  });

  // const glowLayer = new BABYLON.GlowLayer('glow', scene, {
  //   mainTextureFixedSize: 256,
  //   blurKernelSize: 32,
  // });
  scene.registerBeforeRender(() => {
    lineSystem.rotation.x += 0.0002;
    lineSystem.rotation.y += 0.0003;
    lineSystem.rotation.z += 0.0001;
  });
  // const skybox = BABYLON.Mesh.CreateBox('skyBox', 100.0, scene);
  // const skyboxMaterial = new BABYLON.StandardMaterial('skyBox', scene);
  // skyboxMaterial.backFaceCulling = false;
  // skyboxMaterial.useSunPosition = true;
  // skyboxMaterial.reflectionTexture = new BABYLON.CubeTexture(
  //   '//www.babylonjs.com/assets/skybox/TropicalSunnyDay',
  //   scene,
  // );
  // skyboxMaterial.reflectionTexture.coordinatesMode = BABYLON.Texture.SKYBOX_MODE;
  // skyboxMaterial.emissiveColor = new BABYLON.Color3(0.3, 0.2, 0.3);
  // skybox.material = skyboxMaterial;
  // for (let i = 0; i < 50; i++) {
  //   const cube = new BABYLON.Mesh.CreateBox('box' + i, Math.random() * 10, scene, true);
  //   cube.position = new BABYLON.Vector3(Math.random() * 3, Math.random() * 3, Math.random() * 3);
  //   cube.enableEdgesRendering();
  //   cube.edgesWidth = 2.0;
  //   cube.edgesColor = new BABYLON.Color3(1, 1, 1);
  // }

  return scene;
};
