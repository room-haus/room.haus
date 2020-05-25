import {builder} from './templates/SeasonFour';
import CaseTexture from '../../images/mix-art/mx069.jpg';
import CDLabelTexture from '../../images/mix-labels/cd_template_MX069.png';

export const caseTexture = CaseTexture;
export const cdLabelTexture = CDLabelTexture;

const colors = {
  backgroundColors: ['#9E9E9E'],
  gridColor: '#FFFFFF',
};
export const build = builder(colors);
