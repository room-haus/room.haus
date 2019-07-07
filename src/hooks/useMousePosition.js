import {useState, useEffect, useRef} from 'react';
import {throttle} from 'lodash';

const useMousePosition = (ref) => {
  const [position, setPosition] = useState({x: undefined, y: undefined});
  const element = useRef(ref);
  const mouseCallback = useRef(
    throttle((e) => {
      setPosition({
        x: e.pageX,
        y: e.pageY,
      });
    }, 100),
  );
  const touchCallback = useRef((e) => {
    setPosition({
      x: e.touches[0].pageX,
      y: e.touches[0].pageX,
    });
  });

  useEffect(() => {
    if (element.current) {
      element.current.addEventListener('mousemove', mouseCallback.current);
      element.current.addEventListener('touchstart', touchCallback.current);
      return () => {
        element.current.removeEventListener('mousemove', mouseCallback.current);
        element.current.removeEventListener('touchstart', touchCallback.current);
      };
    }
  });

  return position;
};

export default useMousePosition;
