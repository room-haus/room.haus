import {sceneMediaUrl} from '../../content/sceneMedia.mjs';
import React from 'react';
import {VideoBackgroundScene, build} from './templates/VideoBackground';
import CaseTexture from '../../images/mix-art/mx028.jpg';
import CDLabelTexture from '../../images/mix-labels/cd_template_MX028.png';

export const caseTexture = CaseTexture;
export const cdLabelTexture = CDLabelTexture;

export {build};

export const Background = (props) => {
  return (
    <VideoBackgroundScene
      {...props}
      manifestUrl={sceneMediaUrl('MX028', 'background')}
    />
  );
};
