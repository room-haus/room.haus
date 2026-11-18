export class FixedStepClock {
  readonly dt = 1 / 60;
  private previous: number | undefined;
  private accumulator = 0;
  clear() { this.previous = undefined; this.accumulator = 0; }
  advance(milliseconds:number, running:boolean):number {
    if (!running || !Number.isFinite(milliseconds)) { this.clear(); return 0; }
    if (this.previous === undefined) { this.previous = milliseconds; return 0; }
    this.accumulator = Math.min(.05, this.accumulator + Math.max(0, (milliseconds-this.previous)/1000));
    this.previous = milliseconds;
    const count = Math.min(3, Math.floor((this.accumulator+1e-9)/this.dt));
    this.accumulator = Math.max(0,this.accumulator-count*this.dt);
    return count;
  }
}
