import {createBuild} from './templates/SceneExperiment';
import CaseTexture from '../../images/mix-art/mx056.jpg';
import CDLabelTexture from '../../images/mix-labels/cd_template_MX056.png';

export const caseTexture = CaseTexture;
export const cdLabelTexture = CDLabelTexture;

const colors = ['#D3DCEB', '#023090'];
export const build = createBuild(colors);
