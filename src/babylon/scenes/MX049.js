import {createBuild} from './templates/SceneExperiment';
import CaseTexture from '../../images/mix-art/mx049.jpg';
import CDLabelTexture from '../../images/mix-labels/cd_template_MX049.png';

export const caseTexture = CaseTexture;
export const cdLabelTexture = CDLabelTexture;

const colors = ['#FF0123', '#033BB2'];
export const build = createBuild(colors);
