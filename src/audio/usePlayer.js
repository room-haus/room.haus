import {useLayoutEffect, useMemo, useReducer} from 'react';
import HLSAudioSource from './HLSAudioSource';

export default function usePlayer(streamURL, startTime, onPosition, autoplay) {
  const audio = useMemo(() => new HLSAudioSource(streamURL, startTime), [streamURL, startTime]);
  const [, refresh] = useReducer((n) => n + 1, 0);
  useLayoutEffect(() => {
    let lastSecond;
    const save = (updateURL = true) => {
      const {status, duration} = audio.snapshot;
      if (!audio.media || !duration || !['playing', 'paused', 'ended'].includes(status)) return;
      const seconds = status === 'ended' || audio.media.ended ? 0 : Math.floor(audio.position());
      if (seconds === lastSecond) return;
      lastSecond = seconds;
      onPosition(seconds, updateURL);
    };
    audio.notify = () => {
      save();
      refresh();
    };
    const saveOnPageHide = () => save();
    window.addEventListener('pagehide', saveOnPageHide);
    if (autoplay) audio.play();
    return () => {
      window.removeEventListener('pagehide', saveOnPageHide);
      save(false);
      audio.dispose();
    };
  }, [audio, onPosition, autoplay]);
  const controls = useMemo(() => ({
    play: () => audio.play(),
    pause: () => audio.pause(),
    seek: (seconds) => audio.seek(seconds),
    retry: () => audio.play(),
  }), [audio]);
  return {audio, ...audio.snapshot, ...controls};
}
