import type {
  AudioFrame, Dungeon, EncounterSnapshot, EnemyDefinition, EnemyState, Mode, NavigationState, Pose,
} from '../contracts.ts';

export const ENEMIES: EnemyDefinition[] = [
  {
    id: 'bone-listener', name: 'BONE LISTENER', kind: 'bone', x: 0, z: 12, height: 2, width: 1.7,
    signal: 'bass', description: 'Its bones move with the bass.', reply: 'The bones answer.',
  },
  {
    id: 'hollow-eye', name: 'HOLLOW EYE', kind: 'eye', x: 3, z: 24, height: 2, width: 1.7,
    signal: 'mid', description: 'Its pupil follows the mids.', reply: 'The eye opens.',
  },
  {
    id: 'ash-moth', name: 'ASH MOTH', kind: 'moth', x: 4, z: 44, height: 2, width: 1.7,
    signal: 'high', description: 'Its wings catch the highs.', reply: 'Ash falls from its wings.',
  },
];

const HEALTH = 3;
const STARTING_MANA = 0.35;
export const SPELL_COST = 0.6;
const COOLDOWN_MS = 650;
const REACTION_SECONDS = 0.85;
const DEFAULT_VIEW_HALF_ANGLE = 50 * Math.PI / 180;
const MIN_DISTANCE = 2;
const MAX_DISTANCE = 18;
const tileKey = (x: number, z: number) => `${x},${z}`;

function makeEnemy(definition: EnemyDefinition): EnemyState {
  return {
    id: definition.id, visible: false, proximity: 0, energy: 0, reaction: 0,
    acknowledged: false, health: HEALTH, maxHealth: HEALTH, defeated: false,
  };
}

export class EncounterController {
  private readonly tiles: Set<string>;
  private readonly gate: string;
  private readonly world: Dungeon;
  private readonly now: () => number;
  private previousTime: number | null = null;
  private lastActivation = -Infinity;
  private wasPlaying = false;
  private snapshot: EncounterSnapshot = {
    enemies: ENEMIES.map(makeEnemy), selectedId: null, message: '', reaction: 0, action: 'provoke', mana: STARTING_MANA,
  };

  constructor(world: Dungeon, now = () => performance.now()) {
    this.world = world;
    this.now = now;
    this.tiles = new Set(world.tiles.map(({x, z}) => tileKey(x, z)));
    this.gate = tileKey(world.gate.x, world.gate.z);
  }

  reset(): void {
    this.previousTime = null;
    this.lastActivation = -Infinity;
    this.wasPlaying = false;
    this.snapshot = {
      enemies: ENEMIES.map(makeEnemy), selectedId: null, message: '', reaction: 0, action: 'provoke', mana: STARTING_MANA,
    };
  }

  activate(id: string, mode: Mode): void {
    const target = this.snapshot.enemies.find(enemy => enemy.id === id);
    const definition = ENEMIES.find(enemy => enemy.id === id);
    const now = this.now();
    if (!definition || !target?.visible || target.defeated || now - this.lastActivation < COOLDOWN_MS) return;

    this.lastActivation = now;
    target.acknowledged = true;
    target.reaction = 1;
    if (mode === 'EXPLORE') {
      target.health -= 1;
      target.defeated = target.health === 0;
      if (target.defeated) target.visible = false;
    }
    this.snapshot.message = target.defeated ? `${definition.name} disperses.` : definition.reply;
    this.snapshot.reaction = 1;
  }

  cast(mode: Mode): boolean {
    if (mode !== 'EXPLORE' || this.snapshot.mana < SPELL_COST) return false;
    const targets = this.snapshot.enemies.filter(enemy => enemy.visible && !enemy.defeated);
    const now = this.now();
    if (!targets.length || now - this.lastActivation < COOLDOWN_MS) return false;

    this.lastActivation = now;
    this.snapshot.mana -= SPELL_COST;
    for (const target of targets) {
      target.acknowledged = true;
      target.reaction = 1;
    }
    this.snapshot.message = 'STATIC crawls over the stone.';
    this.snapshot.reaction = 1;
    return true;
  }

  update(
    audio: AudioFrame, navigation: NavigationState, reducedMotion: boolean,
    motion: number, deltaSeconds: number, gateOpen = 1, viewHalfAngleRadians = DEFAULT_VIEW_HALF_ANGLE,
  ): EncounterSnapshot {
    let previous = this.previousTime;
    const delta = Math.max(0, deltaSeconds);
    if (previous !== null && (
      audio.time < previous ||
      Math.floor(audio.time / this.world.duration) !== Math.floor(previous / this.world.duration)
    )) {
      this.reset();
      previous = null;
    }
    if (audio.playing && audio.available && previous !== null && this.wasPlaying) {
      const elapsed = Math.min(audio.time - previous, delta, 0.1);
      const charge = Math.max(0, Math.min(1, audio.mid * 0.65 + audio.intensity * 0.35));
      this.snapshot.mana = Math.min(1, this.snapshot.mana + charge * elapsed * 0.08);
    }
    const justPaused = this.wasPlaying && !audio.playing;
    this.previousTime = audio.time;
    this.wasPlaying = audio.playing;
    this.snapshot.action = navigation.mode === 'EXPLORE' ? 'attack' : 'provoke';

    let closest = Infinity;
    const viewCosine = Math.cos(Number.isFinite(viewHalfAngleRadians)
      ? Math.max(0, Math.min(Math.PI / 2, viewHalfAngleRadians))
      : DEFAULT_VIEW_HALF_ANGLE);
    this.snapshot.selectedId = null;
    this.snapshot.reaction = 0;
    for (const [index, enemy] of this.snapshot.enemies.entries()) {
      const definition = ENEMIES[index];
      const {pose} = navigation;
      const dx = definition.x - pose.x;
      const dz = definition.z - pose.z;
      const distance = Math.hypot(dx, dz);
      enemy.visible = !enemy.defeated && distance >= MIN_DISTANCE && distance <= MAX_DISTANCE &&
        (dx * Math.sin(pose.yaw) + dz * Math.cos(pose.yaw)) / distance >= viewCosine &&
        this.canSee(pose, dx, dz, distance, gateOpen >= 0.85);
      enemy.proximity = enemy.visible ? (MAX_DISTANCE - distance) / (MAX_DISTANCE - MIN_DISTANCE) : 0;
      enemy.reaction = justPaused ? 0 : Math.max(0, enemy.reaction - delta / REACTION_SECONDS);
      const band = audio.playing && audio.available ? Math.max(0, Math.min(1, audio[definition.signal])) : 0;
      enemy.energy = enemy.visible ? Math.round(band * 5) / 5 * (reducedMotion ? 0.25 : Math.max(0, Math.min(1, motion))) : 0;

      if (enemy.visible && distance < closest) {
        closest = distance;
        this.snapshot.selectedId = enemy.id;
      }
      this.snapshot.reaction = Math.max(this.snapshot.reaction, enemy.reaction);
    }
    if (justPaused) this.snapshot.message = '';
    return this.snapshot;
  }

  private canSee(pose: Pose, dx: number, dz: number, distance: number, gateOpen: boolean): boolean {
    const size = this.world.tileSize;
    const steps = Math.ceil(distance / (size / 16));
    for (let step = 1; step <= steps; step++) {
      const x = Math.round((pose.x + dx * step / steps) / size);
      const z = Math.round((pose.z + dz * step / steps) / size);
      const tile = tileKey(x, z);
      if (!this.tiles.has(tile) || (!gateOpen && tile === this.gate)) return false;
    }
    return true;
  }
}
