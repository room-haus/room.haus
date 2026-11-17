import {sceneMediaUrl} from '../../content/sceneMedia.mjs';
import React from 'react';
import {VideoBackgroundScene, build} from './templates/VideoBackground';
import CaseTexture from '../../images/mix-art/mx034.jpg';
import CDLabelTexture from '../../images/mix-labels/cd_template_MX034.png';

export const caseTexture = CaseTexture;
export const cdLabelTexture = CDLabelTexture;

export {build};

export const Background = () => <VideoBackgroundScene manifestUrl={sceneMediaUrl('MX034', 'background')} />;
