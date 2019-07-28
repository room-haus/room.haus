import React from 'react';
import * as BABYLON from 'babylonjs';
import CaseTexture from 'src/images/mix-art/mx023.jpg';
import VideoGrid from '../../components/VideoGrid';
import CDLabelTexture from '../../images/cd_template_MX023.png';

export const caseTexture = CaseTexture;
export const cdLabelTexture = CDLabelTexture;

export const build = ({scene}) => {
  const light = new BABYLON.HemisphericLight('light', new BABYLON.Vector3(0, 1, 0), scene);
  light.intensity = 10;
  scene.clearColor = new BABYLON.Color4(0, 0, 0, 0);

  return scene;
};

export const Background = (props) => (
  <VideoGrid
    {...props}
    columns={3}
    rows={3}
    videos={[
      'https://roomhauscdnprd.blob.core.windows.net/assets/MX023/video/MX023BGV-ColoursA.m3u8',
      'https://roomhauscdnprd.blob.core.windows.net/assets/MX023/video/MX023BGV-ColoursB.m3u8',
      'https://roomhauscdnprd.blob.core.windows.net/assets/MX023/video/MX023BGV-pink.m3u8',
    ]}
  />
);
