import {SPACE_DELAY_CALIBRATION_V1 as calibration, spaceDelaySendGain} from '../audio-space/delay-calibration.mjs';
import {normalizeSpaceGesture} from './recipe.mjs';
import {TAKE_SOURCE_SAMPLE_RATE} from './source.mjs';

export const SPACE_TAKE_WORKLET_URL = '/worklets/space-take-v1.js';
export const SPACE_TAKE_PROCESSOR_NAME = 'room-space-take-v1';
export const SPACE_TAKE_OUTPUT_GAIN = 0.5;
export const SPACE_TAKE_GUARD = 0.98;

// Snap inaudible state to exact zero so silent voices can release their delay lines.
// This is -240 dBFS, far below the canonical PCM16 resolution.
const silence = 1e-12;
const guard = sample => Math.max(-SPACE_TAKE_GUARD, Math.min(SPACE_TAKE_GUARD, sample));

/** @param {number} canonicalFrame @param {number} sampleRate */
export function contextFrameFor(canonicalFrame, sampleRate) {
  return Math.ceil(canonicalFrame * sampleRate / TAKE_SOURCE_SAMPLE_RATE);
}

class Biquad {
  s1 = 0;
  s2 = 0;

  constructor(rate, cutoff, highpass) {
    // Web Audio lowpass/highpass filters express Q in decibels.
    if (cutoff >= rate / 2) {
      this.b0 = highpass ? 0 : 1;
      this.b1 = this.b2 = this.a1 = this.a2 = 0;
      return;
    }
    const w = 2 * Math.PI * cutoff / rate;
    const cos = Math.cos(w);
    const alpha = Math.sin(w) / (2 * 10 ** (calibration.filterQDb / 20));
    const a0 = 1 + alpha;
    this.b0 = (1 + (highpass ? cos : -cos)) / (2 * a0);
    this.b1 = (highpass ? -2 : 2) * this.b0;
    this.b2 = this.b0;
    this.a1 = -2 * cos / a0;
    this.a2 = (1 - alpha) / a0;
  }

  process(input) {
    const output = this.b0 * input + this.s1;
    this.s1 = this.b1 * input - this.a1 * output + this.s2;
    this.s2 = this.b2 * input - this.a2 * output;
    if (input === 0 && Math.abs(this.s1) + Math.abs(this.s2) < silence) this.s1 = this.s2 = 0;
    return output;
  }

  get silent() {
    return this.s1 === 0 && this.s2 === 0;
  }
}

function createDelay(rate, seconds, feedback) {
  const data = new Float32Array(Math.max(1, Math.round(rate * seconds)));
  const low = new Biquad(rate, calibration.lowpassHz, false);
  const high = new Biquad(rate, calibration.highpassHz, true);
  let index = 0;
  let pending = 0;
  return {
    process(input) {
      const delayed = data[index];
      const output = high.process(low.process(delayed));
      const stored = input + output * feedback;
      const next = Math.abs(stored) < silence ? 0 : stored;
      pending += Number(next !== 0) - Number(delayed !== 0);
      data[index] = next;
      if (++index === data.length) index = 0;
      return output;
    },
    get silent() {
      return pending === 0 && low.silent && high.silent;
    },
  };
}

/**
 * A throw carries its press-time settings through its independent tail.
 * Inputs are planar floats and the voice adds its filtered return into the
 * provided output block. Gate and block edges are half-open sample indices.
 * @param {number} sampleRate @param {import('./recipe.mjs').SpaceTakeSettings} effectiveSettings
 */
export function createSpaceVoice(sampleRate, effectiveSettings) {
  const {delayFrames, feedback, wetLevel, stereoWidth} = effectiveSettings;
  const seconds = delayFrames / TAKE_SOURCE_SAMPLE_RATE;
  const leftDelay = createDelay(sampleRate, seconds, feedback);
  const rightDelay = createDelay(sampleRate, seconds + calibration.rightOffsetSeconds, feedback);
  const gain = wetLevel * spaceDelaySendGain(feedback);
  const width = stereoWidth * calibration.maxStereoWidth;
  const direct = (1 + width) * gain / 2;
  const cross = (1 - width) * gain / 2;
  return {
    /**
     * The caller begins processing at the gate start; gateEnd can be outside this block.
     * @param {Float32Array | undefined} left @param {Float32Array | undefined} right
     * @param {Float32Array} wetLeft @param {Float32Array} wetRight
     */
    processBlock(left, right, wetLeft, wetRight, from, to, gateEnd) {
      for (let i = from; i < to; i++) {
        const open = i < gateEnd;
        const l = leftDelay.process(open ? left?.[i] ?? 0 : 0);
        const r = rightDelay.process(open ? right?.[i] ?? 0 : 0);
        wetLeft[i] += l * direct + r * cross;
        wetRight[i] += r * direct + l * cross;
      }
    },
    get silent() {
      return leftDelay.silent && rightDelay.silent;
    },
  };
}

