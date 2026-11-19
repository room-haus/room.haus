import {readFileSync,writeFileSync,mkdirSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {chromium} from '@playwright/test';
import {makeReference,wavBytes} from '../src/experiences/shared/audio/research/materials.ts';
import {prepareProcessingPassages} from './lib/audio-processing-sources.mjs';
const require=createRequire(import.meta.url),{moduleUrl}=require('../e2e/helpers/research-module.cjs');
const root=resolve('artifacts/audio-rhythm');mkdirSync(root,{recursive:true});
const fixtures=JSON.parse(readFileSync('scripts/fixtures/audio-processing-passages.json'));
const passages=await prepareProcessingPassages(fixtures.passages,root+'/passages');
writeFileSync(root+'/passages/source-manifest.json',JSON.stringify(passages,null,2));
const sources=[{name:'reference-loop',bpm:120,phase:0,alignment:'Known generated 120 BPM grid, phase 0.',bytes:Buffer.from(wavBytes(makeReference('loop'))).toString('base64')},...passages.map(p=>({name:`mx029-${String(p.segment).padStart(3,'0')}`,bpm:128,phase:0,alignment:'Manual trial: 128 BPM / excerpt start as downbeat. Not beat-verified or human-auditioned.',bytes:readFileSync(p.sourceWav).toString('base64')}))];
const browser=await chromium.launch({headless:true}),page=await browser.newPage();
let results;
try{
  await page.goto(process.env.ROOM_TEST_ORIGIN||'http://127.0.0.1:4243/labs/');
  results=await page.evaluate(async({sources,urls})=>{
    const {rhythmLayer,rhythmDefaults}=await import(urls.layer),{AudioClock}=await import(urls.clock),rate=24000,results=[];
    const stats=channels=>{let sum=0,peak=0,count=0;for(const c of channels)for(const v of c){sum+=v*v;peak=Math.max(peak,Math.abs(v));count++;}return {rms:Math.sqrt(sum/count),peak,finite:channels.every(c=>c.every(Number.isFinite))};};
    for(const source of sources){
      const decoder=new OfflineAudioContext(2,1,rate),input=await decoder.decodeAudioData(Uint8Array.from(atob(source.bytes),c=>c.charCodeAt(0)).buffer);
      const modes=[{name:'original',level:0,...rhythmDefaults},{name:'air',level:.5,...rhythmDefaults},{name:'reply',level:.5,kick:0,clap:4096,hat:17476,cycle:0},{name:'competing-offset',level:1,kick:4369,clap:4369,hat:65535,cycle:0,offset:.075}];
      for(const mode of modes){
        const context=new OfflineAudioContext(2,input.length+rate,rate),headroom=context.createGain(),layerBus=context.createGain(),clock=new AudioClock(),hits=[];
        headroom.gain.value=.5;headroom.connect(context.destination);layerBus.gain.value=mode.level*.5;layerBus.connect(headroom);
        const dry=context.createBufferSource();dry.buffer=input;dry.connect(headroom);dry.start();
        let now=0;const clockContext=new Proxy(context,{get(target,key){if(key==='currentTime')return now;const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;}});
        const nodes=[],module=rhythmLayer({playBuffer(buffer,at,level){const s=context.createBufferSource(),g=context.createGain();s.buffer=buffer;g.gain.value=level;s.connect(g);g.connect(layerBus);s.start(at);hits.push(at);return true;}})({context:clockContext,clock,own:n=>{nodes.push(n);return n;}});
        clock.setTempo(source.bpm);clock.anchor(source.phase+(mode.offset||0));module.update(mode);
        // Exercise the actual shared clock, advancing its media/audio mapping in
        // 25ms steps; this offline adapter is not a second application scheduler.
        if(mode.level)for(let t=0;t<input.duration-.1;t+=.025){now=t;clock.sync(t,t,true);}
        const rendered=await context.startRendering(),channels=[0,1].map(c=>Array.from(rendered.getChannelData(c)));
        module.dispose();nodes.forEach(n=>n.disconnect());
        const body=channels.map(c=>c.slice(0,input.length)),dryChannels=body.map((_c,c)=>Array.from(input.getChannelData(Math.min(c,input.numberOfChannels-1)),v=>v*.5));
        const layer=body.map((c,j)=>c.map((v,i)=>v-dryChannels[j][i])),dryRms=stats(dryChannels).rms,layerRms=stats(layer).rms;
        results.push({name:source.name,mode:mode.name,settings:mode,bpm:source.bpm,phase:source.phase+(mode.offset||0),alignment:source.alignment,rate,...stats(channels),bodyRms:stats(body).rms,layerRms,layerToDryDb:layerRms?20*Math.log10(layerRms/dryRms):null,bodyRmsDeltaDb:20*Math.log10(stats(body).rms/dryRms),seconds:rendered.duration,hitCount:hits.length,channels});
      }
    }
    const fixtureClock=new AudioClock(),errors=[];fixtureClock.setTempo(120);fixtureClock.anchor(0);
    fixtureClock.repeat(.25,(at,_generation,index)=>errors.push(at-(10+index*.125)));
    for(let i=0;i<2400;i++)fixtureClock.sync(10+i*.025,i*.025,true);
    return {renders:results,fixedTempoDrift:{bpm:120,intervalSeconds:60,events:errors.length,maxGridErrorSeconds:Math.max(...errors.map(Math.abs)),endMinusStartErrorSeconds:errors.at(-1)-errors[0],scope:'Shared clock arithmetic against a fixed-tempo fixture; not speaker latency or alignment to a live DJ mix.'}};
  },{sources,urls:{layer:moduleUrl(resolve('src/experiences/audio-rhythm/layer.ts')),clock:moduleUrl(resolve('src/experiences/shared/audio/research/AudioClock.ts'))}});
}finally{await browser.close();}
const summaries=results.renders.map(({channels,...r})=>{const filename=`${r.name}-${r.mode}.wav`,bytes=stereoWav(channels,r.rate);writeFileSync(root+'/'+filename,bytes);return {...r,path:filename,sha256:createHash('sha256').update(bytes).digest('hex')};});
if(summaries.some(r=>!r.finite||r.peak>=.98))throw Error('Render exceeded finite headroom');
const chunks=readdirSync('dist/assets').filter(n=>/^audio-rhythm\..+\.js$/.test(n)).map(n=>({file:n,bytes:readFileSync('dist/assets/'+n).length,gzipBytes:gzipSync(readFileSync('dist/assets/'+n)).length}));
const files=['src/experiences/audio-rhythm/layer.ts','src/experiences/audio-rhythm/index.tsx','src/experiences/shared/audio/research/AudioClock.ts','src/experiences/shared/audio/research/ResearchHost.tsx','src/experiences/shared/audio/research/materials.manifest.json'];
const report={date:'2026-11-19',base:'de4d70f',graph:'Actual rhythm module and shared clock in offline Web Audio. Adapter routes tracked-style one-shots through layer level * .5 and sum .5. Guard/16-voice admission are independently tested in the real ResearchAudio graph, not simulated here. Raw unnormalized stereo PCM16, 24kHz.',listening:'Not human-auditioned. Candidate complementary/intrusive settings, not listening findings. MX029 128 BPM/start anchors are manual trial values, not verified synchronization.',fixedTempoDrift:results.fixedTempoDrift,sources:passages,sourceHashes:Object.fromEntries(files.map(f=>[f,createHash('sha256').update(readFileSync(f)).digest('hex')])),chunks,renders:summaries};
writeFileSync(root+'/render-measurements.json',JSON.stringify(report,null,2));writeFileSync('docs/audio-research/rhythm-measurements.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({chunks,renders:summaries.map(({name,mode,peak,layerToDryDb,bodyRmsDeltaDb})=>({name,mode,peak,layerToDryDb,bodyRmsDeltaDb}))},null,2));
function stereoWav(channels,rate){
  const length=channels[0].length,out=Buffer.alloc(44+length*4);out.write('RIFF');out.writeUInt32LE(out.length-8,4);out.write('WAVEfmt ',8);out.writeUInt32LE(16,16);out.writeUInt16LE(1,20);out.writeUInt16LE(2,22);out.writeUInt32LE(rate,24);out.writeUInt32LE(rate*4,28);out.writeUInt16LE(4,32);out.writeUInt16LE(16,34);out.write('data',36);out.writeUInt32LE(length*4,40);
  for(let i=0;i<length;i++)for(let c=0;c<2;c++)out.writeInt16LE(Math.round(Math.max(-1,Math.min(1,channels[c][i]))*32767),44+(i*2+c)*2);return out;
}
