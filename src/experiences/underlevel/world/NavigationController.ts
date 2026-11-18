import type {Direction, DirectorState, Dungeon, Mode, NavigationState, Pose, Waypoint} from '../contracts';

const EYE_HEIGHT = 1.65;
const MANUAL_DURATION = 0.3;
const IDLE_DURATION = 12;
const TURN = Math.PI / 2;
const GATE_CLEARANCE = 0.85;
const RESUME_SPEED = 8;
const NEIGHBORS = [
  [0, 1],
  [1, 0],
  [0, -1],
  [-1, 0],
] as const;

type Coordinate = {x: number; z: number};
type Movement = {from: Pose; to: Pose; elapsed: number; duration: number};

const key = ({x, z}: Coordinate) => `${x},${z}`;
const distance = (from: Coordinate, to: Coordinate) => Math.hypot(to.x - from.x, to.z - from.z);
const ease = (progress: number) => progress * progress * (3 - 2 * progress);

function blend(from: Pose, to: Pose, weight: number): Pose {
  if (weight === 1) return to;
  const yawDelta = Math.atan2(Math.sin(to.yaw - from.yaw), Math.cos(to.yaw - from.yaw));
  return {
    x: from.x + (to.x - from.x) * weight,
    y: EYE_HEIGHT,
    z: from.z + (to.z - from.z) * weight,
    yaw: from.yaw + yawDelta * weight,
  };
}

function waypointPose(waypoint: Waypoint): Pose {
  return {x: waypoint.x, y: EYE_HEIGHT, z: waypoint.z, yaw: waypoint.yaw};
}

export class NavigationController {
  mode: Mode;
  private world: Dungeon;
  private pose: Pose;
  private tiles: Set<string>;
  private gateOpen = false;
  private idle = 0;
  private lastInputTime = -Infinity;
  private movement: Movement | null = null;
  private resuming = false;
  private reducedMotion: boolean;

  constructor(world: Dungeon, reducedMotion = false) {
    this.world = world;
    this.mode = reducedMotion ? 'STILL' : 'DRIFT';
    this.reducedMotion = reducedMotion;
    this.pose = waypointPose(world.route[0]);
    this.tiles = new Set(world.tiles.filter((tile) => key(tile) !== key(world.artifact)).map(key));
  }

  setMode(mode: Mode) {
    if (this.mode === mode) return;
    this.mode = mode;
    this.movement = null;
    this.idle = 0;
    this.lastInputTime = -Infinity;
    this.resuming = mode === 'DRIFT';
  }

  input(direction: Direction, nowSeconds: number) {
    if (this.mode === 'STILL') return;
    this.setMode('EXPLORE');
    this.idle = 0;
    if (nowSeconds < this.lastInputTime) return;
    this.lastInputTime = nowSeconds;
    if (this.movement) return;

    const from = this.pose;
    const heading = Math.round(from.yaw / TURN);
    let to: Pose;
    if (direction === 'left' || direction === 'right') {
      to = {...from, yaw: (heading + (direction === 'left' ? -1 : 1)) * TURN};
    } else {
      const turn = heading + (direction === 'back' ? 2 : 0);
      const [dx, dz] = NEIGHBORS[((turn % 4) + 4) % 4];
      const tile = this.tileAt(from);
      const next = {x: tile.x + dx, z: tile.z + dz};
      const yaw = heading * TURN;
      if (this.canEnter(next)) {
        to = this.atCenter(next, yaw);
      } else {
        if (yaw === from.yaw) return;
        to = {...from, yaw};
      }
    }

    this.movement = {from, to, elapsed: 0, duration: MANUAL_DURATION};
  }

  update(audioTime: number, deltaSeconds: number, director: DirectorState, reducedMotion: boolean): NavigationState {
    this.gateOpen = director.gateOpen >= GATE_CLEARANCE;
    const delta = Math.max(0, deltaSeconds);
    if (this.reducedMotion && !reducedMotion && this.mode === 'DRIFT') this.resuming = true;
    this.reducedMotion = reducedMotion;

    if (this.mode === 'EXPLORE') {
      this.idle += delta;
      this.advance(reducedMotion ? MANUAL_DURATION : delta);
    }
    if (this.mode === 'DRIFT' && !reducedMotion) {
      const target = this.routePose(audioTime);
      if (this.resuming) this.resume(target, delta);
      else this.pose = target;
    }

    return {mode: this.mode, pose: this.pose, resumeOffered: this.mode === 'EXPLORE' && this.idle >= IDLE_DURATION};
  }

