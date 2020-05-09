import {createBuild} from './templates/SceneExperiment';
import CaseTexture from '../../images/mix-art/mx053.jpg';
import CDLabelTexture from '../../images/mix-labels/cd_template_MX053.png';

export const caseTexture = CaseTexture;
export const cdLabelTexture = CDLabelTexture;

const colors = ['#30383B', '#ECE9E0'];
export const build = createBuild(colors);
