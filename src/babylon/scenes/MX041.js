import {sceneMediaUrl} from '../../content/sceneMedia.mjs';
import React from 'react';
import {VideoBackgroundScene, build} from './templates/VideoBackground';
import CaseTexture from '../../images/mix-art/mx041.jpg';
import CDLabelTexture from '../../images/mix-labels/cd_template_MX041.png';

export const caseTexture = CaseTexture;
export const cdLabelTexture = CDLabelTexture;

export {build};

export const Background = (props) => {
  return (
    <VideoBackgroundScene
      {...props}
      manifestUrl={sceneMediaUrl('MX041', 'background')}
    />
  );
};
