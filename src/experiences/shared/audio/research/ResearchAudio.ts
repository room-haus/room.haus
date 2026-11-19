import {AudioClock} from './AudioClock.ts';

export type ModuleKind='processor'|'layer';
export interface ModuleScope {context:AudioContext;own:<T extends AudioNode>(node:T)=>T;clock:AudioClock;}
export interface ResearchModule {
  input?:AudioNode;output:AudioNode;
  update?:(params:Readonly<Record<string,number>>)=>void;
  reset?:()=>void;dispose?:()=>void;
}
export type ModuleFactory=(scope:ModuleScope)=>ResearchModule;
type Handle={module:ResearchModule;nodes:Set<AudioNode>;gate:GainNode;source?:AudioNode};
type Snapshot={status:string;time:number;playing:boolean};
const bounded=(value:number,min:number,max:number,fallback=0)=>Number.isFinite(value)?Math.max(min,Math.min(max,value)):fallback;
export function ramp(param:AudioParam,value:number,time:number,duration=.015){
  if(!Number.isFinite(value))return;
  if(param.cancelAndHoldAtTime)param.cancelAndHoldAtTime(time);else{param.cancelScheduledValues(time);param.setValueAtTime(param.value,time);}
  param.linearRampToValueAtTime(value,time+duration);
}

/** Opt-in graph owned by AudioController; never creates a context or a media element. */
export class ResearchAudio {
  readonly clock=new AudioClock();
  context?:AudioContext;
  private input?:AudioNode;
  private dry?:GainNode;
  private wet?:GainNode;
  private layers?:GainNode;
  private sum?:GainNode;
  private guard?:AudioWorkletNode;
  private captureNode?:AudioWorkletNode;
  private fallback?:WaveShaperNode;
  private meter?:AnalyserNode;
  private factories=new Map<ModuleKind,ModuleFactory>();
  private handles=new Map<ModuleKind,Handle>();
  private retired=new Map<Handle,ReturnType<typeof setTimeout>>();
  private params=new Map<ModuleKind,Record<string,number>>();
  private voices=new Set<{source:AudioBufferSourceNode;gain:GainNode}>();
  private endingVoices=new Set<{source:AudioBufferSourceNode;gain:GainNode}>();
  private requests=new Map<number,{resolve:(value:AudioBuffer|null)=>void;timer:ReturnType<typeof setTimeout>}>();
  private requestId=0;
  private captureGeneration=0;
  private captureTap:'source'|'output'='source';
  private capturing=false;
  private epoch=0;
  private timer?:ReturnType<typeof setInterval>;
  private state:Snapshot={status:'idle',time:0,playing:false};
  private armed=false;
  private hidden=false;
  private level=.5;
  private peak=0;
  private rms=0;
  private reason='Press Play source to check audio capabilities.';
  private disposed=false;
  private readonly snapshot:()=>Snapshot;
  private visibility=()=>{this.hidden=document.hidden;if(this.hidden)this.stop('Tab hidden; effects stopped.');};

