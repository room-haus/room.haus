export const HORIZON = .1;
type Callback = (audioTime:number, generation:number, gridIndex:number)=>void;
/** Schedules only the next 100ms; a stalled JS thread never replays old beats. */
export class AudioClock {
  bpm=120;
  tempoSet=false;
  anchored=false;
  generation=0;
  onCancel?:()=>void;
  private phase=0;
  private previous?:{audio:number;media:number};
  private taps:number[]=[];
  private jobs=new Set<{division:number;callback:Callback;last:number}>();
  get subscriptions(){return this.jobs.size;}
  setTempo(bpm:number){
    if(!Number.isFinite(bpm))return;
    this.cancel();this.bpm=Math.max(40,Math.min(240,bpm));this.tempoSet=true;
  }
  tap(mediaTime:number){
    if(!Number.isFinite(mediaTime))return;
    const last=this.taps.at(-1);
    if(last!==undefined&&(mediaTime-last<.25||mediaTime-last>1.5))this.taps=[];
    this.taps.push(mediaTime);this.taps=this.taps.slice(-5);
    if(this.taps.length>=2)this.setTempo(60*(this.taps.length-1)/(mediaTime-this.taps[0]));
    this.anchor(mediaTime);
  }
  anchor(mediaTime:number){if(Number.isFinite(mediaTime)){this.cancel();this.phase=mediaTime;this.anchored=this.tempoSet;}}
  repeat(division:number,callback:Callback){
    if(this.jobs.size>=4)throw Error('Clock subscription limit (4).');
    if(!Number.isFinite(division)||division<.25||division>16)throw Error('Beat division must be 0.25–16.');
    const job={division,callback,last:-Infinity};this.jobs.add(job);return ()=>this.jobs.delete(job);
  }
  sync(audio:number,media:number,running:boolean){
    if(!Number.isFinite(audio)||!Number.isFinite(media)||!running){this.cancel();this.previous=undefined;return;}
    if(this.previous&&Math.abs((media-this.previous.media)-(audio-this.previous.audio))>.15)this.cancel();
    this.previous={audio,media};
    if(!this.tempoSet||!this.anchored)return;
    for(const job of this.jobs){
      const interval=60/this.bpm*job.division;
      const first=Math.max(job.last+1,Math.ceil((media+.005-this.phase)/interval));
      const end=Math.floor((media+HORIZON-this.phase)/interval);
      // At 240 BPM / sixteenths this is at most two events per tick.
      for(let beat=first;beat<=end;beat++){
        job.last=beat;
        try{job.callback(audio+(this.phase+beat*interval-media),this.generation,beat);}catch{this.cancel();return;}
      }
    }
  }
  cancel(){this.generation++;this.jobs.clear();this.anchored=false;this.onCancel?.();}
}
