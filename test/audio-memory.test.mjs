import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {memorySettings,windowSamples,grainChoice,MemoryFragment} from '../src/experiences/audio-memory/fragment.ts';
import {AudioClock} from '../src/experiences/shared/audio/research/AudioClock.ts';

function harness(seconds=2,silent=false){
  const rate=1000,buffer=(length,channels=2)=>{const data=Array.from({length:channels},()=>new Float32Array(length));return {length,sampleRate:rate,numberOfChannels:channels,duration:length/rate,getChannelData:c=>data[c],copyToChannel:(v,c)=>data[c].set(v)};};
  const captured=buffer(seconds*rate);if(!silent)captured.getChannelData(0).fill(.2);
  const clock=new AudioClock(),events=[],context={currentTime:0,createBuffer:(c,n)=>buffer(n,c)};
  const owner={context,clock,diagnostics:()=>({generation:clock.generation,mode:'processed'}),capture:async()=>captured,playBuffer:(b,at)=>{events.push({buffer:b,at});return true;},stop:()=>clock.cancel()};
  const fragment=new MemoryFragment(owner);fragment.activate();fragment.update({length:2,density:1,mode:0});return {fragment,clock,events,context};
}
test('sparse long repetition starts immediately, switches treatment on the same fragment and drops expired stalls',async()=>{
  const {fragment,clock,events,context}=harness();assert.equal(await fragment.capture(10),true);assert.equal(fragment.play(10),true);
  assert.equal(events.length,1);assert.ok(events[0].at<=.03);
  clock.sync(.025,10.025,true);clock.sync(5.5,15.5,true);assert.ok(events.length>=2);
  const bytes=fragment.snapshot().bytes;fragment.update({length:2,density:8,mode:1});context.currentTime=6;fragment.play(16);
  assert.equal(fragment.snapshot().bytes,bytes);assert.equal(fragment.snapshot().ready,true);
  const count=events.length;context.currentTime=25;clock.sync(25,35,true);assert.equal(events.length,count);assert.equal(fragment.snapshot().bytes,0);
});
test('silent or shorter-than-requested windows are not labeled playable captures',async()=>{
  const silent=harness(2,true),short=harness(1.995);
  assert.equal(await silent.fragment.capture(10),false);assert.equal(silent.fragment.snapshot().ready,false);
  assert.equal(await short.fragment.capture(10),false);assert.equal(short.fragment.snapshot().ready,false);
});
test('lookahead at the deadline cannot cut a currently playing window early',async()=>{
  const {fragment,clock,context}=harness();await fragment.capture(10);fragment.play(10);
  context.currentTime=11.95;clock.sync(11.95,21.95,true);assert.equal(fragment.snapshot().ready,true);
  context.currentTime=12.05;clock.sync(12.05,22.05,true);assert.equal(fragment.snapshot().bytes,0);
});

test('fragment settings and sample windows bound invalid input and silence both boundaries',()=>{
  assert.deepEqual(memorySettings({length:99,density:NaN,mode:4}),{length:2,density:3,mode:1});
  assert.deepEqual(memorySettings({length:-1,density:99,mode:Infinity}),{length:.25,density:8,mode:0});
  const data=windowSamples(new Float32Array(1000).fill(.4),1000,false);
  assert.equal(data[0],0);assert.equal(data.at(-1),0);assert.equal(data[500],Math.fround(.4));
  assert.ok(Math.max(...data.map((v,i)=>i?Math.abs(v-data[i-1]):0))<.05);
  const grain=windowSamples(new Float32Array(200).fill(.4),1000,true);
  assert.equal(grain[0],0);assert.equal(grain.at(-1),0);assert.ok(grain[100]>.39);
});
test('seeded grain choice is reproducible, distributed and bounded independently of skipped ticks',()=>{
  const a=Array.from({length:192},(_,i)=>grainChoice(i));
  assert.deepEqual(a,Array.from({length:192},(_,i)=>grainChoice(i)));
  assert.ok(a.every(n=>n>=0&&n<8&&Number.isInteger(n)));assert.equal(new Set(a).size,8);
  assert.equal(grainChoice(180),a[180]);
});
test('actual four-second shared ring returns exact newest known stereo window across wrap and releases memory',()=>{
  let Processor;const messages=[];
  vm.runInNewContext(readFileSync(new URL('../src/audio/worklets/ResearchProcessor/research.js',import.meta.url),'utf8'),{sampleRate:1000,Float32Array,Math,Number,AudioWorkletProcessor:class{port={postMessage:m=>messages.push(m)};},registerProcessor:(_,p)=>{Processor=p;}});
  const p=new Processor({processorOptions:{guard:false}});
  for(let capture=0;capture<100;capture++){
    p.port.onmessage({data:{type:'start',seconds:4,generation:capture}});
    for(let i=0;i<6000;i+=100){const left=Float32Array.from({length:100},(_,j)=>(i+j)/6000);p.process([[left,Float32Array.from(left,v=>-v)]],[[new Float32Array(100),new Float32Array(100)]]);}
    assert.equal(p.ring[0].byteLength+p.ring[1].byteLength,32000);
    p.port.onmessage({data:{type:'read',id:capture,seconds:.5,generation:capture}});
    const [left,right]=messages.at(-1).channels;assert.equal(left.length,500);
    assert.equal(left[0],Math.fround(5500/6000));assert.equal(left.at(-1),Math.fround(5999/6000));assert.equal(right[0],-left[0]);
  }
  p.port.onmessage({data:{type:'clear',generation:101}});assert.equal(p.ring,null);
});
test('late capture cannot repopulate after shared stop or close',async()=>{
  let resolve;const owner={diagnostics:()=>({generation:1,mode:'processed'}),capture:()=>new Promise(r=>{resolve=r;}),clearCapture(){}};
  const fragment=new MemoryFragment(owner);fragment.activate();
  const pending=fragment.capture(20);fragment.dispose();resolve({});assert.equal(await pending,false);assert.equal(fragment.snapshot().bytes,0);
});
