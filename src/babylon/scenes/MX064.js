import {builder} from './templates/SeasonFour';
import CaseTexture from '../../images/mix-art/mx064.jpg';
import CDLabelTexture from '../../images/mix-labels/cd_template_MX064.png';

export const caseTexture = CaseTexture;
export const cdLabelTexture = CDLabelTexture;

const colors = {
  backgroundColors: ['#16273B', '#FFFFFF', '#F7F70B'],
  gridColor: '#12D107',
};
export const build = builder(colors);
