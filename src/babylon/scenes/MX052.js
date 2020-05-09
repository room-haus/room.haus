import {createBuild} from './templates/SceneExperiment';
import CaseTexture from '../../images/mix-art/mx052.jpg';
import CDLabelTexture from '../../images/mix-labels/cd_template_MX052.png';

export const caseTexture = CaseTexture;
export const cdLabelTexture = CDLabelTexture;

// const colors = ['#1158FE', '#628195'];
const colors = ['#F5F5F5', '#1158FE'];
// const colors = ['#1158FE', '#FFF'];
export const build = createBuild(colors);
