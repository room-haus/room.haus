import {ramp,type ModuleFactory} from '../shared/audio/research/ResearchAudio.ts';
import {makeReference,toBuffer} from '../shared/audio/research/materials.ts';

export const atmosphereDefaults={texture:0,brightness:900,movement:.2,tuning:110};
export const atmospherePresets=[
  {name:'Veil',texture:0,brightness:900,movement:.2,tuning:110},
  {name:'Warm floor',texture:1,brightness:1200,movement:.15,tuning:110},
  {name:'Suspended',texture:.35,brightness:2200,movement:.45,tuning:220},
] as const;
const clamp=(n:number|undefined,min:number,max:number,fallback:number)=>Number.isFinite(n)?Math.max(min,Math.min(max,n!)):fallback;
export function atmosphereSettings(p:Readonly<Record<string,number>>){
  return {texture:clamp(p.texture,0,1,0),brightness:clamp(p.brightness,150,5000,900),movement:clamp(p.movement,0,1,.2),tuning:clamp(p.tuning,55,880,110)};
}

/** Free-time sustained material. All sources use the owner's context and gate. */
export const atmosphereLayer:ModuleFactory=({context,own})=>{
  const noise=own(context.createBufferSource()),tone=own(context.createOscillator()),motion=own(context.createOscillator());
  const noiseLevel=own(context.createGain()),toneLevel=own(context.createGain()),filter=own(context.createBiquadFilter());
  const depth=own(context.createGain()),highpass=own(context.createBiquadFilter()),output=own(context.createGain());
  const now=context.currentTime;
  noise.buffer=toBuffer(context,makeReference('noise'));noise.loop=true;
  tone.type='sine';tone.frequency.value=110;motion.type='sine';motion.frequency.value=.05;
  noiseLevel.gain.value=.5;toneLevel.gain.value=0;depth.gain.value=120;
  filter.type='lowpass';filter.frequency.value=900;filter.Q.value=.5;
  highpass.type='highpass';highpass.frequency.value=80;highpass.Q.value=.5;
  noise.connect(highpass);highpass.connect(filter);filter.connect(noiseLevel);noiseLevel.connect(output);
  tone.connect(toneLevel);toneLevel.connect(output);motion.connect(depth);depth.connect(filter.detune);
  // Slow entrance is local; the independent shared stop gate remains immediate.
  output.gain.value=0;ramp(output.gain,1,now,2);
  for(const source of [noise,tone,motion])source.start(now);
  let disposed=false,initialized=false;
  return {output,update(params){
    if(disposed)return;const p=atmosphereSettings(params),time=context.currentTime,duration=initialized?.75:0;
    initialized=true; // First settings arrive behind the silent entrance gate.
    ramp(noiseLevel.gain,.5*(1-p.texture),time,duration);
    ramp(toneLevel.gain,.045*p.texture,time,duration);
    ramp(filter.frequency,p.brightness,time,duration);
    ramp(motion.frequency,.03+.09*p.movement,time,duration);
    ramp(depth.gain,600*p.movement,time,duration);
    ramp(tone.frequency,p.tuning,time,duration);
  },dispose(){
    if(disposed)return;disposed=true;
    for(const source of [noise,tone,motion]){try{source.stop();}catch{/* Already stopped. */}}
    // Scope releases nodes and their buffer after disconnection. Clearing a
    // stopped source's buffer here suppresses WebKit's pending ended event.
  }};
};
