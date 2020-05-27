import {builder} from './templates/SeasonFour';
import CaseTexture from '../../images/mix-art/mx062.jpg';
import CDLabelTexture from '../../images/mix-labels/cd_template_MX062.png';

export const caseTexture = CaseTexture;
export const cdLabelTexture = CDLabelTexture;

const colors = {
  backgroundColors: ['#000000', '#AB53A9', '#ABAE57', '#F0EF00'],
  gridColor: '#0059EB',
};
export const build = builder(colors);
