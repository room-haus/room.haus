import {builder} from './templates/SeasonFour';
import CaseTexture from '../../images/mix-art/mx065.jpg';
import CDLabelTexture from '../../images/mix-labels/cd_template_MX065.png';

export const caseTexture = CaseTexture;
export const cdLabelTexture = CDLabelTexture;

const colors = {
  backgroundColors: ['#7570B2', '#DDEC17', '#ECEBF3', '#95CA0A'],
  gridColor: '#95CA0A',
};
export const build = builder(colors);
