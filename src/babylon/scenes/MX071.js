import {builder} from './templates/SeasonFour';
import CaseTexture from '../../images/mix-art/mx071.jpg';
import CDLabelTexture from '../../images/mix-labels/cd_template_MX071.png';

export const caseTexture = CaseTexture;
export const cdLabelTexture = CDLabelTexture;

const colors = {
  backgroundColors: ['#0B3BDD'],
  gridColor: '#F95A20',
};
export const build = builder(colors);
