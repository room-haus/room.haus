function round(value, decimals) {
  return Number(`${Math.round(`${value}e${decimals}`)}e-${decimals}`);
}

const intervalToBPM = (interval) => {
  let bpm = 60.0 / interval;
  while (bpm < 70) {
    bpm *= 2;
  }
  while (bpm > 140) {
    bpm /= 2;
  }
  return round(bpm, 0);
};

class BPMAnalyser {
  constructor({sampleRate = 44100, frameSize, memory, precision = 3}) {
    this.precision = precision;
    this.sampleRate = sampleRate;
    this.frameSize = frameSize;
    this.frameDuration = frameSize / sampleRate;
    this.memoryWindow = Math.ceil(memory / this.frameDuration);
    this.intervals = [];
    this.histogram = {};
    this.data = {};
    this.iterations = 0;
    this.foundFirstBeat = false;
    this.onsets = 0;
  }

  addInterval(bpm) {
    if (this.histogram[bpm] !== undefined) {
      this.histogram[bpm]++;
    } else {
      this.histogram[bpm] = 1;
    }
  }

  removeOldData() {
    const cutoff = this.iterations - this.memoryWindow;
    const cutoffIndex = this.intervals.findIndex((meta) => meta.iteration <= cutoff);
    if (cutoffIndex > -1) {
      const oldMeta = this.intervals.splice(cutoffIndex);
      oldMeta.forEach((meta) => {
        this.histogram[meta.bpm]--;
        if (this.histogram[meta.bpm] <= 0) {
          delete this.histogram[meta.bpm];
        }
      });
    }
  }

  cycle(prevPeak) {
    if (prevPeak) {
      if (this.onsets >= 1) {
        const intervalDiff = this.intervals.length
          ? this.iterations - this.intervals[0].iteration
          : this.iterations - this.firstBeatIteration;
        const duration = intervalDiff * this.frameDuration;
        // console.log(intervalDiff);
        if (duration > 0.2) {
          const intervalMeta = {
            bpm: intervalToBPM(duration),
            interval: duration,
            iteration: this.iterations,
          };
          this.intervals.unshift(intervalMeta);
          this.addInterval(intervalMeta.bpm);
          this.onsets++;
        }
      } else {
        this.firstBeatIteration = this.iterations;
        this.onsets++;
      }
    }

    if (this.onsets >= 1) {
      this.removeOldData();
      this.analyze();
    }
    this.iterations++;
  }

  analyze() {
    const mostCommonMeta = Object.entries(this.histogram) // eslint-disable-line prefer-destructuring
      .reduce(
        (meta, [bpm, count]) => {
          if (!meta.max || count > meta.max.count) {
            meta.max = {
              bpm,
              count,
            };
          }
          meta.total += count;
          return meta;
        },
        {max: null, total: 0},
      );
    if (mostCommonMeta && mostCommonMeta.max) {
      const bpm = Number(mostCommonMeta.max.bpm);
      const interval = 60 / bpm;
      this.data = {
        onsets: this.onsets,
        bpm,
        interval,
        confidence: round(mostCommonMeta.max.count / mostCommonMeta.total, 2),
        histogram: this.histogram,
        frameDuration: this.frameDuration,
        memoryWindow: this.memoryWindow,
        iterations: this.iterations,
      };
    }
  }
}

export default BPMAnalyser;
