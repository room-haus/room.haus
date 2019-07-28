import {useLayoutEffect, useState, useCallback} from 'react';

export default (ref) => {
  const [hovering, setHovering] = useState(false);
  const mouseEnter = useCallback(() => setHovering(true));
  const mouseLeave = useCallback(() => setHovering(false));

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }

    element.addEventListener('mouseenter', mouseEnter);
    element.addEventListener('mouseleave', mouseLeave);

    return () => {
      element.removeEventListener('mouseenter', mouseEnter);
      element.removeEventListener('mouseleave', mouseLeave);
    };
  }, [ref.current]);

  return hovering;
};
