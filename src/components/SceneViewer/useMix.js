import {useEffect, useState} from 'react';
import {getMix} from 'src/mixes';

export default (mixId) => {
  const [mix, setMix] = useState(getMix(mixId));

  useEffect(() => {
    const mixMeta = mixId ? getMix(mixId) : undefined;
    setMix(mixMeta);
  }, [mixId]);

  return mix;
};
