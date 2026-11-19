import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {AudioClock} from '../src/experiences/shared/audio/research/AudioClock.ts';
import {kitNames, makeSamples, makeReference} from '../src/experiences/shared/audio/research/materials.ts';

test('clock requires deliberate tempo and phase; schedules unique events inside bounded audio horizon',()=>{
  const clock=new AudioClock(),events=[];
  clock.sync(10,20,true);clock.repeat(.25,(at,generation)=>events.push({at,generation}));
  clock.sync(10.025,20.025,true);assert.equal(events.length,0);
  clock.setTempo(120);clock.anchor(20);clock.repeat(.25,(at,generation)=>events.push({at,generation}));
  for(let i=1;i<20;i++)clock.sync(10+i*.025,20+i*.025,true);
  assert.ok(events.length>=3);assert.equal(new Set(events.map(e=>e.at.toFixed(5))).size,events.length);
  const last=events.at(-1).at;clock.sync(13,23,true);
  assert.ok(events.filter(e=>e.at>last).every(e=>e.at>=13&&e.at<=13.1));
  const count=events.length;clock.cancel();clock.sync(13.025,23.025,true);assert.equal(events.length,count);
});

test('actual guard processor rejects non-finite samples, bounds output and cancels bounded rolling capture',()=>{
  let Processor;const messages=[];
  const scope={sampleRate:1000,Float32Array,Math,Number,AudioWorkletProcessor:class {port={postMessage:message=>messages.push(message)};},registerProcessor:(_name,cls)=>{Processor=cls;}};
  vm.runInNewContext(readFileSync(new URL('../src/audio/worklets/ResearchProcessor/research.js',import.meta.url),'utf8'),scope);
  const guard=new Processor({processorOptions:{guard:true}}),input=new Float32Array([NaN,Infinity,-Infinity,4,-4,.25]),out=new Float32Array(6);
  guard.process([[input]],[[out]]);assert.deepEqual(Array.from(out).map(v=>Math.round(v*100)),[0,0,0,98,-98,25]);
  guard.port.onmessage({data:{type:'start',seconds:99,generation:1}});assert.equal(guard.ring[0].length,8000);
  for(let i=0;i<70;i++)guard.process([[new Float32Array(128).fill(.25)]],[[new Float32Array(128),new Float32Array(128)]]);
  guard.port.onmessage({data:{type:'read',id:1,seconds:1,generation:1}});assert.equal(messages.at(-1).channels[0].length,1000);assert.ok(messages.at(-1).channels[0].every(v=>v===.25));
  guard.port.onmessage({data:{type:'clear',generation:2}});assert.equal(guard.ring,null);
  guard.port.onmessage({data:{type:'read',id:2,seconds:1,generation:1}});assert.equal(messages.at(-1).channels,null);
  const capture=new Processor({processorOptions:{guard:false}});
  capture.port.onmessage({data:{type:'start',seconds:1,generation:3}});
  capture.process([[new Float32Array([1,-1,.2])]],[[new Float32Array(3),new Float32Array(3)]]);
  capture.port.onmessage({data:{type:'read',id:3,seconds:1,generation:3}});
  assert.equal(messages.at(-1).channels[0][0],1);assert.equal(messages.at(-1).channels[0][1],-1);
});
test('clock cancels after transport jump and pause; invalid inputs and subscription count are bounded',()=>{
  const clock=new AudioClock();clock.setTempo(120);clock.anchor(0);clock.sync(0,0,true);
  for(let i=0;i<4;i++)clock.repeat(1,()=>{});
  assert.throws(()=>clock.repeat(1,()=>{}),/limit/);
  clock.sync(.025,8,true);assert.equal(clock.anchored,false);assert.equal(clock.subscriptions,0);
  for(const bpm of [NaN,Infinity,-100,900])clock.setTempo(bpm);
  assert.ok(Number.isFinite(clock.bpm)&&clock.bpm>=40&&clock.bpm<=240);
  clock.anchor(8);clock.sync(.1,8.075,false);assert.equal(clock.anchored,false);
});
test('generated kit and references are deterministic finite bounded mono fixtures with all six voices',()=>{
  assert.deepEqual(kitNames,['kick','snare','clap','closed-hat','open-hat','rim']);
  for(const name of kitNames){const a=makeSamples(name,24000),b=makeSamples(name,24000);assert.deepEqual(a,b);assert.ok(a.length<=24000);assert.ok(a.some(v=>v!==0));assert.ok(a.every(v=>Number.isFinite(v)&&Math.abs(v)<=.65));}
  const loop=makeReference('loop',24000);assert.equal(loop.length,24000*8);assert.ok(loop.every(v=>Number.isFinite(v)&&Math.abs(v)<=.75));
  for(const kind of ['tone','noise'])assert.ok(makeReference(kind,24000).every(v=>Number.isFinite(v)&&Math.abs(v)<=.5));
});
