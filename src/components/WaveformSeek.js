import React, {useEffect, useState} from 'react';
import PlaybackScope from './PlaybackScope';

const motionQuery = '(prefers-reduced-motion: reduce)';
const hasDuration = (duration) => duration > 0 && Number.isFinite(duration);

export function timestamp(seconds) {
  const value = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
}

export function PlaybackClock({time, duration}) {
  return (
    <div className="clock">
      <span>{timestamp(time)}</span>
      <span>{hasDuration(duration) ? timestamp(duration) : '–:––'}</span>
    </div>
  );
}

export default function WaveformSeek({player, visible = true, showTime = false}) {
  const {audio, time, duration, playing, seek} = player;
  const readyToSeek = hasDuration(duration);
  const [reducedMotion, setReducedMotion] = useState(() => matchMedia(motionQuery).matches);
  useEffect(() => {
    const media = matchMedia(motionQuery);
    const change = (event) => setReducedMotion(event.matches);
    media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, []);

  return (
    <div className="time-control">
      <div className="wave-seek" style={{'--played': `${readyToSeek ? 100 * Math.min(time / duration, 1) : 0}%`}}>
        <PlaybackScope audio={audio} active={visible && playing && !reducedMotion} />
        <input
          type="range"
          className="seek"
          aria-label="Seek playback"
          disabled={!readyToSeek}
          min="0"
          max={readyToSeek ? duration : 0}
          value={readyToSeek ? Math.min(time, duration) : 0}
          step="1"
          aria-valuetext={`${timestamp(time)} of ${readyToSeek ? timestamp(duration) : 'unknown duration'}`}
          onChange={(event) => seek(Number(event.target.value))}
        />
      </div>
      {showTime && <PlaybackClock time={time} duration={duration} />}
    </div>
  );
}
