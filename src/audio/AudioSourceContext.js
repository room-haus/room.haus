import React, {useContext, useState, useEffect} from 'react';
import HLSAudioSource from './HLSAudioSource';

const AudioContext = window.AudioContext || window.webkitAudioContext;

export const Context = React.createContext({
  audio: new HLSAudioSource(),
});

export default ({children}) => {
  const [state, setState] = useState(() => {
    const context = new AudioContext();
    const audio = new HLSAudioSource();
    audio.init(context);
    return {
      context,
      audio,
      ready: false,
    };
  });

  useEffect(() => {
    const {audio} = state;
    document.addEventListener(
      'click',
      () => {
        audio.resume();
        setState((prev) => ({
          ...prev,
          ready: true,
        }));
      },
      {once: true},
    );
  }, []);
  return <Context.Provider value={state}>{children}</Context.Provider>;
};

export const useAudioContext = () => {
  return useContext(Context);
};
