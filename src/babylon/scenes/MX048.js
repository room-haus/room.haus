import {createBuild} from './templates/SceneExperiment';
import CaseTexture from '../../images/mix-art/mx048.jpg';
import CDLabelTexture from '../../images/mix-labels/cd_template_MX048.png';

export const caseTexture = CaseTexture;
export const cdLabelTexture = CDLabelTexture;

const colors = ['#F1017C', '#00C009'];
export const build = createBuild(colors);
