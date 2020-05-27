import {builder} from './templates/SeasonFour';
import CaseTexture from '../../images/mix-art/mx074.jpg';
import CDLabelTexture from '../../images/mix-labels/cd_template_MX074.png';

export const caseTexture = CaseTexture;
export const cdLabelTexture = CDLabelTexture;

const colors = {
  backgroundColors: ['#FFF'],
  gridColor: '#000000',
};
export const build = builder(colors);
