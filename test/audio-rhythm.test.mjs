import test from 'node:test';
import assert from 'node:assert/strict';
import {AudioClock} from '../src/experiences/shared/audio/research/AudioClock.ts';

test('quarter-beat callbacks expose absolute grid indices, skip stalls and never duplicate',()=>{
  const c=new AudioClock(),events=[];
  c.setTempo(120);c.anchor(0);c.repeat(.25,(at,generation,index)=>events.push({at,index,generation}));
  for(let i=0;i<=40;i++)c.sync(10+i*.025,i*.025,true);
  assert.deepEqual(events.slice(0,4).map(e=>e.index),[1,2,3,4]);
  assert.deepEqual(events.slice(0,4).map(e=>e.at),[10.125,10.25,10.375,10.5]);
  const count=events.length;c.sync(12,2,true);
  assert.ok(events.slice(count).every(e=>e.at>12&&e.at<=12.1));
  assert.equal(new Set(events.map(e=>e.index)).size,events.length);
});

test('60 seconds of fixed 120 BPM has negligible grid drift; re-anchor shifts phase and cancels old work',()=>{
  const c=new AudioClock(),events=[];c.setTempo(120);c.anchor(0);
  c.repeat(.25,(at,_generation,index)=>events.push({at,index}));
  for(let i=0;i<2400;i++)c.sync(10+i*.025,i*.025,true);
  assert.ok(events.length>=479);
  assert.ok(Math.max(...events.map(e=>Math.abs(e.at-(10+e.index*.125))))<1e-10);
  const count=events.length;c.anchor(60.01);
  c.sync(70,60,true);assert.equal(events.length,count);
  c.repeat(.25,(at,_generation,index)=>events.push({at,index}));c.sync(70,60,true);
  assert.ok(events.at(-1).index===0);assert.ok(Math.abs(events.at(-1).at-70.01)<1e-10);
  c.sync(70.025,60.025,false);const stopped=events.length;
  c.sync(71,61,true);assert.equal(events.length,stopped);assert.equal(c.subscriptions,0);
});
