import {createBuild} from './templates/SceneExperiment';
import CaseTexture from '../../images/mix-art/mx059.jpg';
import CDLabelTexture from '../../images/mix-labels/cd_template_MX059.png';

export const caseTexture = CaseTexture;
export const cdLabelTexture = CDLabelTexture;

const colors = ['#021557', '#4E7BB4'];
export const build = createBuild(colors);
