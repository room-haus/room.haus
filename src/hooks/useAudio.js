import {useState, useRef, useEffect} from 'react';
import HLSAudioSource from '../audio/HLSAudioSource';

export default (initParams) => {
  const [params, setParams] = useState(initParams);
  const [audio, setAudio] = useState();
  const cache = useRef(new Map());

  useEffect(() => {
    const {id, source} = params;
    if (!cache.has(id)) {
      cache.set(id, new HLSAudioSource(id));
    }
    setAudio(cache.get(id));
  }, [params]);

  return {audio, setParams};
};
