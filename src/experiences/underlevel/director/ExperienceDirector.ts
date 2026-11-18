import type {AudioFrame, Cue, DirectorState, Dungeon, Pose, WorldEvent} from '../contracts.ts';
import {cues, mix} from '../data/mx029.ts';

const clamp = (n: number) => Math.max(0, Math.min(1, n));
const ease = (n: number) => { const t = clamp(n); return t * t * (3 - 2 * t); };
const eventType = (cue: Cue): WorldEvent['type'] => cue.id === 'gate' ? 'open-gate' : cue.id === 'hall' ? 'reveal-room' : cue.id === 'transmitter' ? 'artifact-awaken' : 'change-atmosphere';

/** Semantic state is reconstructible from media time; no historical event backlog. */
export class ExperienceDirector {
  private previousTime: number | null = null;
  private timeline: Cue[];
  private duration: number;
  constructor(timeline: Cue[] = cues, duration = mix.cycleDuration) {
    this.timeline = [...timeline].sort((a,b) => a.time-b.time);
    this.duration = duration;
  }
  update(audio: AudioFrame): DirectorState {
    const time = Math.max(0, Number.isFinite(audio.time) ? audio.time : 0);
    const cycle = Math.floor(time / this.duration);
    const local = time % this.duration;
    const cue = this.timeline.filter(c => c.time <= local).at(-1) || this.timeline[0];
    const events: WorldEvent[] = [];
    // Discontinuities (seek, background jump) reconstruct state rather than firing
    // every missed cue. Normal forward crossings fire once with cycle-specific IDs.
    if (audio.playing && this.previousTime !== null && time > this.previousTime && time-this.previousTime < 1) {
      for (const item of this.timeline) {
        const absolute = cycle*this.duration + item.time;
        if (absolute > this.previousTime && absolute <= time) events.push({id:`${mix.id}:${cycle}:${item.id}`,time:absolute,type:eventType(item),magnitude:item.intensity});
      }
    }
    this.previousTime = time;
    const gateCue = this.timeline.find(c => c.id === 'gate')?.time ?? 56;
    const hallCue = this.timeline.find(c => c.id === 'hall')?.time ?? 62;
    return {
      time, cycleTime:local, chapter:cue.chapter, gateOpen:ease((local-gateCue)/2),
      reveal:ease((local-hallCue)/8), artifact:ease((local-34)/8),
      // Interpreted mood: sustained intensity and spectral brightness, bounded;
      // this is deliberately separate from semantic architectural progression.
      atmosphere:clamp(cue.intensity*.35 + audio.intensity*.45 + audio.brightness*.2),
      palette:local >= hallCue && local < (this.timeline.find(c => c.id === 'afterimage')?.time ?? 118) ? 'violet' : 'ember', events,
    };
  }
}

/** A seek may close an authored door, but never through a visitor holding STILL. */
export function resolveGateClearance(state: DirectorState, pose: Pose, world: Dungeon): DirectorState {
  const nearGate = Math.abs(pose.x-world.gate.x*world.tileSize) < world.tileSize*.5 &&
    Math.abs(pose.z-world.gate.z*world.tileSize) < world.tileSize*.55;
  return nearGate && state.gateOpen < 1 ? {...state, gateOpen:1} : state;
}
