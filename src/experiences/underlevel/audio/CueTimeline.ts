import type {Cue} from '../contracts.ts';

export class CueTimeline {
  private readonly cues: Cue[];

  constructor(cues: readonly Cue[]) {
    this.cues = [...cues].sort((a, b) => a.time - b.time);
  }

  private upperBound(time: number) {
    let start = 0;
    let end = this.cues.length;
    while (start < end) {
      const middle = Math.floor((start + end) / 2);
      if (this.cues[middle].time <= time) start = middle + 1;
      else end = middle;
    }
    return start;
  }

  at(time: number): Cue | undefined {
    return this.cues[this.upperBound(time) - 1];
  }

  between(from: number, to: number): Cue[] {
    return this.cues.slice(this.upperBound(from), this.upperBound(to));
  }
}
