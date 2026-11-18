import assert from 'node:assert/strict';
import test from 'node:test';
import {registerHooks} from 'node:module';
import {emptyAudioFrame} from '../src/experiences/shared/audio/FeatureExtractor.ts';
const hooks=registerHooks({resolve(specifier,context,next){if(context.parentURL?.includes('/src/audio/')&&/^\.\/[\w-]+$/.test(specifier))return next(specifier+'.js',context);return next(specifier,context);}});
const {ListeningSession}=await import('../src/experiences/shared/ListeningSession.ts');hooks.deregister();
function setup(){const session=new ListeningSession('/mix.m3u8');let time=0;session.audio.snapshot=()=>({playing:true,status:'playing',time,duration:100,error:null});return {session,setTime:t=>{time=t;}};}
test('sample sequence retains transient until next extraction, including high-refresh frames without physics steps',()=>{
  const {session}=setup();let onset=1;session.audio.featureSequence=1;session.audio.sample=()=>({...emptyAudioFrame(),playing:true,available:true,onset});
  assert.equal(session.sample(.008).features.onset,1);onset=0;
  assert.equal(session.sample(.008).features.onset,1);
  session.audio.featureSequence=2;assert.equal(session.sample(.008).features.onset,0);
  session.clear();assert.equal(session.sample(.008).features.onset,0);session.dispose();
});
test('analysis exceptions and unavailable samples remain ambient without changing playback',()=>{
  const {session}=setup();let pauses=0;session.audio.source.pause=()=>pauses++;
  session.audio.sample=()=>{throw Error('analyser lost');};
  const result=session.sample(.016);assert.equal(result.source,'ambient');assert.equal(result.playback.playing,true);assert.equal(result.features.onset,0);assert.equal(pauses,0);
  session.dispose();assert.equal(pauses,1);
});
test('visibility return resynchronizes playhead without seek; actual jumps still reset',()=>{
  const {session,setTime}=setup();session.audio.sample=()=>emptyAudioFrame();const seeks=[];session.onSeek=t=>seeks.push(t);
  session.sample(0);setTime(35);session.clear();session.sample(0);assert.deepEqual(seeks,[]);
  setTime(80);session.sample(.016);assert.deepEqual(seeks,[80]);session.dispose();
});
test('real elapsed time tolerates continuous media progress across a rendering stall',()=>{
 const {session,setTime}=setup();session.audio.sample=()=>emptyAudioFrame();const seeks=[];session.onSeek=t=>seeks.push(t);
 session.sample(0);setTime(.7);session.sample(.7);assert.deepEqual(seeks,[]);session.dispose();
});
test('a failed source replaced during seeking cannot leave retry permanently inactive',()=>{
 const {session}=setup();session.audio.sample=()=>emptyAudioFrame();
 class Media extends EventTarget {seeking=false;pause(){} }
 const old=new Media();session.audio.source.media=old;
 assert.equal(session.sample(0).source,'ambient');old.seeking=true;old.dispatchEvent(new Event('seeking'));
 assert.equal(session.sample(.016).source,'inactive');
 session.audio.source.media=new Media();assert.equal(session.sample(.016).source,'ambient');
 old.dispatchEvent(new Event('seeking'));assert.equal(session.sample(.016).source,'ambient');session.dispose();
});
test('invalid or out-of-range analysis is neutral ambient data, never amplified features',()=>{
 const {session}=setup();
 for(const invalid of [NaN,Infinity,-.1,2]){
  session.audio.sample=()=>({...emptyAudioFrame(),available:true,playing:true,bass:invalid});session.audio.featureSequence++;
  const result=session.sample(.016);assert.equal(result.source,'ambient');assert.equal(result.features.bass,0);assert.equal(result.features.available,false);
 }
 session.dispose();
});
