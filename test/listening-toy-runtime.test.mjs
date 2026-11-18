import assert from 'node:assert/strict';
import test from 'node:test';
import {FixedStepClock} from '../src/experiences/shared/FixedStepClock.ts';
import {InteractionDirector} from '../src/experiences/shared/InteractionDirector.ts';
import {ToyRuntime} from '../src/experiences/shared/ToyRuntime.ts';
import {MobileSimulation} from '../src/experiences/hanging-balance/MobileSimulation.ts';
import {emptyAudioFrame} from '../src/experiences/shared/audio/FeatureExtractor.ts';
const frame={source:'ambient',features:emptyAudioFrame(),featureSequence:0,mediaTime:0};
test('clock caps stalls at three fixed steps and resumes without catch-up', () => {
  const clock = new FixedStepClock();
  assert.equal(clock.advance(0, true), 0); assert.equal(clock.advance(10000, true), 3);
  assert.equal(clock.advance(10010, false), 0); assert.equal(clock.advance(90000, true), 0); assert.equal(clock.advance(90017, true), 1);
});
test('held scene or slider input prevents timeout; return blends and preserves keep control', () => {
  const director = new InteractionDirector();director.accept(0); director.hold(true, 0);
  assert.equal(director.update(100).mode, 'control'); director.hold(false, 100);
  assert.equal(director.update(107.9).mode, 'control'); assert.equal(director.update(108.75).autonomy, .5);assert.equal(director.update(109.5).mode, 'watch');
  director.accept(110); director.keep = true;assert.equal(director.update(200).mode, 'control');director.watch(); assert.equal(director.update(201).mode, 'watch');
});
test('frozen rejects manipulation but allows selection; Gentle starts still and reset preserves media position',()=>{
  const runtime=new ToyRuntime(new MobileSimulation(),true);
  runtime.tick(0,frame,true);assert.equal(runtime.running,false);
  assert.equal(runtime.act({type:'command',command:'settle'}),false);
  assert.equal(runtime.act({type:'select',targetId:'stone'}),true);
  runtime.motionPaused=false;runtime.tick(17,frame,true);runtime.tick(34,frame,true);
  assert.equal(runtime.running,true);runtime.act({type:'set-value',control:'counterweight',value:1});
  runtime.act({type:'grab',targetId:'bell',x:1,y:1});
  runtime.tick(100,{...frame,source:'inactive'},true);
  assert.equal(runtime.simulation.snapshot().grabbedId,null);
  const pose=structuredClone(runtime.simulation.snapshot());runtime.tick(100000,{...frame,source:'inactive'},true);
  assert.deepEqual(runtime.simulation.snapshot(),pose);
  runtime.reset(67,'seek');assert.equal(runtime.simulation.snapshot().counterweight,.5);
});
test('rejected IDs, unsupported controls and commands do not claim Control',()=>{
  const runtime=new ToyRuntime(new MobileSimulation(),false);runtime.tick(0,frame,true);
  for(const action of [{type:'grab',targetId:'missing',x:0,y:0},{type:'set-value',control:'paddle-position',value:1},{type:'command',command:'poke',targetId:'bell'}])assert.equal(runtime.act(action),false);
  assert.equal(runtime.director.update(0).mode,'watch');
});

test('slider ownership lasts through hold; Settle releases scene grab and rejected cooldown does not extend control',()=>{
  const runtime=new ToyRuntime(new MobileSimulation(),false);runtime.tick(0,frame,true);
  runtime.act({type:'grab',targetId:'bell',x:.5,y:.2});
  runtime.act({type:'set-value',control:'counterweight',value:1});
  runtime.director.hold(true,runtime.simTime);
  assert.equal(runtime.simulation.snapshot().grabbedId,null);
  for(let i=1;i<700;i++)runtime.tick(i*1000/60,frame,true);
  assert.equal(runtime.director.update(runtime.simTime).mode,'control');
  runtime.director.hold(false,runtime.simTime);
  runtime.act({type:'grab',targetId:'stone',x:0,y:1});runtime.act({type:'command',command:'settle'});
  assert.equal(runtime.simulation.snapshot().grabbedId,null);
  assert.equal(runtime.simulation.snapshot().counterweight,.8);
  assert.equal(runtime.act({type:'command',command:'nudge-object',targetId:'bell'}),true);
  const ended=runtime.simTime;
  assert.equal(runtime.act({type:'command',command:'nudge-object',targetId:'bell'}),false);
  assert.equal(runtime.director.update(ended+9.5).mode,'watch');
});
test('a stall drops old fractional backlog as well as excess elapsed time',()=>{
 const clock=new FixedStepClock();clock.advance(0,true);assert.equal(clock.advance(10,true),0);
 assert.equal(clock.advance(10000,true),3);assert.equal(clock.advance(10007,true),0);
});
