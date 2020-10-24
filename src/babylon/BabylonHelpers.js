import * as BABYLON from 'babylonjs';
import {scaleLinear} from 'd3';
import {forceIterable} from 'src/utils/CollectionHelpers';
import CDModel from './models/CD/CD.babylon';
import './models/CD/CD.babylon.manifest';
import EnvironmentDDS from './textures/EnvironmentSpecularHDR.dds';
// import 'src/babylon/textures/environment.dds';

export class MeshGroup {
  constructor(name, scene, children = []) {
    this.children = [];
    this.chassis = BABYLON.Mesh.CreateBox(name, 1, scene);
    this.chassis.isVisible = false;
    if (children && children.length) {
      this.add(children);
    }
  }

  update(t) {
    this.children = this.children.filter((child) => {
      if (child.__update(t)) {
        child.dispose();
        return false;
      }
      return true;
    });
  }

  dispose() {
    this.children.forEach((child) => child.dispose());
  }
  add(items) {
    const children = forceIterable(items);
    children.forEach((child) => (child.parent = this.chassis));
    this.children.push(...children);
  }
  replace(items) {
    this.dispose();
    this.add(items);
  }
}

// export const group = (name, items = [], scene) => {
//   const parent = new BABYLON.Mesh.CreateBox(name, 1, scene);
//   parent.isVisible = false;
//   items.forEach((item) => (item.parent = parent));
//   return parent;
// };

export const createGrid = (scene, color, xpos, thickness = 0.05) => {
  const density = 100;
  const size = 1000;
  var positionScale = scaleLinear()
    .domain([0, density])
    .range([-size / 2, size / 2]);
  const materialColor = color;
  const material = new BABYLON.StandardMaterial('mat', scene);
  material.diffuseColor = materialColor;
  material.emissiveColor = materialColor;

  const createVertical = (position, index) => {
    const gridLine = BABYLON.MeshBuilder.CreatePlane(
      `VerticalLine${index}`,
      {
        width: thickness,
        height: size,
        updatable: true,
        sideOrientation: BABYLON.Mesh.DOUBLESIDE,
      },
      scene,
    );
    gridLine.material = material;
    gridLine.position = position;
    return gridLine;
  };

  const createHorizontal = (position, index) => {
    const gridLine = BABYLON.MeshBuilder.CreatePlane(
      `HorizontalLine${index}`,
      {
        width: size,
        height: thickness,
        updatable: true,
        sideOrientation: BABYLON.Mesh.DOUBLESIDE,
      },
      scene,
    );
    gridLine.material = material;
    gridLine.position = position;
    return gridLine;
  };

  const verticalGroup = new MeshGroup('Vertical Line Group', scene);
  for (let i = 0; i < density; i++) {
    const position = new BABYLON.Vector3(xpos, 0, positionScale(i));
    verticalGroup.add(createVertical(position, i));
  }
  const horizontalGroup = new MeshGroup('Vertical Line Group', scene);
  for (let i = 0; i < density; i++) {
    const position = new BABYLON.Vector3(xpos, positionScale(i), 0);
    const line = createHorizontal(position, i);
    line.rotate(BABYLON.Axis.Y, Math.PI / 2);
    horizontalGroup.add(line);
  }
  // horizontalGroup.chassis.rotate(BABYLON.Axis.Y, Math.PI / 2);
  const gridGroup = new MeshGroup('Grid Group', scene, [horizontalGroup.chassis, verticalGroup.chassis]);
  return gridGroup;
};

export const makeGridGroup = (scene, color, position) => {
  const gridLeft = createGrid(scene, color, -10);
  const gridRight = createGrid(scene, color, 10);
  const gridGroup = new MeshGroup('Grid Collection', scene, [gridLeft.chassis, gridRight.chassis]);
  gridGroup.position = position || BABYLON.Vector3.Zero();
  return gridGroup;
};

export const makeSkybox = (scene, name) => {
  const skybox = BABYLON.MeshBuilder.CreateBox('skyBox', {size: 1000.0}, scene);
  const skyboxMaterial = new BABYLON.StandardMaterial('skyBox', scene);
  skyboxMaterial.backFaceCulling = false;
  skyboxMaterial.reflectionTexture = new BABYLON.CubeTexture(`/models/skyboxes/${name}/${name}`, scene);
  skyboxMaterial.reflectionTexture.coordinatesMode = BABYLON.Texture.SKYBOX_MODE;
  skyboxMaterial.diffuseColor = new BABYLON.Color3(0, 0, 0);
  skyboxMaterial.specularColor = new BABYLON.Color3(0, 0, 0);
  skybox.material = skyboxMaterial;
  return skybox;
};

export const simpleMaterial = (scene, color) => {
  const material = new BABYLON.StandardMaterial(`material${Math.random}`, scene);
  material.diffuseColor = color;
  material.emissiveColor = color;
  return material;
};

export const makeStreak = (scene, parent, updateCallback) => {
  const size = Math.random() * 0.1 + 0.01;
  const streak = new BABYLON.MeshBuilder.CreateBox(
    `streak${Math.random()}`,
    {
      width: size,
      height: size,
      depth: Math.random() * 5 + 0.1,
      updatable: true,
    },
    scene,
  );
  streak.__update = updateCallback.bind(streak);
  streak.material = simpleMaterial(scene, new BABYLON.Color3(0.6, 0.6, 0.6));
  streak.position = new BABYLON.Vector3(Math.random() * 10 - 5, Math.random() * 10 - 5, Math.random() * 100 + 100);
  parent.add(streak);
  return streak;
};

