import type {ToyFrame} from '../shared/contracts.ts';
import {clamp} from './config.ts';
export function mapAudio(frame:ToyFrame) {
  const f=frame.features;
  const valid=frame.source==='live' && f.available && [f.bass,f.lowMid,f.intensity,f.high,f.brightness,f.onset].every(Number.isFinite);
  const unit=(n:number)=>clamp(n,0,1);
  return {bass:valid?unit(f.bass):0,intensity:valid?unit(f.intensity):0,
    detail:valid?unit(f.high)*Math.PI/90:0,brightness:valid?unit(f.brightness):.5,
    onset:valid&&!frame.reducedMotion?unit(f.onset):0};
}
