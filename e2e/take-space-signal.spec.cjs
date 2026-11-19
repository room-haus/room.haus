const {expect, test} = require('@playwright/test');

const rate = 48_000;
const frameCount = rate * 2;
const gesture = {
  id: 'test-throw', startFrame: 28_800, endFrame: 36_000,
  settings: {delayFrames: 4800, feedback: 0.4, wetLevel: 1, stereoWidth: 1},
};
const recipe = {
  schema: 1, experiment: 'audio-space', rendererVersion: 1, parentId: null,
  passage: {sourceId: 'mx029', revision: 'test', startFrame: 123, endFrame: 123 + frameCount},
  initialSettings: gesture.settings, gestures: [gesture],
};

// Capture the actual render thread output before it reaches the device.
const tapModule = `
  class Capture extends AudioWorkletProcessor {
    constructor({processorOptions: {start, length}}) {
      super();
      this.start = start;
      this.length = length;
      this.left = new Float32Array(length + 1);
      this.right = new Float32Array(length + 1);
    }

    process(inputs, outputs) {
      if (!this.left) return false;
      const [left, right] = inputs[0];
      const size = outputs[0][0].length;
      for (let i = 0; i < size; i++) {
        const position = currentFrame + i - this.start;
        if (position >= 0 && position <= this.length) {
          this.left[position] = left?.[i] ?? 0;
          this.right[position] = right?.[i] ?? 0;
        }
      }
      if (currentFrame + size <= this.start + this.length) return true;
      this.port.postMessage([this.left, this.right], [this.left.buffer, this.right.buffer]);
      this.left = this.right = null;
      return false;
    }
  }
  registerProcessor('take-test-capture', Capture);
`;

function fixture(at, packet = false) {
  const pcm = new Uint8Array(frameCount * 4);
  const source = new DataView(pcm.buffer);
  const channels = [[], []];
  for (const onset of at) {
    const left = [];
    const right = [];
    const count = packet ? 1920 : 1;
    for (let i = 0; i < count; i++) {
      const shape = packet ? Math.sin(Math.PI * i / count) ** 2 * Math.sin(2 * Math.PI * 900 * i / rate) : 1;
      const l = Math.round(24_576 * shape);
      const r = Math.round(8192 * shape);
      source.setInt16((onset + i) * 4, l, true);
      source.setInt16((onset + i) * 4 + 2, r, true);
      left.push(l / 32768);
      right.push(r / 32768);
    }
    channels[0].push({onset, samples: left});
    channels[1].push({onset, samples: right});
  }
  return {source: {pcm, sampleRate: rate, channels: 2, frameCount, format: 's16le'}, channels};
}

async function capture(page, channels, outputRate, draft = recipe) {
  await page.route('**/take-signal-fixture.html', route => route.fulfill({
    contentType: 'text/html',
    body: '<button>Capture</button>',
  }));
  await page.goto('/take-signal-fixture.html');
  await page.evaluate(({channels, draft, outputRate, rate, frameCount, tapModule}) => {
    window.capture = new Promise((resolve, reject) => {
      document.querySelector('button').onclick = async () => {
        let context;
        try {
          context = new AudioContext({sampleRate: outputRate});
          await context.resume();
          await context.audioWorklet.addModule('/worklets/space-take-v1.js');
          const captureURL = URL.createObjectURL(new Blob([tapModule], {type: 'text/javascript'}));
          try {
            await context.audioWorklet.addModule(captureURL);
          } finally {
            URL.revokeObjectURL(captureURL);
          }
          const start = Math.ceil((context.currentTime + 0.2) * context.sampleRate) + 17;
          const length = Math.ceil(frameCount * context.sampleRate / rate);
          const worklet = new AudioWorkletNode(context, 'room-space-take-v1', {
            outputChannelCount: [2],
            processorOptions: {startContextFrame: start, frameCount, rendererVersion: 1, gestures: []},
          });
          const capture = new AudioWorkletNode(context, 'take-test-capture', {
            processorOptions: {start, length},
          });
          const source = context.createBufferSource();
          source.buffer = context.createBuffer(2, frameCount, rate);
          channels.forEach((entries, i) => {
            const output = source.buffer.getChannelData(i);
            for (const {onset, samples} of entries) output.set(samples, onset);
          });
          const signal = new Promise((accept, fail) => {
            capture.port.onmessage = ({data}) => accept(data.map(channel => Array.from(channel)));
            worklet.onprocessorerror = () => fail(new Error('Space worklet stopped unexpectedly'));
            capture.onprocessorerror = () => fail(new Error('Capture worklet stopped unexpectedly'));
          });
          const commands = [];
          const message = new Promise((accept, fail) => {
            worklet.port.onmessage = ({data}) => {
              if (data.type === 'rejected') fail(new Error(data.error));
              else if (commands.push(data.action) === 2) accept(commands);
            };
          });
          const [gesture] = draft.gestures;
          source.connect(worklet).connect(capture).connect(context.destination);
          source.start(start / context.sampleRate);
          worklet.port.postMessage({type: 'open', gesture: {...gesture, endFrame: frameCount}});
          worklet.port.postMessage({type: 'close', id: gesture.id, endFrame: gesture.endFrame});
          const [samples, scheduled] = await Promise.all([signal, message]);
          resolve({samples, scheduled, sampleRate: context.sampleRate});
        } catch (error) {
          reject(error);
        } finally {
          await context?.close();
        }
      };
    });
  }, {channels, draft, outputRate, rate, frameCount, tapModule});
  await page.getByRole('button', {name: 'Capture'}).click();
  return page.evaluate(() => window.capture);
}

