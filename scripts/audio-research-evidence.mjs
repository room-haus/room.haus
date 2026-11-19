import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {chromium} from '@playwright/test';
import {makeSamples,makeReference,kitNames,wavBytes} from '../src/experiences/shared/audio/research/materials.ts';
const require=createRequire(import.meta.url),{moduleUrl}=require('../e2e/helpers/research-module.cjs');
const root=resolve('artifacts/audio-research');mkdirSync(root+'/materials',{recursive:true});
for(const name of kitNames)writeFileSync(root+'/materials/'+name+'.wav',wavBytes(makeSamples(name)));
for(const kind of ['loop','tone','noise'])writeFileSync(root+'/materials/reference-'+kind+'.wav',wavBytes(makeReference(kind)));
writeFileSync(root+'/materials/manifest.json',readFileSync('src/experiences/shared/audio/research/materials.manifest.json'));
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:1100},reducedMotion:'reduce'});
await page.addInitScript(()=>sessionStorage.setItem('room-labs-session','open'));
await page.goto(process.env.ROOM_TEST_ORIGIN||'http://127.0.0.1:4216/labs/');
const urls={owner:moduleUrl(resolve('src/experiences/shared/audio/research/ResearchAudio.ts')),reference:moduleUrl(resolve('src/experiences/shared/audio/research/reference.ts')),materials:moduleUrl(resolve('src/experiences/shared/audio/research/materials.ts'))};
const rendered=await page.evaluate(async urls=>{
  const {ResearchAudio}=await import(urls.owner),{referenceProcessor}=await import(urls.reference),{makeReference,toBuffer}=await import(urls.materials);
  const results=[];
  for(const processed of [false,true]){
    const context=new AudioContext();await context.resume();
    const input=context.createGain(),source=context.createBufferSource();source.buffer=toBuffer(context,makeReference('loop'));source.connect(input);
    const owner=new ResearchAudio(()=>({playing:true,status:'playing',time:context.currentTime}));owner.attach(context,input);owner.sync({status:'playing',playing:true,time:0});
    for(let i=0;i<100&&!owner.diagnostics().processing;i++)await new Promise(r=>setTimeout(r,20));
    if(!owner.diagnostics().processing)throw Error('Output guard not ready');
    owner.install('processor',referenceProcessor);owner.setLevel(1);if(processed)owner.arm();
    owner.startCapture(5,'output');source.start(context.currentTime+.1,0,4);
    await new Promise(r=>setTimeout(r,4300));const buffer=await owner.capture(4.3);if(!buffer)throw Error('No output capture');
    const samples=Array.from(buffer.getChannelData(0));
    results.push({mode:processed?'processed':'original',rate:buffer.sampleRate,samples,peak:Math.max(...samples.map(Math.abs).filter((_,i)=>i%2===0)),rms:Math.sqrt(samples.reduce((s,v)=>s+v*v,0)/samples.length),diagnostics:owner.diagnostics()});
    owner.dispose();source.disconnect();input.disconnect();await context.close();
  }
  return results;
},urls);
for(const {mode,samples,rate} of rendered)writeFileSync(root+'/reference-'+mode+'.wav',wavBytes(Float32Array.from(samples),rate));
writeFileSync(root+'/render-measurements.json',JSON.stringify(rendered.map(({samples,...meta})=>({...meta,samples:samples.length})),null,2));
await page.goto(new URL('/labs/#audio-experiments',page.url()).href);await page.getByRole('button',{name:'Open Audio routing check ↗'}).click();
await page.locator('[data-audio-research]').waitFor({state:'visible'});
await page.screenshot({path:root+'/controls-desktop.png',fullPage:false});
await browser.close();console.log(JSON.stringify({renders:rendered.map(({mode,rms,peak})=>({mode,rms,peak})),directory:root}));
