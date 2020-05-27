import {builder} from './templates/SeasonFour';
import CaseTexture from '../../images/mix-art/mx070.jpg';
import CDLabelTexture from '../../images/mix-labels/cd_template_MX070.png';

export const caseTexture = CaseTexture;
export const cdLabelTexture = CDLabelTexture;

const colors = {
  backgroundColors: ['#1B22BB', '#D91312'],
  gridColor: '#FFFFFF',
};
export const build = builder(colors);
