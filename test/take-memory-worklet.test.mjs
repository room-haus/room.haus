import test from 'node:test';
import assert from 'node:assert/strict';
import {captureFragment} from '../src/experiences/takes/fragment-asset.mjs';
import {prepareMemoryEvents} from '../src/experiences/takes/memory-render.mjs';
import {renderTake} from '../src/experiences/takes/render.mjs';

for (const deviceRate of [48000, 44100]) {
  test('performed stereo and Original match the canonical reference on a ' + deviceRate + ' Hz device', async (t) => {
    let Processor;
    for (const [name, value] of Object.entries({
      AudioWorkletProcessor: class {
        port = {postMessage() {}};
      },
      sampleRate: deviceRate,
      currentFrame: 0,
      registerProcessor: (_name, ctor) => {
        Processor = ctor;
      },
    })) {
      Object.defineProperty(globalThis, name, {value, configurable: true, writable: true});
      t.after(() => {
        delete globalThis[name];
      });
    }
    await import('../src/experiences/takes/memory-worklet.mjs?rate=' + deviceRate);
    const length = 36000,
      sampleRate = 48000;
    const pcm = new Uint8Array(length * 4),
      samples = new DataView(pcm.buffer);
    for (let i = 0; i < length; i++) {
      samples.setInt16(i * 4, 32767, true);
      samples.setInt16(i * 4 + 2, Math.round(28000 * Math.cos(i * 0.022)), true);
    }
    const passage = {sourceId: 'MX029', revision: 'test', startFrame: 900, endFrame: 900 + length};
    const raw = {pcm, frameCount: length, sampleRate, channels: 2, format: 's16le'};
    const captured = await captureFragment(raw, passage, 12900, 12000);
    const materials = new Map([[captured.ref.sha256, captured.pcm]]);
    const trigger = {
      id: 'lead',
      startFrame: 3000,
      endFrame: length,
      fragmentRef: captured.ref,
      treatment: 'repeat',
      level: 1,
      density: 8,
      seedVersion: 1,
    };
    const extra = {...trigger, id: 'second', startFrame: 3300};
    const recipe = {
      schema: 1,
      rendererVersion: 1,
      experiment: 'audio-memory',
      parentId: null,
      passage,
      gestures: [trigger, extra],
    };
    const expected = renderTake(recipe, raw, materials);
    const offset = 901,
      start = 217;
    const events = prepareMemoryEvents([trigger], length, materials);
    const node = new Processor({processorOptions: {pcm: pcm.buffer, events, offset}});
    node.port.onmessage({data: {type: 'start', frame: start}});
    const streams = [expected.dry, expected.take].map((bytes) => new DataView(bytes.buffer));
    let clipped = false;
    for (let head = 0; head < ((length - offset) * deviceRate) / 48000 + start; head += 128) {
      globalThis.currentFrame = head;
      if (head === 1024) {
        // The player has already installed this PCM window for the first trigger.
        const reused = prepareMemoryEvents([extra], length, materials).map((event) => ({
          ...event,
          channels: undefined,
        }));
        node.port.onmessage({data: {type: 'trigger', id: extra.id, events: reused}});
      }
      const output = [
        [new Float32Array(128), new Float32Array(128)],
        [new Float32Array(128), new Float32Array(128)],
      ];
      node.process([], output);
      for (let i = 0; i < 128; i++) {
        const pos = ((head + i - start) * 48000) / deviceRate;
        if (pos < 0 || offset + pos >= length) continue;
        const frame = offset + Math.floor(pos),
          frac = pos - Math.floor(pos);
        for (let mode = 0; mode < 2; mode++)
          for (let ch = 0; ch < 2; ch++) {
            const a = streams[mode].getInt16(frame * 4 + ch * 2, true);
            const b = streams[mode].getInt16(Math.min(frame + 1, length - 1) * 4 + ch * 2, true);
            clipped ||= a === 32112;
            assert.ok(
              Math.abs(output[mode][ch][i] * 32768 - (a + (b - a) * frac)) < 0.005,
              'output differs at frame ' + frame + ' mode ' + mode + ' channel ' + ch,
            );
          }
      }
    }
    assert.ok(clipped, 'fixture must exercise the shared peak guard');
  });
}
