import {createBuild} from './templates/SceneExperiment';
import CaseTexture from '../../images/mix-art/mx055.jpg';
import CDLabelTexture from '../../images/mix-labels/cd_template_MX055.png';

export const caseTexture = CaseTexture;
export const cdLabelTexture = CDLabelTexture;

const colors = ['#1C1C1C', '#5E5E5E'];
export const build = createBuild(colors);
