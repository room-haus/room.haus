import type {ToyFrame} from '../shared/contracts.ts';
export function mapAudio(frame: ToyFrame): {
  speed: number;
  compression: number;
  onset: boolean;
  warmth: number;
  seam: number;
} {
  const unit = (v: number) => (Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0);
  const live = frame.source === 'live' && frame.features.available && frame.features.playing;
  const gentle = frame.reducedMotion || frame.motion < 0.5;
  return {
    speed: gentle ? 0.6 : live ? 1.2 + 1.2 * unit(frame.features.intensity) : 1.5,
    compression: gentle ? 0 : live ? 0.05 * unit(frame.features.bass) : 0,
    onset: !gentle && live && unit(frame.features.onset) > 0.35,
    warmth: live ? unit(frame.features.brightness) : 0.3,
    seam: live ? 0.15 * unit(frame.features.high) : 0.03,
  };
}
