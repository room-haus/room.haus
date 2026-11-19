// Memory v1 uses free-time ticks and a stateless grain sequence.
export const REPEAT_SECONDS = 12, GRAIN_SECONDS = .2, STEP = .0625, ONSET_SECONDS = .025;

export function windowSamples(input, rate, hann) {
  const output = new Float32Array(input.length);
  const fade = Math.max(1, Math.round(.015 * rate));
  for (let i = 0; i < input.length; i++) {
    const gain = hann ? .5 - .5 * Math.cos(2 * Math.PI * i / Math.max(1, input.length - 1))
      : Math.min(1, i / fade, (input.length - 1 - i) / fade);
    output[i] = (Number.isFinite(input[i]) ? input[i] : 0) * gain;
  }
  return output;
}

export function grainChoice(index) {
  let n = (Math.floor(index) + 0x529a) >>> 0;
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  return (n ^ (n >>> 16)) >>> 29;
}

export function grainRange(length, rate, grain) {
  const frames = Math.min(length, Math.floor(GRAIN_SECONDS * rate));
  return {offset: Math.round((length - frames) * grain / 7), frames};
}

// -1 selects the full repeat, 0–7 select Hann grains and null skips the tick.
export function memoryTick(treatment, density, duration, index) {
  if (treatment === 'repeat') {
    const interval = Math.ceil(duration / STEP * (1 + (8 - density) / 4));
    return index % interval === 0 ? -1 : null;
  }
  if (index === 0) return 0;
  if (index % Math.ceil(8 / density) !== 0) return null;
  const scan = Math.min(7, Math.floor((ONSET_SECONDS + index * STEP) / REPEAT_SECONDS * 8));
  return Math.max(0, Math.min(7, scan + grainChoice(index) % 3 - 1));
}
