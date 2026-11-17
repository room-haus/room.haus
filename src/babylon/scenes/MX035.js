import React from 'react';
import {VideoBackgroundScene, build} from './templates/VideoBackground';
import CaseTexture from '../../images/mix-art/mx035.jpg';
import CDLabelTexture from '../../images/mix-labels/cd_template_MX035.png';

export const caseTexture = CaseTexture;
export const cdLabelTexture = CDLabelTexture;

export {build};

export const Background = () => <VideoBackgroundScene manifestUrl="https://roomhauscdnprd.blob.core.windows.net/assets/MX035/video/lava.m3u8" />;
