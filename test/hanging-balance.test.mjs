import assert from 'node:assert/strict';
import test from 'node:test';
import {MobileSimulation} from '../src/experiences/hanging-balance/MobileSimulation.ts';
import {emptyAudioFrame} from '../src/experiences/underlevel/audio/FeatureExtractor.ts';
const frame = (i, extra = {}) => ({dt:1/60, simTime:i/60, mediaTime:i/60, features:emptyAudioFrame(), featureSequence:i, source:'ambient', mode:'watch', autonomy:1, motion:1, reducedMotion:false,...extra});
function run(sim, count, extra={}) { for(let i=0;i<count;i++) sim.step(frame(i,extra)); return sim.snapshot(); }
function bounds(state) {
  assert.equal(state.rods.length,3); assert.equal(state.objects.length,5);
  for (const [bodies,limit] of [[state.rods,35*Math.PI/180],[state.objects,Math.PI/6]]) for(const body of bodies) {
    assert.ok(Number.isFinite(body.angle) && Math.abs(body.angle)<=limit+1e-9);
    assert.ok(Number.isFinite(body.velocity) && Math.abs(body.velocity)<=1.5);
  }
  assert.ok(state.counterweight>=.2 && state.counterweight<=.8);
  assert.equal(state.recoveries,0);
}
test('counterweight produces signed mechanical equilibrium, persists through Watch and Settle', () => {
  const left=new MobileSimulation(), right=new MobileSimulation();
  left.act({type:'set-value',control:'counterweight',value:-1});
  right.act({type:'set-value',control:'counterweight',value:1});
  const a=run(left,900), b=run(right,900);
  assert.ok(a.rods[0].angle>b.rods[0].angle+.1);
  right.act({type:'grab',targetId:'bell',x:-1,y:0});
  right.act({type:'command',command:'settle'});
  assert.equal(right.snapshot().grabbedId,null);
  assert.equal(right.snapshot().counterweight,.8);
  run(right,90); assert.ok(Math.abs(right.snapshot().rods[0].velocity)<.05);
  right.reset(29,80,'seek'); assert.equal(right.snapshot().counterweight,.5);
});
test('same seed, actions and features produce identical states; release never teleports', () => {
  const a=new MobileSimulation(),b=new MobileSimulation();
  for(const sim of [a,b]) {sim.reset(29,0,'open'); sim.act({type:'grab',targetId:'bell',x:.7,y:.1});run(sim,240);}
  assert.deepEqual(a.snapshot(),b.snapshot());
  const before=structuredClone(a.snapshot().objects);
  a.act({type:'release'});assert.deepEqual(a.snapshot().objects,before);
});
test('cached onsets are consumed once; grabbed target and Gentle reject transients', () => {
  const sim=new MobileSimulation();
  const audio={...emptyAudioFrame(),available:true,playing:true,onset:1};
  run(sim,200,{features:audio,featureSequence:1,source:'live'});
  assert.equal(sim.snapshot().onsetImpulses,1);
  sim.reset(29,0,'open'); sim.act({type:'grab',targetId:'bell',x:0,y:0});
  run(sim,30,{features:audio,featureSequence:2,source:'live'});
  assert.equal(sim.snapshot().onsetImpulses,0);
  sim.act({type:'release'});run(sim,100,{features:audio,source:'live',reducedMotion:true,motion:.2});
  assert.equal(sim.snapshot().onsetImpulses,0);
});
test('inactive freezes and invalid features match neutral external drive', () => {
  const sim=new MobileSimulation(); const before=structuredClone(sim.snapshot());
  run(sim,200,{source:'inactive'});assert.deepEqual(sim.snapshot(),before);
  const a=new MobileSimulation(), b=new MobileSimulation();
  run(a,300,{source:'live',features:{...emptyAudioFrame(),bass:NaN,onset:Infinity}});
  run(b,300,{source:'live'});assert.deepEqual(a.snapshot(),b.snapshot());
});
test('30 simulated minutes of sustained drive, rapid grabs and nudges stay bounded', () => {
  const sim=new MobileSimulation();
  for(let i=0;i<30*60*60;i++) {
    if(i%13===0) sim.act({type:'nudge',targetId:'bell',x:i%2?1:-1,y:1});
    if(i%127===0) sim.act({type:'set-value',control:'counterweight',value:i%2?1:-1});
    if(i%359===0) sim.act({type:'grab',targetId:'vessel',x:i%2?1:-1,y:i%2?1:-1});
    if(i%359===100) sim.act({type:'release'});
    sim.step(frame(i,{source:'live',features:{...emptyAudioFrame(),available:true,playing:true,bass:1,intensity:1,onset:1,high:1}}));
    bounds(sim.snapshot());
  }
});
