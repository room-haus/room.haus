import {createBuild} from './templates/SceneExperiment';
import CaseTexture from '../../images/mix-art/mx050.jpg';
import CDLabelTexture from '../../images/mix-labels/cd_template_MX050.png';

export const caseTexture = CaseTexture;
export const cdLabelTexture = CDLabelTexture;

const colors = ['#575757', '#111111'];
export const build = createBuild(colors);
