import HLS from 'hls.js';
import {FREQ_BIN_COUNT} from './constants';
import AudioBand from './AudioBand';
// import BPMDetectorWorkletNode from './BPMDetectorWorkletNode';

export default class HLSAudioSource {
  constructor(callbacks = {}) {
    this.callbacks = {
      onInit: callbacks.onInit,
      onPlay: callbacks.onPlay,
      onPause: callbacks.onPause,
      onToggle: callbacks.onToggle,
      onEnd: callbacks.onEnd,
      onLoaded: callbacks.onLoaded,
      onProgress: callbacks.onProgress,
      onTime: callbacks.onTime,
      onReady: callbacks.onReady,
    };

    this.ready = false;
  }

  callback(name, ...params) {
    const func = this.callbacks[name];
    return func ? func(...params) : undefined;
  }

  async init(ctx) {
    this.callback('onInit');

    this.ctx = ctx;
    this.audio = new Audio();

    this.element = this.ctx.createMediaElementSource(this.audio);
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fft = FREQ_BIN_COUNT * 2;
    this.frequencyBuffer = new Uint8Array(this.analyser.frequencyBinCount);
    this.timeDomainBuffer = new Uint8Array(this.analyser.frequencyBinCount);

    this.bands = {};

    const cpuCores = navigator && navigator.hardwareConcurrency ? navigator.hardwareConcurrency : 1;
    console.log(`CPU cores: ${cpuCores}`);
    // if (this.ctx.audioWorklet && cpuCores > 1) {
    //   this.bpmAnalyzerNode = new BPMDetectorWorkletNode(this.ctx, this.callbacks.onODFUpdate, {cpuCores});
    //   try {
    //     await this.bpmAnalyzerNode.init();
    //     this.bpmAnalyzerNode.attach(this.element);
    //   } catch (error) {
    //     console.error('Failed to load bpm analyzer processor!', error);
    //   }
    // }

    this.element.connect(this.analyser);
    this.element.connect(this.ctx.destination);

    this.audio.addEventListener('play', () => {
      this.callback('onPlay');
      this.callback('onToggle');
    });
    this.audio.addEventListener('pause', () => {
      this.callback('onPause');
      this.callback('onToggle');
    });
    this.audio.addEventListener('ended', () => {
      this.callback('onEnd');
    });
  }

  loadHSLAudio(autoplay = false) {
    if (HLS.isSupported()) {
      if (this.hls) {
        this.hls.destroy();
      }
      this.hls = new HLS();
      this.hls.loadSource(this.manifestUrl);
      this.hls.attachMedia(this.audio);
    } else {
      this.audio.src = this.manifestUrl;
    }
    if (autoplay) {
      this.toggle();
    }
  }

  setManifestUrl(manifestUrl) {
    this.manifestUrl = manifestUrl;
    this.loadHSLAudio(true);
  }

  // setOnsetCallback(func) {
  //   if (this.bpmAnalyzerNode) {
  //     this.bpmAnalyzerNode.onsetCallback = func;
  //   }
  // }

  // setODFUpdateCallback(func) {
  //   if (this.bpmAnalyzerNode) {
  //     this.bpmAnalyzerNode.onMessage = func;
  //   }
  // }

  percentCompletion() {
    return this.audio ? this.audio.currentTime / this.audio.duration : 0;
  }

  dispose() {
    this.hls.destroy();
  }

  resume() {
    this.ctx.resume();
    if (!this.ready) {
      this.ready = true;
      this.callback('onReady');
    }
    this.callback('onResume');
  }

  toggle() {
    if (this.ready) {
      this.isPlaying() ? this.audio.pause() : this.audio.play(); // eslint-disable-line no-unused-expressions
    } else {
      this.callbacks.onResume = this.toggle.bind(this);
    }
  }

  isPlaying() {
    return this.audio ? !this.audio.paused : false;
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

  getTotalEnergy(band) {
    if (band) {
      return this.bands[band].getTotalEnergy();
    }
    const data = this.getFrequencyData();
    return data.reduce((total, frame) => total + frame, 0);
  }

  makeBand(name, options) {
    this.bands[name] = new AudioBand(this.ctx, this.element, options);
  }

  currentTime() {
    return this.audio ? this.audio.currentTime : 0;
  }

  // update(band) {
  //   if (!this.ready || !this.isPlaying()) {
  //     return;
  //   }
  //   if (band) {
  //     this.bands[band].process();
  //   } else {
  //     Object.values(this.bands).forEach((b) => b.process());
  //   }
  // }

  getMeta() {
    const {currentTime = 0, duration = 0.000001, paused = true} = this.audio;
    return {
      time: currentTime,
      isPlaying: !paused,
      playheadLocation: currentTime / duration,
    };
  }
}
