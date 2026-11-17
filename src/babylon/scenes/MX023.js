import {sceneMediaUrl} from '../../content/sceneMedia.mjs';
import React from 'react';
import * as BABYLON from 'babylonjs';
import CaseTexture from 'src/images/mix-art/mx023.jpg';
import VideoGrid from '../../components/VideoGrid';
import CDLabelTexture from '../../images/mix-labels/cd_template_MX023.png';

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
    columns={3}
    rows={3}
    videos={[
      sceneMediaUrl('MX023', 'MX023BGV-ColoursA'),
      sceneMediaUrl('MX023', 'MX023BGV-ColoursB'),
      sceneMediaUrl('MX023', 'MX023BGV-pink'),
    ]}
  />
);
