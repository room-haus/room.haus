import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import test from 'node:test';
import {FeatureExtractor, emptyAudioFrame} from '../src/experiences/underlevel/audio/FeatureExtractor.ts';
import {CueTimeline} from '../src/experiences/underlevel/audio/CueTimeline.ts';

// The shared audio modules rely on webpack's extension resolution.
const resolver = registerHooks({
  resolve(specifier, context, next) {
    if (context.parentURL?.includes('/src/audio/') && /^\.\/[\w-]+$/.test(specifier)) {
      return next(specifier + '.js', context);
    }
    return next(specifier, context);
  },
});
const {AudioController} = await import('../src/experiences/underlevel/audio/AudioController.ts');
resolver.deregister();

const dt = 1 / 30;
const features = () => {
  const extractor = new FeatureExtractor();
  const frame = emptyAudioFrame();
  const bins = new Float32Array(2048);
  const waveform = new Uint8Array(4096).fill(128);
  return (time, {level = 0, frequency = 80, spectrumLevel = level, tones} = {}) => {
    bins.fill(-Infinity);
    const index = Math.round(frequency / (48000 / 4096));
    if (spectrumLevel > 0) bins.fill(Math.min(spectrumLevel * 8 / 255, 1) * 70 - 100, index - 1, index + 2);
    for (const [hz, decibels] of tones ?? []) {
      const bin = Math.round(hz / (48000 / 4096));
      bins.fill(decibels, bin - 1, bin + 2);
    }
    waveform.fill(128 - level, 0, waveform.length / 2);
    waveform.fill(128 + level, waveform.length / 2);
    extractor.sample(bins, waveform, 48000, time, dt, frame);
    return {...frame};
  };
};

test('silent analysis stays neutral and available', () => {
  const frame = features()(0);
  assert.deepEqual(frame, {...emptyAudioFrame(), available: true, playing: true});
});

test('bounded band and RMS features respond to frequency and adapt to steady levels', () => {
  const sample = features();
  const track = Array.from({length: 450}, (_, step) => sample(step * dt, {level: 95}));
  const frame = track.at(-1);
  assert.ok(frame.bass > 0.15 && frame.bass < 0.85);
  assert.equal(frame.high, 0);
  assert.ok(frame.rms > 0.15 && frame.rms < 0.85);
  assert.ok(frame.intensity > 0.15 && frame.intensity < 0.85);
  assert.ok(frame.brightness < 0.2);
  for (const {time, playing, available, bpm, ...signals} of track) {
    for (const value of Object.values(signals)) assert.ok(value >= 0 && value <= 1);
  }
  const bright = features();
  for (let step = 0; step < 90; step++) bright(step * dt, {level: 30, frequency: 6200});
  assert.ok(bright(3, {level: 30, frequency: 6200}).brightness > 0.6);
});

test('unequal sustained bands stay unequal after the mix settles', () => {
  const sample = features();
  let frame;
  for (let step = 0; step <= 450; step++) {
    frame = sample(step * dt, {level: 35, spectrumLevel: 0, tones: [[80, -38], [6200, -78]]});
  }
  assert.ok(frame.bass > frame.high + 0.35);
  const steady = sample(451 * dt, {level: 35, spectrumLevel: 0, tones: [[80, -38], [6200, -78]]});
  assert.ok(Math.abs(steady.bass - frame.bass) < 0.01);
});

test('a 6 dB band change remains visible and spectral noise below the band floor stays dark', () => {
  const sample = features();
  const measure = (step, db) => sample(step * dt, {
    level: 35, spectrumLevel: 0, tones: [[80, db], [6200, -92]],
  });
  let frame;
  for (let step = 0; step < 150; step++) frame = measure(step, -53);
  const sustained = frame.bass;
  for (let step = 150; step < 155; step++) frame = measure(step, -47);
  assert.ok(frame.bass - sustained > 0.08);
  assert.equal(frame.high, 0);
  for (let step = 155; step < 172; step++) frame = measure(step, -90);
  assert.ok(frame.bass < 0.03);
});

test('a nearby transient inside the cooldown cannot generate a second onset', () => {
  const sample = features();
  sample(0);
  assert.ok(sample(dt, {level: 30}).onset > 0.5);
  sample(2 * dt);
  assert.equal(sample(3 * dt, {level: 45}).onset, 0);
});

test('tempo requires repeated coherent transients and expires after a breakdown', () => {
  const sample = features();
  sample(0);
  const single = sample(dt, {level: 30});
  assert.equal(single.bpm, 0);
  assert.equal(single.beatConfidence, 0);
  let frame;
  for (let step = 2; step <= 180; step++) {
    frame = sample(step * dt, {level: step % 15 === 0 ? 30 : 0});
  }
  assert.ok(Math.abs(frame.bpm - 120) < 2);
  assert.ok(frame.beatConfidence > 0.7);
  for (let step = 181; step <= 300; step++) frame = sample(step * dt);
  assert.equal(frame.bpm, 0);
  assert.equal(frame.beatConfidence, 0);
});

