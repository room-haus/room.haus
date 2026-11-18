import type {AudioFrame, DirectorState, EncounterSnapshot, WorldResponse} from '../contracts.ts';
import {TEMPO_CONFIDENCE} from '../audio/TempoEstimator.ts';

const clamp = (value: number) => Math.max(0, Math.min(1, value));
const step = (value: number) => Math.round(clamp(value) * 5) / 5;

/** Map normalized analysis to perceptually distinct, bounded world controls. */
export function mapSignals(
  audio: AudioFrame, director: DirectorState, encounters: EncounterSnapshot,
  reducedMotion: boolean, motion: number,
): WorldResponse {
  const source = !audio.playing ? 'paused' : audio.available ? 'live' : 'cue';
  const live = source === 'live';
  const intensity = live ? step(audio.intensity) : 0;
  const attenuation = reducedMotion ? 0.25 : 1;
  const motionScale = reducedMotion ? 0 : clamp(motion);
  const cueMood = source === 'cue' ? step(director.atmosphere) : 0;
  const hasTempo = live && audio.beatConfidence >= TEMPO_CONFIDENCE && Number.isFinite(audio.bpm) && audio.bpm > 0;
  // Integrated phase follows estimated tempo. The estimator does not track beat onsets.
  const beats = hasTempo ? audio.tempoBeats ?? audio.time * audio.bpm / 60 : 0;
  const cadence = (Math.floor(beats * 2) % 2) * motionScale;
  const tempoStrength = hasTempo ? clamp((audio.beatConfidence - TEMPO_CONFIDENCE) / 0.2) * motionScale : 0;
  const pulseBeats = audio.bpm > 150 ? 2 : 1;
  const pulses = audio.tempoPulses ?? beats / pulseBeats;
  const tempoPulse = tempoStrength ? tempoStrength * Math.cos(2 * Math.PI * pulses) : 0;
  const tempoColor = tempoStrength ? tempoStrength * Math.sin(2 * Math.PI * beats / 8) : 0;
  return {
    source, intensity, cadence, tempoPulse, tempoColor,
    lantern: live ? step(audio.bass * 0.75 + audio.sub * 0.25) * attenuation : 0,
    runes: live ? step(audio.mid) * attenuation : 0,
    dust: live ? step(audio.high) * motionScale : 0,
    resonance: live ? step(audio.lowMid) * attenuation : 0,
    fog: (live ? step(audio.intensity * 0.8 + audio.brightness * 0.2) : cueMood) * attenuation,
    enemyEnergy: intensity * motionScale,
    reaction: clamp(encounters.reaction) * attenuation,
  };
}
