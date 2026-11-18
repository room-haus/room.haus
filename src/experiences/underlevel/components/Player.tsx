import {mix} from '../data/mx029';
import type {PlaybackSnapshot} from '../contracts';

export function elapsedTime(seconds: number) {
  const time = Math.max(0, Math.floor(seconds || 0));
  return `${Math.floor(time / 60)}:${String(time % 60).padStart(2, '0')}`;
}

interface PlayerProps {
  playback: PlaybackSnapshot;
  native: boolean;
  volume: number;
  onToggle: () => void;
  onSeek: (seconds: number) => void;
  onVolume: (volume: number) => void;
  nativeHost: React.Ref<HTMLDivElement>;
}

export function Player({playback, native, volume, onToggle, onSeek, onVolume, nativeHost}: PlayerProps) {
  const pending = playback.status === 'loading';
  const active = playback.playing || pending;

  return (
    <section className="ul-player" aria-label="Mix player">
      <div className="ul-record">
        <span className="ul-label">{mix.id} <span aria-hidden="true">/</span> {mix.artist}</span>
        <strong>{mix.title}</strong>
      </div>
      {native && <div className="ul-native" ref={nativeHost} />}
      {!native && (
        <div className="ul-timeline">
          <button className="ul-play" type="button" onClick={onToggle} aria-label={active ? 'Pause mix' : 'Play mix'}>
            <span aria-hidden="true">{active ? 'Pause' : 'Play'}</span>
          </button>
          <label className="ul-seek">
            <span className="ul-sr">Seek mix</span>
            <input type="range" min={0} max={playback.duration || 1} step="0.1"
              disabled={!playback.duration} value={Math.min(playback.time, playback.duration || 1)}
              aria-valuetext={elapsedTime(playback.time)} onChange={event => onSeek(event.currentTarget.valueAsNumber)} />
          </label>
          <span className="ul-time">{elapsedTime(playback.time)} / {playback.duration ? elapsedTime(playback.duration) : '-:--'}</span>
        </div>
      )}
      {!native && (
        <label className="ul-volume">
          <span className="ul-label">Volume</span>
          <input type="range" min={0} max={1} step="0.01" value={volume}
            aria-valuetext={`${Math.round(volume * 100)}%`} onChange={event => onVolume(event.currentTarget.valueAsNumber)} />
        </label>
      )}
    </section>
  );
}
