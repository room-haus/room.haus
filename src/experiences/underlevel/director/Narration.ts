import type {AudioFrame, DirectorState, Dungeon, EncounterSnapshot, NavigationState, Tile} from '../contracts.ts';

const lines = {
  corridor: [
    'The passage descends. DRIFT follows the sound.',
    'Mortar has spilled from a joint in the wall.',
    'The passage is wide enough to turn around.',
    'The stones here are worn smooth at shoulder height.',
    'The low ceiling hides the end of the passage.',
  ],
  chamber: [
    'The corridor widens around the transmitter.',
    'The transmitter sits on a foundation of cut stone.',
    'The floor is marked where the transmitter was dragged into place.',
    'Two shallow recesses break the symmetry of the chamber.',
    'The markings around the transmitter are different from the rest of the masonry.',
  ],
  hall: [
    'The hall spreads out beyond the gate.',
    'The columns continue into the deeper part of the hall.',
    'There is room to move between the pillars.',
    'The far side of the hall is difficult to make out.',
    'The hall floor is worn in several directions.',
  ],
  gate: [
    'The way through the gate is clear.',
    'The gate has lifted into a recess in the ceiling.',
    'The passage beyond the raised gate leads into a wider room.',
  ],
  bone: [
    'The Bone Listener stands within reach of the lantern light.',
    'The bones face into the corridor.',
    'The Bone Listener is close enough to provoke. In EXPLORE, click or tap to attack.',
  ],
  eye: [
    'An eye watches from the transmitter chamber.',
    'The Hollow Eye hangs in the air.',
    'The eye remains visible. In EXPLORE, click or tap it to attack.',
  ],
  moth: [
    'An Ash Moth is visible between the stones.',
    'Ash outlines the moth’s wings.',
    'The moth is close enough to provoke.',
  ],
  attack: [
    'The strike made contact.',
    'The creature flinched at the blow.',
    'The blow struck the creature.',
  ],
  defeat: [
    'The creature dispersed where it stood.',
    'The last blow scattered the creature into the dark.',
    'The creature’s outline broke apart.',
  ],
  cast: [
    'Static ran over the stones and reached the creatures in view.',
    'Your spell sent a charge through the room.',
    'The static made the creatures react.',
  ],
  quiet: [
    'The mix has almost fallen silent.',
    'The level drops. Listen for what comes back.',
    'Very little sound is reaching the passage now.',
    'The music thins to a trace.',
  ],
  build: [
    'The mix gathers weight.',
    'More of the mix is coming through.',
    'The sound swells against the stone.',
    'The passage fills as the level rises.',
  ],
  'quiet-passed': [
    'A moment ago the passage was nearly silent.',
    'The quiet part of the mix has passed.',
    'The music has returned after a stretch of near silence.',
  ],
  'build-passed': [
    'The mix gathered weight a moment ago.',
    'The passage filled with sound during that last rise.',
    'The level rose steadily a moment ago.',
  ],
  bright: [
    'The upper frequencies stand out now.',
    'A bright edge cuts through the mix.',
    'The high end leaves a fine trace in the air.',
    'Treble shows through the rest of the sound.',
  ],
  bass: [
    'Low frequencies come through strongly.',
    'The bass puts weight behind the lantern light.',
    'A low band pushes through the passage.',
    'The bottom of the mix presses against the masonry.',
  ],
  fast: [
    'The mix is moving at a quick pace.',
    'The estimated pulse is fast enough to count in pairs.',
    'The music holds a quick, repeated cadence.',
    'The pulse keeps returning at short intervals.',
  ],
  surreal: [
    'You remembered your middle school crush. You are devastated.',
    'Man, this kind of sucks.',
    'You got an alert from your bank. You chose to ignore it.',
    'You miss your dog',
    'You question the competency of your government',
    'You suddenly remember the price of butter.',
    'You mentally reschedule an appointment you have already missed.',
    'You remember the password to an account that no longer exists.',
    'You are fairly sure you left the oven on in a previous apartment.',
    'You think of a good response to an argument from six years ago.',
    'You wonder where the odd socks go after you move.',
    'You realize you have been carrying a dead pen all week.',
    'You remember the smell of a school gym just before it rained.',
    'You consider becoming a person who owns a label maker.',
    'You thought there would be more chairs.',
    'You almost remember what you came down here to get.',
    'You decide to check your email later, as if later were a place.',
    'You miss the old bus route.',
    'You think you could have been better at darts with proper encouragement.',
    'You remember having a strong opinion about a lamp.',
  ],
} as const;