function decode(bytes, channel) {
  const data = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return Float64Array.from({length: frameCount}, (_, i) => data.getInt16(i * 4 + channel * 2, true) / 32768);
}

function energy(signal, sampleRate, start, end) {
  let sum = 0;
  for (let i = Math.round(start * sampleRate); i < Math.round(end * sampleRate); i++) sum += signal[i] ** 2;
  return sum / sampleRate;
}

function onset(signal, sampleRate, from) {
  let i = Math.round(from * sampleRate);
  while (i < signal.length && Math.abs(signal[i]) < 0.002) i++;
  return i / sampleRate;
}

test('live worklet impulse output agrees with the prepared stereo PCM', async ({page}) => {
  const {renderTake} = await import('../src/experiences/takes/render.mjs');
  const {source, channels} = fixture([gesture.startFrame - 1, gesture.startFrame, gesture.endFrame]);
  const prepared = renderTake(recipe, source);
  const result = await capture(page, channels, rate);
  expect(result.sampleRate).toBe(rate);
  expect(result.scheduled).toEqual(['open', 'close']);
  const signal = [];
  for (let channel = 0; channel < 2; channel++) {
    const actual = result.samples[channel];
    const expected = decode(prepared.take, channel);
    expect(actual.length).toBe(frameCount + 1);
    expect(actual[frameCount]).toBe(0);
    let maximumError = 0;
    for (let i = 0; i < frameCount; i++) maximumError = Math.max(maximumError, Math.abs(actual[i] - expected[i]));
    expect(maximumError).toBeLessThanOrEqual(0.5 / 32768);
    expect(onset(actual, rate, 0.65)).toBe(onset(expected, rate, 0.65));
    expect(energy(actual, rate, 0.8, 0.9)).toBeGreaterThan(0);
    signal.push({channel, maximumError, onset: onset(actual, rate, 0.65)});
  }
  await test.info().attach('matching-rate-signal', {body: JSON.stringify(signal), contentType: 'application/json'});
});

test('a 44.1 kHz live context preserves elapsed repeat timing and return balance', async ({page}) => {
  const {renderTake} = await import('../src/experiences/takes/render.mjs');
  const {source, channels} = fixture([gesture.startFrame + 720], true);
  const prepared = renderTake(recipe, source);
  const result = await capture(page, channels, 44_100);
  expect(result.sampleRate).toBe(44_100);
  const signal = [];
  for (let channel = 0; channel < 2; channel++) {
    const actual = result.samples[channel];
    const expected = decode(prepared.take, channel);
    expect(actual.length).toBe(88_201);
    expect(actual[88_200]).toBe(0);
    const onsetErrors = [0.68, 0.8, 0.9].map(time =>
      Math.abs(onset(actual, result.sampleRate, time) - onset(expected, rate, time)));
    expect(Math.max(...onsetErrors)).toBeLessThan(0.00015);
    const expectedRatio = energy(expected, rate, 0.68, 1.1) / energy(expected, rate, 0.6, 0.67);
    const actualRatio = energy(actual, result.sampleRate, 0.68, 1.1) / energy(actual, result.sampleRate, 0.6, 0.67);
    const energyErrorDb = 10 * Math.log10(actualRatio / expectedRatio);
    expect(Math.abs(energyErrorDb)).toBeLessThan(0.3);
    signal.push({channel, onsetErrors, energyErrorDb});
  }
  await test.info().attach('different-rate-signal', {body: JSON.stringify(signal), contentType: 'application/json'});
});
