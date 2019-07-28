import React, {useEffect, useState, useContext} from 'react';
import {getMix} from 'src/mixes';

export const Context = React.createContext({meta: {}});

export default ({children}) => {
  const [mixId, setMixId] = useState();
  const [state, setState] = useState({
    setMixId,
    meta: {},
  });
  useEffect(() => {
    if (mixId) {
      setState((prev) => ({...prev, meta: getMix(mixId)}));
    }
  }, [mixId]);
  return <Context.Provider value={state}>{children}</Context.Provider>;
};

export const useMixMetaContext = () => {
  return useContext(Context);
};