type Kind = keyof typeof lines;
type EventKind = 'attack' | 'defeat' | 'cast';
type SoundChange = 'quiet' | 'build';
export interface Narration { id: string; text: string; kind: Kind }

interface NarrationFrame {
  audio: AudioFrame;
  director: DirectorState;
  navigation: NavigationState;
  encounters: EncounterSnapshot;
}

const RECENT_LIMIT = 14;
const ENEMY_KINDS = {'bone-listener': 'bone', 'hollow-eye': 'eye', 'ash-moth': 'moth'} as const;

/** Holds each line across frames, with quiet time between announcements. */
export class NarrationDirector {
  private readonly zones: Map<string, Tile['zone']>;
  private readonly world: Dungeon;
  private readonly seed: number;
  private randomState: number;
  private recent: string[] = [];
  private previousTime = -Infinity;
  private held: Narration | null = null;
  private holdUntil = 0;
  private nextAt = 0;
  private sequence = 0;
  private previousHealth = 0;
  private previousDefeated = 0;
  private previousMana = 0;
  private pending: {kind: EventKind; expires: number} | null = null;
  private soundTime: number | null = null;
  private intensityBaseline = 0;
  private soundChange: SoundChange | null = null;
  private soundChangeSince = 0;
  private soundChangeQueued = false;
  private pendingSound: {kind: SoundChange; expires: number} | null = null;
  private gateNarrated = false;
  private lastNarratedEnemy: string | null = null;

  constructor(world: Dungeon, seed = world.seed) {
    this.world = world;
    this.seed = seed;
    this.randomState = seed >>> 0;
    this.zones = new Map(world.tiles.map(tile => [`${tile.x},${tile.z}`, tile.zone]));
  }

  reset() {
    this.randomState = this.seed >>> 0;
    this.recent = [];
    this.sequence = 0;
    this.restartClock();
  }

  update({audio, director, navigation, encounters}: NarrationFrame): Narration | null {
    const {time} = audio;
    if (!Number.isFinite(time) || time < 0) return null;
    if (time < this.previousTime) this.restartClock();
    this.observeEncounter(time, encounters);
    this.observeSound(audio);
    this.previousTime = time;
    if (!audio.playing) return this.held;

    const {pose} = navigation;
    const {tileSize, gate} = this.world;
    const x = Math.round(pose.x / tileSize);
    const z = Math.round(pose.z / tileSize);
    const zone = this.zones.get(`${x},${z}`);
    const localOpenGate = director.gateOpen >= 0.85 && x === gate.x && Math.abs(z - gate.z) <= 1;
    if (!localOpenGate) this.gateNarrated = false;
    const selected = encounters.enemies.find(enemy => enemy.id === encounters.selectedId && enemy.visible && !enemy.defeated);
    if (selected?.id !== this.lastNarratedEnemy) this.lastNarratedEnemy = null;
    if (this.held && time < this.holdUntil) return this.held;
    this.held = null;
    if (time < this.nextAt) return null;

    const categories: Kind[] = [];
    if (this.pending && time <= this.pending.expires) categories.push(this.pending.kind);
    this.pending = null;
    const enemyId = selected?.id as keyof typeof ENEMY_KINDS | undefined;
    const enemyKind = enemyId && Object.hasOwn(ENEMY_KINDS, enemyId) ? ENEMY_KINDS[enemyId] : null;
    if (localOpenGate && !this.gateNarrated) categories.push('gate');
    if (enemyKind && enemyId !== this.lastNarratedEnemy) categories.push(enemyKind);
    if (this.pendingSound && time <= this.pendingSound.expires) {
      const {kind} = this.pendingSound;
      categories.push(kind === this.soundChange ? kind : `${kind}-passed`);
    }
    this.pendingSound = null;
    // Regular surreal lines leave room for the dungeon and the mix to speak.
    if (this.sequence % 2 === 1) categories.push('surreal');
    const sound = this.soundKinds(audio);
    if (this.sequence > 0 && this.sequence % 4 === 0) categories.push(...sound);
    if (zone) categories.push(zone);
    categories.push(...sound, 'surreal');

    this.held = this.pick(categories);
    if (this.held.kind === 'gate') this.gateNarrated = true;
    if (this.held.kind === enemyKind && enemyId) this.lastNarratedEnemy = enemyId;
    this.holdUntil = time + 7 + this.random() * 2;
    this.nextAt = this.holdUntil + 6 + this.random() * 4;
    this.sequence++;
    return this.held;
  }

