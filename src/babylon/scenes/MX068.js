import {builder} from './templates/SeasonFour';
import CaseTexture from '../../images/mix-art/mx068.jpg';
import CDLabelTexture from '../../images/mix-labels/cd_template_MX068.png';

export const caseTexture = CaseTexture;
export const cdLabelTexture = CDLabelTexture;

const colors = {
  backgroundColors: ['#FFFFFF', '#EDC60F', '#0B3BDD', '#CF2F75'],
  gridColor: '#0B3BDD',
};
export const build = builder(colors);
