import React from 'react';
import {VideoBackgroundScene, build} from './templates/VideoBackground';
import CaseTexture from '../../images/mix-art/mx026.jpg';
import CDLabelTexture from '../../images/mix-labels/cd_template_MX026.png';

export const caseTexture = CaseTexture;
export const cdLabelTexture = CDLabelTexture;

export {build};

export const Background = (props) => {
  return (
    <VideoBackgroundScene
      {...props}
      manifestUrl="https://roomhauscdnprd.blob.core.windows.net/assets/MX026/video/background.m3u8"
    />
  );
};
