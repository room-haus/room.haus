import {readFileSync,writeFileSync,mkdirSync,readdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {chromium} from '@playwright/test';
const require=createRequire(import.meta.url),{moduleUrl}=require('../e2e/helpers/research-module.cjs');
const root=resolve('artifacts/audio-structure');mkdirSync(root,{recursive:true});
const browser=await chromium.launch({headless:true});
let results;
try{
  const page=await browser.newPage();await page.goto(process.env.ROOM_TEST_ORIGIN||'http://127.0.0.1:4276/labs/');
  results=await page.evaluate(async urls=>{
    const {ResearchAudio,ramp}=await import(urls.owner),{StructureIntervention}=await import(urls.structure),{makeReference,toBuffer}=await import(urls.materials);
    const rate=24000,wait=ms=>new Promise(r=>setTimeout(r,ms));
    // Real pre-effect shared capture; the source is the explicit deterministic fixture.
    const live=new AudioContext({sampleRate:rate});await live.resume();const input=live.createGain(),voice=live.createBufferSource();voice.buffer=toBuffer(live,makeReference('loop'));voice.connect(input);
    const owner=new ResearchAudio(()=>({status:'playing',playing:true,time:live.currentTime}));owner.attach(live,input);owner.sync({status:'playing',playing:true,time:live.currentTime});
    for(let i=0;i<100&&!owner.diagnostics().capture;i++)await wait(20);
    const start=live.currentTime+.05;owner.startCapture(1,'source');voice.start(start);await wait(750);
    const capture=await owner.capture(.125),position=live.currentTime-start;if(!capture)throw Error('Shared capture failed');
    const captured={seconds:capture.duration,channels:capture.numberOfChannels,sampleRate:capture.sampleRate,sourcePosition:position};owner.dispose();voice.stop();await live.close();
    const results=[];
    for(const strength of [.5,1])for(const kind of ['original','stutter','thin','fill']){
      if(kind==='original'&&strength===1)continue;
      const context=new OfflineAudioContext(2,rate*4,rate),dry=context.createGain(),wet=context.createGain(),layers=context.createGain(),sum=context.createGain(),source=context.createBufferSource();
      source.buffer=toBuffer(context,makeReference('loop'));dry.gain.value=1;wet.gain.value=0;layers.gain.value=0;sum.gain.value=.5;
      source.connect(dry);dry.connect(sum);wet.connect(sum);layers.connect(sum);sum.connect(context.destination);source.start(0,position);
      let now=0,generation=0,armed=false,module;const nodes=[];
      const scopeContext=new Proxy(context,{get(target,key){if(key==='currentTime')return now;const v=Reflect.get(target,key,target);return typeof v==='function'?v.bind(target):v;}});
      const adapter={context:scopeContext,diagnostics:()=>({generation,capturing:true}),startCapture:()=>true,clearCapture(){},capture:async()=>capture,
        arm(){if(!armed){module=effect.factory({context:scopeContext,own:n=>{nodes.push(n);return n;}});source.connect(module.input);module.output.connect(wet);armed=true;ramp(dry.gain,1-strength,now);ramp(wet.gain,strength,now);ramp(layers.gain,strength*.5,now);}return true;},
        stop(){generation++;ramp(dry.gain,1,now);ramp(wet.gain,0,now);ramp(layers.gain,0,now);},
        playBuffer(buffer,at,level){const s=context.createBufferSource(),g=context.createGain();s.buffer=buffer;g.gain.value=level;s.connect(g);g.connect(layers);s.start(at);return true;}};
      const effect=new StructureIntervention(adapter);if(kind==='stutter')effect.listen();now=.5;if(kind!=='original'){if(!effect.press(kind,1))throw Error('Rejected '+kind);await Promise.resolve();await Promise.resolve();}
      const rendered=await context.startRendering(),channels=[0,1].map(c=>Array.from(rendered.getChannelData(c)));effect.dispose();nodes.forEach(n=>n.disconnect());
      let peak=0,sumSquares=0;for(const c of channels)for(const v of c){if(!Number.isFinite(v))throw Error('Nonfinite render');peak=Math.max(peak,Math.abs(v));sumSquares+=v*v;}
      results.push({kind,strength,seconds:4,interventionStart:.5,interventionEnd:1.5,peak,rms:Math.sqrt(sumSquares/(channels[0].length*2)),channels});
    }
    const original=results[0].channels;
    for(const r of results){let error=0;for(let i=Math.ceil(1.51*rate);i<rate*4;i++)error=Math.max(error,Math.abs(r.channels[0][i]-original[0][i]));r.returnMaxError=error;}
    return {captured,renders:results};
  },{owner:moduleUrl(resolve('src/experiences/shared/audio/research/ResearchAudio.ts')),structure:moduleUrl(resolve('src/experiences/audio-structure/intervention.ts')),materials:moduleUrl(resolve('src/experiences/shared/audio/research/materials.ts'))});
}finally{await browser.close();}
const renders=results.renders.map(({channels,...r})=>{
  const bytes=stereoWav(channels,24000),file=`reference-${r.kind}${r.kind==='original'?'':'-'+r.strength}.wav`;writeFileSync(root+'/'+file,bytes);return {...r,file,sha256:createHash('sha256').update(bytes).digest('hex')};
});
if(renders.some(r=>r.peak>=.98||r.returnMaxError>1e-6))throw Error('Headroom or source return failed');
const chunks=readdirSync('dist/assets').filter(n=>/^audio-structure\..+\.js$/.test(n)).map(file=>({file,bytes:readFileSync('dist/assets/'+file).length,gzipBytes:gzipSync(readFileSync('dist/assets/'+file)).length}));
const report={date:'2026-11-19',base:'254426f',method:'Real shared source-ring capture of the generated 120 BPM diagnostic loop. Actual production controller/processor and finite one-shot material rendered offline with the shared-equivalent dry/wet, layer and headroom gains. Guard and voice admission tested separately in the actual ResearchAudio graph. Four seconds; intervention .5–1.5 seconds; same advancing source and no normalization. Offline cleanup timer is deliberately not run: the audio envelope alone must restore unity.',listening:'No human listening review. These are audition candidates and measured continuity evidence, not claims of expressive musical success.',capture:results.captured,chunks,renders};
writeFileSync(root+'/render-measurements.json',JSON.stringify(report,null,2));writeFileSync('docs/audio-research/structure-measurements.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
function stereoWav(channels,rate){const n=channels[0].length,out=Buffer.alloc(44+n*4);out.write('RIFF');out.writeUInt32LE(out.length-8,4);out.write('WAVEfmt ',8);out.writeUInt32LE(16,16);out.writeUInt16LE(1,20);out.writeUInt16LE(2,22);out.writeUInt32LE(rate,24);out.writeUInt32LE(rate*4,28);out.writeUInt16LE(4,32);out.writeUInt16LE(16,34);out.write('data',36);out.writeUInt32LE(n*4,40);for(let i=0;i<n;i++)for(let c=0;c<2;c++)out.writeInt16LE(Math.round(Math.max(-1,Math.min(1,channels[c][i]))*32767),44+(i*2+c)*2);return out;}
