const WINDOW_SECONDS = 8;
const MIN_HISTORY = 4.8;
const MIN_PERIOD = 0.28;
const MAX_PERIOD = 1.25;
export const TEMPO_CONFIDENCE = 0.65;
const pulseDivisor = (bpm: number) => bpm > 150 ? 2 : 1;

export class TempoPhase {
  beats = 0;
  pulses = 0;
  private previousTime: number | undefined;
  private previousBpm = 0;

  reset() {
    this.beats = this.pulses = this.previousBpm = 0;
    this.previousTime = undefined;
  }

  sample(time: number, bpm: number, confidence: number) {
    if (this.previousTime !== undefined && time < this.previousTime) this.reset();
    const rate = confidence >= TEMPO_CONFIDENCE && Number.isFinite(bpm) && bpm > 0 ? bpm : 0;
    if (this.previousTime !== undefined) {
      // Finish the elapsed interval at the prior rate, then apply the new estimate going forward.
      const elapsedBeats = (time - this.previousTime) * this.previousBpm / 60;
      this.beats += elapsedBeats;
      this.pulses += elapsedBeats / pulseDivisor(this.previousBpm);
    }
    this.previousTime = time;
    this.previousBpm = rate;
  }
}

interface Sample {
  time: number;
  rmsChange: number;
  flux: number;
}

interface Estimate {
  period: number;
  confidence: number;
}

function correlation(values: number[], lag: number, mean: number) {
  let product = 0;
  let leftPower = 0;
  let rightPower = 0;
  for (let index = lag; index < values.length; index++) {
    const left = values[index - lag] - mean;
    const right = values[index] - mean;
    product += left * right;
    leftPower += left * left;
    rightPower += right * right;
  }
  const scale = Math.sqrt(leftPower * rightPower);
  return scale > 1e-8 ? product / scale : 0;
}

function estimatePeriod(values: number[], secondsPerSample: number): Estimate | undefined {
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const minLag = Math.max(2, Math.round(MIN_PERIOD / secondsPerSample));
  const maxLag = Math.round(MAX_PERIOD / secondsPerSample);
  const scores = Array.from({length: maxLag * 2 + 3}, (_, lag) => correlation(values, lag, mean));
  let best: Estimate | undefined;

  for (let lag = minLag; lag <= maxLag; lag++) {
    const peak = scores[lag];
    if (peak < 0.4 || peak < scores[lag - 1] || peak < scores[lag + 1]) continue;
    const repeat = Math.max(scores[lag * 2 - 1], scores[lag * 2], scores[lag * 2 + 1]);
    if (repeat < 0.35) continue;

    const curvature = 2 * peak - scores[lag - 1] - scores[lag + 1];
    const offset = curvature > 0 ? (scores[lag + 1] - scores[lag - 1]) / (2 * curvature) : 0;
    const period = (lag + offset) * secondsPerSample;
    const confidence = (peak + repeat) / 2;
    // Prefer the shorter of similarly strong repetitions, including multiples.
    if (!best || confidence > best.confidence + 0.07) best = {period, confidence};
  }
  return best;
}

export class TempoEstimator {
  private history: Sample[] = [];
  private previousRms: number | undefined;
  private lastEstimate = -Infinity;
  private lastVariation = -Infinity;
  bpm = 0;
  confidence = 0;

  reset() {
    this.history.length = 0;
    this.previousRms = undefined;
    this.lastEstimate = -Infinity;
    this.lastVariation = -Infinity;
    this.bpm = this.confidence = 0;
  }

  sample(time: number, rms: number, flux: number) {
    const history = this.history;
    if (history.length && time <= history[history.length - 1].time) return;
    const rmsChange = rms - (this.previousRms ?? rms);
    this.previousRms = rms;
    history.push({time, rmsChange, flux});
    while (time - history[0].time > WINDOW_SECONDS) history.shift();
    if (Math.abs(rmsChange) > 0.002 || flux > 0.012) this.lastVariation = time;

    if (time - this.lastVariation > 1.2) {
      this.bpm = this.confidence = 0;
      return;
    }
    const span = time - history[0].time;
    if (span < MIN_HISTORY || time - this.lastEstimate < 0.25) return;
    this.lastEstimate = time;

    const secondsPerSample = span / (history.length - 1);
    if (secondsPerSample > 0.1) {
      this.bpm = this.confidence = 0;
      return;
    }
    const loudness = estimatePeriod(history.map((sample) => sample.rmsChange), secondsPerSample);
    const spectrum = estimatePeriod(history.map((sample) => sample.flux), secondsPerSample);
    const estimate = loudness && spectrum && spectrum.confidence > loudness.confidence ? spectrum : loudness ?? spectrum;
    this.bpm = estimate ? Math.round(60 / estimate.period) : 0;
    this.confidence = estimate?.confidence ?? 0;
  }
}
