import {builder} from './templates/SeasonFour';
import CaseTexture from '../../images/mix-art/mx067.jpg';
import CDLabelTexture from '../../images/mix-labels/cd_template_MX067.png';

export const caseTexture = CaseTexture;
export const cdLabelTexture = CDLabelTexture;

const colors = {
  backgroundColors: ['#0F0F0F', '#F2F2F2'],
  gridColor: '#FEDD02',
};
export const build = builder(colors);
