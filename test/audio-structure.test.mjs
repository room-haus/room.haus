import test from 'node:test';
import assert from 'node:assert/strict';
import {StructureIntervention,structureSettings,buildStutter,buildFill} from '../src/experiences/audio-structure/intervention.ts';

const buffer=(channels,length,rate)=>{const data=Array.from({length:channels},()=>new Float32Array(length));return {numberOfChannels:channels,length,sampleRate:rate,duration:length/rate,getChannelData:c=>data[c],copyToChannel:(v,c)=>data[c].set(v)};};
const context={currentTime:0,sampleRate:24000,createBuffer:buffer};
test('finite intervention material bounds duration, preserves stereo and softens fragment boundaries',()=>{
  assert.equal(structureSettings(NaN).duration,1);assert.equal(structureSettings(100).duration,2);assert.equal(structureSettings(-1).duration,.5);
  const source=buffer(2,3000,24000);source.getChannelData(0).fill(.2);source.getChannelData(1).fill(-.1);
  const output=buildStutter(context,source,2);assert.equal(output.duration,2);assert.equal(output.numberOfChannels,2);
  assert.equal(output.getChannelData(0)[0],0);assert.equal(output.getChannelData(0).at(-1),0);
  assert.ok(Math.abs(output.getChannelData(0)[1500]-.8)<1e-6);assert.ok(Math.abs(output.getChannelData(1)[1500]+.4)<1e-6);
  for(let c=0;c<2;c++){const data=output.getChannelData(c);assert.ok(data.every(Number.isFinite));assert.ok(data.every((v,i)=>!i||Math.abs(v-data[i-1])<.005));}
});
test('sparse generated fill is finite, bounded and deterministic with a quiet final boundary',()=>{
  const a=buildFill(context,1),b=buildFill(context,1);assert.equal(a.duration,1);assert.deepEqual(a.getChannelData(0),b.getChannelData(0));
  assert.ok(a.getChannelData(0).some(v=>Math.abs(v)>.1));assert.ok(a.getChannelData(0).every(Number.isFinite));assert.equal(a.getChannelData(0)[0],0);assert.equal(a.getChannelData(0).at(-1),0);
});
test('first press owns pending capture; early release and bypass reject its late completion',async()=>{
  let generation=0,resolve;
  const owner={context,diagnostics:()=>({generation,mode:'processed',capturing:true}),arm:()=>true,startCapture:()=>true,clearCapture(){},capture:()=>new Promise(r=>{resolve=r;}),stop:()=>{generation++;}};
  const action=new StructureIntervention(owner);assert.equal(action.listen(),true);context.currentTime=.2;
  const id=action.press('stutter',1);assert.ok(id);assert.equal(action.press('thin',1),null);action.release(id+1);assert.equal(action.snapshot().pending,true);
  action.release(id);resolve(buffer(2,3000,24000));await Promise.resolve();await Promise.resolve();assert.equal(action.snapshot().active,false);assert.equal(action.snapshot().bytes,0);
  context.currentTime=1;action.listen();context.currentTime=1.2;assert.ok(action.press('stutter',1));owner.stop();action.snapshot();resolve(buffer(2,3000,24000));await Promise.resolve();await Promise.resolve();assert.equal(action.snapshot().active,false);assert.equal(action.snapshot().bytes,0);action.dispose();
});
test('failed capture and kit construction relinquish ownership and retain the original path',async()=>{
  let generation=0,original=true;
  const owner={context:{...context,currentTime:0},diagnostics:()=>({generation,capturing:true}),arm:()=>{original=false;return true;},startCapture:()=>true,clearCapture(){},capture:async()=>null,stop:()=>{generation++;original=true;}};
  const action=new StructureIntervention(owner);action.listen();owner.context.currentTime=.2;action.press('stutter',1);await Promise.resolve();await Promise.resolve();assert.equal(action.snapshot().active,false);assert.equal(original,true);
  owner.context.currentTime=1;owner.context.createBuffer=()=>{throw Error('kit allocation failed');};action.press('fill',1);assert.equal(action.snapshot().active,false);assert.equal(action.snapshot().bytes,0);assert.equal(original,true);action.dispose();
});
test('audio deadline releases pending ownership when the wall timer has not run',()=>{
  let generation=0;
  const owner={context:{...context,currentTime:0},diagnostics:()=>({generation,capturing:true}),arm:()=>true,startCapture:()=>true,clearCapture(){},capture:()=>new Promise(()=>{}),stop:()=>generation++};
  const action=new StructureIntervention(owner);try{action.listen();owner.context.currentTime=.2;action.press('stutter',.5);owner.context.currentTime=1;assert.equal(action.snapshot().active,false);assert.equal(action.snapshot().pending,false);}finally{action.dispose();}
});
