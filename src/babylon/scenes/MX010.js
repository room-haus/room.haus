import * as BABYLON from 'babylonjs';
import {scaleLinear} from 'd3';
import 'src/babylon/skyboxes/space/blue/';
import CaseTexture from 'src/images/mix-art/mx010.jpg';
import CDLabelTexture from '../../images/cd_template_MX010.png';

import {makeGridGroup, makeSkybox} from '../BabylonHelpers';

export const caseTexture = CaseTexture;
export const cdLabelTexture = CDLabelTexture;

export const build = ({scene, engine, audio}) => {
  let gl = null;
  if (engine.webGLVersion >= 2) {
    gl = new BABYLON.GlowLayer('glow', scene, {
      mainTextureSamples: 8,
    });
  } else {
    gl = new BABYLON.GlowLayer('glow', scene);
  }
  gl.blurKernelSize = 32;

  makeSkybox(scene, 'blue');

  const light = new BABYLON.HemisphericLight('light', new BABYLON.Vector3(0, 1, 0), scene);
  light.intensity = 10;

  const parent = scene.getMeshByName('CDChassis');
  gl.addExcludedMesh(parent);

  const color = new BABYLON.Color4(231 / 255, 12 / 255, 10 / 255, 1);
  let grid = makeGridGroup(scene, color, new BABYLON.Vector3(0, 0, 800));

  const ampScale = scaleLinear()
    .domain([60, 130])
    .range([1, 2.5]);
  audio.makeBand('kick', {
    lowPass: 120,
    highPass: 90,
    threshold: 100,
  });

  let t = 0;
  scene.registerBeforeRender(() => {
    if (audio && audio.isPlaying()) {
      t += 0.2;
    }
    if (800 - t < 0) {
      const rotation = grid.chassis.rotation.z;
      grid.dispose();
      grid = makeGridGroup(scene, color, new BABYLON.Vector3(0, 0, 800 - t));
      grid.chassis.rotation.z = rotation;
      t = 400;
    }
    const dampDistance = 300;
    const dampening = Math.min(t, dampDistance) / dampDistance;
    const _avgAmp = audio.getAverageFrequency('kick') || 0;
    const avgAmp = Math.max(_avgAmp * dampening, 60);

    grid.chassis.position = new BABYLON.Vector3(0, 0, 800 - t);
    gl.intensity = ampScale(avgAmp);
    grid.chassis.rotation.z -= 0.0001;
  });

  return scene;
};