  private observeEncounter(time: number, encounters: EncounterSnapshot) {
    let health = 0;
    let defeated = 0;
    for (const enemy of encounters.enemies) {
      health += enemy.health;
      if (enemy.defeated) defeated++;
    }
    if (encounters.reaction > 0 && Number.isFinite(this.previousTime)) {
      let event: EventKind | undefined;
      if (defeated > this.previousDefeated) event = 'defeat';
      else if (health < this.previousHealth) event = 'attack';
      else if (encounters.mana < this.previousMana && encounters.message.startsWith('STATIC')) event = 'cast';
      if (event) this.pending = {kind: event, expires: time + 20};
    }
    this.previousHealth = health;
    this.previousDefeated = defeated;
    this.previousMana = encounters.mana;
  }

  private observeSound(audio: AudioFrame) {
    if (!audio.playing || !audio.available) {
      this.clearSound();
      return;
    }
    const {time, intensity} = audio;
    if (this.soundTime === null || time - this.soundTime > 1) {
      this.intensityBaseline = intensity;
      this.soundChange = null;
    } else {
      const elapsed = time - this.soundTime;
      this.intensityBaseline += (intensity - this.intensityBaseline) * (1 - Math.exp(-elapsed / 3));
    }
    this.soundTime = time;
    const next = this.isQuiet(audio) ? 'quiet' :
      intensity >= 0.4 && intensity - this.intensityBaseline >= 0.10 ? 'build' : null;
    if (next !== this.soundChange) {
      this.soundChange = next;
      this.soundChangeSince = time;
      this.soundChangeQueued = false;
    }
    const duration = time - this.soundChangeSince;
    const minimum = next === 'quiet' ? 0.5 : 1.5;
    if (next && duration >= minimum && !this.soundChangeQueued) {
      if (!this.pendingSound || time > this.pendingSound.expires) {
        this.pendingSound = {kind: next, expires: time + 10};
      }
      this.soundChangeQueued = true;
    } else if (next && this.pendingSound?.kind === next) {
      this.pendingSound.expires = time + 10;
    }
  }

  private isQuiet(audio: AudioFrame) {
    return audio.rms < 0.08 && audio.intensity < 0.12;
  }

  private soundKinds(audio: AudioFrame): Kind[] {
    if (!audio.available) return [];
    if (this.isQuiet(audio)) return ['quiet'];
    const kinds: Kind[] = [];
    if (audio.beatConfidence >= 0.65 && audio.bpm >= 145) kinds.push('fast');
    if (audio.brightness >= 0.62 && audio.high >= 0.35) kinds.push('bright');
    if (audio.bass >= 0.64) kinds.push('bass');
    return kinds;
  }

  private clearSound() {
    this.soundTime = null;
    this.soundChange = null;
    this.pendingSound = null;
  }

  private pick(categories: Kind[]): Narration {
    for (const kind of categories) {
      const options = lines[kind].map((text, index) => ({text, id: `${kind}-${index}`, kind}))
        .filter(({id}) => !this.recent.includes(id));
      if (!options.length) continue;
      const selected = options[Math.floor(this.random() * options.length)];
      this.recent.push(selected.id);
      if (this.recent.length > RECENT_LIMIT) this.recent.shift();
      return selected;
    }
    // The surreal pool exceeds the recent-history limit.
    throw new Error('Narration pool exhausted');
  }

  private random(): number {
    this.randomState = (Math.imul(1664525, this.randomState) + 1013904223) >>> 0;
    return this.randomState / 4294967296;
  }

  private restartClock() {
    this.previousTime = -Infinity;
    this.held = null;
    this.holdUntil = this.nextAt = 0;
    this.pending = null;
    this.clearSound();
    this.gateNarrated = false;
    this.lastNarratedEnemy = null;
  }
}
