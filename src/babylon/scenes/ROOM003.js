import * as BABYLON from 'babylonjs';
import throttle from 'lodash/throttle';
import {interpolateRainbow} from 'd3';
import CaseTexture from '../../images/mix-art/rm003.jpg';
import CDLabelTexture from '../../images/mix-labels/cd_template_RM003.png';
import {stringToColor3} from '../BabylonHelpers';

const getColor = (x) => stringToColor3(interpolateRainbow(x));

export const caseTexture = CaseTexture;
export const cdLabelTexture = CDLabelTexture;

// eslint-disable-next-line import/prefer-default-export
export const build = ({scene, engine, audio}) => {
  scene.clearColor = new BABYLON.Color3(0, 0, 0);
  scene.ambientColor = new BABYLON.Color3(1, 1, 1);
  const lol = new BABYLON.HemisphericLight('light', new BABYLON.Vector3(0, 1, 0), scene);
  lol.intensity = 5;
  const lol2 = new BABYLON.HemisphericLight('light2', new BABYLON.Vector3(0, -1, 0), scene);
  lol2.intensity = 5;

  const gl = new BABYLON.GlowLayer('glow', scene);
  gl.intensity = 1.5;

  const path = [
    new BABYLON.Vector3(-1.0, 0.0, 0.0),
    new BABYLON.Vector3(0.0, 1, 0.0),
    new BABYLON.Vector3(1.0, 0, 0.0),
    new BABYLON.Vector3(0.0, -1, 0.0),
    new BABYLON.Vector3(-1.0, 0.0, 0.0),
  ];

  const colors = new Array(path.length).fill(0).map(() => new BABYLON.Color4(1, 1, 1, 1));

  const step = 1.0;
  const zDepth = 25;

  const squares = [];
  const addShape = (shapeCount = 10, scale = 1) => {
    for (let i = 0; i < shapeCount; i += 1) {
      const square = BABYLON.MeshBuilder.CreateLines('tube', {points: path, colors, updatable: true}, scene);
      square.material.emissiveColor = new BABYLON.Color3(1, 0.5, 0);
      square.material.disableLighting = true;
      square.material.alpha = 1;

      square.idx = i;
      square.originalPosZ = -square.idx * step;

      square.position.z = -zDepth;
      square.scaling = new BABYLON.Vector3(scale, scale, scale);

      squares.push(square);
    }
  };
  const addLow = throttle(() => addShape(1, 5), 100);
  const addMid = throttle(() => addShape(1, 2), 300);

  // addShapes(50);
  // audio.startWorklet();
  // audio.setOnsetCallback(() => {
  //   console.log('YEET');
  //   // addShapes(2);
  // });
  audio.makeBand('low', {
    lowPass: 300,
  });
  audio.makeBand('clap', {
    highPass: 5000,
    lowPass: 10000,
  });

  let time = 0;
  const rate = 0.01;
  scene.registerBeforeRender(() => {
    // gl.intensity = audio.isPlaying() ? 1.5 : 0.5;
    const energy = audio.getAverageAmplitude('low');
    // console.log(energy);
    if (energy > 140) {
      addLow();
    }
    const clap = audio.getAverageFrequency('clap');
    if (clap > 100) {
      addMid();
    }
    for (let i = squares.length - 1; i >= 0; i--) {
      const square = squares[i];
      square.position.z += 0.1;
      square.rotation.z = (Math.cos(time + square.idx * 0.1) * Math.PI) / 2;
      if (square.position.z > zDepth) {
        squares.splice(i, 1);
        square.dispose();
        // square.idx += squaresCount;
        // square.originalPosZ = -square.idx * step;
        // toRemove.push(square);
      } else {
        const percent = (square.position.z + zDepth) / (2 * zDepth);
        const color = getColor(percent);
        square.material.emissiveColor = color;
        // BABYLON.Color3.HSVtoRGBToRef(magic, 1, 1, square.material.emissiveColor);
        // square.material.emissiveColor.scaleToRef(1 - Math.sqrt(Math.abs(magic)), square.material.emissiveColor);
      }
    }

    // camera.fov = (Math.sin(time * 3) * 0.25 + 0.75) * 0.25 + 0.525;
    time += scene.getAnimationRatio() * rate;
  });

  return scene;
};
