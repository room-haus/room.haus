import {grainRange, memoryTick, windowSamples, ONSET_SECONDS, REPEAT_SECONDS, STEP} from '../audio-memory/material.mjs';
import {TAKE_SOURCE_SAMPLE_RATE as RATE} from './source.mjs';
import {SPACE_TAKE_GUARD, SPACE_TAKE_OUTPUT_GAIN as MIX_GAIN} from './space-render.mjs';

const voiceLimit = 16;
const guard = sample => Math.max(-SPACE_TAKE_GUARD, Math.min(SPACE_TAKE_GUARD, sample));

/**
 * Canonical 48 kHz frames relative to the passage. startFrame is the button press.
 * Tick zero sounds 25 ms later. A live caller uses these event frames directly.
 * Each trigger owns its tick index, including when audition starts mid-passage.
 * @param {import('./recipe.mjs').MemoryGesture[]} gestures @param {number} frameCount
 */
export function memorySchedule(gestures, frameCount) {
  const events = [];
  for (const g of gestures) {
    const length = g.fragmentRef.frameCount;
    const stop = Math.min(frameCount, g.endFrame, g.startFrame + REPEAT_SECONDS * RATE);
    const onset = g.startFrame + ONSET_SECONDS * RATE;
    if (g.level === 0) continue;
    for (let tick = 0, at = onset; at < stop; tick++, at += STEP * RATE) {
      const grain = memoryTick(g.treatment, g.density, length / RATE, tick);
      if (grain === null) continue;
      const frames = grain === -1 ? length : grainRange(length, RATE, grain).frames;
      // The initial voice may end at the gesture boundary. Later ticks require a full window.
      if (tick > 0 && at + frames > stop) continue;
      events.push({gestureId: g.id, sha256: g.fragmentRef.sha256, grain, startFrame: at,
        endFrame: Math.min(at + frames, stop), gain: g.level * (grain === -1 ? .5 : .36)});
    }
  }
  events.sort((a, b) => a.startFrame - b.startFrame);
  let ends = [];
  for (const event of events) {
    ends = ends.filter(end => end > event.startFrame);
    if (ends.length >= voiceLimit) throw new RangeError('Too many simultaneous fragment voices.');
    ends.push(event.endFrame);
  }
  return events;
}

/** Decode and window only the material and grain indices used by this performance. */
function prepareVoice(pcm, grain) {
  const length = pcm.byteLength / 4;
  const {offset, frames} = grain === -1 ? {offset: 0, frames: length} : grainRange(length, RATE, grain);
  const samples = new DataView(pcm.buffer, pcm.byteOffset, pcm.byteLength);
  return [0, 1].map(channel => {
    const input = Float32Array.from({length: frames}, (_, i) => samples.getInt16((offset + i) * 4 + channel * 2, true) / 32768);
    return windowSamples(input, RATE, grain !== -1);
  });
}

/**
 * Process or seek the canonical source clock before any device resampling.
 * @param {import('./recipe.mjs').MemoryGesture[]} gestures @param {number} frameCount
 * @param {ReadonlyMap<string, Uint8Array>} materials Verified raw PCM keyed by SHA-256.
 */
export function createMemoryRender(gestures, frameCount, materials) {
  const schedule = memorySchedule(gestures, frameCount);
  for (const {fragmentRef} of gestures) {
    const pcm = materials?.get(fragmentRef.sha256);
    if (!(pcm instanceof Uint8Array) || pcm.byteLength !== fragmentRef.frameCount * 4) {
      throw new RangeError('A referenced fragment material is missing or has the wrong length.');
    }
  }
  const windows = new Map();
  const events = schedule.map(event => {
    const key = event.sha256 + '/' + event.grain;
    if (!windows.has(key)) windows.set(key, prepareVoice(materials.get(event.sha256), event.grain));
    return {...event, channels: windows.get(key)};
  });
  let position = 0, nextEvent = 0, active = [];
  return {
    seek(frame) {
      if (!Number.isSafeInteger(frame) || frame < 0 || frame > frameCount) throw new RangeError('Invalid fragment seek.');
      position = frame;
      nextEvent = 0;
      active = [];
      while (nextEvent < events.length && events[nextEvent].startFrame < frame) {
        const event = events[nextEvent++];
        if (event.endFrame > frame) active.push(event);
      }
    },
    dispose() {
      events.length = 0;
      active.length = 0;
      windows.clear();
    },
    processBlock(left, right, dryLeft, dryRight, takeLeft, takeRight, from = 0, to = takeLeft.length) {
      const end = position + to - from;
      while (nextEvent < events.length && events[nextEvent].startFrame < end) active.push(events[nextEvent++]);
      takeLeft.fill(0, from, to);
      takeRight.fill(0, from, to);
      for (const event of active) {
        const [l, r] = event.channels;
        const clipped = event.endFrame - event.startFrame < l.length;
        for (let f = Math.max(position, event.startFrame); f < Math.min(end, event.endFrame); f++) {
          const i = from + f - position, sample = f - event.startFrame;
          const gain = clipped ? event.gain * Math.min(1, (event.endFrame - 1 - f) / (.015 * RATE)) : event.gain;
          takeLeft[i] += l[sample] * gain;
          takeRight[i] += r[sample] * gain;
        }
      }
      active = active.filter(e => e.endFrame > end);
      for (let i = from; i < to; i++) {
        const l = (left?.[i] ?? 0) * MIX_GAIN, r = (right?.[i] ?? 0) * MIX_GAIN;
        if (dryLeft) dryLeft[i] = guard(l);
        if (dryRight) dryRight[i] = guard(r);
        takeLeft[i] = guard(l + takeLeft[i] * MIX_GAIN);
        takeRight[i] = guard(r + takeRight[i] * MIX_GAIN);
      }
      position = end;
    },
  };
}
