import React, {lazy, Suspense, useCallback, useEffect, useRef, useState} from 'react';
import usePlayer from '../audio/usePlayer';
import SiteHeader from '../components/SiteHeader';
import ArtworkViewer from '../components/ArtworkViewer';
import {mixes} from '../content/mixes';
import {nextMix} from '../content/catalogDisplay.mjs';
import {openNextMix, recordPath} from './navigation';
import Transport from '../components/Transport';
import ErrorBoundary from '../components/ErrorBoundary';
import {listeningLink, openingPosition, savePosition} from './listeningPosition';

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
  const [position, setPosition] = useState(() => openingPosition(record));
  const {trackIndex} = position;
  const [reducedMotion, setReducedMotion] = useState(() => matchMedia(motionQuery).matches);
  const [scene, setScene] = useState(() => !matchMedia(motionQuery).matches);
  const [sceneFailed, setSceneFailed] = useState(false);
  const stage = useRef(null);
  const next = nextMix(mixes, record);
  const stream = record.tracks ? record.tracks[trackIndex].streamURL : record.audioSourceURL;
  const remember = useCallback((seconds) => savePosition(record, trackIndex, seconds), [record, trackIndex]);
  const player = usePlayer(stream, position.seconds, remember);
  const selectTrack = (index) => {
    if (index === trackIndex) return;
    savePosition(record, index, 0);
    setPosition({trackIndex: index, seconds: 0, shared: false});
  };
  const startOver = () => {
    savePosition(record, trackIndex, 0);
    setPosition({trackIndex, seconds: 0, shared: false});
  };
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
    <div className={record.slug ? 'player-page' : 'player-page mix-player'}>
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
        <div className="stage-tools" role="group" aria-label="Scene and artwork">
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
          <ArtworkViewer record={record} />
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
        selectTrack={selectTrack}
        shared={position.shared}
        startOver={startOver}
        getLink={() => listeningLink(record, trackIndex, player.audio.position())}
        reducedMotion={reducedMotion}
      />
      {next && (
        <a className="next-mix" href={recordPath(next)} rel="next" onClick={event => openNextMix(event, next)}>
          <span>Next mix</span><span>{next.id} · {next.artist} <span aria-hidden="true">→</span></span>
        </a>
      )}
    </div>
  );
}
