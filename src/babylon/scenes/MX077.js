import {builder} from './templates/SeasonFive';
import CaseTexture from '../../images/mix-art/mx077.jpg';
import CDLabelTexture from '../../images/mix-labels/cd_template_MX077.png';
import SphereMap from './assets/sphereMapMX077.jpg';

export const caseTexture = CaseTexture;
export const cdLabelTexture = CDLabelTexture;

export const build = builder(SphereMap);