  constructor(snapshot:()=>Snapshot){
    this.snapshot=snapshot;
    this.clock.onCancel=()=>this.cancelVoices();
    if(typeof document!=='undefined')document.addEventListener('visibilitychange',this.visibility);
  }
  attach(context:AudioContext,input:AudioNode){
    this.detach();this.context=context;this.input=input;const epoch=++this.epoch;
    this.dry=context.createGain();this.wet=context.createGain();this.layers=context.createGain();this.sum=context.createGain();
    this.dry.gain.value=1;this.wet.gain.value=this.layers.gain.value=0;this.sum.gain.value=.5;
    this.fallback=context.createWaveShaper();this.fallback.curve=new Float32Array([-0.98,-0.5,0,.5,.98]);
    this.meter=context.createAnalyser();this.meter.fftSize=256;
    input.connect(this.dry);this.dry.connect(this.sum);this.wet.connect(this.sum);this.layers.connect(this.sum);
    this.sum.connect(this.fallback);this.fallback.connect(this.meter);this.meter.connect(context.destination);
    this.reason='Preparing the shared output guard…';
    this.timer=setInterval(()=>this.tick(),25);
    if(!context.audioWorklet){this.reason='AudioWorklet unavailable. Original playback is preserved.';return this;}
    context.audioWorklet.addModule('/worklets/research.js').then(()=>{
      if(epoch!==this.epoch||this.disposed)return;
      const options={numberOfInputs:1,numberOfOutputs:1,outputChannelCount:[2]};
      const guard=new AudioWorkletNode(context,'room-research',{...options,processorOptions:{guard:true}});
      const capture=new AudioWorkletNode(context,'room-research',options);
      this.guard=guard;this.captureNode=capture;
      guard.port.onmessage=event=>this.message(event.data);capture.port.onmessage=event=>this.message(event.data);
      // Replace the startup guard before processing can be armed. Exactly one output path.
      this.sum!.disconnect(this.fallback!);this.fallback!.disconnect();this.sum!.connect(guard);guard.connect(this.meter!);
      input.connect(capture);capture.connect(context.destination); // Capture outputs silence.
      guard.onprocessorerror=()=>this.guardFailed();capture.onprocessorerror=()=>{this.clearCapture();capture.disconnect();this.captureNode=undefined;};
      this.reason='Ready. Original uses the same −6 dB headroom as Processed.';
    }).catch(()=>{if(epoch===this.epoch)this.reason='Output guard could not load. Original playback is preserved.';});
    return this;
  }
  private guardFailed(){
    this.stop('Output guard failed. Original playback is preserved.');
    this.sum?.disconnect();this.guard?.disconnect();this.guard=undefined;
    if(this.sum&&this.fallback&&this.meter){this.sum.connect(this.fallback);this.fallback.connect(this.meter);}
  }
  private message(data:{type?:string;peak?:number;rms?:number;id?:number;generation?:number;channels?:Float32Array[]|null}){
    if(data.type==='meter'){this.peak=bounded(data.peak||0,0,1);this.rms=bounded(data.rms||0,0,1);return;}
    if(data.id===undefined)return;const request=this.requests.get(data.id);if(!request)return;
    clearTimeout(request.timer);this.requests.delete(data.id);
    if(data.generation!==this.captureGeneration||!data.channels?.[0]?.length||!this.context){request.resolve(null);return;}
    const buffer=this.context.createBuffer(2,data.channels[0].length,this.context.sampleRate);
    data.channels.forEach((channel,i)=>buffer.copyToChannel(new Float32Array(channel),i));request.resolve(buffer);
  }
  sync(state:Snapshot){
    const changed=state.status!==this.state.status;this.state=state;
    if(changed&&state.status!=='playing')this.stop(`Source ${state.status}; effects stopped.`);
    if(!this.context&&state.playing)this.reason='Processing unavailable for this source/browser. Original playback is preserved.';
  }
  private tick(){
    const state=this.snapshot();this.sync(state);
    const generation=this.clock.generation;
    this.clock.sync(this.context?.currentTime||0,state.time,state.status==='playing'&&state.playing&&this.context?.state==='running'&&!this.hidden&&this.armed);
    if(this.clock.generation!==generation&&this.armed)this.stop('Transport changed; effects stopped.');
  }
  install(kind:ModuleKind,factory:ModuleFactory){
    this.stop();this.factories.set(kind,factory);
  }
  update(kind:ModuleKind,params:Record<string,number>){
    const safe=Object.fromEntries(Object.entries(params).filter(([,value])=>Number.isFinite(value)));this.params.set(kind,safe);
    try{this.handles.get(kind)?.module.update?.(safe);}catch{this.stop('Module update failed; hearing Original.');}
  }
  private create(kind:ModuleKind,factory:ModuleFactory){
    const context=this.context!,nodes=new Set<AudioNode>();const own=<T extends AudioNode>(node:T)=>{nodes.add(node);return node;};
    try{
      const module=factory({context,own,clock:this.clock}),gate=own(context.createGain());
      if(module.output.context!==context||module.input&&module.input.context!==context)throw Error('Module must use the shared context.');
      module.update?.(this.params.get(kind)||{});
      if(kind==='processor'){if(!module.input)throw Error('Processor requires an input.');this.input!.connect(module.input);}
      module.output.connect(gate);gate.connect(kind==='processor'?this.wet!:this.layers!);
      this.handles.set(kind,{module,nodes,gate,source:this.input});
    }catch(error){nodes.forEach(node=>node.disconnect());throw error;}
  }
  arm(){
    if(this.disposed||!this.guard||!this.state.playing||this.state.status!=='playing'||this.context?.state!=='running'||this.hidden||this.retired.size>=4)return false;
    if(this.armed)return true;
    try{for(const [kind,factory] of this.factories)this.create(kind,factory);}
    catch{this.stop('Module could not start; hearing Original.');return false;}
    this.armed=true;this.reason='Processed · effects are armed.';this.applyLevel();return true;
  }
  private applyLevel(){if(!this.context)return;const time=this.context.currentTime;
    const processed=this.armed&&this.handles.has('processor');
    ramp(this.dry!.gain,processed?1-this.level:1,time);ramp(this.wet!.gain,processed?this.level:0,time);ramp(this.layers!.gain,this.armed?this.level*.5:0,time);
  }
  setLevel(value:number){this.level=bounded(value,0,1,.5);this.applyLevel();}
  original(){this.stop('Original · all experiment output removed.');}
  reset(){this.stop('Effect state, captures and scheduled events cleared.');}
  stop(reason='Effects stopped; hearing Original.'){
    this.armed=false;this.clock.cancel();this.reason=reason;this.clearCapture();
    if(this.context){
      const time=this.context.currentTime;this.applyLevel();
      for(const handle of this.handles.values()){
        ramp(handle.gate.gain,0,time);
        const timer=setTimeout(()=>this.destroy(handle),25);this.retired.set(handle,timer);
      }
      this.handles.clear();
    }
  }
  private destroy(handle:Handle){
    clearTimeout(this.retired.get(handle));this.retired.delete(handle);
    if(handle.module.input)try{handle.source?.disconnect(handle.module.input);}catch{/* Detached. */}
    try{handle.module.reset?.();}catch{/* Cleanup must continue. */}
    try{handle.module.dispose?.();}catch{/* Cleanup must continue. */}
    handle.nodes.forEach(node=>{try{node.disconnect();}catch{/* Detached. */}});
    try{handle.module.output.disconnect(handle.gate);}catch{/* Already disconnected. */}
  }
  private cancelVoices(){
    for(const voice of this.voices){
      if(this.context){ramp(voice.gain.gain,0,this.context.currentTime);try{voice.source.stop(this.context.currentTime+.02);}catch{/* Ended. */}}
      this.endingVoices.add(voice);
    }
    this.voices.clear();
  }
  /** Schedule a bounded one-shot voice, at most 100ms ahead, only while armed. */
  playBuffer(buffer:AudioBuffer,when=this.context?.currentTime||0,level=.2){
    const context=this.context;
    if(!context||context.state!=='running'||this.state.status!=='playing'||!this.armed||this.voices.size+this.endingVoices.size>=16||buffer.duration>8||!Number.isFinite(when)||when<context.currentTime-.01||when>context.currentTime+.1)return false;
    const source=context.createBufferSource(),gain=context.createGain();source.buffer=buffer;
    gain.gain.value=bounded(level,0,.5,.2);source.connect(gain);gain.connect(this.layers!);
    const voice={source,gain};this.voices.add(voice);source.onended=()=>{source.disconnect();gain.disconnect();this.voices.delete(voice);this.endingVoices.delete(voice);};
    source.start(Math.max(when,context.currentTime));return true;
  }
  startCapture(seconds=4,tap:'source'|'output'='source'){
    this.clearCapture();if(!this.captureNode||!this.guard||!this.state.playing||this.state.status!=='playing'||this.context?.state!=='running'||this.hidden||this.context!.sampleRate>96000)return false;
    this.capturing=true;this.captureTap=tap;const node=tap==='source'?this.captureNode:this.guard;
    node.port.postMessage({type:'start',seconds:bounded(seconds,.1,8,4),generation:this.captureGeneration});return true;
  }
  capture(seconds=4):Promise<AudioBuffer|null>{
    const node=this.captureTap==='source'?this.captureNode:this.guard;
    if(!node||!this.capturing||this.requests.size>=1)return Promise.resolve(null);const id=++this.requestId;
    return new Promise(resolve=>{
      const timer=setTimeout(()=>{this.requests.delete(id);resolve(null);},1000);this.requests.set(id,{resolve,timer});
      node.port.postMessage({type:'read',id,seconds:bounded(seconds,.1,8,4),generation:this.captureGeneration});
    });
  }
  clearCapture(){
    this.capturing=false;
    this.captureGeneration++;for(const node of [this.guard,this.captureNode])node?.port.postMessage({type:'clear',generation:this.captureGeneration});
    for(const {resolve,timer} of this.requests.values()){clearTimeout(timer);resolve(null);}this.requests.clear();
  }
  diagnostics(){return {processing:Boolean(this.guard),layering:Boolean(this.guard),capture:Boolean(this.guard&&this.captureNode&&this.context!.sampleRate<=96000),capturing:this.capturing,mode:this.armed?'processed':'original',reason:this.reason,peak:this.peak,rms:this.rms,headroomDb:-6.0206,voices:this.voices.size,modules:this.handles.size,scheduled:this.clock.subscriptions,generation:this.clock.generation,bpm:this.clock.bpm,tempoSet:this.clock.tempoSet,anchored:this.clock.anchored};}
  detach(){
    this.stop('Audio source detached.');this.epoch++;clearInterval(this.timer);this.timer=undefined;
    for(const handle of [...this.retired.keys()])this.destroy(handle);
    for(const voice of this.endingVoices){voice.source.onended=null;voice.source.disconnect();voice.gain.disconnect();}this.endingVoices.clear();
    if(this.input){for(const node of [this.dry,this.captureNode])if(node)try{this.input.disconnect(node);}catch{/* Already detached. */}}
    for(const node of [this.dry,this.wet,this.layers,this.sum,this.fallback,this.guard,this.captureNode,this.meter]){
      if(node&&'port' in node){node.port.onmessage=null;node.port.close();}node?.disconnect();
    }
    this.dry=this.wet=this.layers=this.sum=undefined;this.guard=this.captureNode=undefined;this.fallback=undefined;this.meter=undefined;this.input=undefined;this.context=undefined;this.peak=this.rms=0;
  }
  dispose(){this.detach();this.disposed=true;this.factories.clear();this.params.clear();if(typeof document!=='undefined')document.removeEventListener('visibilitychange',this.visibility);}
}
