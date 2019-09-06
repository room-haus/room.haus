import {useEffect, useState, useCallback} from 'react';

export default () => {
  const [mode, setMode] = useState('mouse');
  const touchCallback = useCallback(() => {
    setMode('touch');
  });

  useEffect(() => {
    document.addEventListener('touchstart', touchCallback);

    return () => {
      document.removeEventListener('touchstart', touchCallback);
    };
  }, []);

  return mode;
};
