import {builder} from './templates/SeasonFour';
import CaseTexture from '../../images/mix-art/mx072.jpg';
import CDLabelTexture from '../../images/mix-labels/cd_template_MX072.png';

export const caseTexture = CaseTexture;
export const cdLabelTexture = CDLabelTexture;

const colors = {
  backgroundColors: ['#EBD985', '#F0EF00'],
  gridColor: '#000000',
};
export const build = builder(colors);
