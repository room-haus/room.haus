import React, {useContext, useState} from 'react';
import HLSAudioSource from './HLSAudioSource';

export const Context = React.createContext({
  audio: new HLSAudioSource(),
});

export default ({children}) => {
  const [state] = useState(() => {
    const context = new AudioContext();
    const audio = new HLSAudioSource();
    audio.init(context);
    return {
      context,
      audio,
    };
  });
  return <Context.Provider value={state}>{children}</Context.Provider>;
};

export const useAudioContext = () => {
  return useContext(Context);
};
