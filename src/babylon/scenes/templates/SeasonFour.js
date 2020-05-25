import * as BABYLON from 'babylonjs';
import {hexToColor3} from '../../BabylonHelpers';
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
export const builder = ({backgroundColors = [], gridColor} = {}) => ({scene, audio}) => {
  scene.clearColor = new BABYLON.Color3(0, 0, 0);
  scene.ambientColor = new BABYLON.Color3(1, 1, 1);
  const light = new BABYLON.HemisphericLight('light', new BABYLON.Vector3(0, 1, 0), scene);
  light.intensity = 10;

  const colors = backgroundColors.map(hexToColor3);
  const generateLines = (size, density = 1) => {
    const xPlane = [];
    const yPlane = [];
    const zPlane = [];
    for (let y = -size / 2; y < size / 2; y += density) {
      xPlane.push([new BABYLON.Vector3(-4, y, -size), new BABYLON.Vector3(-4, y, size)]);
      xPlane.push([new BABYLON.Vector3(4, y, -size), new BABYLON.Vector3(4, y, size)]);

      yPlane.push([new BABYLON.Vector3(y, -4, -size), new BABYLON.Vector3(y, -4, size)]);
      yPlane.push([new BABYLON.Vector3(y, 4, -size), new BABYLON.Vector3(y, 4, size)]);

      zPlane.push([new BABYLON.Vector3(-size, y, -4), new BABYLON.Vector3(size, y, -4)]);
      zPlane.push([new BABYLON.Vector3(-size, y, 4), new BABYLON.Vector3(size, y, 4)]);
    }
    return {xPlane, yPlane, zPlane};
  };
  const {xPlane, yPlane, zPlane} = generateLines(100, 1);
  const xLineSystem = new BABYLON.MeshBuilder.CreateLineSystem('x-lines', {lines: xPlane, updatable: true}, scene);
  const yLineSystem = new BABYLON.MeshBuilder.CreateLineSystem('y-lines', {lines: yPlane, updatable: true}, scene);
  const zLineSystem = new BABYLON.MeshBuilder.CreateLineSystem('z-lines', {lines: zPlane, updatable: true}, scene);
  const gridColor3 = hexToColor3(gridColor);
  xLineSystem.color = gridColor3;
  yLineSystem.color = gridColor3;
  zLineSystem.color = gridColor3;

  const colorGen = colorGenerator(colors);
  scene.clearColor = colorGen.next().value;
  audio.startWorklet();
  audio.setOnsetCallback(() => {
    scene.clearColor = colorGen.next().value;
  });

  // const glowLayer = new BABYLON.GlowLayer('glow', scene, {
  //   mainTextureFixedSize: 256,
  //   blurKernelSize: 32,
  // });
  scene.registerBeforeRender(() => {
    xLineSystem.rotation.x += 0.002;
    yLineSystem.rotation.y += 0.003;
    zLineSystem.rotation.z += 0.001;
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

  return scene;
};