export const initCDModel = (scene, meshes, caseTexture, cdLabelTexture) => {
  const CDChassis = new BABYLON.TransformNode('CDChassis', scene);
  meshes.forEach((mesh) => {
    mesh.parent = CDChassis;
  });
  CDChassis.scaling = new BABYLON.Vector3(0.1, 0.1, 0.1);
  CDChassis.position = new BABYLON.Vector3(0, 0, 0);

  const CDMesh = scene.getMeshByName('MetalCD');

  const metal = new BABYLON.PBRMetallicRoughnessMaterial('Metal', scene);
  CDMesh.material = metal;

  metal.baseColor = new BABYLON.Color3(0.5, 0.5, 0.5);
  metal.metallic = 1;
  metal.roughness = 0.17;

  const CDCover = scene.getMeshByName('Cover');

  const cover = new BABYLON.PBRMaterial('cover', scene);
  CDCover.material = cover;

  cover.roughness = 0.8;
  // cover.emissiveTexture = new BABYLON.Texture(caseTexture, scene);
  if (cover.albedoTexture) {
    cover.albedoTexture.dispose();
  }
  cover.albedoTexture = new BABYLON.Texture(caseTexture, scene);
  cover.backFaceCulling = false;

  const cdLabel = scene.getMeshByName('CDLabel');
  if (cdLabelTexture) {
    const cdTexture = new BABYLON.Texture(cdLabelTexture, scene);
    cdLabel.material.opacityTexture = cdTexture;
    cdLabel.rotate(BABYLON.Axis.Y, Math.PI);
    cdLabel.rotate(BABYLON.Axis.Z, Math.PI);
    cdLabel.material.backFaceCulling = false;
  } else {
    cdLabel.dispose();
  }

  const hdrTexture = BABYLON.CubeTexture.CreateFromPrefilteredData(EnvironmentDDS, scene);

  const cdCaseFront = scene.getMeshByName('FrontPlastic');
  const cdCaseBack = scene.getMeshByName('BackPlastic');

  const plastic = new BABYLON.PBRMaterial('plastic', scene);
  plastic.clearCoat.isEnabled = true;
  cdCaseFront.material = plastic;
  cdCaseBack.material = plastic;

  plastic.reflectionTexture = hdrTexture;
  plastic.refractionTexture = hdrTexture;
  plastic.indexOfRefraction = 0.52;
  plastic.alpha = 0.25;
  plastic.forceIrradianceInFragment = true;
  plastic.directIntensity = 0.0;
  plastic.environmentIntensity = 0.3;
  plastic.cameraExposure = 0.66;
  plastic.cameraContrast = 1.66;
  plastic.roughness = 0.15;
  plastic.reflectivityColor = new BABYLON.Color3(0.2, 0.2, 0.2);
  plastic.albedoColor = new BABYLON.Color3(0.95, 0.95, 0.95);
  plastic.backFaceCulling = false;

  metal.environmentTexture = hdrTexture.clone('CD Texture');
  scene.registerBeforeRender(() => {
    CDChassis.rotation.y += 0.005;
  });
};

export async function loadCDModel(scene, caseTexture, cdLabelTexture) {
  const {meshes} = await BABYLON.SceneLoader.ImportMeshAsync('', CDModel, '', scene);

  initCDModel(scene, meshes, caseTexture, cdLabelTexture);

  return scene;
}

export async function loadSceneAssets(scene, babylonFilePath) {
  const parts = babylonFilePath.split('/');
  const file = parts.pop();
  const root = parts.join('/') + '/';
  return BABYLON.SceneLoader.AppendAsync(root, file, scene);
}

export const initCamera = (scene, canvas) => {
  const camera =
    scene.activeCamera ||
    new BABYLON.ArcRotateCamera('Camera', (3 * Math.PI) / 2, Math.PI / 2, 4.5, new BABYLON.Vector3(0, 0, 0), scene);
  camera.lowerRadiusLimit = camera.upperRadiusLimit = camera.radius;
  camera.setTarget(new BABYLON.Vector3(0, 0, 0));
  camera.attachControl(canvas);
  scene.activeCamera = camera;
  const spotlight = new BABYLON.SpotLight('spotlight', camera.position, camera.cameraDirection, Math.PI / 3, 2, scene);
  spotlight.intensity = 1;
  spotlight.diffuse = BABYLON.Color3.White();
  scene.registerBeforeRender(() => {
    spotlight.position = camera.position;
    spotlight.direction = camera.cameraDirection;
  });
  return scene;
};

export const hexToColor3 = (_hex) => {
  const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
  const hex = _hex.replace(shorthandRegex, (m, r, g, b) => r + r + g + g + b + b);

  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  const {r, g, b} = {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  };
  return new BABYLON.Color3(r / 255, g / 255, b / 255);
};

export const rgbToColor3 = (str) => {
  const [r, g, b] = str
    .replace('rgb(', '')
    .replace(')', '')
    .split(',')
    .map((x) => Number(x) / 255);
  return new BABYLON.Color3(r, g, b);
};

export const stringToColor3 = (str) => {
  if (str.startsWith('#')) {
    return hexToColor3(str);
  }
  if (str.startsWith('rgb(')) {
    return rgbToColor3(str);
  }
  throw Error(`Invalid color string format: ${str}`);
};

export function* colorGenerator(_colors = []) {
  const colors = _colors.map(stringToColor3);
  let index = 0;
  while (true) {
    if (index >= colors.length) {
      index = 0;
    }
    yield colors[index++];
  }
}
