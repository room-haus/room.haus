import React from 'react';
import VideoGrid from '../../components/VideoGrid';
import * as BABYLON from 'babylonjs';
import CaseTexture from 'src/images/mix-art/mx013.jpg';
import CDLabelTexture from '../../images/mix-labels/cd_template_MX013.png';

export const caseTexture = CaseTexture;
export const cdLabelTexture = CDLabelTexture;

export const build = ({scene}) => {
  const light = new BABYLON.HemisphericLight('light', new BABYLON.Vector3(0, 1, 0), scene);
  light.intensity = 10;
  scene.clearColor = new BABYLON.Color4(0, 0, 0, 0);

  return scene;
};

export const Background = ({source}) => (
  <VideoGrid source={source} columns={3} rows={3} videos={['https://www.dropbox.com/s/sslop96edbf800p/mx013video.mp4?dl=1']} />
);
