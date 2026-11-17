import React from 'react';
import {VideoBackgroundScene, build} from './templates/VideoBackground';
import CaseTexture from '../../images/mix-art/mx033.jpg';
import CDLabelTexture from '../../images/mix-labels/cd_template_MX033.png';

export const caseTexture = CaseTexture;
export const cdLabelTexture = CDLabelTexture;

export {build};

export const Background = () => <VideoBackgroundScene manifestUrl="https://roomhauscdnprd.blob.core.windows.net/assets/MX033/video/octo.m3u8" />;
