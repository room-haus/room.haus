import assert from 'node:assert/strict';
import test from 'node:test';
import {EnsembleSimulation} from '../src/experiences/odd-ensemble/EnsembleSimulation.ts';
import {ToyRuntime} from '../src/experiences/shared/ToyRuntime.ts';
import {emptyAudioFrame} from '../src/experiences/shared/audio/FeatureExtractor.ts';
const frame=(i,extra={})=>({dt:1/60,simTime:i/60,mediaTime:i/60,features:emptyAudioFrame(),featureSequence:i,source:'ambient',mode:'watch',autonomy:1,motion:1,reducedMotion:false,...extra});
const run=(sim,n,extra={})=>{for(let i=0;i<n;i++)sim.step(frame(i,extra));return sim.snapshot();};
function bounds(s){for(const m of s.members){for(const c of [m.stretch,m.lean,m.aperture]){assert.ok(Number.isFinite(c.value));assert.ok(Number.isFinite(c.velocity));}assert.ok(m.stretch.value>=.75&&m.stretch.value<=1.35);assert.ok(Math.abs(m.lean.value)<=Math.PI/12);assert.ok(m.aperture.value>=0&&m.aperture.value<=1);}assert.ok(s.pending.length<=1);}
test('extreme actions and thirty simulated minutes stay bounded',()=>{
 const s=new EnsembleSimulation();
 for(let i=0;i<108000;i++){
  if(i%41===0)s.act({type:'nudge',targetId:'low',x:i%2?1e20:-1e20,y:i%2?1e20:-1e20});
  if(i%113===0)s.act({type:'grab',targetId:'pip',x:-1,y:1});
  if(i%113===1)s.act({type:'move',x:1e20,y:-1e20});
  if(i%113===60)s.act({type:'release'});
  s.step(frame(i,{source:'live',features:{...emptyAudioFrame(),available:true,playing:true,bass:1,mid:1,high:1,intensity:1,onset:1}}));bounds(s.snapshot());
 }
 assert.equal(s.act({type:'nudge',targetId:'low',x:NaN,y:Infinity}),false);
 assert.equal(s.act({type:'command',command:'poke',targetId:'unknown'}),false);
});
test('same seed/actions replay exactly; 30/60Hz rendering produces identical fixed-step state',()=>{
 const render=hz=>{const rt=new ToyRuntime(new EnsembleSimulation(),false);rt.reset(0,'open');for(let i=0;i<=hz*20;i++){rt.tick(i*1000/hz,{features:emptyAudioFrame(),featureSequence:0,source:'ambient',mediaTime:0},true);}return rt.simulation.snapshot();};
 assert.deepEqual(render(30),render(60));
 const a=new EnsembleSimulation(),b=new EnsembleSimulation();for(const s of [a,b]){s.reset(57,270,'seek');s.act({type:'nudge',targetId:'pip',x:1,y:1});run(s,700);}assert.deepEqual(a.snapshot(),b.snapshot());
});
test('held input owns its member; release and Watch preserve physical channels; Keep control persists',()=>{
 const rt=new ToyRuntime(new EnsembleSimulation(),false),f={features:emptyAudioFrame(),featureSequence:0,source:'ambient',mediaTime:0};rt.tick(0,f,true);
 rt.act({type:'grab',targetId:'low',x:0,y:0});rt.act({type:'move',x:.8,y:.8});
 for(let i=1;i<=900;i++)rt.tick(i*1000/60,f,true);
 assert.equal(rt.simulation.snapshot().grabbedId,'low');assert.equal(rt.director.update(rt.simTime).autonomy,0);
 const before=structuredClone(rt.simulation.snapshot().members);rt.release();assert.deepEqual(rt.simulation.snapshot().members,before);
 rt.director.keep=true;for(let i=901;i<=1800;i++)rt.tick(i*1000/60,f,true);assert.equal(rt.director.update(rt.simTime).mode,'control');
 rt.director.keep=false;for(let i=1801;i<=2400;i++)rt.tick(i*1000/60,f,true);assert.equal(rt.director.update(rt.simTime).mode,'watch');bounds(rt.simulation.snapshot());
});
test('one fresh onset makes one nod; pokes have one-hop delayed response and shared cooldown',()=>{
 const s=new EnsembleSimulation(),features={...emptyAudioFrame(),playing:true,available:true,onset:1};run(s,180,{source:'live',features,featureSequence:1});assert.equal(s.snapshot().onsetNods,1);
 s.reset(29,0,'open');assert.equal(s.act({type:'command',command:'poke',targetId:'knuckle'}),true);assert.equal(s.act({type:'command',command:'poke',targetId:'pip'}),true);assert.equal(s.snapshot().pending.length,1);
 run(s,120);assert.equal(s.snapshot().neighbourReactions,1);assert.equal(s.snapshot().pending.length,0);assert.equal(s.snapshot().pokes,2);
});
test('inactive and motion-zero freeze exactly; seek clears queued responses and grab',()=>{
 const s=new EnsembleSimulation();s.act({type:'command',command:'poke',targetId:'low'});s.act({type:'grab',targetId:'low',x:0,y:0});const before=structuredClone(s.snapshot());run(s,90,{source:'inactive'});assert.deepEqual(s.snapshot(),before);run(s,90,{motion:0});assert.deepEqual(s.snapshot(),before);
 s.reset(29,120,'seek');assert.equal(s.snapshot().pending.length,0);assert.equal(s.snapshot().grabbedId,null);for(const m of s.snapshot().members)assert.equal(m.stretch.value,1);
});
test('ambient ignores all audio bands; Gentle disables onset/poke impulses and neighbour reactions',()=>{
 const a=new EnsembleSimulation(),b=new EnsembleSimulation();run(a,900,{features:{...emptyAudioFrame(),bass:1,mid:1,onset:1,intensity:1}});run(b,900);assert.deepEqual(a.snapshot(),b.snapshot());
 const gentle=new EnsembleSimulation();run(gentle,60,{reducedMotion:true,motion:.2,source:'live',features:{...emptyAudioFrame(),available:true,playing:true,onset:1}});const velocity=gentle.snapshot().members[0].stretch.velocity;gentle.act({type:'command',command:'poke',targetId:'low'});assert.equal(gentle.snapshot().members[0].stretch.velocity,velocity);run(gentle,180,{reducedMotion:true,motion:.2});assert.equal(gentle.snapshot().onsetNods,0);assert.equal(gentle.snapshot().neighbourReactions,0);
});
test('invalid live features behave as neutral and passive gestures remain sparse over ten minutes',()=>{
 const a=new EnsembleSimulation(),b=new EnsembleSimulation();run(a,100,{source:'live',features:{...emptyAudioFrame(),available:true,playing:true,bass:NaN,mid:Infinity,onset:NaN}});run(b,100,{source:'live',features:{...emptyAudioFrame(),available:true,playing:true}});assert.deepEqual(a.snapshot(),b.snapshot());
 const s=new EnsembleSimulation();run(s,36000);assert.ok(s.snapshot().gestures>=29&&s.snapshot().gestures<=50);assert.equal(s.snapshot().neighbourReactions,s.snapshot().gestures);assert.equal(s.snapshot().onsetNods,0);
});