test('tempo recovers repeating loudness changes without isolated spectral onsets', () => {
  const sample = features();
  let frame;
  for (let step = 0; step <= 240; step++) {
    const level = 28 + Math.round(5 * Math.cos(2 * Math.PI * step / 15));
    frame = sample(step * dt, {level, spectrumLevel: 26});
    assert.equal(frame.onset, 0);
  }
  assert.ok(Math.abs(frame.bpm - 120) < 3);
  assert.ok(frame.beatConfidence > 0.7);
});

test('aperiodic variations do not produce a tempo estimate', () => {
  const sample = features();
  let seed = 29;
  for (let step = 0; step <= 450; step++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const level = (seed >>> 25) % 65;
    const frame = sample(step * dt, {level, spectrumLevel: 26});
    assert.equal(frame.bpm, 0);
    assert.equal(frame.beatConfidence, 0);
  }
});

test('cue lookup reconstructs state at boundaries and ignores backward crossings', () => {
  const early = {id: 'early', time: 4, kind: 'build', intensity: 0.4, chapter: 'THRESHOLD'};
  const late = {id: 'late', time: 12, kind: 'drop', intensity: 1, chapter: 'THE HALL'};
  const timeline = new CueTimeline([late, early]);
  assert.equal(timeline.at(3), undefined);
  assert.deepEqual(timeline.at(4), early);
  assert.deepEqual(timeline.at(20), late);
  assert.deepEqual(timeline.at(8), early);
  assert.deepEqual(timeline.between(4, 12), [late]);
  assert.deepEqual(timeline.between(12, 4), []);
});

class NativeAudio extends EventTarget {
  paused = true;
  currentTime = 0;
  readyState = 4;
  duration = 180;
  volume = 1;
  canPlayType() { return 'probably'; }
  play() {
    this.paused = false;
    this.dispatchEvent(new Event('loadedmetadata'));
    this.dispatchEvent(new Event('playing'));
    return Promise.resolve();
  }
  pause() {
    this.paused = true;
    this.dispatchEvent(new Event('pause'));
  }
  removeAttribute() { this.src = ''; }
  load() {}
}

test('native WebKit plays with analysis unavailable on one element', () => {
  globalThis.Audio = NativeAudio;
  globalThis.window = {AudioContext: class {
    constructor() { assert.fail('WebKit native HLS would be routed through Web Audio'); }
  }};
  Object.defineProperty(globalThis, 'navigator', {configurable: true, value: {vendor: 'Apple Computer, Inc.'}});
  const audio = new AudioController('/mix.m3u8');
  try {
    audio.setVolume(0.25);
    audio.play();
    const media = audio.source.media;
    assert.equal(media.volume, 0.25);
    assert.deepEqual(audio.sample(dt), {...emptyAudioFrame(), playing: true});
    audio.seek(20);
    assert.equal(audio.sample(dt).time, 20);
    audio.pause();
    assert.equal(audio.snapshot().status, 'paused');
    assert.equal(audio.sample(dt).playing, false);
    audio.play();
    assert.equal(audio.source.media, media);
  } finally {
    audio.dispose();
  }
  assert.equal(audio.source.media, null);
  assert.equal(audio.snapshot().playing, false);
});

test('analyzed playback samples at 30 Hz and clears features on pause or either seek path', () => {
  globalThis.Audio = NativeAudio;
  Object.defineProperty(globalThis, 'navigator', {configurable: true, value: {vendor: 'Other'}});
  let reads = 0;
  globalThis.window = {AudioContext: class {
    sampleRate = 48000;
    state = 'running';
    destination = {};
    createMediaElementSource() { return {connect() {}, disconnect() {}}; }
    createAnalyser() {
      return {
        frequencyBinCount: 2048,
        getFloatFrequencyData(array) {
          reads++;
          array.fill(-Infinity);
          array[7] = -25;
        },
        getByteTimeDomainData(array) { array.fill(140); },
        disconnect() {},
      };
    }
    resume() { return Promise.resolve(); }
    close() { return Promise.resolve(); }
  }};
  const audio = new AudioController('/mix.m3u8');
  try {
    audio.play();
    const frame = audio.sample(1 / 60);
    assert.equal(frame.available, true);
    assert.ok(frame.bass > 0);
    for (let index = 0; index < 120; index++) audio.sample(1 / 60);
    assert.ok(reads >= 58 && reads <= 61, 'approximately 30 measurements per second');
    audio.source.media.currentTime = 25;
    assert.equal(audio.sample(1 / 60).time, 25);
    assert.equal(frame.bass, 0, 'native forward seek clears the previous features');
    assert.ok(audio.sample(dt).bass > 0);
    audio.source.media.currentTime = 24.95;
    assert.equal(audio.sample(1 / 60).time, 24.95);
    assert.equal(frame.bass, 0, 'native backward seek clears the previous features');
    assert.ok(audio.sample(dt).bass > 0);
    audio.seek(40);
    assert.equal(audio.sample(0), frame);
    assert.equal(frame.time, 40);
    assert.equal(frame.onset, 0);
    assert.equal(frame.bass, 0);
    audio.pause();
    assert.deepEqual(audio.sample(dt), {...emptyAudioFrame(), time: 40});
  } finally {
    audio.dispose();
  }
});
