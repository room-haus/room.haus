import {useEffect, useRef} from 'react';
import BabylonSceneManager from 'src/babylon/BabylonSceneManager';

export default (canvas) => {
  const {current: manager} = useRef(new BabylonSceneManager());

  useEffect(() => {
    if (canvas.current) {
      manager.init(canvas.current);
    }
  }, [canvas]);

  return manager;
};
