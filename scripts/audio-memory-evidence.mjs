import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {chromium} from '@playwright/test';
import {makeReference,wavBytes} from '../src/experiences/shared/audio/research/materials.ts';
import {prepareProcessingPassages} from './lib/audio-processing-sources.mjs';
const require=createRequire(import.meta.url),{moduleUrl}=require('../e2e/helpers/research-module.cjs');
const root=resolve('artifacts/audio-memory');mkdirSync(root,{recursive:true});
const fixture=JSON.parse(readFileSync('scripts/fixtures/audio-processing-passages.json'));
const passages=await prepareProcessingPassages(fixture.passages,root+'/passages');
const sources=[{name:'reference-loop',bytes:Buffer.from(wavBytes(makeReference('loop'))).toString('base64')},...passages.map(p=>({name:`mx029-${String(p.segment).padStart(3,'0')}`,bytes:readFileSync(p.sourceWav).toString('base64')}))];
const browser=await chromium.launch({headless:true}),page=await browser.newPage();
try{
  await page.goto(process.env.ROOM_TEST_ORIGIN||'http://127.0.0.1:4266/labs/');
  const evidence=await page.evaluate(async({sources,urls})=>{
    const {ResearchAudio}=await import(urls.owner),{MemoryFragment}=await import(urls.memory),{AudioClock}=await import(urls.clock);
    const results=[],captures=[],rate=24000,wait=ms=>new Promise(r=>setTimeout(r,ms));
    const stats=buffer=>{let peak=0,sum=0,n=0;for(let c=0;c<buffer.numberOfChannels;c++)for(const v of buffer.getChannelData(c)){peak=Math.max(peak,Math.abs(v));sum+=v*v;n++;}return {peak,rms:Math.sqrt(sum/n)};};
    const wav=buffer=>{
      const bytes=new Uint8Array(44+buffer.length*4),view=new DataView(bytes.buffer),str=(at,s)=>{for(let i=0;i<s.length;i++)bytes[at+i]=s.charCodeAt(i);};
      str(0,'RIFF');view.setUint32(4,bytes.length-8,true);str(8,'WAVEfmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,2,true);view.setUint32(24,rate,true);view.setUint32(28,rate*4,true);view.setUint16(32,4,true);view.setUint16(34,16,true);str(36,'data');view.setUint32(40,bytes.length-44,true);
      for(let i=0;i<buffer.length;i++)for(let c=0;c<2;c++)view.setInt16(44+(i*2+c)*2,Math.round(Math.max(-1,Math.min(1,buffer.getChannelData(Math.min(c,buffer.numberOfChannels-1))[i]))*32767),true);
      let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(binary);
    };
    for(const {name,bytes} of sources){
      const raw=Uint8Array.from(atob(bytes),c=>c.charCodeAt(0)),context=new AudioContext({sampleRate:rate}),media=new Audio(URL.createObjectURL(new Blob([raw],{type:'audio/wav'}))),input=context.createMediaElementSource(media);
      const owner=new ResearchAudio(()=>({status:media.paused?'paused':'playing',playing:!media.paused,time:media.currentTime}));owner.attach(context,input);await context.resume();await media.play();owner.sync({status:'playing',playing:true,time:media.currentTime});
      for(let i=0;i<100&&!owner.diagnostics().capture;i++)await wait(20);
      if(!owner.arm()||!owner.startCapture(4))throw Error('Source capture unavailable');await wait(1250);
      const captured=await owner.capture(1),position=media.currentTime;if(!captured)throw Error('No captured samples');
      captures.push({source:name,position,duration:captured.duration,sampleRate:captured.sampleRate,channels:captured.numberOfChannels,...stats(captured)});
      // Samples come from the real pre-effect media capture. Offline playback
      // uses the production fragment controller and shared clock, not a DSP copy.
      owner.dispose();media.pause();URL.revokeObjectURL(media.src);media.removeAttribute('src');await context.close();
      for(const mode of [0,1,2]){
        const offline=new OfflineAudioContext(2,rate*6,rate),dry=offline.createBufferSource(),headroom=offline.createGain();dry.buffer=await offline.decodeAudioData(raw.buffer.slice(0));headroom.gain.value=.5;dry.connect(headroom);headroom.connect(offline.destination);dry.start(0,position);
        const clock=new AudioClock();let active=true;const adapter={context:offline,clock,diagnostics:()=>({generation:clock.generation,mode:active?'processed':'original'}),capture:async()=>captured,stop:()=>{active=false;clock.cancel();},playBuffer:(buffer,at,level)=>{
          const voice=offline.createBufferSource(),gain=offline.createGain();voice.buffer=buffer;gain.gain.value=Math.min(.5,level)*.5*.5;voice.connect(gain);gain.connect(headroom);voice.start(at);return true;
        }};
        const fragment=new MemoryFragment(adapter);if(mode){fragment.activate();fragment.update({length:1,density:mode===1?6:8,mode:mode===1?0:1});await fragment.capture(position);fragment.play(0);for(let t=0;t<6;t+=.025)clock.sync(t,t,true);}
        const output=await offline.startRendering();fragment.dispose();const treatment=['original','repetition','dissolution'][mode];results.push({source:name,treatment,seconds:6,fragmentSeconds:1,density:mode===1?6:8,level:.5,...stats(output),wav:wav(output)});
      }
    }
    return {captures,renders:results};
  },{sources,urls:{owner:moduleUrl(resolve('src/experiences/shared/audio/research/ResearchAudio.ts')),memory:moduleUrl(resolve('src/experiences/audio-memory/fragment.ts')),clock:moduleUrl(resolve('src/experiences/shared/audio/research/AudioClock.ts'))}});
  const summaries=evidence.renders.map(({wav,...r})=>{const bytes=Buffer.from(wav,'base64'),file=`${r.source}-${r.treatment}.wav`;writeFileSync(root+'/'+file,bytes);return {...r,file,sha256:createHash('sha256').update(bytes).digest('hex')};});
  const report={date:'2026-11-19',base:'7874d3d',sources:passages,captures:evidence.captures,renders:summaries,method:'Real Chromium MediaElement WAV → shared ResearchAudio source capture. Production MemoryFragment/AudioClock offline renders over six seconds following capture. Source at 0.5 headroom, layer level 0.5 and shared-equivalent layer scale. Guard omitted offline; peaks checked below ceiling. No normalization. No subjective listening review performed.'};
  if(report.captures.some(c=>c.rms<.0001)||summaries.some(r=>r.peak>=.98||!Number.isFinite(r.rms)))throw Error('Silent capture or unsafe render');
  writeFileSync(root+'/render-measurements.json',JSON.stringify(report,null,2));writeFileSync('docs/audio-research/memory-measurements.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify({captures:report.captures,renders:summaries.map(({source,treatment,peak,rms})=>({source,treatment,peak,rms}))},null,2));
}finally{await browser.close();}
