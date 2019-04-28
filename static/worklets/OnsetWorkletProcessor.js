/* global currentTime */ // eslint-disable-line no-unused-vars
import {FFTR} from './main.js'; // eslint-disable-line import/extensions
import BPMAnalyser from './BPMAnalyser.js'; // eslint-disable-line import/extensions

const BUFFER_SIZE = 512;
const BUFFERS_PER_FRAME = 4;
const FRAME_SIZE = BUFFER_SIZE * BUFFERS_PER_FRAME;

const scaleTransform = (trans, size) => {
  const buffer = new Float32Array(size);
  let i = 0;
  const bSi = 1.0 / size;
  const x = trans;
  while (i < x.length) {
    buffer[i] = x[i] * bSi;
    i++;
  }
  return buffer;
};

class MyAudioBuffer {
  constructor(samples = []) {
    this.buffer = new Float32Array(BUFFER_SIZE);
    this.size = 0;
    this.write(samples);
  }

  write(samples) {
    this.buffer.set(samples, this.size);
    this.size += samples.length;
  }

  reset() {
    this.buffer.fill(0);
    this.size = 0;
  }

  isFull() {
    return this.size >= this.buffer.length;
  }
}

// const hann = (sampleIndex, totalSamples = FRAME_SIZE) => Math.sin((Math.PI * sampleIndex) / (totalSamples - 1)) ** 2;

class AudioFrame {
  constructor(buffers) {
    this.buffers = buffers || [new MyAudioBuffer(), new MyAudioBuffer(), new MyAudioBuffer(), new MyAudioBuffer()];
  }

  copy() {
    const buffers = [...this.buffers];
    return new AudioFrame(buffers);
  }

  addBuffer(buffer) {
    this.buffers.shift();
    this.buffers.push(new MyAudioBuffer(buffer.buffer));
  }

  samples() {
    const buffer = new Float32Array(FRAME_SIZE);
    for (let b = 0; b < this.buffers.length; b++) {
      buffer.set(this.buffers[b].buffer, BUFFER_SIZE * b);
    }
    return buffer;
  }

  energy() {
    return this.samples().reduce((totalEnergy, sample) => totalEnergy + sample * sample, 0);
  }

  stft() {
    const samples = this.samples();
    const fft = new FFTR(samples.length);
    const transformed = fft.forward(samples);
    fft.dispose();
    return scaleTransform(transformed, samples.length);
  }
}

const median = (values) => {
  if (values.length === 0) {
    return 0;
  }
  if (values.length === 1) {
    return values[0];
  }
  values.sort((a, b) => a - b);
  const half = Math.floor(values.length / 2);
  return half % 2 ? values[half] : (values[half - 1] + values[half]) / 2.0;
};

const mean = (values) => {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((total, x) => total + x, 0) / values.length;
};

class OnsetWorkletProcesser extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      {
        name: 'medianWeight',
        automationRate: 'k-rate',
        defaultValue: 1.0,
        minValue: 0,
        maxValue: 2,
      },
      {
        name: 'meanWeight',
        automationRate: 'k-rate',
        defaultValue: 1.0,
        minValue: 0,
        maxValue: 2,
      },
      {
        name: 'sampleSize',
        automationRate: 'k-rate',
        defaultValue: 15,
        minValue: 1,
        maxValue: 50,
      },
      {
        name: 'maxPeakWeight',
        automationRate: 'k-rate',
        defaultValue: 0.0,
        minValue: 0,
        maxValue: 1.5,
      },
    ];
  }
  constructor({processorOptions: {mode}}) {
    super();
    this.mode = mode;
    this.buffer = new MyAudioBuffer();
    this.frames = [new AudioFrame(), new AudioFrame()];
    this.odfHistory = [];
    this.sdHistory = [];
    this.threshold = 0;
    this.highestPeak = 0;
    this.perf = [];
    this.bpmAnalyser = new BPMAnalyser({sampleRate: 44100, frameSize: BUFFER_SIZE, precision: 3, memory: 15});
  }

  energyODF() {
    const [prevFrame, currFrame] = this.frames.slice(-2);
    const odf = Math.abs(currFrame.energy() - prevFrame.energy());
    this.odfHistory.unshift(odf);
    return odf;
  }

  spectralDifferenceODF() {
    const [prevFrame, currFrame] = this.frames.slice(-2);
    const currFFT = currFrame.stft();
    const prevFFT = prevFrame.stft();
    const size = currFFT.length;
    let total = 0;
    for (let i = 0; i < size; i++) {
      total += Math.abs(Math.abs(currFFT[i]) - Math.abs(prevFFT[i]));
    }
    this.sdHistory.unshift(total);
    return total;
  }

  updateFrames() {
    this.frames.shift();
    const copy = this.frames[0].copy();
    copy.addBuffer(this.buffer);
    this.frames.push(copy);
    this.buffer.reset();
  }

  process(inputs, outputs, parameters) {
    const samples = inputs[0][0];
    this.buffer.write(samples);
    if (this.buffer.isFull()) {
      this.updateFrames();
      const odf = this.mode === 'SPECTRAL_DIFFERENCE' ? this.spectralDifferenceODF() : this.energyODF();
      const {sampleSize, medianWeight, meanWeight, maxPeakWeight} = parameters;
      const threshold = this.calculateThreshold(sampleSize[0], medianWeight[0], meanWeight[0], maxPeakWeight[0]);
      const isPreviousPeak = this.isPreviousOnset();
      this.bpmAnalyser.cycle(isPreviousPeak);
      this.port.postMessage({odf, threshold, isPreviousPeak, bpmData: this.bpmAnalyser.data, debug: false});
    }
    return true;
  }

  getHistory() {
    return this.mode === 'SPECTRAL_DIFFERENCE' ? this.sdHistory : this.odfHistory;
  }

  calculateThreshold(m, lambda, alpha, peakWeight) {
    // σn = λ × median(O[nm]) + α × mean(O[nm]) + N
    const weightedHighestPeak = this.highestPeak * peakWeight;
    const prevODFValues = this.getHistory().slice(0, m);
    this.threshold = lambda * median(prevODFValues) + alpha * mean(prevODFValues) + weightedHighestPeak;
    return this.threshold;
  }

  isPreviousOnset() {
    const [curr = 0, prev = 0, prevprev = 0] = this.getHistory().slice(0, 3);
    if (prev > curr && prev > prevprev) {
      if (prev > this.threshold) {
        this.highestPeak = prev > this.highestPeak ? prev : this.highestPeak;
        return true;
      }
    }
    return false;
  }
}

registerProcessor('onset-detector-processor', OnsetWorkletProcesser);
