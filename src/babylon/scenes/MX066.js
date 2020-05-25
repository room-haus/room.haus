import {builder} from './templates/SeasonFour';
import CaseTexture from '../../images/mix-art/mx066.jpg';
import CDLabelTexture from '../../images/mix-labels/cd_template_MX066.png';

export const caseTexture = CaseTexture;
export const cdLabelTexture = CDLabelTexture;

const colors = {
  backgroundColors: ['#E41414', '#DA635F'],
  gridColor: '#FFFFFF',
};
export const build = builder(colors);
