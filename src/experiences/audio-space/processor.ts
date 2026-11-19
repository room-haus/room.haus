import {ramp,type ModuleFactory} from '../shared/audio/research/ResearchAudio.ts';

export const spaceDefaults={mode:0,time:.45,feedback:.35,stereo:0,division:0};
const bound=(v:number|undefined,min:number,max:number,fallback:number)=>Number.isFinite(v)?Math.max(min,Math.min(max,v!)):fallback;
export function spaceSettings(p:Readonly<Record<string,number>>){
  return {mode:Math.round(bound(p.mode,0,1,0)),time:bound(p.time,0,1,.45),feedback:bound(p.feedback,0,1,.35),stereo:Math.round(bound(p.stereo,0,1,0)),division:[.25,.5,1].includes(p.division)?p.division:0};
}
export function delaySeconds(clock:{bpm:number;tempoSet:boolean},division:number,free:number){
  return division>0&&clock.tempoSet&&Number.isFinite(clock.bpm)?60/bound(clock.bpm,40,240,120)*bound(division,.25,1,.5):bound(free,.04,.4,.2);
}
/** Original generated noise responses; energy-normalized, no direct impulse. */
export function makeImpulse(rate:number,seconds:number):Float32Array[]{
  return [0,1].map(channel=>{
    let seed=773+channel*997;const data=new Float32Array(Math.ceil(rate*seconds));let energy=0;
    for(let i=0;i<data.length;i++){
      seed=(Math.imul(1664525,seed)+1013904223)>>>0;
      const x=i/data.length;
      data[i]=(seed/2**32*2-1)*Math.exp(-9.21034*x)*Math.min(1,(1-x)*50);energy+=data[i]*data[i];
    }
    const scale=.45/Math.sqrt(energy);for(let i=0;i<data.length;i++)data[i]*=scale;
    return data;
  });
}

/** Unity dry insert + bounded wet return. Shared owner alone connects to output. */
export const spaceProcessor:ModuleFactory=({context,own,clock})=>{
  const input=own(context.createGain()),output=own(context.createGain()),wet=own(context.createGain());
  input.channelCount=2;input.channelCountMode='explicit';
  input.connect(output); // At shared level L: (1−L)*dry + L*(dry+return) = dry+L*return.
  const delayGate=own(context.createGain()),reverbGate=own(context.createGain());
  delayGate.gain.value=.32;reverbGate.gain.value=0;delayGate.connect(wet);reverbGate.connect(wet);
  const split=own(context.createChannelSplitter(2)),echoes=own(context.createChannelMerger(2));input.connect(split);echoes.connect(delayGate);
  const delays=[0,1].map(c=>{
    const delay=own(context.createDelay(1.6)),low=own(context.createBiquadFilter()),high=own(context.createBiquadFilter()),feedback=own(context.createGain());
    delay.delayTime.value=.202+c*.008;low.type='lowpass';low.frequency.value=3800;low.Q.value=-6.0206;high.type='highpass';high.frequency.value=180;high.Q.value=-6.0206;feedback.gain.value=0;
    split.connect(delay,c);delay.connect(low);low.connect(high);high.connect(echoes,0,c);high.connect(feedback);feedback.connect(delay);
    return {delay,feedback};
  });
  const pre=own(context.createDelay(.1)),low=own(context.createBiquadFilter()),high=own(context.createBiquadFilter());
  pre.delayTime.value=.023;low.type='lowpass';low.frequency.value=4800;low.Q.value=-6.0206;high.type='highpass';high.frequency.value=220;high.Q.value=-6.0206;
  input.connect(pre);pre.connect(high);high.connect(low);
  const reverbs=[.18,.9].map(seconds=>{
    const convolver=own(context.createConvolver()),gain=own(context.createGain());convolver.normalize=false;
    const channels=makeImpulse(context.sampleRate,seconds),buffer=context.createBuffer(2,channels[0].length,context.sampleRate);
    channels.forEach((data,c)=>buffer.copyToChannel(new Float32Array(data),c));convolver.buffer=buffer;
    gain.gain.value=0;low.connect(convolver);convolver.connect(gain);gain.connect(reverbGate);return {convolver,gain};
  });
  // Symmetric mid/side matrix: mono is equal L/R; width never exceeds 35%.
  const spatial=own(context.createChannelSplitter(2)),merge=own(context.createChannelMerger(2));wet.connect(spatial);merge.connect(output);
  const matrix=[0,1].flatMap(from=>[0,1].map(to=>{const gain=own(context.createGain());gain.gain.value=.5;spatial.connect(gain,from);gain.connect(merge,0,to);return {gain,same:from===to};}));
  return {input,output,update:params=>{
    const p=spaceSettings(params),at=context.currentTime,time=delaySeconds(clock,p.division,.04+p.time*.36);
    delays.forEach(({delay,feedback},c)=>{ramp(delay.delayTime,time+c*.008,at,.04);ramp(feedback.gain,p.feedback*.48,at,.04);});
    ramp(delayGate.gain,p.mode===0?.32:0,at,.04);ramp(reverbGate.gain,p.mode===1?.55:0,at,.04);
    ramp(pre.delayTime,.005+p.time*.04,at,.04);
    ramp(reverbs[0].gain.gain,1-p.feedback,at,.04);ramp(reverbs[1].gain.gain,p.feedback,at,.04);
    matrix.forEach(({gain,same})=>ramp(gain.gain,(1+(same?1:-1)*p.stereo*.35)/2,at,.04));
  },dispose:()=>{reverbs.forEach(({convolver})=>{convolver.buffer=null;});}};
};
