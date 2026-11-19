import type {ModuleFactory,ResearchAudio} from '../shared/audio/research/ResearchAudio.ts';

export const MEMORY_SECONDS=4,REPEAT_SECONDS=12,GRAIN_SECONDS=.2,STEP=.0625;
const clamp=(n:number|undefined,min:number,max:number,fallback:number)=>Number.isFinite(n)?Math.max(min,Math.min(max,n!)):fallback;
export function memorySettings(p:Readonly<Record<string,number>>){
  return {length:clamp(p.length,.25,2,1),density:Math.round(clamp(p.density,1,8,3)),mode:Math.round(clamp(p.mode,0,1,0))};
}
/** Short equal boundaries for repetition; Hann for overlapping grains. */
export function windowSamples(input:Float32Array,rate:number,hann:boolean){
  const output=new Float32Array(input.length),fade=Math.max(1,Math.round(.015*rate));
  for(let i=0;i<input.length;i++){
    const gain=hann?.5-.5*Math.cos(2*Math.PI*i/Math.max(1,input.length-1)):Math.min(1,i/fade,(input.length-1-i)/fade);
    output[i]=(Number.isFinite(input[i])?input[i]:0)*gain;
  }
  return output;
}
/** Stateless seed: skipped ticks never change later choices. */
export function grainChoice(index:number){
  let n=(Math.floor(index)+0x529a)>>>0;n=Math.imul(n^(n>>>16),0x45d9f3b);n=Math.imul(n^(n>>>16),0x45d9f3b);return (n^(n>>>16))>>>29;
}
export function prepareFragment(context:BaseAudioContext,source:AudioBuffer){
  const copy=(offset:number,length:number,hann:boolean)=>{
    const buffer=context.createBuffer(Math.min(2,source.numberOfChannels),length,source.sampleRate);
    for(let c=0;c<buffer.numberOfChannels;c++)buffer.copyToChannel(windowSamples(source.getChannelData(c).subarray(offset,offset+length),source.sampleRate,hann),c);
    return buffer;
  };
  const length=Math.min(source.length,Math.floor(2*source.sampleRate)),grainLength=Math.min(length,Math.floor(GRAIN_SECONDS*source.sampleRate));
  return {repeat:copy(0,length,false),grains:Array.from({length:8},(_,i)=>copy(Math.round((length-grainLength)*i/7),grainLength,true))};
}

/** Fragment lifetime belongs to the shared module scope, never to a second source. */
export class MemoryFragment {
  private owner:ResearchAudio;
  private epoch=0;
  private generation=-1;
  private active=false;
  private pending=false;
  private captured?:AudioBuffer;
  private prepared?:ReturnType<typeof prepareFragment>;
  private cancel?:()=>void;
  private started=0;
  private position=0;
  private until=0;
  private playing=false;
  private failure='';
  private settings=memorySettings({});
  readonly factory:ModuleFactory=({context,own})=>{
    const output=own(context.createGain()),epoch=this.activate();
    return {output,dispose:()=>{if(this.epoch===epoch)this.dispose();}};
  };
  constructor(owner:ResearchAudio){this.owner=owner;}
  activate(){this.dispose();this.active=true;this.generation=this.owner.diagnostics().generation;return this.epoch;}
  dispose(){this.epoch++;this.active=false;this.pending=false;this.playing=false;this.failure='';this.cancel?.();this.cancel=undefined;this.captured=undefined;this.prepared=undefined;}
  private reconcile(){if(this.active&&this.generation!==this.owner.diagnostics().generation)this.dispose();}
  update(params:Readonly<Record<string,number>>){this.settings=memorySettings(params);}
  listen(){
    this.owner.stop();this.dispose();
    if(!this.owner.arm())return false;
    if(!this.owner.startCapture(MEMORY_SECONDS,'source')){this.owner.stop();return false;}
    this.started=this.owner.context!.currentTime;return true;
  }
  async capture(mediaTime:number){
    this.reconcile();if(!this.active||this.pending||this.playing)return false;
    const epoch=this.epoch,generation=this.generation,length=this.settings.length;
    this.pending=true;this.failure='';this.captured=undefined;this.prepared=undefined;
    try{
      const buffer=await this.owner.capture(length);
      if(epoch!==this.epoch||generation!==this.owner.diagnostics().generation||!this.active)return false;
      if(!buffer||buffer.length<Math.floor(length*buffer.sampleRate)||buffer.duration>2||buffer.numberOfChannels>2){this.failure='No complete source window received. Wait, then capture again.';return false;}
      let energy=0;for(let c=0;c<buffer.numberOfChannels;c++)for(const sample of buffer.getChannelData(c))energy+=sample*sample;
      if(!Number.isFinite(energy)||energy<=1e-12){this.failure='No audible samples in this window. The passage may be silent or capture unavailable. Try another moment.';return false;}
      this.captured=buffer;this.position=mediaTime;this.prepared=prepareFragment(this.owner.context!,buffer);return true;
    }finally{if(epoch===this.epoch)this.pending=false;}
  }
  play(mediaTime:number){
    this.reconcile();if(!this.active||!this.prepared||!this.captured||this.pending)return false;
    const owner=this.owner,context=owner.context!,settings={...this.settings},prepared=this.prepared;
    this.cancel?.();owner.clock.setTempo(240);owner.clock.anchor(mediaTime+.025);this.generation=owner.diagnostics().generation;
    this.until=context.currentTime+REPEAT_SECONDS;this.playing=true;
    const interval=Math.ceil(this.captured.duration/STEP*(1+(8-settings.density)/4));
    const epoch=this.epoch,origin=context.currentTime;
    // The shared clock intentionally drops elapsed grid events, including zero.
    // Give the gesture a prompt, windowed onset instead of waiting one interval.
    owner.playBuffer(settings.mode===0?prepared.repeat:prepared.grains[0],context.currentTime+.025,settings.mode===0?.5:.36);
    this.cancel=owner.clock.repeat(.25,(at,_generation,index)=>{
      if(epoch!==this.epoch)return;
      if(at>=this.until){if(context.currentTime>=this.until){owner.stop('Memory finished; fragment discarded. Hearing Original.');this.dispose();}return;}
      if(index===0)return;
      let buffer:AudioBuffer;
      if(settings.mode===0){if(index%interval!==0)return;buffer=prepared.repeat;}
      else{
        if(index%Math.ceil(8/settings.density)!==0)return;
        // A slowly traversed fragment with seeded local scatter. Original pitch,
        // no beat/key detection, no claim of high-fidelity time stretching.
        const scan=Math.min(7,Math.floor((at-origin)/REPEAT_SECONDS*8));
        buffer=prepared.grains[Math.max(0,Math.min(7,scan+grainChoice(index)%3-1))];
      }
      if(at+buffer.duration<=this.until)owner.playBuffer(buffer,at,settings.mode===0?.5:.36);
    });
    return true;
  }
  snapshot(){
    this.reconcile();const buffers=this.prepared?[this.prepared.repeat,...this.prepared.grains]:[];
    if(this.captured)buffers.push(this.captured);
    return {active:this.active,pending:this.pending,playing:this.playing,ready:Boolean(this.captured),failure:this.failure,duration:this.captured?.duration||0,position:this.position,
      buffered:this.active?Math.min(MEMORY_SECONDS,Math.max(0,(this.owner.context?.currentTime||0)-this.started)):0,
      bytes:buffers.reduce((n,b)=>n+b.length*b.numberOfChannels*4,0),remaining:this.playing?Math.max(0,this.until-(this.owner.context?.currentTime||0)):0};
  }
}
