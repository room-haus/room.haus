import type {ToyFrame} from '../shared/contracts.ts';
import {clamp} from './config.ts';
/** Read-only visual features. Ambient never invents spectral or transient activity. */
export function mapAudio(frame:ToyFrame) {
 const enabled=frame.source==='live'&&frame.features.available&&frame.features.playing;
 const value=(n:number)=>enabled?clamp(n,0,1):0;
 return {bass:value(frame.features.bass),mid:value(frame.features.mid),high:value(frame.features.high),
  intensity:value(frame.features.intensity),brightness:value(frame.features.brightness),
  onset:!frame.reducedMotion?value(frame.features.onset):0};
}
