import React, {useContext, useState, useEffect} from 'react';
import HLSAudioSource from './HLSAudioSource';

const AudioContext = window.AudioContext || window.webkitAudioContext;

export const Context = React.createContext({
  audio: new HLSAudioSource(),
});

export default (props) => {
  const [state, setState] = useState(() => {
    const context = new AudioContext();
    const audio = new HLSAudioSource({
      onReady() {
        setState((prev) => ({
          ...prev,
          ready: true,
        }));
      },
    });
    audio.init(context);
    return {
      context,
      audio,
      ready: false,
    };
  });

  return <Context.Provider value={state} {...props} />;
};

export const useAudioContext = () => {
  return useContext(Context);
};
