import {createBuild} from './templates/SceneExperiment';
import CaseTexture from '../../images/mix-art/mx057.jpg';
import CDLabelTexture from '../../images/mix-labels/cd_template_MX057.png';

export const caseTexture = CaseTexture;
export const cdLabelTexture = CDLabelTexture;

const colors = ['#AB0302', '#E69329'];
export const build = createBuild(colors);
