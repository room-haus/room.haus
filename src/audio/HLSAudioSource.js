import {attachStream, usesNativeHLS} from './attachStream';
import AudioBand from './AudioBand';
import BPMDetectorWorkletNode from './BPMDetectorWorkletNode';
import {FREQ_BIN_COUNT} from './constants';

export default class HLSAudioSource {
  constructor(url) {
    this.url = url;
    this.snapshot = {playing: false, status: url ? 'idle' : 'unavailable', time: 0, duration: 0, error: null};
    this.bandOptions = new Map();
    this.bands = new Map();
    this.onsets = new Set();
    this.attempt = 0;
  }

  update(values) {
    this.snapshot = {...this.snapshot, ...values};
    this.notify?.(this.snapshot);
  }

  loading() {
    clearTimeout(this.timeout);
    this.timeout = setTimeout(() => this.fail('The stream took too long to respond.'), 20000);
    this.update({status: 'loading', error: null});
  }

  fail(message) {
    this.releaseMedia();
    this.update({status: 'error', error: message, playing: false, time: 0, duration: 0});
  }

  createMedia() {
    const media = new Audio();
    this.media = media;
    media.preload = 'none';
    media.crossOrigin = 'anonymous';
    const syncTime = () => this.update({
      time: Number.isFinite(media.currentTime) ? media.currentTime : 0,
      duration: Number.isFinite(media.duration) ? media.duration : 0,
    });
    const events = {
      timeupdate: syncTime, durationchange: syncTime, loadedmetadata: syncTime,
      playing: () => {
        clearTimeout(this.timeout);
        this.update({playing: true, status: 'playing', error: null});
      },
      pause: () => {
        clearTimeout(this.timeout);
        this.update({playing: false, status: 'paused'});
      },
      waiting: () => { if (!media.paused) this.loading(); },
      ended: () => this.update({playing: false, status: 'ended'}),
      error: () => this.fail('The stream could not be played.'),
    };
    Object.entries(events).forEach(([event, fn]) => media.addEventListener(event, fn));
    this.removeListeners = () => Object.entries(events).forEach(([event, fn]) => media.removeEventListener(event, fn));

    // The browser media element can play by itself when Web Audio is unavailable.
    const Context = window.AudioContext || window.webkitAudioContext;
    // WebKit's native HLS decoder can advance the playhead without supplying
    // Web Audio samples. Preserve its native output. Chromium supplies samples
    // on both native HLS and MediaSource, so it keeps the reactive scenes.
    const nativeWebKit = navigator.vendor === 'Apple Computer, Inc.' && usesNativeHLS(media, this.url);
    if (Context && !nativeWebKit) {
      try {
        this.context = new Context();
        this.analyser = this.context.createAnalyser();
        this.analyser.fftSize = FREQ_BIN_COUNT * 2;
        this.frequency = new Uint8Array(this.analyser.frequencyBinCount);
        this.waveform = new Uint8Array(this.analyser.fftSize);
        this.input = this.context.createMediaElementSource(media);
        this.input.connect(this.context.destination);
        this.input.connect(this.analyser);
        this.bandOptions.forEach((options, name) => this.makeBand(name, options));
        if (this.workletRequested) this.startWorklet();
      } catch {
        // Hardware and browser support for analysis varies independently of media playback.
      }
    }
  }

  play() {
    if (!this.url) return;
    this.wantsPlay = true;
    const attempt = ++this.attempt;
    try {
      if (!this.media) this.createMedia();
      const media = this.media;
      this.context?.resume().catch(() => {});
      this.loading();
      const start = () => {
        if (this.media !== media || !this.wantsPlay) return;
        const activeAttempt = this.attempt;
        media.play()?.catch((error) => {
          if (this.media !== media || activeAttempt !== this.attempt || !this.wantsPlay) return;
          this.fail(error.name === 'NotAllowedError' ? 'Press play again to start the stream.' : 'The stream could not be played.');
        });
      };
      if (!this.detach) {
        this.detach = attachStream(media, this.url, () => {
          this.attached = true;
          start();
        }, (message) => { if (this.media === media) this.fail(message); });
      } else if (this.attached) {
        start();
      }
    } catch {
      if (attempt === this.attempt) this.fail('The stream could not be played.');
    }
  }

  pause() {
    this.wantsPlay = false;
    this.attempt++;
    clearTimeout(this.timeout);
    this.media?.pause();
    if (this.url) this.update({playing: false, status: 'paused'});
  }

  seek(seconds) {
    if (this.media && Number.isFinite(seconds) && this.snapshot.duration > 0) {
      this.media.currentTime = Math.max(0, Math.min(seconds, this.snapshot.duration));
      this.update({time: this.media.currentTime});
    }
  }

  isPlaying() { return this.snapshot.playing; }

  makeBand(name, options) {
    this.bandOptions.set(name, options);
    if (!this.input) return;
    this.bands.get(name)?.dispose();
    this.bands.set(name, new AudioBand(this.context, this.input, options));
  }

  getFrequencyData(band) {
    if (band) return this.bands.get(band)?.getFrequencyData() || [];
    if (!this.analyser) return [];
    this.analyser.getByteFrequencyData(this.frequency);
    return this.frequency;
  }

  getTimeDomainData(band) {
    if (band) return this.bands.get(band)?.getTimeDomainData();
    if (!this.analyser) return null;
    this.analyser.getByteTimeDomainData(this.waveform);
    return this.waveform;
  }

  getAverageFrequency(band) {
    const data = this.getFrequencyData(band);
    return this.getMean(data, 0);
  }

  getAverageAmplitude(band) { return this.getMean(this.getTimeDomainData(band), 128); }

  getMean(data, empty) {
    return data?.length ? data.reduce((sum, value) => sum + value, 0) / data.length : empty;
  }

  getTotalEnergy(band) { return this.getFrequencyData(band).reduce((sum, value) => sum + value, 0); }

  processBands() {
    if (this.isPlaying()) this.bands.forEach((band) => { if (band.hasCallback) band.process(); });
  }

  setOnsetCallback(fn) {
    this.onsets.add(fn);
    return () => this.onsets.delete(fn);
  }

  startWorklet() {
    this.workletRequested = true;
    if (!this.context?.audioWorklet || !this.input || this.worklet) return;
    const detector = new BPMDetectorWorkletNode(this.context, () => this.onsets.forEach((fn) => fn()));
    this.worklet = detector;
    detector.attach(this.input).catch(() => detector.dispose());
  }

  stopAnalysis() {
    this.worklet?.dispose();
    this.worklet = null;
    this.bands.forEach((band) => band.dispose());
    this.bands.clear();
  }

  clearSceneAnalysis() {
    this.stopAnalysis();
    this.bandOptions.clear();
    this.workletRequested = false;
    this.onsets.clear();
  }

  releaseMedia() {
    clearTimeout(this.timeout);
    this.attempt++;
    this.wantsPlay = false;
    this.removeListeners?.();
    this.removeListeners = null;
    this.detach?.();
    this.detach = null;
    this.attached = false;
    this.media = null;
    this.stopAnalysis();
    this.input?.disconnect();
    this.analyser?.disconnect();
    this.input = this.analyser = null;
    if (this.context && this.context.state !== 'closed') this.context.close().catch(() => {});
    this.context = null;
  }

  dispose() {
    this.notify = null;
    this.releaseMedia();
    this.clearSceneAnalysis();
  }
}
