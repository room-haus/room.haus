import {builder} from './templates/SeasonFive';
import CaseTexture from '../../images/mix-art/mx078.jpg';
import CDLabelTexture from '../../images/mix-labels/cd_template_MX078.png';
import SphereMap from './assets/sphereMapMX078.jpg';

export const caseTexture = CaseTexture;
export const cdLabelTexture = CDLabelTexture;

export const build = builder(SphereMap);
