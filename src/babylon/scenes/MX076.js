import {builder} from './templates/SeasonFive';
import CaseTexture from '../../images/mix-art/mx076.jpg';
import CDLabelTexture from '../../images/mix-labels/cd_template_MX076.png';
import SphereMap from './assets/sphereMapMX076.jpg';

export const caseTexture = CaseTexture;
export const cdLabelTexture = CDLabelTexture;

export const build = builder(SphereMap);
