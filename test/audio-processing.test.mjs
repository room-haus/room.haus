import test from 'node:test';
import assert from 'node:assert/strict';
import {processingSettings} from '../src/experiences/audio-processing/processor.ts';

test('processing settings reject non-finite input and bound all audible controls',()=>{
  assert.deepEqual(processingSettings({cutoff:NaN,saturation:Infinity,movement:-Infinity}),{cutoff:8000,saturation:.2,movement:0});
  assert.deepEqual(processingSettings({cutoff:-1,saturation:9,movement:9}),{cutoff:200,saturation:1,movement:1});
  assert.deepEqual(processingSettings({cutoff:1e8,saturation:-1,movement:-1}),{cutoff:18000,saturation:0,movement:0});
  assert.deepEqual(processingSettings({cutoff:1000,saturation:0,movement:0}),{cutoff:1000,saturation:0,movement:0});
});
