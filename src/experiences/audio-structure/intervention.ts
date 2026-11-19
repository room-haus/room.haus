import {ramp,type ModuleFactory,type ResearchAudio} from '../shared/audio/research/ResearchAudio.ts';
import {makeSamples,toBuffer} from '../shared/audio/research/materials.ts';

export type InterventionKind='stutter'|'thin'|'fill';
const FADE=.015,FRAGMENT=.125;
export const structureSettings=(duration:number)=>({duration:Number.isFinite(duration)?Math.max(.5,Math.min(2,duration)):1});
const edge=(i:number,length:number,rate:number)=>Math.max(0,Math.min(1,i/(FADE*rate),(length-1-i)/(FADE*rate)));

/** Compensate the shared one-shot/layer attenuation, retaining its fixed headroom. */
export function buildStutter(context:BaseAudioContext,source:AudioBuffer,seconds:number){
  const rate=source.sampleRate,length=Math.floor(structureSettings(seconds).duration*rate),period=Math.floor(FRAGMENT*rate);
  if(source.length<period||source.numberOfChannels>2)throw Error('Incomplete fragment');
  const output=context.createBuffer(source.numberOfChannels,length,rate);let energy=0;
  for(let c=0;c<output.numberOfChannels;c++){
    const input=source.getChannelData(c),data=output.getChannelData(c);
    for(let i=0;i<length;i++){
      const j=i%period,v=input[j];if(!Number.isFinite(v))throw Error('Invalid captured samples');energy+=v*v;
      data[i]=4*v*edge(j,period,rate)*edge(i,length,rate);
    }
  }
  if(energy<=1e-12)throw Error('Silent fragment');return output;
}
/** One finite free-time phrase from the shared generated approximations, no kit fetch. */
export function buildFill(context:BaseAudioContext,seconds:number){
  const duration=structureSettings(seconds).duration,rate=context.sampleRate,output=context.createBuffer(1,Math.floor(duration*rate),rate),data=output.getChannelData(0);
  const events=[['rim',0,.9],['closed-hat',.25,.45],['snare',.5,.7],['closed-hat',.75,.4]] as const;
  for(const [name,fraction,level] of events){
    const hit=toBuffer(context,makeSamples(name)),samples=hit.getChannelData(0),offset=Math.floor(duration*fraction*rate);
    // toBuffer's native 24kHz material is resampled explicitly into the finite phrase.
    for(let j=0;j<Math.min(data.length-offset,Math.floor(hit.duration*rate));j++){
      const index=j*hit.sampleRate/rate,lo=Math.floor(index),v=(samples[lo]||0)*(1-index+lo)+(samples[lo+1]||0)*(index-lo);
      data[offset+j]+=v*level*2;
    }
  }
  for(let i=0;i<data.length;i++)data[i]*=edge(i,data.length,rate);return output;
}

