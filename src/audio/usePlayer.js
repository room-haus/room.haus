import {useEffect, useMemo, useReducer} from 'react';
import HLSAudioSource from './HLSAudioSource';

export default function usePlayer(streamURL) {
  const audio = useMemo(() => new HLSAudioSource(streamURL), [streamURL]);
  const [, refresh] = useReducer((n) => n + 1, 0);
  useEffect(() => {
    audio.notify = refresh;
    return () => audio.dispose();
  }, [audio]);
  const controls = useMemo(() => ({
    play: () => audio.play(),
    pause: () => audio.pause(),
    seek: (seconds) => audio.seek(seconds),
    retry: () => audio.play(),
  }), [audio]);
  return {audio, ...audio.snapshot, ...controls};
}
