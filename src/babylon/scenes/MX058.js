import {createBuild} from './templates/SceneExperiment';
import CaseTexture from '../../images/mix-art/mx058.jpg';
import CDLabelTexture from '../../images/mix-labels/cd_template_MX058.png';

export const caseTexture = CaseTexture;
export const cdLabelTexture = CDLabelTexture;

const colors = ['#F6F2E6', '#00F359'];
export const build = createBuild(colors);
