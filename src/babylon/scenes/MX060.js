import {createBuild} from './templates/SceneExperiment';
import CaseTexture from '../../images/mix-art/mx060.jpg';
import CDLabelTexture from '../../images/mix-labels/cd_template_MX060.png';

export const caseTexture = CaseTexture;
export const cdLabelTexture = CDLabelTexture;

const colors = ['#1DBEF2', '#2A2A2A'];
export const build = createBuild(colors);
