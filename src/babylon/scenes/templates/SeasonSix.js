import * as BABYLON from 'babylonjs';
import {CustomMaterial} from 'babylonjs-materials';
// import {scaleLinear} from 'd3';

const {MeshBuilder, Mesh, Matrix} = BABYLON;

// eslint-disable-next-line import/prefer-default-export
export const builder = () => ({scene}) => {
  const length = 10;
  const segments = 500;
  const radius = 0.05;
  const spaceBetween = 0.5;
  const rowItems = 21;
  const totalItems = (rowItems + 1) * (rowItems + 1);

  const blackColor = new BABYLON.Color3(16 / 255, 22 / 255, 26 / 255);
  const whiteColor = new BABYLON.Color3(245 / 255, 248 / 255, 250 / 255);

  const initTime = +new Date();

  //
  // Main scene ===============================
  //

  scene.clearColor = BABYLON.Color4.FromColor3(blackColor);

  const camera = new BABYLON.ArcRotateCamera(
    'camera',
    -Math.PI / 2,
    Math.PI / 2,
    -0.0,
    new BABYLON.Vector3(0, 0, 0),
    scene,
  );
  // camera.attachControl(canvas, true);
  camera.minZ = 0.1;
  camera.fov = 1.15;

  const baseLight = new BABYLON.HemisphericLight('hemiLight', new BABYLON.Vector3(-1, 1, 0), scene);
  baseLight.diffuse = new BABYLON.Color3(1, 1, 1);
  baseLight.groundColor = new BABYLON.Color3(1, 1, 1);

  const mainMaterial = new CustomMaterial('tubeMaterial', scene);
  mainMaterial.specularColor = new BABYLON.Color3(0.0, 0.0, 0.0);
  mainMaterial.emissiveColor = new BABYLON.Color3(0.1, 0.1, 0.1);
  mainMaterial.freeze();

  //
  // Meshes
  //

  const contourMaterial = new CustomMaterial('tubeMaterial', scene);
  contourMaterial.diffuseColor = whiteColor;
  contourMaterial.specularColor = new BABYLON.Color3(0, 0, 0);

  const fillerMaterial = new CustomMaterial('tubeMaterial', scene);
  fillerMaterial.diffuseColor = blackColor;
  fillerMaterial.specularColor = new BABYLON.Color3(0, 0, 0);

  const path = [];
  for (let i = 0; i < length; i += length / segments) {
    path.push(new BABYLON.Vector3(0, 0, i - 1));
  }
  const meshParams = {
    path,
    tessellation: 32,
    radius,
    cap: BABYLON.Mesh.DOUBLESIDE,
    scene,
    updatable: false,
  };

  const contourMesh = BABYLON.MeshBuilder.CreateTube('tube', {...meshParams, sideOrientation: BABYLON.Mesh.BACKSIDE});
  contourMesh.material = contourMaterial;

  const fillerMesh = MeshBuilder.CreateTube('tube', {...meshParams, sideOrientation: Mesh.FRONTSIDE});
  fillerMesh.material = fillerMaterial;

  const bufferMatrices = new Float32Array(16 * totalItems);
  let idx = 0;
  for (let y = -rowItems / 2; y <= rowItems / 2; y += 1) {
    for (let x = -rowItems / 2; x <= rowItems / 2; x += 1) {
      const matrix = Matrix.Translation(x * spaceBetween, y * spaceBetween, 0);
      matrix.copyToArray(bufferMatrices, 16 * idx);
      idx += 1;
    }
  }
  contourMesh.thinInstanceSetBuffer('matrix', bufferMatrices, 16);
  fillerMesh.thinInstanceSetBuffer('matrix', bufferMatrices, 16);

  //
  // Shaders
  //

  contourMaterial.Vertex_Before_PositionUpdated(`
    positionUpdated = positionUpdated + normalUpdated * radius * (2.0 + positionUpdated.z * .025);

    float t = iTime * speed;
    float k = positionUpdated.z * factor;
    positionUpdated.x += sin(k - t) * swingSize;
    positionUpdated.y += cos(k - t) * swingSize;    
  `);

  fillerMaterial.Vertex_Before_PositionUpdated(`
    float t = iTime * speed;
    float k = positionUpdated.z * factor;
    positionUpdated.x += sin(k - t) * swingSize;
    positionUpdated.y += cos(k - t) * swingSize;    
  `);

  [fillerMaterial, contourMaterial].forEach((material) => {
    material.AddUniform('iTime', 'float');
    material.AddUniform('factor', 'float');
    material.AddUniform('speed', 'float');
    material.AddUniform('radius', 'float');
    material.AddUniform('swingSize', 'float');

    material.onBind = () => {
      const time = (+new Date() - initTime) * 0.001;
      material.getEffect().setFloat('iTime', time);
      material.getEffect().setFloat('factor', 1.0);
      material.getEffect().setFloat('speed', 5);
      material.getEffect().setFloat('radius', radius);
      material.getEffect().setFloat('swingSize', 0.15);
    };
  });

  // FOV control

  window.addEventListener('mousewheel', (e) => {
    const sign = Math.sign(e.wheelDelta) * -1;

    camera.fov += sign * 0.05;
    camera.fov = Math.max(Math.min(camera.fov, 1.2), 0.25);
  });

  return scene;
};
