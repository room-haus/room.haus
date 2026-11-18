import HLSAudioSource from '../../../audio/HLSAudioSource.js';
import type {AudioFrame, PlaybackSnapshot} from '../contracts.ts';
import {emptyAudioFrame, FeatureExtractor} from './FeatureExtractor.ts';

const SAMPLE_INTERVAL = 1 / 30;
const PLAYHEAD_JITTER = 0.25;
const NEUTRAL_FRAME = emptyAudioFrame();

export class AudioController {
  readonly source: HLSAudioSource;
  onChange?: (snapshot: PlaybackSnapshot) => void;

  private readonly features = new FeatureExtractor();
  private readonly frame = emptyAudioFrame();
  private analyser?: AnalyserNode;
  private spectrum = new Float32Array();
  private elapsed = SAMPLE_INTERVAL;
  private volume = 1;
  private disposed = false;

  constructor(url: string) {
    this.source = new HLSAudioSource(url);
    this.source.notify = () => {
      if (this.source.media && this.source.media.volume !== this.volume) {
        this.source.media.volume = this.volume;
      }
      this.onChange?.(this.snapshot());
    };
  }

  snapshot(): PlaybackSnapshot {
    const snapshot = this.source.snapshot;
    return {...snapshot, time: this.source.position(), playing: !this.disposed && snapshot.playing};
  }

  play() {
    if (!this.disposed) this.source.play();
  }

  pause() {
    if (this.disposed) return;
    this.clearAnalysis();
    this.source.pause();
  }

  seek(seconds: number) {
    if (this.disposed || !Number.isFinite(seconds)) return;
    this.clearAnalysis(false);
    this.source.seek(seconds);
  }

  setVolume(value: number) {
    if (this.disposed || !Number.isFinite(value)) return;
    this.volume = Math.max(0, Math.min(1, value));
    if (this.source.media) this.source.media.volume = this.volume;
  }

  private clearAnalysis(sampleImmediately = true) {
    this.elapsed = sampleImmediately ? SAMPLE_INTERVAL : 0;
    this.features.reset();
    Object.assign(this.frame, NEUTRAL_FRAME);
  }

  sample(deltaSeconds: number): AudioFrame {
    const {frame, source} = this;
    const time = source.position();
    const playing = !this.disposed && source.snapshot.status === 'playing';
    const context = source.context;
    const analyser = source.analyser;
    const available = playing && analyser && context?.state === 'running';
    const seeking = Boolean(source.media?.seeking);
    if (!available || seeking) {
      if (frame.available) this.clearAnalysis(!seeking);
      frame.time = time;
      frame.playing = playing && !seeking;
      return frame;
    }

    const step = Number.isFinite(deltaSeconds) ? Math.max(0, deltaSeconds) : 0;
    const playheadStep = time - frame.time;
    // Native controls can complete a seek between two render frames.
    if (frame.available && (playheadStep < 0 || playheadStep > step + PLAYHEAD_JITTER)) {
      this.clearAnalysis(false);
      frame.time = time;
      frame.playing = true;
      return frame;
    }

    frame.time = time;
    frame.playing = true;
    frame.onset = 0;
    this.elapsed += step;
    if (this.elapsed + 1e-8 < SAMPLE_INTERVAL) return frame;

    const dt = Math.min(this.elapsed, 0.25);
    this.elapsed %= SAMPLE_INTERVAL;
    if (this.elapsed < 1e-8 || SAMPLE_INTERVAL - this.elapsed < 1e-8) this.elapsed = 0;
    if (this.analyser !== analyser) {
      analyser.smoothingTimeConstant = 0.45;
      this.analyser = analyser;
      this.spectrum = new Float32Array(analyser.frequencyBinCount);
    }
    const waveform = source.getTimeDomainData();
    if (waveform?.length) {
      analyser.getFloatFrequencyData(this.spectrum);
      this.features.sample(this.spectrum, waveform, context.sampleRate, time, dt, frame);
    }
    return frame;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.onChange = undefined;
    this.analyser = undefined;
    this.clearAnalysis();
    this.source.dispose();
  }
}

export default AudioController;
