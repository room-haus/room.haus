import HLS from 'hls.js';
import {FREQ_BIN_COUNT} from './constants';
import AudioBand from './AudioBand';
import {getMix} from '../content/mixes';
import BPMDetectorWorkletNode from './BPMDetectorWorkletNode';

export default class HLSAudioSource {
  constructor({id} = {}) {
    this.id = id;
    this.ready = false;
    this.meta = getMix(id) || {};
    this.callbacks = {
      onInit: [],
      onPlay: [],
      onPause: [],
      onToggle: [],
      onEnd: [],
      onLoaded: [],
      onProgress: [],
      onTime: [],
      onReady: [],
      onODFUpdate: [],
    };

    this.timeInterval = null;
    setInterval(() => {
      this.update();
    }, 10);
    // document.addEventListener('keypress', (event) => {
    //   if (event.keyCode === 32) {
    //     this.ready && this.toggle();
    //   }
    // });
  }

  executeCallbacks(key, ...callbackArgs) {
    const callbacks = this.callbacks[key];
    if (callbacks && callbacks.length) {
      this.callbacks[key].forEach((func) => func.call(this, callbackArgs));
    }
  }

  registerCallback(key, func) {
    this.callbacks[key].push(func);
    return () => {
      this.callbacks[key] = this.callbacks[key].filter((f) => f !== func);
    };
  }

  async init() {
    this.ready = false;
    this.ctx = new AudioContext();
    this.executeCallbacks('onInit');

    this.bands = {};

    this.audio = new Audio();
    this.element = this.ctx.createMediaElementSource(this.audio);
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fft = FREQ_BIN_COUNT * 2;
    this.frequencyBuffer = new Uint8Array(this.analyser.frequencyBinCount);
    this.timeDomainBuffer = new Uint8Array(this.analyser.frequencyBinCount);
    this.floatFrequencyBuffer = new Float32Array(this.analyser.frequencyBinCount);
    this.floatTimeDomainBuffer = new Float32Array(this.analyser.frequencyBinCount);
    const cpuCores = navigator && navigator.hardwareConcurrency ? navigator.hardwareConcurrency : 1;
    console.info(`CPU cores: ${cpuCores}`);
    if (this.ctx.audioWorklet && cpuCores > 1) {
      this.bpmAnalyzerNode = new BPMDetectorWorkletNode(this.ctx, this.executeCallbacks.bind(this, 'onODFUpdate'), {
        cpuCores,
      });
      try {
        await this.bpmAnalyzerNode.init();
        this.bpmAnalyzerNode.attach(this.element);
      } catch (error) {
        console.error('Failed to load bpm analyzer processor!', error);
      }
    }
    this.element.connect(this.analyser);
    this.element.connect(this.ctx.destination);

    this.audio.addEventListener('play', () => {
      this.playing = true;

      this.timeInterval = window.setInterval(() => {
        this.executeCallbacks('onTime', this.element.currentTime);
      }, 500);

      this.executeCallbacks('onPlay');
      this.executeCallbacks('onToggle');
    });
    this.audio.addEventListener('pause', () => {
      this.playing = false;

      window.clearInterval(this.timeInterval);
      this.timeInterval = null;

      this.executeCallbacks('onPause');
      this.executeCallbacks('onToggle');
    });
    this.audio.addEventListener('ended', () => {
      this.playing = false;
      this.executeCallbacks('onEnd');
      if (this.timeInterval) {
        window.clearInterval(this.timeInterval);
      }
    });

    const manifestUrl =
      this.id === 'MX029'
        ? `https://roomhauscdnprd.blob.core.windows.net/mixes/${this.id}/audio/${this.id}.m3u8`
        : `https://roomhauscdnprd.blob.core.windows.net/mixes/${this.id}/${this.id}.m3u8`;

    if (HLS.isSupported()) {
      this.hls && this.hls.destroy();
      this.hls = new HLS();
      this.hls.loadSource(manifestUrl);
      this.hls.attachMedia(this.audio);
    } else {
      this.audio.src = manifestUrl;
    }
    this.ready = true;
    console.log(this.analyser.fftSize);
    this.executeCallbacks('onReady');
  }