/**
 * Version 1 mixer. The caller drives contiguous blocks of the selected passage.
 * Commands use canonical passage-relative frames, even on a different audio clock.
 * @param {number} sampleRate @param {number} rendererVersion @param {number} frameCount
 * @param {import('./recipe.mjs').SpaceGesture[]} gestures
 */
export function createSpaceRender(sampleRate, rendererVersion, frameCount, gestures) {
  if (rendererVersion !== 1) throw new RangeError('Unsupported Space take renderer version.');
  const schedule = new Map();
  const pending = [];
  const active = [];
  let position = 0;

  function open(input) {
    const gesture = normalizeSpaceGesture(input, frameCount);
    const start = contextFrameFor(gesture.startFrame, sampleRate);
    const end = contextFrameFor(gesture.endFrame, sampleRate);
    if (start < position) throw new RangeError('Echo press arrived late.');
    if (schedule.has(gesture.id)) throw new RangeError('Duplicate echo throw ID.');
    for (const entry of schedule.values()) {
      if (gesture.startFrame < entry.gesture.endFrame && gesture.endFrame > entry.gesture.startFrame) {
        throw new RangeError('Echo throws cannot overlap while sending.');
      }
    }
    const voice = gesture.settings.wetLevel === 0 ? null : createSpaceVoice(sampleRate, gesture.settings);
    const entry = {gesture, start, end, voice};
    schedule.set(gesture.id, entry);
    if (voice) {
      pending.push(entry);
      pending.sort((a, b) => a.start - b.start);
    }
  }

  function close(id, endFrame) {
    const entry = schedule.get(id);
    if (!entry || !Number.isSafeInteger(endFrame) || endFrame <= entry.gesture.startFrame
      || endFrame > entry.gesture.endFrame) {
      throw new RangeError('Invalid echo release.');
    }
    if (endFrame === entry.gesture.endFrame) return;
    const end = contextFrameFor(endFrame, sampleRate);
    if (end < position) throw new RangeError('Echo release arrived late.');
    entry.end = end;
    entry.gesture.endFrame = endFrame;
  }

  for (const gesture of gestures) open(gesture);

  return {
    open,
    close,
    /**
     * @param {Float32Array | undefined} left @param {Float32Array | undefined} right
     * @param {Float32Array | undefined} dryLeft @param {Float32Array | undefined} dryRight
     * @param {Float32Array} takeLeft @param {Float32Array} takeRight
     */
    processBlock(left, right, dryLeft, dryRight, takeLeft, takeRight, from = 0, to = takeLeft.length) {
      const next = position + to - from;
      while (pending.length && pending[0].start < next) active.push(pending.shift());
      takeLeft.fill(0, from, to);
      takeRight.fill(0, from, to);
      let retained = 0;
      for (const entry of active) {
        entry.voice.processBlock(left, right, takeLeft, takeRight,
          from + Math.max(0, entry.start - position), to, from + entry.end - position);
        if (entry.end <= next && entry.voice.silent) entry.voice = null;
        else active[retained++] = entry;
      }
      active.length = retained;
      for (let i = from; i < to; i++) {
        const l = (left?.[i] ?? 0) * SPACE_TAKE_OUTPUT_GAIN;
        const r = (right?.[i] ?? 0) * SPACE_TAKE_OUTPUT_GAIN;
        if (dryLeft) dryLeft[i] = guard(l);
        if (dryRight) dryRight[i] = guard(r);
        takeLeft[i] = guard(l + takeLeft[i] * SPACE_TAKE_OUTPUT_GAIN);
        takeRight[i] = guard(r + takeRight[i] * SPACE_TAKE_OUTPUT_GAIN);
      }
      position = next;
    },
  };
}
