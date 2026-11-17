import React from 'react';
import {VideoBackgroundScene, build} from './templates/VideoBackground';
import CaseTexture from '../../images/mix-art/mx031.jpg';
import CDLabelTexture from '../../images/mix-labels/cd_template_MX031.png';

export const caseTexture = CaseTexture;
export const cdLabelTexture = CDLabelTexture;

export {build};

export const Background = () => <VideoBackgroundScene manifestUrl="https://roomhauscdnprd.blob.core.windows.net/assets/MX031/video/highway.m3u8" />;