type Press={id:number;kind:InterventionKind;generation:number;until:number;pending:boolean;buffer?:AudioBuffer};
/** A single gesture lease. Musical timing is finite AudioParam/buffer scheduling on the shared context. */
export class StructureIntervention {
  private owner:ResearchAudio;
  private gate?:GainNode;
  private pressId=0;
  private current?:Press;
  private timer?:ReturnType<typeof setTimeout>;
  private blockedUntil=0;
  private listening=false;
  private started=0;
  private generation=-1;
  private message='Hearing Original. Hold an action briefly; release to return.';
  readonly factory:ModuleFactory=({context,own})=>{
    const gate=own(context.createGain());gate.gain.value=1;this.gate=gate;
    return {input:gate,output:gate,dispose:()=>{if(this.gate===gate)this.gate=undefined;}};
  };
  constructor(owner:ResearchAudio){this.owner=owner;}
  private reconcile(){
    if(this.current&&(this.owner.context?.currentTime||0)>=this.current.until){
      this.cancel('Time limit reached; hearing Original. Release before pressing again.');return;
    }
    if((this.current||this.listening)&&this.generation!==this.owner.diagnostics().generation){
      this.clear();this.message='Interrupted; hearing Original. Start a new gesture deliberately.';
    }
  }
  private clear(){clearTimeout(this.timer);this.timer=undefined;this.current=undefined;this.listening=false;this.blockedUntil=(this.owner.context?.currentTime||0)+.04;}
  listen(){
    this.reconcile();if(this.current)return false;
    if(!this.owner.arm()||!this.owner.startCapture(1,'source')){this.cancel('Source capture unavailable; hearing Original.');return false;}
    this.listening=true;this.started=this.owner.context!.currentTime;this.generation=this.owner.diagnostics().generation;
    this.message='Hearing Original. The shared source ring is listening for a fragment.';return true;
  }
  press(kind:InterventionKind,seconds:number):number|null {
    this.reconcile();const context=this.owner.context;
    if(!context||this.current||context.currentTime<this.blockedUntil)return null;
    if(kind==='stutter'&&(!this.listening||!this.owner.diagnostics().capturing||context.currentTime-this.started<FRAGMENT))return null;
    const duration=structureSettings(seconds).duration;
    const press:Press={id:++this.pressId,kind,generation:this.owner.diagnostics().generation,until:context.currentTime+duration,pending:kind==='stutter'};
    this.current=press;this.generation=press.generation;
    this.timer=setTimeout(()=>{if(this.current===press)this.cancel('Time limit reached; hearing Original. Release before pressing again.');},duration*1000);
    if(kind==='stutter'){
      this.message='Reading the recent source fragment…';
      void this.owner.capture(FRAGMENT).then(buffer=>{
        this.reconcile();if(this.current!==press)return;
        if(!buffer){this.cancel('Capture failed; hearing Original. Listen for a new fragment.');return;}
        try{press.buffer=buildStutter(context,buffer,duration);this.start(press);}catch{this.cancel('No usable fragment; hearing Original. Listen for another moment.');}
      }).catch(()=>{if(this.current===press)this.cancel('Capture failed; hearing Original.');});
    }else{
      try{if(kind==='fill')press.buffer=buildFill(context,duration);this.start(press);}catch{this.cancel('Fill material could not load; hearing Original.');}
    }
    return press.id;
  }
  private start(press:Press){
    const owner=this.owner,context=owner.context!;
    if(this.current!==press||press.generation!==owner.diagnostics().generation||context.currentTime>=press.until-FADE){this.cancel();return;}
    if(!owner.arm()||!this.gate){this.cancel('Intervention unavailable; hearing Original.');return;}
    press.pending=false;this.listening=false;owner.clearCapture();
    const now=context.currentTime,param=this.gate.gain;
    ramp(param,press.kind==='thin'?1:0,now);
    let lastTarget=press.kind==='thin'?1:0;
    if(press.kind==='thin'){
      // Fixed free-time 125ms alternation, with a floor rather than complete silence.
      for(let at=now+.125,step=0;at<press.until-FADE;at+=.125,step++){
        param.setValueAtTime(step%2? .18:1,at);
        param.linearRampToValueAtTime(step%2?1:.18,Math.min(at+FADE,press.until-FADE));
        lastTarget=step%2?1:.18;
      }
    }
    // Audio-thread return is independent of the cleanup timer/main-thread stalls.
    param.setValueAtTime(lastTarget,press.until-FADE);
    param.linearRampToValueAtTime(1,press.until);
    if(press.buffer){
      // A capture read takes time. Trim its one-shot so it cannot outlast the
      // original gesture deadline, and soften the new final boundary.
      const source=press.buffer,length=Math.min(source.length,Math.floor((press.until-now)*source.sampleRate));
      const trimmed=context.createBuffer(source.numberOfChannels,length,source.sampleRate);
      for(let c=0;c<source.numberOfChannels;c++){
        const data=trimmed.getChannelData(c),input=source.getChannelData(c);
        for(let i=0;i<length;i++)data[i]=input[i]*edge(i,length,source.sampleRate);
      }
      press.buffer=trimmed;
    }
    if(press.buffer&&!owner.playBuffer(press.buffer,now,.5)){this.cancel('Playback unavailable; hearing Original.');return;}
    this.message=`Hearing ${press.kind==='stutter'?'fragment repeat':press.kind==='thin'?'rhythmic thinning':'sparse generated fill'} · free time. Release to return.`;
  }
  release(id:number){if(this.current?.id===id)this.cancel('Released; hearing Original at its current position.');}
  cancel(message='Cancelled; hearing Original.'){
    this.clear();this.owner.stop(message);this.message=message;
  }
  dispose(){this.cancel();}
  snapshot(){
    this.reconcile();const press=this.current;
    return {active:Boolean(press),pending:Boolean(press?.pending),kind:press?.kind||'',listening:this.listening,
      buffered:this.listening?Math.min(1,Math.max(0,(this.owner.context?.currentTime||0)-this.started)):0,
      bytes:press?.buffer?press.buffer.length*press.buffer.numberOfChannels*4:0,
      remaining:press?Math.max(0,press.until-(this.owner.context?.currentTime||0)):0,message:this.message};
  }
}
