import {useEffect, useRef} from 'react';
import BabylonSceneManager from 'src/babylon/BabylonSceneManager';

export default (canvas) => {
  const {current: manager} = useRef(new BabylonSceneManager());

  useEffect(() => {
    console.log('Initializing manager', canvas.current);
    if (canvas.current) {
      manager.init(canvas.current);
    }
  }, [canvas]);

  return manager;
};
