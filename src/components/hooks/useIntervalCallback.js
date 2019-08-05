import {useRef, useCallback, useEffect} from 'react';

export default (fn, inputs = [], interval = 0) => {
  const mounted = useRef(true);
  const func = useCallback(() => {
    if (mounted.current && fn) {
      return fn();
    }
    return undefined;
  }, [...inputs, mounted.current, fn]);

  useEffect(() => {
    mounted.current = true;

    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (mounted.current) {
      const intervalId = setInterval(func, interval);
      return () => {
        clearInterval(intervalId);
      };
    }
  }, [mounted.current]);
};