test('runtime suspension discards pending reactions while retaining deformation',()=>{
 const rt=new ToyRuntime(new EnsembleSimulation(),false),f={features:emptyAudioFrame(),featureSequence:0,source:'ambient',mediaTime:0};rt.tick(0,f,true);rt.act({type:'command',command:'poke',targetId:'low'});
 assert.equal(rt.simulation.snapshot().pending.length,1);const pose=structuredClone(rt.simulation.snapshot().members);rt.suspend();assert.equal(rt.simulation.snapshot().pending.length,0);assert.deepEqual(rt.simulation.snapshot().members,pose);
});
test('a held member rejects conflicting selection and remains the directional target',()=>{
 const s=new EnsembleSimulation();s.act({type:'grab',targetId:'low',x:0,y:0});assert.equal(s.act({type:'select',targetId:'pip'}),false);assert.equal(s.snapshot().selectedId,'low');assert.equal(s.snapshot().grabbedId,'low');
});
test('Gentle poke immediately after a zero-step resume or reset never injects an impulse',()=>{
 const rt=new ToyRuntime(new EnsembleSimulation(),true);rt.motionPaused=false;
 const f={features:emptyAudioFrame(),featureSequence:0,source:'ambient',mediaTime:0};
 for(const reset of [false,true]){if(reset)rt.reset(40,'user');rt.tick(reset?1000:0,f,true);assert.equal(rt.running,true);rt.act({type:'command',command:'poke',targetId:'low'});assert.equal(rt.simulation.snapshot().members[0].stretch.velocity,0);assert.equal(rt.simulation.snapshot().pending.length,0);}
});
test('the neighbour receiving an autonomous reaction is the member being attended to',()=>{
 const s=new EnsembleSimulation();for(let i=0;i<36000;i++){s.step(frame(i));for(const r of s.snapshot().pending){assert.equal(s.snapshot().members.find(m=>m.id===r.from).attention,r.id);}}
});
test('release damps toward the current musical pose even when Keep control remains set',()=>{
 const s=new EnsembleSimulation();s.act({type:'grab',targetId:'low',x:0,y:0});s.act({type:'move',x:1,y:1});run(s,120,{mode:'control',autonomy:0});assert.ok(s.snapshot().members[0].stretch.value>1.3);const physical=structuredClone(s.snapshot().members);s.act({type:'release'});assert.deepEqual(s.snapshot().members,physical);run(s,180,{mode:'control',autonomy:0});assert.ok(s.snapshot().members[0].stretch.value<1.05);
});
test('group response cooldown never swallows another member’s local poke',()=>{
 const s=new EnsembleSimulation();s.act({type:'command',command:'poke',targetId:'low'});run(s,10);assert.equal(s.act({type:'command',command:'poke',targetId:'pip'}),true);assert.ok(s.snapshot().members[2].stretch.velocity<-.5);assert.equal(s.snapshot().pending.length,1);assert.equal(s.snapshot().pokes,2);
});
