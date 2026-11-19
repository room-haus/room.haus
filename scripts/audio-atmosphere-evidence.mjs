import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {chromium} from '@playwright/test';
import {makeReference,wavBytes} from '../src/experiences/shared/audio/research/materials.ts';
import {prepareProcessingPassages} from './lib/audio-processing-sources.mjs';
const require=createRequire(import.meta.url),{moduleUrl}=require('../e2e/helpers/research-module.cjs');
const root=resolve('artifacts/audio-atmosphere');mkdirSync(root,{recursive:true});
const fixture=JSON.parse(readFileSync('scripts/fixtures/audio-processing-passages.json'));
const passages=await prepareProcessingPassages(fixture.passages,root+'/passages');
writeFileSync(root+'/passages/source-manifest.json',JSON.stringify(passages,null,2));
const sources=[...['loop','tone'].map(kind=>({name:'reference-'+kind,bytes:Buffer.from(wavBytes(makeReference(kind))).toString('base64')})),...passages.map(p=>({name:`mx029-${String(p.segment).padStart(3,'0')}`,bytes:readFileSync(p.sourceWav).toString('base64')}))];
const browser=await chromium.launch({headless:true}),page=await browser.newPage();
try{
  await page.goto(process.env.ROOM_TEST_ORIGIN||'http://127.0.0.1:4256/labs/');
  const renders=await page.evaluate(async({sources,url})=>{
    const {atmosphereLayer}=await import(url),rate=24000,results=[];
    const stats=channels=>{let square=0,peak=0,n=0;for(const c of channels)for(const v of c){square+=v*v;peak=Math.max(peak,Math.abs(v));n++;}return {peak,rms:Math.sqrt(square/n),finite:channels.every(c=>c.every(Number.isFinite))};};
    for(const {name,bytes} of sources){
      const decoder=new OfflineAudioContext(2,1,rate),buffer=await decoder.decodeAudioData(Uint8Array.from(atob(bytes),c=>c.charCodeAt(0)).buffer);
      const modes=[{name:'original'}, {name:'veil',texture:0,brightness:900,movement:.2,tuning:110,level:.5}, {name:name==='reference-tone'?'tuned-440':'manual-110',texture:1,brightness:1200,movement:.15,tuning:name==='reference-tone'?440:110,level:.5}, {name:name==='reference-tone'?'untuned-466':'bright-blend',texture:name==='reference-tone'?1:.35,brightness:5000,movement:1,tuning:name==='reference-tone'?466.16:220,level:name==='reference-tone'?.5:1}];
      for(const mode of modes){
        const context=new OfflineAudioContext(2,buffer.length,rate),source=context.createBufferSource(),headroom=context.createGain(),nodes=[];
        source.buffer=buffer;headroom.gain.value=.5;source.connect(headroom);headroom.connect(context.destination);let module;
        if(mode.name!=='original'){module=atmosphereLayer({context,own:n=>{nodes.push(n);return n;},clock:{}});module.update(mode);const layer=context.createGain();layer.gain.value=mode.level*.5;module.output.connect(layer);layer.connect(headroom);}
        source.start();const out=await context.startRendering(),channels=[0,1].map(c=>Array.from(out.getChannelData(c)));
        module?.dispose();nodes.forEach(n=>n.disconnect());
        const delta=channels.map((data,c)=>data.map((v,i)=>v-.5*buffer.getChannelData(Math.min(c,buffer.numberOfChannels-1))[i]));
        results.push({source:name,mode:mode.name,settings:mode,...stats(channels),layerRms:stats(delta).rms,channels,rate});
      }
    }
    return results;
  },{sources,url:moduleUrl(resolve('src/experiences/audio-atmosphere/layer.ts'))});
  const summaries=[];
  for(const {channels,...r} of renders){
    const original=renders.find(o=>o.source===r.source&&o.mode==='original'),group=renders.filter(o=>o.source===r.source),target=Math.min(...group.map(o=>o.rms)),trim=target/r.rms;
    const file=`${r.source}-${r.mode}.wav`,bytes=stereoWav(channels,r.rate);writeFileSync(root+'/'+file,bytes);
    writeFileSync(`${root}/${r.source}-comparison-${r.mode}.wav`,stereoWav(channels.map(c=>c.map(v=>v*trim)),r.rate));
    summaries.push({...r,file,seconds:channels[0].length/r.rate,sha256:createHash('sha256').update(bytes).digest('hex'),rmsDifferenceDb:20*Math.log10(r.rms/original.rms),layerToDryDb:r.layerRms?20*Math.log10(r.layerRms/original.rms):null,comparisonTrimDb:20*Math.log10(trim)});
  }
  if(summaries.some(r=>!r.finite||r.peak>=.98))throw Error('Nonfinite or unsafe output');
  const report={date:'2026-11-19',graph:'Actual layer module in aligned OfflineAudioContext; source unchanged at unity into shared-equivalent 0.5 headroom; layer multiplier level*0.5. Offline guard omitted; peaks checked below .98. Actual shared guarded path covered separately in e2e/audio-atmosphere.spec.cjs.',listening:'No human subjective listening performed. Reference-tone tuned-440 is manually set unison to known generated 440Hz; untuned-466 is deliberately one semitone above. MX029 tuning candidates are unverified by ear, never key-matched. Comparison copies attenuate to lowest RMS within each passage; no LUFS/perceptual match claim.',sources:passages,renders:summaries};
  writeFileSync(root+'/render-measurements.json',JSON.stringify(report,null,2));writeFileSync('docs/audio-research/atmosphere-measurements.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify(summaries.map(({source,mode,peak,layerToDryDb,rmsDifferenceDb})=>({source,mode,peak,layerToDryDb,rmsDifferenceDb})),null,2));
}finally{await browser.close();}
function stereoWav(channels,rate){
  const length=channels[0].length,out=Buffer.alloc(44+length*4);out.write('RIFF');out.writeUInt32LE(out.length-8,4);out.write('WAVEfmt ',8);out.writeUInt32LE(16,16);out.writeUInt16LE(1,20);out.writeUInt16LE(2,22);out.writeUInt32LE(rate,24);out.writeUInt32LE(rate*4,28);out.writeUInt16LE(4,32);out.writeUInt16LE(16,34);out.write('data',36);out.writeUInt32LE(length*4,40);
  for(let i=0;i<length;i++)for(let c=0;c<2;c++)out.writeInt16LE(Math.round(Math.max(-1,Math.min(1,channels[c][i]))*32767),44+(i*2+c)*2);return out;
}
