import {ramp,type ModuleFactory} from '../shared/audio/research/ResearchAudio.ts';

export const processingDefaults={cutoff:8000,saturation:.2,movement:0};
const bound=(value:number|undefined,min:number,max:number,fallback:number)=>Number.isFinite(value)?Math.max(min,Math.min(max,value!)):fallback;
export function processingSettings(params:Readonly<Record<string,number>>){
  return {
    cutoff:bound(params.cutoff,200,18000,processingDefaults.cutoff),
    saturation:bound(params.saturation,0,1,processingDefaults.saturation),
    movement:bound(params.movement,0,1,processingDefaults.movement),
  };
}

/** One scoped insert on Task 00's processor bus. No source, timer or transport. */
export const processingProcessor:ModuleFactory=({context,own})=>{
  const input=own(context.createGain()),filter=own(context.createBiquadFilter());
  const open=own(context.createGain()),filtered=own(context.createGain()),tone=own(context.createGain());
  const clean=own(context.createGain()),soft=own(context.createGain()),shape=own(context.createWaveShaper()),output=own(context.createGain());
  const motion=own(context.createOscillator()),depth=own(context.createGain());
  // Web Audio low-pass Q is in dB: −6.02 dB means a non-resonant Q of 0.5.
  filter.type='lowpass';filter.Q.value=-6.020599913;filter.frequency.value=Math.min(18000,context.sampleRate*.3);
  open.gain.value=clean.gain.value=1;filtered.gain.value=soft.gain.value=depth.gain.value=0;
  // Unity small-signal slope, no makeup gain: character comes from rounding peaks.
  shape.curve=Float32Array.from({length:8193},(_,i)=>Math.tanh(2.5*(i/4096-1))/2.5);
  shape.oversample='4x';
  input.connect(open);open.connect(tone);input.connect(filter);filter.connect(filtered);filtered.connect(tone);
  tone.connect(clean);clean.connect(output);tone.connect(shape);shape.connect(soft);soft.connect(output);
  motion.frequency.value=.05;motion.connect(depth);depth.connect(filter.detune);motion.start(context.currentTime);
  let disposed=false;
  return {input,output,update:params=>{
    const p=processingSettings(params),time=context.currentTime;
    const active=p.cutoff<18000||p.movement>0;
    // Leave room for +600 cents even at lower sample rates.
    ramp(filter.frequency,Math.min(p.cutoff,context.sampleRate*.3),time,.04);
    ramp(open.gain,active?0:1,time,.04);ramp(filtered.gain,active?1:0,time,.04);
    ramp(clean.gain,1-p.saturation,time,.04);ramp(soft.gain,p.saturation,time,.04);
    ramp(depth.gain,p.movement*600,time,.04);
  },dispose:()=>{if(!disposed){disposed=true;motion.stop();}}};
};
