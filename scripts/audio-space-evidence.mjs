import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {chromium} from '@playwright/test';
import {makeReference,wavBytes} from '../src/experiences/shared/audio/research/materials.ts';
import {makeImpulse} from '../src/experiences/audio-space/processor.ts';
import {prepareProcessingPassages} from './lib/audio-processing-sources.mjs';
const require=createRequire(import.meta.url),{moduleUrl}=require('../e2e/helpers/research-module.cjs');
const root=resolve('artifacts/audio-space');mkdirSync(root,{recursive:true});
const fixture=JSON.parse(readFileSync('scripts/fixtures/audio-processing-passages.json'));
const passages=await prepareProcessingPassages(fixture.passages,root+'/passages');
writeFileSync(root+'/passages/source-manifest.json',JSON.stringify(passages,null,2));
for(const seconds of [.18,.9]){const channels=makeImpulse(24000,seconds);writeFileSync(`${root}/ir-${seconds}.wav`,stereoWav(channels,24000));}
const sources=[{name:'reference-loop',bytes:Buffer.from(wavBytes(makeReference('loop'))).toString('base64')},...passages.map(p=>({name:`mx029-${String(p.segment).padStart(3,'0')}`,bytes:readFileSync(p.sourceWav).toString('base64')}))];
const browser=await chromium.launch({headless:true}),page=await browser.newPage();
try{
  await page.goto(process.env.ROOM_TEST_ORIGIN||'http://127.0.0.1:4232/labs/');
  const data=await page.evaluate(async({sources,url})=>{
    const {spaceProcessor}=await import(url),rate=24000,results=[];
    const stats=channels=>{let square=0,peak=0,n=0;for(const c of channels)for(const v of c){square+=v*v;peak=Math.max(peak,Math.abs(v));n++;}return {peak,rms:Math.sqrt(square/n),finite:channels.every(c=>c.every(Number.isFinite))};};
    const modes=[{name:'original'},{name:'delay',mode:0,time:4/9,feedback:.35,stereo:1,level:.5},{name:'reverb',mode:1,time:.45,feedback:.35,stereo:1,level:.5},{name:'long-echo',mode:0,time:1,feedback:1,stereo:1,level:1},{name:'air-heavy',mode:1,time:1,feedback:1,stereo:1,level:1}];
    for(const {name,bytes} of sources){
      const decoder=new OfflineAudioContext(2,1,rate),buffer=await decoder.decodeAudioData(Uint8Array.from(atob(bytes),c=>c.charCodeAt(0)).buffer);
      for(const mode of modes){
        const context=new OfflineAudioContext(2,buffer.length+rate*2,rate),source=context.createBufferSource(),headroom=context.createGain();source.buffer=buffer;headroom.gain.value=.5;headroom.connect(context.destination);const nodes=[];let module;
        if(mode.name==='original')source.connect(headroom);
        else{module=spaceProcessor({context,own:n=>{nodes.push(n);return n;},clock:{bpm:120,tempoSet:true}});module.update(mode);const dry=context.createGain(),wet=context.createGain();dry.gain.value=1-mode.level;wet.gain.value=mode.level;source.connect(dry);dry.connect(headroom);source.connect(module.input);module.output.connect(wet);wet.connect(headroom);}
        source.start();const rendered=await context.startRendering(),channels=[0,1].map(i=>Array.from(rendered.getChannelData(i)));module?.dispose();nodes.forEach(n=>n.disconnect());
        const body=channels.map(c=>c.slice(0,buffer.length)),tail=channels.map(c=>c.slice(buffer.length));
        const reference=body.map((_c,c)=>Array.from(buffer.getChannelData(Math.min(c,buffer.numberOfChannels-1)),v=>v*.5));
        const returnRms=stats(body.map((channel,c)=>channel.map((v,i)=>v-reference[c][i]))).rms,referenceRms=stats(reference).rms;
        const windows=[];for(let i=0;i<buffer.length;i+=rate/20)windows.push(stats(body.map(c=>c.slice(i,i+rate/20))).rms);
        results.push({name,mode:mode.name,settings:mode,rate,...stats(channels),bodyRms:stats(body).rms,returnRms,returnToDryDb:returnRms?20*Math.log10(returnRms/referenceRms):null,tailRms:stats(tail).rms,tailPeak:stats(tail).peak,crestDb:20*Math.log10(stats(body).peak/stats(body).rms),windows,channels});
      }
    }
    return results;
  },{sources,url:moduleUrl(resolve('src/experiences/audio-space/processor.ts'))});
  const summaries=[];
  for(const {channels,...result} of data){
    const filename=`${result.name}-${result.mode}.wav`,bytes=stereoWav(channels,result.rate);writeFileSync(root+'/'+filename,bytes);summaries.push({...result,path:filename,seconds:channels[0].length/result.rate,sha256:createHash('sha256').update(bytes).digest('hex')});
  }
  for(const name of sources.map(s=>s.name)){
    const group=data.filter(r=>r.name===name),target=Math.min(...group.map(r=>r.bodyRms));
    for(const r of group){const trim=target/r.bodyRms;writeFileSync(`${root}/${name}-comparison-${r.mode}.wav`,stereoWav(r.channels.map(c=>c.map(v=>v*trim)),r.rate));}
  }
  for(const r of summaries){const original=summaries.find(o=>o.name===r.name&&o.mode==='original');r.bodyRmsDifferenceDb=20*Math.log10(r.bodyRms/original.bodyRms);}
  const report={date:'2026-11-18',graph:'Actual insert in aligned OfflineAudioContext with the shared linear balance and fixed 0.5 headroom. No guard in offline renders; all peaks must stay below 0.98. Actual guarded output independently tested in e2e/audio-space.spec.cjs.',audition:'No human listening review. Raw renders unnormalized; comparison files attenuated to lowest body RMS per passage, never boosted. Not LUFS matching.',sources:passages,renders:summaries};
  if(summaries.some(r=>!r.finite||r.peak>=.98))throw Error('Render exceeded finite headroom');
  writeFileSync(root+'/render-measurements.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify(summaries.map(({name,mode,peak,bodyRmsDifferenceDb,tailRms,crestDb})=>({name,mode,peak,bodyRmsDifferenceDb,tailRms,crestDb})),null,2));
}finally{await browser.close();}
function stereoWav(channels,rate){
  const length=channels[0].length,out=Buffer.alloc(44+length*4);out.write('RIFF');out.writeUInt32LE(out.length-8,4);out.write('WAVEfmt ',8);out.writeUInt32LE(16,16);out.writeUInt16LE(1,20);out.writeUInt16LE(2,22);out.writeUInt32LE(rate,24);out.writeUInt32LE(rate*4,28);out.writeUInt16LE(4,32);out.writeUInt16LE(16,34);out.write('data',36);out.writeUInt32LE(length*4,40);
  for(let i=0;i<length;i++)for(let c=0;c<2;c++)out.writeInt16LE(Math.round(Math.max(-1,Math.min(1,channels[c][i]))*32767),44+(i*2+c)*2);return out;
}
