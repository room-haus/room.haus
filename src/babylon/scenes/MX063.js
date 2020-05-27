import {builder} from './templates/SeasonFour';
import CaseTexture from '../../images/mix-art/mx063.jpg';
import CDLabelTexture from '../../images/mix-labels/cd_template_MX063.png';

export const caseTexture = CaseTexture;
export const cdLabelTexture = CDLabelTexture;

const colors = {
  backgroundColors: ['#108BF5', '#FF4F4F', '#24A3FF', '#D91312'],
  gridColor: '#D91312',
};
export const build = builder(colors);
