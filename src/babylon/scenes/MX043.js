import React from 'react';
import {VideoBackgroundScene, build} from './templates/VideoBackground';
import CaseTexture from '../../images/mix-art/mx043.jpg';
// import CDLabelTexture from '../../images/mix-labels/cd_template_MX043.png';

export const caseTexture = CaseTexture;
// export const cdLabelTexture = CDLabelTexture;

// eslint-disable-next-line import/prefer-default-export
export {build};

export const Background = (props) => {
  return (
    <VideoBackgroundScene
      {...props}
      manifestUrl="https://roomhauscdnprd.blob.core.windows.net/assets/MX043/video/background.m3u8"
    />
  );
};
