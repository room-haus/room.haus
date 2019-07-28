import * as BABYLON from 'babylonjs';
import {scaleLinear} from 'd3';
import {forceIterable} from 'src/utils/CollectionHelpers';
import CDModel from './models/CD/CD.babylon';
import EnvironmentDDS from './textures/EnvironmentSpecularHDR.dds';
import 'src/babylon/textures/environment.dds';

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

export const createGrid = (scene, color, xpos) => {
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
        width: 0.05,
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
        height: 0.05,
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

export const makeSkybox = (scene, location) => {
  const skybox = BABYLON.MeshBuilder.CreateBox('skyBox', {size: 1000.0}, scene);
  const skyboxMaterial = new BABYLON.StandardMaterial('skyBox', scene);
  skyboxMaterial.backFaceCulling = false;
  skyboxMaterial.reflectionTexture = new BABYLON.CubeTexture(location, scene);
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
  const CDChassis = new BABYLON.Mesh.CreateBox('CDChassis', 1, scene);
  meshes.forEach((mesh) => {
    mesh.parent = CDChassis;
  });
  CDChassis.isVisible = false;
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
  cover.albedoTexture = new BABYLON.Texture(caseTexture, scene);
  cover.backFaceCulling = false;

  const cdLabel = scene.getMeshByName('CDLabel');
  if (cdLabelTexture) {
    cdLabel.material.opacityTexture = new BABYLON.Texture(cdLabelTexture, scene);
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
  console.log(babylonFilePath);
  const parts = babylonFilePath.split('/');
  console.log(parts);
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
  return scene;
};
