import type {ToyAction, ToyFrame, ResetReason, ToySimulation} from '../shared/contracts.ts';
import {advanceBall, clamp, COURT, predictIntercept} from './geometry.ts';
import type {Ball, Side} from './geometry.ts';
import {mapAudio} from './mapAudio.ts';
export interface RallyPaddle {
  x: number;
  z: number;
  velocity: number;
  target: number;
}
export interface RallyState {
  phase: 'rally' | 'returning';
  ball: Ball;
  near: RallyPaddle;
  far: RallyPaddle;
  controlWeight: number;
  manualTarget: number;
  grabbedId: string | null;
  bumperCompression: number;
  paddleAccent: number;
  warmth: number;
  seam: number;
  returnProgress: number;
  collisionSequence: number;
  recoveries: number;
  invalidRecoveries: number;
  onsetAccents: number;
  speed: number;
  elapsed: number;
  biasNear: number;
  biasFar: number;
  nextBias: number;
}
export class RallySimulation implements ToySimulation<RallyState> {
  private state!: RallyState;
  private randomState = 29;
  private lastSequence = -1;
  private lastOnset = -1;
  private lastNudge = -2;
  private stalled = 0;
  private active = true;
  private paddleOwned = false;
  private gentle = false;
  private returnStart = {x: 0, z: 0};
  private serveDirection = 1;
  constructor(seed = 29, initial: Partial<RallyState> = {}) {
    this.reset(seed, 0, 'open');
    this.state = {...this.state, ...initial};
  }
  private random(): number {
    this.randomState = (Math.imul(1664525, this.randomState) + 1013904223) >>> 0;
    return this.randomState / 4294967296;
  }
  reset(seed: number, mediaTime: number, _reason: ResetReason): RallyState {
    const playhead = Number.isFinite(mediaTime) ? Math.max(0, Math.floor(mediaTime * 1000)) : 0;
    this.randomState = (seed ^ Math.imul(playhead, 2654435761)) >>> 0;
    this.lastSequence = -1;
    this.lastOnset = -1;
    this.lastNudge = -2;
    this.stalled = 0;
    this.active = true;
    this.serveDirection = 1;
    this.paddleOwned = false;
    this.gentle = false;
    this.state = {
      phase: 'rally',
      ball: {x: 0, z: 0, vx: (this.random() - 0.5) * 0.6, vz: 1.5},
      near: {x: 0, z: 2.6, velocity: 0, target: 0},
      far: {x: 0, z: -2.6, velocity: 0, target: 0},
      controlWeight: 0,
      manualTarget: 0,
      grabbedId: null,
      bumperCompression: 0,
      paddleAccent: 0,
      warmth: 0.3,
      seam: 0.03,
      returnProgress: 0,
      collisionSequence: 0,
      recoveries: 0,
      invalidRecoveries: 0,
      onsetAccents: 0,
      speed: 1.5,
      elapsed: 0,
      biasNear: 0,
      biasFar: 0,
      nextBias: 8 + this.random() * 4,
    };
    this.normalizeSpeed();
    return this.state;
  }
  snapshot(): Readonly<RallyState> {
    return this.state;
  }
  predict(side: Side): ReturnType<typeof predictIntercept> {
    return predictIntercept(this.state.ball, this.state, side);
  }
  act(action: ToyAction): boolean {
    const s = this.state;
    if (action.type === 'select') return action.targetId === 'near-paddle';
    if (action.type === 'release') {
      const held = s.grabbedId !== null;
      s.grabbedId = null;
      return held;
    }
    if (!this.active) return false;
    if (action.type === 'set-value' && action.control === 'paddle-position' && Number.isFinite(action.value)) {
      s.manualTarget = clamp(action.value, -1, 1) * COURT.paddleLimit;
      s.controlWeight = 1;
      this.paddleOwned = true;
      return true;
    }
    if (action.type === 'grab' && action.targetId === 'near-paddle' && Number.isFinite(action.x)) {
      s.grabbedId = 'near-paddle';
      s.manualTarget = clamp(action.x, -1, 1) * COURT.paddleLimit;
      s.controlWeight = 1;
      this.paddleOwned = true;
      return true;
    }
    if (action.type === 'move' && s.grabbedId && Number.isFinite(action.x)) {
      s.manualTarget = clamp(action.x, -1, 1) * COURT.paddleLimit;
      return true;
    }
    if (
      action.type === 'command' &&
      action.command === 'nudge-ball' &&
      s.phase === 'rally' &&
      s.elapsed - this.lastNudge >= 2 - 1e-8
    ) {
      this.lastNudge = s.elapsed;
      const sign = s.ball.vx < 0 ? -1 : 1,
        scale = this.gentle ? 0.2 : 1;
      s.ball.vx += sign * 0.18 * scale;
      s.ball.vz += (s.ball.vz < 0 ? -0.06 : 0.06) * scale;
      this.normalizeSpeed();
      return true;
    }
    return false;
  }
  private normalizeSpeed(): void {
    const b = this.state.ball,
      len = Math.hypot(b.vx, b.vz);
    if (len > 0.00001) {
      b.vx = (b.vx / len) * this.state.speed;
      b.vz = (b.vz / len) * this.state.speed;
    }
  }
  private recover(invalid = false): void {
    const s = this.state,
      b = s.ball;
    s.phase = 'returning';
    s.returnProgress = 0;
    s.recoveries++;
    if (invalid) s.invalidRecoveries++;
    this.serveDirection = b.z < 0 ? 1 : -1;
    this.returnStart = {
      x: Number.isFinite(b.x) ? clamp(b.x, -2.2, 2.2) : 0,
      z: Number.isFinite(b.z) ? clamp(b.z, -3.2, 3.2) : 0,
    };
    s.ball = {...this.returnStart, vx: 0, vz: 0};
    this.stalled = 0;
  }
  step(frame: ToyFrame): RallyState {
    this.active = frame.source !== 'inactive' && frame.motion > 0;
    const s = this.state;
    if (!this.active) {
      this.lastSequence = frame.featureSequence;
      return s;
    }
    if (!Number.isFinite(frame.dt) || frame.dt <= 0) return s;
    const dt = Math.min(frame.dt, 1 / 30),
      audio = mapAudio(frame);
    s.elapsed += dt;
    this.gentle = frame.reducedMotion || frame.motion < 0.5;
    s.speed =
      frame.reducedMotion || frame.motion < 0.5 ? 0.6 : s.speed + (audio.speed - s.speed) * (1 - Math.exp(-dt / 4));
    s.warmth += (audio.warmth - s.warmth) * (1 - Math.exp(-dt / 4));
    s.seam = audio.seam;
    s.bumperCompression = this.gentle
      ? 0
      : audio.compression + (s.bumperCompression - audio.compression) * Math.exp(-dt * 8);
    s.paddleAccent = this.gentle ? 0 : s.paddleAccent * Math.exp(-dt * 8);
    if (frame.featureSequence !== this.lastSequence) {
      this.lastSequence = frame.featureSequence;
      if (audio.onset && s.elapsed - this.lastOnset >= 0.5) {
        s.paddleAccent = 0.05;
        s.onsetAccents++;
        this.lastOnset = s.elapsed;
      }
    }
    if (s.elapsed >= s.nextBias) {
      s.biasNear = (this.random() - 0.5) * 0.3;
      s.biasFar = (this.random() - 0.5) * 0.3;
      s.nextBias = s.elapsed + 8 + this.random() * 4;
    }
    // The director already blends timeout authority. Explicit Watch still eases
    // from the current target; held pointer ownership always wins.
    const autonomy = (frame as ToyFrame & {autonomy?: number}).autonomy;
    const authority =
      typeof autonomy === 'number' && Number.isFinite(autonomy)
        ? 1 - clamp(autonomy, 0, 1)
        : frame.mode === 'control'
          ? 1
          : 0;
    s.controlWeight = !this.paddleOwned
      ? 0
      : s.grabbedId
        ? 1
        : frame.mode === 'control'
          ? authority
          : Math.max(authority, s.controlWeight - dt / 1.5, 0);
    if (s.controlWeight === 0) this.paddleOwned = false;
    for (const side of ['near', 'far'] as const) {
      const paddle = s[side],
        auto = clamp((this.predict(side).x ?? 0) + (side === 'near' ? s.biasNear : s.biasFar), -1.35, 1.35);
      paddle.target = side === 'near' ? auto * (1 - s.controlWeight) + s.manualTarget * s.controlWeight : auto;
      const delta = paddle.target - paddle.x,
        desired = clamp(delta * 8, -3, 3);
      paddle.velocity += clamp(desired - paddle.velocity, -12 * dt, 12 * dt);
      paddle.x = clamp(paddle.x + paddle.velocity * dt, -1.35, 1.35);
      if (Math.abs(paddle.x) === 1.35 && paddle.x * paddle.velocity > 0) paddle.velocity = 0;
    }
    if (s.phase === 'returning') {
      s.returnProgress = Math.min(1, s.returnProgress + dt / 1.2);
      const t = s.returnProgress,
        side = this.returnStart.x < 0 ? -1 : 1,
        end = this.returnStart.z < 0 ? -1 : 1;
      const points = [this.returnStart, {x: side * 2.3, z: end * 3.3}, {x: side * 2.3, z: 0}, {x: 0, z: 0}];
      const segment = t < 0.25 ? 0 : t < 0.7 ? 1 : 2;
      const local = segment === 0 ? t / 0.25 : segment === 1 ? (t - 0.25) / 0.45 : (t - 0.7) / 0.3;
      const u = local * local * (3 - 2 * local),
        from = points[segment],
        to = points[segment + 1];
      s.ball.x = from.x + (to.x - from.x) * u;
      s.ball.z = from.z + (to.z - from.z) * u;
      if (t >= 1 - 1e-9) {
        s.phase = 'rally';
        s.returnProgress = 0;
        s.ball = {x: 0, z: 0, vx: (this.random() - 0.5) * 0.5, vz: this.serveDirection * s.speed};
        this.normalizeSpeed();
      }
      return s;
    }
    if (!Object.values(s.ball).every(Number.isFinite) || Math.abs(s.ball.x) > 2.01 || Math.abs(s.ball.z) > 3.11) {
      this.recover(true);
      return s;
    }
    const speed = Math.hypot(s.ball.vx, s.ball.vz);
    this.stalled = speed < 0.2 ? this.stalled + dt : 0;
    if (this.stalled >= 2 - 1e-9) {
      this.recover();
      return s;
    }
    if (speed >= 0.2) this.normalizeSpeed();
    const result = advanceBall(s.ball, s, dt);
    s.ball = result.ball;
    for (const event of result.events) {
      if (event.kind !== 'goal') s.collisionSequence++;
      if (event.kind === 'bumper' && !this.gentle) s.bumperCompression = 0.05;
      if (event.kind === 'paddle' && !this.gentle) s.paddleAccent = 0.05;
    }
    if (result.goal || result.trapped) this.recover();
    return s;
  }
}
