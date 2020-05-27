import {createBuild} from './templates/SceneExperiment';
import CaseTexture from '../../images/mix-art/mx061.jpg';
import CDLabelTexture from '../../images/mix-labels/cd_template_MX061.png';

export const caseTexture = CaseTexture;
export const cdLabelTexture = CDLabelTexture;

const colors = ['#A5A195', '#090A0C'];
export const build = createBuild(colors);
