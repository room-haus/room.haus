import HLS from 'hls.js';
import {FREQ_BIN_COUNT} from './constants';
import AudioBand from './AudioBand';
import {getMix} from '../content/mixes';
import BPMDetectorWorkletNode from './BPMDetectorWorkletNode';

export default class HLSAudioSource {
  constructor({id} = {}, callbacks = {}) {
    this.ready = false;
    this.meta = getMix(id) || {};
    this.callbacks = {
      onInit: callbacks.onInit || function() {},
      onPlay: callbacks.onPlay || function() {},
      onPause: callbacks.onPause || function() {},
      onToggle: callbacks.onToggle || function() {},
      onEnd: callbacks.onEnd || function() {},
      onLoaded: callbacks.onLoaded || function() {},
      onProgress: callbacks.onProgress || function() {},
      onTime: callbacks.onTime || function() {},
      onReady: callbacks.onReady || function() {},
    };
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContext();
    } catch (e) {
      this.ctx = null;
    }
    if (id) {
      this.init(id);
    }

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

  async init(id) {
    this.callbacks.onInit();

    this.bands = {};

    try {
      this.audio = new Audio();
    } catch (e) {
      return;
    }
    this.element = this.ctx.createMediaElementSource(this.audio);
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fft = FREQ_BIN_COUNT * 2;
    this.frequencyBuffer = new Uint8Array(this.analyser.frequencyBinCount);
    this.timeDomainBuffer = new Uint8Array(this.analyser.frequencyBinCount);
    if (this.ctx.audioWorklet) {
      const cpuCores = navigator && navigator.hardwareConcurrency ? navigator.hardwareConcurrency : 1;
      this.bpmAnalyzerNode = new BPMDetectorWorkletNode(this.ctx, this.callbacks.onODFUpdate, {cpuCores});
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
        this.callbacks.onTime(this.element.currentTime);
      }, 500);

      this.callbacks.onPlay();
      this.callbacks.onToggle();
    });
    this.audio.addEventListener('pause', () => {
      this.playing = false;

      window.clearInterval(this.timeInterval);
      this.timeInterval = null;

      this.callbacks.onPause();
      this.callbacks.onToggle();
    });
    this.audio.addEventListener('ended', () => {
      this.playing = false;
      this.callbacks.onEnd();
      if (this.timeInterval) {
        window.clearInterval(this.timeInterval);
      }
    });

    const manifestUrl = `https://roomhauscdnprd.blob.core.windows.net/mixes/${id}/${id}.m3u8`;

    if (HLS.isSupported()) {
      this.hls && this.hls.destroy();
      this.hls = new HLS();
      this.hls.loadSource(manifestUrl);
      this.hls.attachMedia(this.audio);
    } else {
      this.audio.src = manifestUrl;
    }
    this.ready = true;
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
    if (this.audio) {
      this.ctx.resume && this.ctx.resume();
      this.audio.play();
    }
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
    return true;
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
    this.bands[name] = new AudioBand(this.ctx, this.element, options);
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