  setOnsetCallback(func) {
    if (this.bpmAnalyzerNode) {
      this.bpmAnalyzerNode.onsetCallback = func;
    }
  }

  setODFUpdateCallback(func) {
    if (this.bpmAnalyzerNode) {
      this.bpmAnalyzerNode.onMessage = func;
    }
  }

  play() {
    if (!this.ready) {
      this.init();
    }
    this.ctx.resume && this.ctx.resume();
    this.audio.play();
  }

  pause() {
    if (this.audio) {
      this.audio.pause();
    }
  }

  playheadLocation() {
    return this.audio ? this.audio.currentTime / this.audio.duration : 0;
  }

  dispose() {
    this.hls && this.hls.destroy();
  }

  toggle() {
    this.isPlaying() ? this.pause() : this.play(); // eslint-disable-line no-unused-expressions
  }

  isPlaying() {
    return this.audio && !this.audio.paused;
  }

  getFrequencyData(band) {
    if (!this.ready) {
      return [];
    }
    if (band) {
      return this.bands[band].getFrequencyData();
    }
    this.analyser.getByteFrequencyData(this.frequencyBuffer);
    return this.frequencyBuffer ? this.frequencyBuffer : [];
  }

  ready() {
    return this.ready;
  }

  getTimeDomainData(band) {
    if (!this.ready) {
      return [];
    }
    if (band) {
      return this.bands[band].getTimeDomainData();
    }
    this.analyser.getByteTimeDomainData(this.timeDomainBuffer);
    return this.timeDomainBuffer ? this.timeDomainBuffer : [];
  }

  getFloatFrequencyData() {
    if (!this.ready) {
      return [];
    }
    console.log(this.analyser);
    this.analyser.getFloatFrequencyData(this.floatFrequencyBuffer);
    return this.floatFrequencyBuffer ? this.floatFrequencyBuffer : [];
  }

  getFloatTimeDomainData() {
    if (!this.ready) {
      return [];
    }
    console.log(this.analyser);
    this.analyser.getFloatTimeDomainData(this.floatTimeDomainBuffer);
    return this.floatTimeDomainBuffer ? this.floatTimeDomainBuffer : [];
  }

  getAverageFrequency(band) {
    if (band) {
      return this.bands[band].getAverageFrequency();
    }
    const freqData = this.getFrequencyData();
    if (!freqData.length) {
      return 0;
    }
    return freqData.reduce((total, freq) => total + freq, 0) / freqData.length;
  }

  getAverageAmplitude(band) {
    const data = this.getTimeDomainData(band);
    if (!data.length) {
      return 0;
    }
    return data.reduce((total, amp) => total + amp, 0) / data.length;
  }

  setPlayhead(percent) {
    if (percent != null) {
      this.audio.currentTime = this.audio.duration * percent;
    }
  }

  currentTime() {
    return this.audio ? this.audio.currentTime : 0;
  }

  getTotalEnergy(band) {
    if (band) {
      return this.bands[band].getTotalEnergy();
    }
    const data = this.getFrequencyData();
    return data.reduce((total, frame) => total + frame, 0);
  }

  makeBand(name, options) {
    this.registerCallback('onReady', () => {
      this.bands[name] = new AudioBand(this.ctx, this.element, options);
    });
  }

  update(band) {
    if (!this.ready || !this.isPlaying()) {
      return;
    }
    if (band) {
      this.bands[band].process();
    } else {
      Object.values(this.bands).forEach((b) => b.process());
    }
  }

  getMeta() {
    return {
      time: this.currentTime(),
      isPlaying: this.isPlaying(),
      playheadLocation: this.playheadLocation(),
      meta: this.meta,
    };
  }
}
