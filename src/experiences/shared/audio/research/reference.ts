import {ramp,type ModuleFactory} from './ResearchAudio.ts';
/** Deliberately obvious routing proof. This is not the processing baseline. */
export const referenceProcessor:ModuleFactory=({context,own})=>{
  const filter=own(context.createBiquadFilter());filter.type='lowpass';filter.frequency.value=550;filter.Q.value=.5;
  return {input:filter,output:filter,update:params=>ramp(filter.frequency,Number.isFinite(params.cutoff)?Math.max(100,Math.min(12000,params.cutoff)):550,context.currentTime)};
};
