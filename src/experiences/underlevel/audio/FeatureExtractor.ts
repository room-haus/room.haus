import type {AudioFrame} from '../contracts.ts';
import {TempoEstimator, TempoPhase} from './TempoEstimator.ts';

const BAND_NAMES = ['sub', 'bass', 'lowMid', 'mid', 'high'] as const;
const BAND_EDGES = [30, 60, 150, 500, 2000, 10000];
const BAND_BRIGHTNESS = BAND_NAMES.map((_, index) => {
  const center = Math.sqrt(BAND_EDGES[index] * BAND_EDGES[index + 1]);
  return Math.log(center / BAND_EDGES[0]) / Math.log(BAND_EDGES[5] / BAND_EDGES[0]);
});
// Upper bands retain readable movement at the lower spectral density of music.
const BAND_RANGES_DB = [[-78, -21], [-76, -24], [-74, -27], [-77, -31], [-87, -43]];
const SILENCE_RMS = 0.005;
const ONSET_COOLDOWN = 0.21;

function clamp(value: number) {
  return Math.max(0, Math.min(1, value));
}

function smooth(current: number, target: number, dt: number, attack: number, release: number) {
  const period = target > current ? attack : release;
  return current + (target - current) * (1 - Math.exp(-dt / period));
}

export function emptyAudioFrame(): AudioFrame {
  return {
    time: 0, playing: false, available: false,
    rms: 0, sub: 0, bass: 0, lowMid: 0, mid: 0, high: 0,
    brightness: 0, onset: 0, intensity: 0, bpm: 0, beatConfidence: 0, tempoBeats: 0, tempoPulses: 0,
  };
}

export class FeatureExtractor {
  private rmsBaseline = 0;
  private previousBands = new Float32Array(5);
  private tempo = new TempoEstimator();
  private tempoPhase = new TempoPhase();
  private fluxAverage = 0;
  private lastOnset = -Infinity;
  private primed = false;

  reset() {
    this.rmsBaseline = 0;
    this.previousBands.fill(0);
    this.tempo.reset();
    this.tempoPhase.reset();
    this.fluxAverage = 0;
    this.lastOnset = -Infinity;
    this.primed = false;
  }

  sample(
    spectrum: Float32Array, waveform: Uint8Array, sampleRate: number,
    time: number, dt: number, frame: AudioFrame,
  ) {
    let squared = 0;
    for (const sample of waveform) squared += ((sample - 128) / 128) ** 2;
    const rms = Math.sqrt(squared / waveform.length);
    this.rmsBaseline = smooth(this.rmsBaseline, rms, dt, 2.5, 8);
    const normalizedRms = clamp(rms / (1.7 * Math.max(0.025, this.rmsBaseline)));
    frame.rms = smooth(frame.rms, normalizedRms, dt, 0.08, 0.4);
    frame.available = frame.playing = true;
    frame.time = time;

    const hzPerBin = sampleRate / (spectrum.length * 2);
    let flux = 0;
    let brightness = 0;
    let spectralTotal = 0;
    for (const [index, name] of BAND_NAMES.entries()) {
      const start = Math.ceil(BAND_EDGES[index] / hzPerBin);
      const end = Math.min(spectrum.length, Math.ceil(BAND_EDGES[index + 1] / hzPerBin));
      let level = 0;
      let energy = 0;
      if (rms > SILENCE_RMS && start < end) {
        let powerSum = 0;
        let powerPeak = 0;
        let noveltySum = 0;
        let noveltyPeak = 0;
        for (let bin = start; bin < end; bin++) {
          const db = spectrum[bin];
          const power = 10 ** (db / 10);
          powerSum += power;
          powerPeak = Math.max(powerPeak, power);
          // Preserve the existing scale for spectral flux and brightness.
          const novelty = clamp((db + 100) / 70);
          noveltySum += novelty;
          noveltyPeak = Math.max(noveltyPeak, novelty);
        }
        const bins = end - start;
        const power = 0.65 * powerSum / bins + 0.35 * powerPeak;
        const [floor, ceiling] = BAND_RANGES_DB[index];
        level = clamp((10 * Math.log10(power) - floor) / (ceiling - floor));
        energy = 0.6 * noveltySum / bins + 0.4 * noveltyPeak;
      }
      frame[name] = smooth(frame[name], level, dt, 0.05, 0.16);
      flux += Math.max(0, energy - this.previousBands[index]);
      this.previousBands[index] = energy;
      brightness += energy * BAND_BRIGHTNESS[index];
      spectralTotal += energy;
    }

    frame.brightness = smooth(frame.brightness, spectralTotal ? brightness / spectralTotal : 0, dt, 0.9, 1.8);
    frame.intensity = smooth(frame.intensity, normalizedRms, dt, 1.2, 2.4);
    const threshold = Math.max(0.08, this.fluxAverage * 3.5);
    frame.onset = 0;
    if (this.primed && flux > threshold && time - this.lastOnset >= ONSET_COOLDOWN) {
      this.lastOnset = time;
      frame.onset = clamp(flux / 0.3);
    }
    this.fluxAverage = smooth(this.fluxAverage, flux, dt, 0.35, 1.5);
    this.primed = true;
    this.tempo.sample(time, rms, flux);
    frame.bpm = this.tempo.bpm;
    frame.beatConfidence = this.tempo.confidence;
    this.tempoPhase.sample(time, frame.bpm, frame.beatConfidence);
    frame.tempoBeats = this.tempoPhase.beats;
    frame.tempoPulses = this.tempoPhase.pulses;
  }
}
