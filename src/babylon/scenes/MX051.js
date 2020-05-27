import {createBuild} from './templates/SceneExperiment';
import CaseTexture from '../../images/mix-art/mx051.jpg';
import CDLabelTexture from '../../images/mix-labels/cd_template_MX051.png';

export const caseTexture = CaseTexture;
export const cdLabelTexture = CDLabelTexture;

const colors = ['#FE843B', '#EE02DE'];
export const build = createBuild(colors);
