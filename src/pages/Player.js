import StillArt from '../components/StillArt';
import React, {lazy, Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState} from 'react';
import usePlayer from '../audio/usePlayer';
import MiniPlayer from '../components/MiniPlayer';
import ArtworkViewer from '../components/ArtworkViewer';
import {mixes} from '../content/mixes';
import {nextMix} from '../content/catalogDisplay.mjs';
import {openNextMix, recordPath, returnToArchive} from './navigation';
import Transport from '../components/Transport';
import ErrorBoundary from '../components/ErrorBoundary';
import {linkedPosition, listeningLink, openingPosition, savePosition} from './listeningPosition';

const ListeningScene = lazy(() => import(/* webpackChunkName: "listening-scene" */ '../components/ListeningScene'));
const motionQuery = '(prefers-reduced-motion: reduce)';

export default function Player({entry, visible, autoplay, activeAudio, onClose, onOpen}) {
  const {record, section} = entry;
  const [position, setPosition] = useState(() => ({...openingPosition(record, entry.search), autoplay}));
  const {trackIndex} = position;
  const lastEntry = useRef(entry);
  const stream = record.tracks ? record.tracks[trackIndex].streamURL : record.audioSourceURL;
  const remember = useCallback((seconds, updateURL) => {
    savePosition(record, trackIndex, seconds, updateURL ? lastEntry.current.search : null);
  }, [record, trackIndex]);
  const player = usePlayer(stream, position.seconds, remember, position.autoplay);

  useLayoutEffect(() => {
    activeAudio.current = {record, audio: player.audio};
    return () => { activeAudio.current = null; };
  }, [activeAudio, record, player.audio]);

  useLayoutEffect(() => {
    if (lastEntry.current === entry) return;
    lastEntry.current = entry;
    const linked = linkedPosition(record, entry.search);
    if (!linked) return;
    if (linked.trackIndex === trackIndex) {
      player.audio.seekLinkedPosition(linked.seconds);
      setPosition(previous => ({...previous, shared: linked.shared}));
    } else {
      const playing = ['playing', 'loading'].includes(player.audio.snapshot.status);
      setPosition({...linked, autoplay: playing});
    }
  }, [entry, player.audio, record, trackIndex]);

  const selectTrack = (index) => {
    if (index === trackIndex) return;
    player.pause();
    savePosition(record, index, 0);
    setPosition({trackIndex: index, seconds: 0, shared: false, autoplay: false});
  };
  const startOver = () => {
    savePosition(record, trackIndex, 0);
    // Keep the audio object attached to the live scene. The opening time only seeds that object.
    player.seek(0);
    setPosition(previous => ({...previous, shared: false}));
  };

  if (!visible) {
    return ['idle', 'unavailable'].includes(player.status) ? null : (
      <MiniPlayer record={record} trackIndex={trackIndex} player={player} onClose={onClose} onOpen={onOpen} />
    );
  }

  return (
    <ListeningRoom
      record={record}
      section={section}
      player={player}
      position={position}
      selectTrack={selectTrack}
      startOver={startOver}
    />
  );
}

function ListeningRoom({record, section, player, position, selectTrack, startOver}) {
  const {trackIndex} = position;
  const [scene, setScene] = useState(() => !matchMedia(motionQuery).matches);
  const [sceneFailed, setSceneFailed] = useState(false);
  const stage = useRef(null);
  const next = nextMix(mixes, record);
  const sceneError = useCallback(() => {
    setSceneFailed(true);
    setScene(false);
  }, []);
  useEffect(() => {
    stage.current?.focus({preventScroll: true});
    const media = matchMedia(motionQuery);
    const change = (event) => {
      if (event.matches) setScene(false);
    };
    media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, []);

  return (
    <div className="player-page">
      <main
        className="listening-stage"
        ref={stage}
        tabIndex="-1"
        aria-label={`${record.id}, ${record.artist} listening room`}>
        <div className="stage-visual">
          {scene ? (
            <ErrorBoundary onError={sceneError}>
              <Suspense fallback={<StillArt record={record} pending="Loading scene…" />}>
                <ListeningScene record={record} audio={player.audio} onError={sceneError} />
              </Suspense>
            </ErrorBoundary>
          ) : (
            <StillArt record={record} />
          )}
        </div>
        {sceneFailed && (
          <p role="status" className="scene-failure">
            Scene unavailable. Showing artwork.
          </p>
        )}
      </main>
      <a
        className="scene-back"
        href={history.state?.fromArchive?.url || '/' + section + '/'}
        aria-label={`Back to ${section}`}
        title={`Back to ${section}`}
        onClick={(event) => returnToArchive(event, section)}>
        <svg
          viewBox="0 0 24 24"
          width="20"
          height="20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden="true">
          <path d="m14 5-7 7 7 7M7 12h14" />
        </svg>
      </a>
      <Transport
        record={record}
        player={player}
        trackIndex={trackIndex}
        selectTrack={selectTrack}
        shared={position.shared}
        startOver={startOver}
        getLink={() => listeningLink(record, trackIndex, player.audio.position())}
        scene={scene}
        selectMode={(enabled) => {
          setSceneFailed(false);
          setScene(enabled);
        }}>
        <ArtworkViewer record={record} />
        {next && (
          <a className="next-mix" href={recordPath(next)} rel="next" onClick={(event) => openNextMix(event, next)}>
            <span>Next mix</span>
            <span>
              {next.id} · {next.artist} <span aria-hidden="true">→</span>
            </span>
          </a>
        )}
      </Transport>
    </div>
  );
}