  private tileAt({x, z}: Coordinate): Coordinate {
    return {x: Math.round(x / this.world.tileSize), z: Math.round(z / this.world.tileSize)};
  }

  private atCenter({x, z}: Coordinate, yaw: number): Pose {
    return {x: x * this.world.tileSize, y: EYE_HEIGHT, z: z * this.world.tileSize, yaw};
  }

  private canEnter(tile: Coordinate): boolean {
    return this.tiles.has(key(tile)) && (this.gateOpen || key(tile) !== key(this.world.gate));
  }

  private routePose(time: number): Pose {
    const {duration, route} = this.world;
    const phase = ((time % duration) + duration) % duration;
    const next = route.findIndex((point) => point.time > phase);
    const from = route[next - 1];
    const to = route[next];
    const progress = (phase - from.time) / (to.time - from.time);
    const weight = distance(from, to) === 0 ? ease(progress) : progress;
    const pose = blend(waypointPose(from), waypointPose(to), weight);
    const gate = this.world.gate;
    const inGate = Math.abs(pose.z - gate.z * this.world.tileSize) <= this.world.tileSize / 2;
    if (!this.gateOpen && inGate && this.tileAt(pose).x === gate.x) {
      const approach = to.z < from.z ? 1 : -1;
      return {...pose, z: gate.z * this.world.tileSize + approach * (this.world.tileSize / 2 + 0.05)};
    }
    return pose;
  }

  private advance(delta: number, easing = ease) {
    const movement = this.movement;
    if (!movement) return;

    if (!this.canEnter(this.tileAt(movement.to)) && key(this.tileAt(this.pose)) !== key(this.tileAt(movement.to))) {
      this.movement = {
        from: this.pose,
        to: movement.from,
        elapsed: 0,
        duration: movement.duration,
      };
      return;
    }

    movement.elapsed += delta;
    const progress = Math.min(movement.elapsed / movement.duration, 1);
    this.pose = blend(movement.from, movement.to, easing(progress));
    if (progress === 1) this.movement = null;
  }

  private resume(target: Pose, delta: number) {
    if (this.movement) {
      this.advance(delta, (progress) => progress);
      return;
    }

    const current = this.tileAt(this.pose);
    const destination = this.tileAt(target);
    const sameTile = key(current) === key(destination);
    let nextPose = target;
    if (!sameTile) {
      // Center the camera before taking another cardinal edge. This avoids cutting a corner.
      const center = this.atCenter(current, this.pose.yaw);
      if (distance(this.pose, center) > 0.001) {
        nextPose = center;
      } else {
        const step = this.nextTile(current, destination);
        if (!step || !this.canEnter(step)) return;
        const yaw = Math.atan2(step.x - current.x, step.z - current.z);
        nextPose = this.atCenter(step, yaw);
      }
    }

    const travel = distance(this.pose, nextPose);
    const turn = nextPose.yaw - this.pose.yaw;
    const rotation = Math.abs(Math.atan2(Math.sin(turn), Math.cos(turn)));
    const duration = Math.max(travel / RESUME_SPEED, rotation / (Math.PI * 2));
    if (sameTile && duration <= delta) {
      this.pose = target;
      this.resuming = false;
      return;
    }
    this.movement = {from: this.pose, to: nextPose, elapsed: 0, duration};
    this.advance(delta, (progress) => progress);
  }

  private nextTile(start: Coordinate, destination: Coordinate): Coordinate | undefined {
    const visited = new Set([key(start)]);
    const frontier: {tile: Coordinate; firstStep?: Coordinate}[] = [{tile: start}];
    for (const {tile, firstStep} of frontier) {
      if (key(tile) === key(destination)) return firstStep;
      for (const [dx, dz] of NEIGHBORS) {
        const next = {x: tile.x + dx, z: tile.z + dz};
        const nextKey = key(next);
        if (visited.has(nextKey) || !this.tiles.has(nextKey)) continue;
        visited.add(nextKey);
        frontier.push({tile: next, firstStep: firstStep ?? next});
      }
    }
    return undefined;
  }
}
