import * as BABYLON from 'babylonjs';
import {SkyMaterial} from 'babylonjs-materials';
import CaseTexture from 'src/images/mix-art/mx009.jpg';
import CDLabelTexture from '../../images/cd_template_MX009.png';

export const caseTexture = CaseTexture;
export const cdLabelTexture = CDLabelTexture;

export const build = ({scene, audio}) => {
  const light = new BABYLON.HemisphericLight('hemilight', new BABYLON.Vector3(0, 1, 0), scene);
  light.intensity = 10;

  const skyboxMaterial = new SkyMaterial('skyMaterial', scene);
  // skyboxMaterial.backFaceCulling = false;
  skyboxMaterial.useSunPosition = true;
  skyboxMaterial.luminance = 1;
  skyboxMaterial.rayleigh = 0.4;
  skyboxMaterial.azimuth = 1;

  // Sky mesh (box)
  const skybox = BABYLON.Mesh.CreateBox('skyBox', 1000.0, scene, false, BABYLON.Mesh.BACKSIDE);
  skybox.material = skyboxMaterial;

  let t = 0;
  scene.registerBeforeRender(() => {
    t += 0.001;
    const avgFreq = audio.isPlaying() ? audio.getAverageFrequency() : 0;
    skyboxMaterial.rayleigh = 0.2 * Math.sin(t) + Math.min(avgFreq * 0.02, 1);
    light.intensity = Math.min(avgFreq * 5 + 10, 20);
  });

  BABYLON.ParticleHelper.CreateAsync('rain', scene, true).then((set) => {
    set.start();
  });

  return scene;
};
