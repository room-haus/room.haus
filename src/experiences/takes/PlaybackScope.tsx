import React, {createContext, useCallback, useContext, useEffect, useMemo, useRef} from 'react';

type Stop = () => void;
const Owners = createContext<React.RefObject<Stop | null> | null>(null);

export function PlaybackScope({children}: {children: React.ReactNode}) {
  return <Owners.Provider value={useRef<Stop | null>(null)}>{children}</Owners.Provider>;
}

// The listener, editor and prepared review may coexist on one page.
// Claiming the output synchronously releases the previous transport.
export function usePlaybackOwner() {
  const scope = useContext(Owners);
  const own = useRef<Stop | null>(null);
  const release = useCallback(() => {
    if (scope && scope.current === own.current) scope.current = null;
    own.current = null;
  }, [scope]);
  useEffect(() => release, [release]);
  return useMemo(
    () => ({
      release,
      claim(stop: Stop) {
        scope?.current?.();
        own.current = stop;
        if (scope) scope.current = stop;
      },
    }),
    [release, scope],
  );
}
