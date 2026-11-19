import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {chromium} from '@playwright/test';
import {makeReference,wavBytes} from '../src/experiences/shared/audio/research/materials.ts';
import {cacheVerifiedSource,prepareProcessingPassages} from './lib/audio-processing-sources.mjs';
const require=createRequire(import.meta.url),{moduleUrl}=require('../e2e/helpers/research-module.cjs');
const root=resolve(process.env.ROOM_AUDIO_PROCESSING_OUTPUT||'artifacts/audio-processing');mkdirSync(root,{recursive:true});
const fixture=JSON.parse(readFileSync(resolve('scripts/fixtures/audio-processing-passages.json')));
const {playlistUrl}=fixture;
const playlistFile=await cacheVerifiedSource(playlistUrl,fixture.playlistSha256,root+'/passages/mx029-playlist.m3u8');
const playlist=readFileSync(playlistFile,'utf8'),durations=[...playlist.matchAll(/#EXTINF:([\d.]+)/g)].map(m=>Number(m[1]));
const mixManifest=await prepareProcessingPassages(fixture.passages,root+'/passages');
mixManifest.forEach(p=>{p.mediaTime=durations.slice(0,p.segment).reduce((s,v)=>s+v,0);});
writeFileSync(root+'/passages/source-manifest.json',JSON.stringify(mixManifest,null,2));
const sources=[{name:'reference-loop',bytes:Buffer.from(wavBytes(makeReference('loop'))).toString('base64')},...mixManifest.map(p=>({name:`mx029-${String(p.segment).padStart(3,'0')}`,bytes:readFileSync(p.sourceWav).toString('base64')}))];
const browser=await chromium.launch({headless:true}),page=await browser.newPage();
try{
  await page.goto(process.env.ROOM_TEST_ORIGIN||'http://127.0.0.1:4225/labs/');
  const urls={processor:moduleUrl(resolve('src/experiences/audio-processing/processor.ts')),owner:moduleUrl(resolve('src/experiences/shared/audio/research/ResearchAudio.ts'))};
  const data=await page.evaluate(async({sources,urls})=>{
    const {processingProcessor}=await import(urls.processor),{ResearchAudio}=await import(urls.owner);
    const modes=[{name:'original'}, {name:'processed',cutoff:8000,saturation:.2,movement:0,level:.5},{name:'obscured',cutoff:450,saturation:1,movement:1,level:1}];
    const rate=24000,results=[];
    const stats=channels=>{let square=0,peak=0,n=0;for(const c of channels)for(const v of c){square+=v*v;peak=Math.max(peak,Math.abs(v));n++;}return {peak,rms:Math.sqrt(square/n),finite:channels.every(c=>c.every(Number.isFinite))};};
    // Exact, aligned offline examples use the real insert with shared dry/wet and
    // fixed 0.5 headroom. They omit the worklet guard (peaks remain below it).
    for(const {name,bytes} of sources){
      const decoder=new OfflineAudioContext(2,1,rate),buffer=await decoder.decodeAudioData(Uint8Array.from(atob(bytes),c=>c.charCodeAt(0)).buffer);
      for(const mode of modes){
        const context=new OfflineAudioContext(2,buffer.length,rate),source=context.createBufferSource(),headroom=context.createGain();source.buffer=buffer;headroom.gain.value=.5;headroom.connect(context.destination);
        const nodes=[];let module;
        if(mode.name==='original')source.connect(headroom);
        else {
          module=processingProcessor({context,own:n=>{nodes.push(n);return n;}});module.update(mode);
          const dry=context.createGain(),wet=context.createGain();dry.gain.value=1-mode.level;wet.gain.value=mode.level;
          source.connect(dry);dry.connect(headroom);source.connect(module.input);module.output.connect(wet);wet.connect(headroom);
        }
        source.start();const rendered=await context.startRendering();const channels=Array.from({length:2},(_,i)=>Array.from(rendered.getChannelData(i)));
        module?.dispose();nodes.forEach(n=>n.disconnect());
        results.push({name,mode:mode.name,settings:mode,rate,...stats(channels),channels});
      }
    }
    // Separately capture the actual guarded shared owner path, never a second
    // audible connection alongside it. This validates reference output routing.
    const references=[];
    for(const processed of [false,true]){
      const context=new AudioContext({sampleRate:24000});await context.resume();
      const bytes=sources[0].bytes,buffer=await context.decodeAudioData(Uint8Array.from(atob(bytes),c=>c.charCodeAt(0)).buffer);
      const source=context.createBufferSource(),input=context.createGain();source.buffer=buffer;source.connect(input);
      const owner=new ResearchAudio(()=>({status:'playing',playing:true,time:context.currentTime}));owner.attach(context,input);owner.sync({status:'playing',playing:true,time:0});
      const wait=ms=>new Promise(r=>setTimeout(r,ms));for(let i=0;i<100&&!owner.diagnostics().processing;i++)await wait(20);
      if(!owner.diagnostics().processing)throw Error('Shared guard unavailable');
      owner.install('processor',processingProcessor);owner.update('processor',modes[1]);owner.setLevel(.5);if(processed)owner.arm();
      await wait(60);owner.startCapture(5,'output');source.start(context.currentTime+.1,0,4);await wait(4300);
      const b=await owner.capture(4.3);if(!b)throw Error('Missing shared output capture');
      const channels=Array.from({length:2},(_,i)=>Array.from(b.getChannelData(i)));
      references.push({name:'shared-reference',mode:processed?'processed':'original',rate:b.sampleRate,...stats(channels),channels});
      owner.dispose();source.disconnect();input.disconnect();await context.close();
    }
    return {offline:results,shared:references};
  },{sources,urls});
  // Interleave both channels; the shared tiny diagnostic exporter is mono only.
  function stereoWav(channels,rate){
    const length=channels[0].length,out=Buffer.alloc(44+length*4);out.write('RIFF');out.writeUInt32LE(out.length-8,4);out.write('WAVEfmt ',8);out.writeUInt32LE(16,16);out.writeUInt16LE(1,20);out.writeUInt16LE(2,22);out.writeUInt32LE(rate,24);out.writeUInt32LE(rate*4,28);out.writeUInt16LE(4,32);out.writeUInt16LE(16,34);out.write('data',36);out.writeUInt32LE(length*4,40);
    for(let i=0;i<length;i++)for(let c=0;c<2;c++)out.writeInt16LE(Math.round(Math.max(-1,Math.min(1,channels[c][i]))*32767),44+(i*2+c)*2);return out;
  }
  const summaries=[];
  for(const group of ['offline','shared'])for(const {channels,...result} of data[group]){
    const filename=`${result.name}-${result.mode}.wav`,bytes=stereoWav(channels,result.rate);writeFileSync(root+'/'+filename,bytes);
    summaries.push({...result,path:filename,seconds:channels[0].length/result.rate,graph:group,sha256:createHash('sha256').update(bytes).digest('hex')});
  }
  // Local audition copies only: attenuate the louder Original to Processed RMS.
  // Never boost either side, and never apply this trim in the running experiment.
  for(const group of ['offline','shared'])for(const original of data[group].filter(r=>r.mode==='original')){
    const processed=data[group].find(r=>r.name===original.name&&r.mode==='processed');
    const target=Math.min(original.rms,processed.rms);
    for(const render of [original,processed]){
      const trim=target/render.rms,channels=render.channels.map(c=>c.map(v=>v*trim));
      const filename=`${render.name}-comparison-${render.mode}.wav`,bytes=stereoWav(channels,render.rate);writeFileSync(root+'/'+filename,bytes);
      summaries.push({name:render.name,mode:render.mode,rate:render.rate,peak:render.peak*trim,rms:target,trimDb:20*Math.log10(trim),graph:group+'-comparison',path:filename,sha256:createHash('sha256').update(bytes).digest('hex'),seconds:channels[0].length/render.rate});
    }
  }
  for(const result of summaries){const original=summaries.find(r=>r.graph===result.graph&&r.name===result.name&&r.mode==='original');result.rmsDifferenceDb=20*Math.log10(result.rms/original.rms);}
  writeFileSync(root+'/render-measurements.json',JSON.stringify({playlistUrl,playlistSha256:createHash('sha256').update(playlist).digest('hex'),note:'Raw output is unnormalized. Comparison copies attenuate Original to Processed RMS for local audition only; no LUFS/perceptual matching claim. Offline examples and actual shared captures are distinguished. No human listening review.',renders:summaries},null,2));
  console.log(JSON.stringify(summaries.map(({name,mode,peak,rms,rmsDifferenceDb})=>({name,mode,peak,rms,rmsDifferenceDb})),null,2));
}finally{await browser.close();}
