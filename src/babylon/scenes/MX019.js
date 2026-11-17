import {mediaUrl} from '../../content/media.mjs';
import React from 'react';
import * as BABYLON from 'babylonjs';
import {VideoBackgroundScene} from './templates/VideoBackground';
import CaseTexture from 'src/images/mix-art/mx019.jpg';
import CDLabelTexture from '../../images/mix-labels/cd_template_MX019.png';

export const caseTexture = CaseTexture;
export const cdLabelTexture = CDLabelTexture;

export const build = ({scene}) => {
  const light = new BABYLON.HemisphericLight('light', new BABYLON.Vector3(0, 1, 0), scene);
  light.intensity = 10;
  scene.clearColor = new BABYLON.Color4(0, 0, 0, 0);

  return scene;
};

export const Background = () => <VideoBackgroundScene manifestUrl={mediaUrl('assets/MX019BGV/MX019BGV.m3u8')} />;
