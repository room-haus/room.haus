import {useEffect, useMemo, useReducer} from 'react';
import HLSAudioSource from './HLSAudioSource';

export default function usePlayer(streamURL, startTime, onPosition) {
  const audio = useMemo(() => new HLSAudioSource(streamURL, startTime), [streamURL, startTime]);
  const [, refresh] = useReducer((n) => n + 1, 0);
  useEffect(() => {
    let lastSecond;
    const save = () => {
      const {status, duration} = audio.snapshot;
      if (!audio.media || !duration || !['playing', 'paused', 'ended'].includes(status)) return;
      const seconds = status === 'ended' || audio.media.ended ? 0 : Math.floor(audio.position());
      if (seconds === lastSecond) return;
      lastSecond = seconds;
      onPosition(seconds);
    };
    audio.notify = () => {
      save();
      refresh();
    };
    window.addEventListener('pagehide', save);
    return () => {
      window.removeEventListener('pagehide', save);
      audio.dispose();
    };
  }, [audio, onPosition]);
  const controls = useMemo(() => ({
    play: () => audio.play(),
    pause: () => audio.pause(),
    seek: (seconds) => audio.seek(seconds),
    retry: () => audio.play(),
  }), [audio]);
  return {audio, ...audio.snapshot, ...controls};
}
