import test from 'node:test';
import assert from 'node:assert/strict';
import {atmosphereSettings} from '../src/experiences/audio-atmosphere/layer.ts';

test('external layer settings cannot introduce nonfinite parameters or excessive gain and pitch',()=>{
  const s=atmosphereSettings({texture:2,brightness:Infinity,movement:-1,tuning:1e9});
  assert.deepEqual(s,{texture:1,brightness:900,movement:0,tuning:880});
  assert.deepEqual(atmosphereSettings({texture:NaN,brightness:-5,movement:Infinity,tuning:0}),{texture:0,brightness:150,movement:.2,tuning:55});
});
