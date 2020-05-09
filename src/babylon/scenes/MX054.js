import {createBuild} from './templates/SceneExperiment';
import CaseTexture from '../../images/mix-art/mx054.jpg';
import CDLabelTexture from '../../images/mix-labels/cd_template_MX054.png';

export const caseTexture = CaseTexture;
export const cdLabelTexture = CDLabelTexture;

const colors = ['#DEC801', '#EE334E'];
export const build = createBuild(colors);
