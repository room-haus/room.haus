import {mediaUrl} from '../../content/media.mjs';
import React from 'react';
import {VideoBackgroundScene, build} from './templates/VideoBackground';
import CaseTexture from '../../images/mix-art/mx043.jpg';
import CDLabelTexture from '../../images/mix-labels/cd_template_MX043.png';

export const caseTexture = CaseTexture;
export const cdLabelTexture = CDLabelTexture;

export {build};

export const Background = (props) => {
  return (
    <VideoBackgroundScene
      {...props}
      manifestUrl={mediaUrl('assets/MX043/video/background.m3u8')}
    />
  );
};
