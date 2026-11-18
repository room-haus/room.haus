export const COURT = {
  halfWidth: 2,
  halfLength: 3,
  ballRadius: 0.1,
  paddleHalfWidth: 0.55,
  paddleLimit: 1.35,
  paddleZ: 2.6,
  goalZ: 3.1,
  bumper: {x: 0.75, z: 0, radius: 0.3},
} as const;
export const EPSILON = 1e-7;
export interface Ball {
  x: number;
  z: number;
  vx: number;
  vz: number;
}
export interface Paddle {
  x: number;
  velocity: number;
}
export interface Paddles {
  near: Paddle;
  far: Paddle;
}
export type Side = 'near' | 'far';
export interface Contact {
  time: number;
  kind: 'paddle' | 'bumper' | 'wall' | 'goal';
  nx: number;
  nz: number;
  side?: Side;
}
export const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

/** All trajectories, including controller prediction, use these swept shapes. */
export function nextContact(ball: Ball, paddles: Paddles, horizon: number, ignore?: Side): Contact | null {
  const candidates: Contact[] = [];
  const add = (event: Contact) => {
    if (event.time >= -EPSILON && event.time <= horizon + EPSILON)
      candidates.push({...event, time: Math.max(0, event.time)});
  };
  if (ball.vx !== 0) {
    const sign = Math.sign(ball.vx);
    add({time: (sign * 1.9 - ball.x) / ball.vx, kind: 'wall', nx: -sign, nz: 0});
  }
  if (ball.vz !== 0) {
    const sign = Math.sign(ball.vz),
      side: Side = sign > 0 ? 'near' : 'far';
    const time = (sign * 2.5 - ball.z) / ball.vz;
    if (side !== ignore && Math.abs(ball.x + ball.vx * time - paddles[side].x) <= 0.65 + EPSILON)
      add({time, kind: 'paddle', nx: 0, nz: -sign, side});
    add({time: (sign * COURT.goalZ - ball.z) / ball.vz, kind: 'goal', nx: 0, nz: -sign, side});
  }
  const dx = ball.x - COURT.bumper.x,
    dz = ball.z - COURT.bumper.z;
  const a = ball.vx * ball.vx + ball.vz * ball.vz,
    b = 2 * (dx * ball.vx + dz * ball.vz),
    c = dx * dx + dz * dz - 0.16;
  const disc = b * b - 4 * a * c;
  if (a > 0 && disc >= 0) {
    const time = c < -EPSILON ? 0 : (-b - Math.sqrt(disc)) / (2 * a);
    const x = dx + ball.vx * time,
      z = dz + ball.vz * time,
      len = Math.hypot(x, z);
    const nx = len > EPSILON ? x / len : -ball.vx / Math.sqrt(a),
      nz = len > EPSILON ? z / len : -ball.vz / Math.sqrt(a);
    if (ball.vx * nx + ball.vz * nz < -EPSILON) add({time, kind: 'bumper', nx, nz});
  }
  const priority = {paddle: 0, bumper: 0, wall: 1, goal: 2};
  candidates.sort((a, b) =>
    Math.abs(a.time - b.time) <= EPSILON ? priority[a.kind] - priority[b.kind] : a.time - b.time,
  );
  return candidates[0] ?? null;
}

export function resolveContact(ball: Ball, contact: Contact, paddles: Paddles): void {
  const speed = Math.hypot(ball.vx, ball.vz);
  if (contact.kind === 'paddle' && contact.side) {
    const paddle = paddles[contact.side];
    const bias = clamp(((ball.x - paddle.x) / 0.65) * 0.72 + paddle.velocity * 0.08, -0.9, 0.9);
    ball.vx = speed * bias;
    ball.vz = contact.nz * speed * Math.sqrt(1 - bias * bias);
  } else {
    const dot = ball.vx * contact.nx + ball.vz * contact.nz;
    ball.vx -= 2 * dot * contact.nx;
    ball.vz -= 2 * dot * contact.nz;
  }
  if (contact.kind === 'bumper') {
    ball.x = COURT.bumper.x + contact.nx * (0.4 + EPSILON);
    ball.z = COURT.bumper.z + contact.nz * (0.4 + EPSILON);
  } else {
    ball.x += contact.nx * EPSILON;
    ball.z += contact.nz * EPSILON;
  }
}

export function advanceBall(
  initial: Ball,
  paddles: Paddles,
  dt: number,
): {ball: Ball; events: Contact[]; goal: Side | null; trapped: boolean} {
  const ball = {...initial},
    events: Contact[] = [];
  let remaining = dt;
  while (remaining > EPSILON) {
    const contact = nextContact(ball, paddles, remaining);
    if (!contact) {
      ball.x += ball.vx * remaining;
      ball.z += ball.vz * remaining;
      break;
    }
    if (events.length === 4) return {ball, events, goal: null, trapped: true};
    ball.x += ball.vx * contact.time;
    ball.z += ball.vz * contact.time;
    remaining -= contact.time;
    events.push(contact);
    if (contact.kind === 'goal') return {ball, events, goal: contact.side ?? null, trapped: false};
    resolveContact(ball, contact, paddles);
  }
  return {ball, events, goal: null, trapped: false};
}

export function predictIntercept(
  initial: Ball,
  paddles: Paddles,
  side: Side,
): {x: number | null; contacts: number; time: number} {
  const ball = {...initial};
  let time = 0,
    contacts = 0;
  const plane = side === 'near' ? 2.5 : -2.5;
  while (time < 2 && contacts < 8) {
    const contact = nextContact(ball, paddles, 2 - time, side);
    const intercept = (plane - ball.z) / ball.vz;
    if (intercept >= 0 && intercept <= 2 - time && (!contact || intercept <= contact.time + EPSILON))
      return {x: clamp(ball.x + ball.vx * intercept, -1.35, 1.35), contacts, time: time + intercept};
    if (!contact) return {x: null, contacts, time: 2};
    ball.x += ball.vx * contact.time;
    ball.z += ball.vz * contact.time;
    time += contact.time;
    if (contact.kind === 'goal') return {x: null, contacts, time};
    resolveContact(ball, contact, paddles);
    contacts++;
  }
  return {x: null, contacts, time};
}
