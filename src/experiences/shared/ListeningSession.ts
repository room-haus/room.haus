import {AudioController} from './audio/AudioController.ts';
import {emptyAudioFrame} from './audio/FeatureExtractor.ts';
import type {AudioFrame, AudioSourceMode, PlaybackSnapshot} from './contracts.ts';
/** Owns a Labs source. A future borrowed public-player adapter must NOT use this owner. */
export class ListeningSession {
  readonly audio:AudioController;
  onSeek?: (time:number)=>void;
  private media?:HTMLMediaElement;
  private previousTime=0;
  private cachedFeatures=emptyAudioFrame();
  private cachedSequence=-1;
  private seeking=false;
  private seekListener=()=>{ this.seeking=true; this.audio.clearAnalysis(false); this.onSeek?.(this.audio.snapshot().time); };
  private soughtListener=()=>{ this.seeking=false; this.previousTime=this.audio.snapshot().time; this.audio.clearAnalysis(false); this.onSeek?.(this.previousTime); };
  constructor(url:string,options:{research?:boolean}={}) { this.audio=new AudioController(url,options); }
  play() { this.audio.play(); this.bind(); }
  pause() { this.audio.pause(); }
  seek(time:number) { this.audio.seek(time); this.previousTime=time; this.onSeek?.(time); }
  snapshot():PlaybackSnapshot { return this.audio.snapshot(); }
  clear() { this.previousTime=this.snapshot().time; this.audio.clearAnalysis(); this.cachedFeatures=emptyAudioFrame(); this.cachedSequence=-1; }
  private bind() {
    const media=(this.audio.source.media||undefined) as HTMLMediaElement|undefined;
    if(media===this.media) return;
    this.unbind(); this.media=media;
    this.seeking=Boolean(media?.seeking);
    this.clear();
    media?.addEventListener('seeking',this.seekListener);
    media?.addEventListener('seeked',this.soughtListener);
  }
  private unbind() {
    this.media?.removeEventListener('seeking',this.seekListener);
    this.media?.removeEventListener('seeked',this.soughtListener);
    this.media=undefined;
  }
  sample(dt:number) {
    this.bind();
    const playback=this.snapshot();
    if(Math.abs(playback.time-this.previousTime)>Math.max(.3,dt+.25)) {
      this.audio.clearAnalysis(false); this.onSeek?.(playback.time);
    }
    this.previousTime=playback.time;
    let features:AudioFrame;
    try {features=this.audio.sample(dt);} catch {
      // Analysis failure never tears down or replaces the audible source.
      this.audio.clearAnalysis();features={...emptyAudioFrame(),time:playback.time,playing:playback.status==='playing'};
    }
    const unitFeatures=['rms','sub','bass','lowMid','mid','high','brightness','onset','intensity','beatConfidence'] as const;
    if(Object.values(features).some(value=>typeof value==='number'&&!Number.isFinite(value))
      ||unitFeatures.some(key=>features[key]<0||features[key]>1)) {
      features={...emptyAudioFrame(),time:Number.isFinite(playback.time)?playback.time:0,playing:playback.status==='playing'};
    }
    const source:AudioSourceMode=playback.status==='playing' && !this.seeking && !this.media?.seeking
      ? (features.available?'live':'ambient'):'inactive';
    if(source!=='live') {this.cachedFeatures={...features,onset:0};this.cachedSequence=-1;}
    else if(this.cachedSequence!==this.audio.featureSequence) {
      this.cachedFeatures={...features};this.cachedSequence=this.audio.featureSequence;
    }
    return {playback,features:{...this.cachedFeatures,time:features.time},source,featureSequence:this.audio.featureSequence};
  }
  dispose() { this.onSeek=undefined; this.unbind(); this.audio.dispose(); }
}
