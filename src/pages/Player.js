import React, {lazy, Suspense, useCallback, useEffect, useRef, useState} from 'react';
import usePlayer from '../audio/usePlayer';
import SiteHeader from '../components/SiteHeader';
import Transport from '../components/Transport';
import ErrorBoundary from '../components/ErrorBoundary';

const ListeningScene = lazy(() => import(/* webpackChunkName: "listening-scene" */ '../components/ListeningScene'));
const motionQuery = '(prefers-reduced-motion: reduce)';

function StillArt({record}) {
  return (
    <div className="still-stage" aria-label={`Artwork for ${record.artist}, ${record.id}`}>
      <div className="still-object">
        <div className="compact-disc" aria-hidden="true">
          {record.label && <img src={record.label} alt="" />}
        </div>
        <img className="still-cover" src={record.art} width="500" height="500" alt={`${record.id} cover`} />
      </div>
    </div>
  );
}

export default function Player({record, section}) {
  const [trackIndex, setTrackIndex] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(() => matchMedia(motionQuery).matches);
  const [scene, setScene] = useState(() => !matchMedia(motionQuery).matches);
  const [sceneFailed, setSceneFailed] = useState(false);
  const stage = useRef(null);
  const stream = record.tracks ? record.tracks[trackIndex].streamURL : record.audioSourceURL;
  const player = usePlayer(stream);
  const sceneError = useCallback(() => {
    setSceneFailed(true);
    setScene(false);
  }, []);
  useEffect(() => {
    stage.current?.focus({preventScroll: true});
    const media = matchMedia(motionQuery);
    const change = (event) => {
      setReducedMotion(event.matches);
      if (event.matches) setScene(false);
    };
    media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, []);

  return (
    <div className="player-page">
      <SiteHeader section={section} listening />
      <main
        className="listening-stage"
        ref={stage}
        tabIndex="-1"
        aria-label={`${record.id}, ${record.artist} listening room`}
      >
        <div className="stage-visual">
          {scene ? (
            <ErrorBoundary onError={sceneError}>
              <Suspense fallback={<StillArt record={record} />}>
                <ListeningScene record={record} audio={player.audio} onError={sceneError} />
              </Suspense>
            </ErrorBoundary>
          ) : (
            <StillArt record={record} />
          )}
        </div>
        <div className="stage-tools" role="group" aria-label="Visual mode">
          <button
            aria-pressed={scene}
            onClick={() => {
              setSceneFailed(false);
              setScene(true);
            }}
          >
            Scene
          </button>
          <button aria-pressed={!scene} onClick={() => setScene(false)}>
            Still art
          </button>
        </div>
        {sceneFailed && (
          <p role="status" className="scene-failure">
            Scene unavailable. Showing artwork.
          </p>
        )}
      </main>
      <Transport
        record={record}
        player={player}
        trackIndex={trackIndex}
        selectTrack={setTrackIndex}
        reducedMotion={reducedMotion}
      />
    </div>
  );
}
