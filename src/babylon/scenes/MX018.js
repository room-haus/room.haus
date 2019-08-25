import * as BABYLON from 'babylonjs';
import CaseTexture from 'src/images/mix-art/mx018.jpg';
import {scaleLinear, scaleLog} from 'd3';
import ModelPath from 'src/babylon/models/MX018/jett.babylon';
import CDLabelTexture from '../../images/mix-labels/cd_template_MX018.png';
import 'src/babylon/models/MX018/jett.babylon.manifest';
import 'src/babylon/models/MX018/Concrete.Cast-In-Place.Flat.Broom.Grey.bump.jpg';

export const sceneAssetsPath = ModelPath;
export const cdLabelTexture = CDLabelTexture;
export const caseTexture = CaseTexture;

const bumpScale = scaleLog()
  .domain([127, 140])
  .range([0.8, 1])
  .clamp(true);

const energyScale = scaleLinear()
  .domain([0, 100000])
  .range([1, 5])
  .clamp(true);

export const build = ({scene, audio, assetsLoaded}) => {
  scene.clearColor = new BABYLON.Color3(0.05, 0.05, 0.05);

  if (assetsLoaded) {
    audio.makeBand('kick', {
      lowPass: 100,
      highPass: 30,
    });

    const innerSphere = scene.getMeshByName('InnerSphere');
    const outerSphere = scene.getMeshByName('OuterSphere');
    const middleSphere = scene.getMeshByName('MiddleSphere');
    innerSphere.scaling = new BABYLON.Vector3(0.03, 0.03, 0.03);
    innerSphere.position = new BABYLON.Vector3(0, 0, 0);
    outerSphere.scaling = new BABYLON.Vector3(0.01, 0.01, 0.01);
    outerSphere.position = new BABYLON.Vector3(0, 0, 0);
    middleSphere.scaling = new BABYLON.Vector3(0.01, 0.01, 0.01);
    middleSphere.position = new BABYLON.Vector3(0, 0, 0);

    scene.registerBeforeRender(() => {
      const totalEnergy = audio.getTotalEnergy();
      const energy = energyScale(totalEnergy);
      outerSphere.rotation.y += 0.001;
      outerSphere.rotation.z += 0.002;
      middleSphere.rotation.y -= 0.001 * energy;
      middleSphere.rotation.x -= 0.002 * energy;
      innerSphere.rotation.z -= 0.001 * energy;
      innerSphere.rotation.x += 0.002 * energy;

      const kickAmp = audio.getAverageAmplitude('kick');
      const scale = bumpScale(kickAmp);
      outerSphere.scaling = new BABYLON.Vector3(0.1 * scale, 0.1 * scale, 0.1 * scale);
      middleSphere.scaling = new BABYLON.Vector3(0.09 * scale, 0.09 * scale, 0.09 * scale);
      innerSphere.scaling = new BABYLON.Vector3(0.3 * scale, 0.3 * scale, 0.3 * scale);
    });
  }
  return scene;
};
