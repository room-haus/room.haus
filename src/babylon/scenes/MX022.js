import {sceneMediaUrl} from '../../content/sceneMedia.mjs';
import React from 'react';
import * as BABYLON from 'babylonjs';
import VideoGrid from '../../components/VideoGrid';
import CaseTexture from 'src/images/mix-art/mx022.jpg';
import CDLabelTexture from '../../images/mix-labels/cd_template_MX022.png';

export const caseTexture = CaseTexture;
export const cdLabelTexture = CDLabelTexture;

export const build = ({scene, audio}) => {
  const light = new BABYLON.HemisphericLight('light', new BABYLON.Vector3(0, 1, 0), scene);
  light.intensity = 10;
  scene.clearColor = new BABYLON.Color4(0, 0, 0, 0);

  audio.startWorklet();

  return scene;
};

export const Background = (props) => (
  <VideoGrid
    {...props}
    columns={2}
    rows={2}
    videos={[
      sceneMediaUrl('MX022', 'MX022BGV-starry'),
      sceneMediaUrl('MX022', 'MX022BGV-static'),
    ]}
  />
);
