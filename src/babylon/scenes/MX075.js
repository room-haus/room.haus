import {builder} from './templates/SeasonFive';
import CaseTexture from '../../images/mix-art/mx075.jpg';
import CDLabelTexture from '../../images/mix-labels/cd_template_MX075.png';
import SphereMap from './assets/sphereMapMX075.jpg';

export const caseTexture = CaseTexture;
export const cdLabelTexture = CDLabelTexture;

export const build = builder(SphereMap);
