import {builder} from './templates/SeasonFour';
import CaseTexture from '../../images/mix-art/mx073.jpg';
import CDLabelTexture from '../../images/mix-labels/cd_template_MX073.png';

export const caseTexture = CaseTexture;
export const cdLabelTexture = CDLabelTexture;

const colors = {
  backgroundColors: ['#FCFD02'],
  gridColor: '#000000',
};
export const build = builder(colors);
