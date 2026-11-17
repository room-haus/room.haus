import {mediaUrl} from '../../content/media.mjs';
import React from 'react';
import {VideoBackgroundScene, build} from './templates/VideoBackground';
import CaseTexture from '../../images/mix-art/mx036.jpg';
import CDLabelTexture from '../../images/mix-labels/cd_template_MX036.png';

export const caseTexture = CaseTexture;
export const cdLabelTexture = CDLabelTexture;

export {build};

export const Background = () => <VideoBackgroundScene manifestUrl={mediaUrl('assets/MX036/video/background.m3u8')} />;
