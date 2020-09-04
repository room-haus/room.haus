import {FREQ_BIN_COUNT} from './constants';
const FRAME_WINDOW_SIZE = 100;
const SLEEP_AMOUNT = 300;

export default class AudioBand {
  constructor(ctx, clip, {lowPass, highPass, callback, threshold, sleepDuration}) {
    this.ctx = ctx;

    this.clip = clip;

    this.analyser = this.ctx.createAnalyser();
    this.analyser.fft = FREQ_BIN_COUNT * 2;
    this.frequencyBuffer = new Uint8Array(this.analyser.frequencyBinCount);
    this.timeDomainBuffer = new Uint8Array(this.analyser.frequencyBinCount);

    const filters = [];
    if (lowPass) {
      this.lowPassFilter = this.ctx.createBiquadFilter();
      this.lowPassFilter.type = 'lowpass';
      this.lowPassFilter.frequency.value = lowPass;
      filters.push(this.lowPassFilter);
    }
    if (highPass) {
      this.highPassFilter = this.ctx.createBiquadFilter();
      this.highPassFilter.type = 'highpass';
      this.highPassFilter.frequency.value = highPass;
      filters.push(this.highPassFilter);
    }
    const filteredElement = filters.reduce((chain, filter) => {
      chain.connect(filter);
      return filter;
    }, this.clip);

    filteredElement.connect(this.analyser);
    this.callback = callback || function() {}; // eslint-disable-line func-names
    this.frames = []; //new Array(FRAME_WINDOW_SIZE).fill(0);
    this.average = 0;
    this.sleeping = false;

    this.threshold = threshold;
    this.sleepDuration = sleepDuration || SLEEP_AMOUNT;
  }

  trigger(frame) {
    if (document.hidden) {
      return;
    }
    this.callback(frame);
    this.sleeping = true;
    setTimeout(() => {
      this.sleeping = false;
    }, this.sleepDuration);
  }

  process() {
    if (this.sleeping) {
      return;
    }
    const buffer = this.getFrequencyData();
    const filteredBuffer = buffer.filter((slice) => slice);
    const frame = filteredBuffer.reduce((total, slice) => total + slice, 0) / (filteredBuffer.length || 1);
    if (this.threshold) {
      if (frame >= this.threshold) {
        this.trigger(frame);
      }
      return;
    }
    if (this.average < frame) {
      this.trigger(frame);
    }
    if (this.frames.length >= FRAME_WINDOW_SIZE) {
      this.frames.shift();
    }
    this.frames.push(frame);
    this.average = this.frames.reduce((total, _frame) => total + _frame, 0) / this.frames.length;
    // console.log(this.average, frame, this.frames.length);
  }

  getFrequencyData() {
    this.analyser.getByteFrequencyData(this.frequencyBuffer);
    return this.frequencyBuffer ? this.frequencyBuffer : [];
  }

  getTimeDomainData() {
    this.analyser.getByteTimeDomainData(this.timeDomainBuffer);
    return this.timeDomainBuffer ? this.timeDomainBuffer : [];
  }

  getAverageFrequency() {
    let freqData = this.getFrequencyData().filter((frame) => frame);
    return freqData.reduce((total, freq) => total + freq, 0) / freqData.length;
  }

  getAverageAmplitude() {
    const data = this.getTimeDomainData();
    return data.reduce((total, amp) => total + Math.abs(amp), 0) / data.length;
  }

  getTotalEnergy() {
    const freqData = this.getFrequencyData();
    return freqData.reduce((total, freq) => total + freq, 0);
  }
}
