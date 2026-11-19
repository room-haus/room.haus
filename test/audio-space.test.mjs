import test from 'node:test';
import assert from 'node:assert/strict';
import {spaceSettings,spaceDefaults,makeImpulse,delaySeconds} from '../src/experiences/audio-space/processor.ts';

test('space parameters bound feedback, delay, mode, stereo and non-finite values',()=>{
  assert.deepEqual(spaceSettings({time:NaN,feedback:Infinity,mode:NaN,stereo:NaN}),spaceDefaults);
  const p=spaceSettings({time:999,feedback:999,mode:9,stereo:9});
  assert.equal(p.time,1);assert.equal(p.feedback,1);assert.equal(p.mode,1);assert.equal(p.stereo,1);
  assert.equal(delaySeconds({bpm:120,tempoSet:true},.5,.2),.25);
  assert.equal(delaySeconds({bpm:40,tempoSet:true},1,.2),1.5);
  assert.equal(delaySeconds({bpm:120,tempoSet:false},.5,.2),.2);
  assert.equal(delaySeconds({bpm:NaN,tempoSet:true},1,.2),.2);
});
test('generated close and air responses are deterministic, bounded, stereo and finite',()=>{
  for(const seconds of [.18,.9]){
    const a=makeImpulse(24000,seconds),b=makeImpulse(24000,seconds);
    assert.deepEqual(a,b);assert.equal(a.length,2);assert.equal(a[0].length,Math.ceil(24000*seconds));
    assert.notDeepEqual(a[0],a[1]);assert.ok(a.every(c=>c.every(Number.isFinite)));
    for(const c of a){assert.ok(Math.max(...c.map(Math.abs))<.3);assert.ok(c.slice(-240).every(v=>Math.abs(v)<.0001));}
  }
});
