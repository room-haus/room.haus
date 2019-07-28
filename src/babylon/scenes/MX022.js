import React from 'react';
import * as BABYLON from 'babylonjs';
import VideoGrid from '../../components/VideoGrid';
import CaseTexture from 'src/images/mix-art/mx022.jpg';
import CDLabelTexture from '../../images/cd_template_MX022.png';

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
    columns={2}
    rows={2}
    videos={[
      'https://roomhauscdnprd.blob.core.windows.net/assets/MX022/videos/starry/MX022BGV-starry.m3u8',
      'https://roomhauscdnprd.blob.core.windows.net/assets/MX022/videos/static/MX022BGV-static.m3u8',
    ]}
  />
);
