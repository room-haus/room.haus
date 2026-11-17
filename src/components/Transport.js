import React, {useEffect, useRef, useState} from 'react';
import PlaybackScope from './PlaybackScope';

function timestamp(seconds) {
  const value = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
}

function PlayIcon({playing}) {
  return (
    <svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true" fill="currentColor">
      {playing ? <path d="M5 4h5v16H5zm9 0h5v16h-5z" /> : <path d="M6 3.5v17L20 12z" />}
    </svg>
  );
}

export default function Transport({record, player, trackIndex, selectTrack, reducedMotion}) {
  const [showTracks, setShowTracks] = useState(false);
  const listButton = useRef(null);
  const {audio, time, duration, playing, status, error, seek} = player;
  const readyToSeek = duration > 0 && Number.isFinite(duration);
  const failed = status === 'error' || status === 'unavailable';
  const loading = status === 'loading';
  const unavailable = status === 'unavailable';
  const canPause = playing || loading;
  const action = unavailable ? 'Unavailable' : failed ? 'Retry' : canPause ? 'Pause' : 'Play';
  const tracks = record.tracks || [];
  const fallbackURL = record.soundcloud || record.purchaseLink;
  const selected = tracks[trackIndex];
  const closeTracks = () => {
    setShowTracks(false);
    listButton.current?.focus();
  };
  useEffect(() => {
    if (!showTracks) return;
    document.querySelector('#release-tracks button[aria-pressed=true]')?.focus();
    const keydown = (event) => {
      if (event.key === 'Escape') closeTracks();
    };
    document.addEventListener('keydown', keydown);
    return () => document.removeEventListener('keydown', keydown);
  }, [showTracks]);

  return (
    <section className="transport" aria-label="Audio player">
      {showTracks && (
        <section className="tracks-panel" id="release-tracks" aria-label="Tracklist">
          <div className="tracks-heading">
            <h2>Tracklist</h2>
            <button onClick={closeTracks} aria-label="Close tracklist">
              ×
            </button>
          </div>
          <ol>
            {tracks.map((track, index) => (
              <li key={track.streamURL}>
                <button
                  aria-pressed={trackIndex === index}
                  onClick={() => {
                    selectTrack(index);
                    closeTracks();
                  }}>
                  <span className="track-index">{String(index + 1).padStart(2, '0')}</span>
                  <span>{track.name}</span>
                  {index === trackIndex && <span className="selected-track">Selected</span>}
                </button>
              </li>
            ))}
          </ol>
          {record.purchaseLink && (
            <a className="release-purchase" href={record.purchaseLink}>
              {record.name} on Bandcamp <span aria-hidden="true">↗</span>
            </a>
          )}
        </section>
      )}
      <div className="transport-status" role="status">
        {failed && (
          <>
            <span>{error || 'Audio stream unavailable.'}</span>{' '}
            {fallbackURL && (
              <a href={fallbackURL}>{record.soundcloud ? 'Listen on SoundCloud' : 'Listen on Bandcamp'} ↗</a>
            )}
          </>
        )}
        {loading && <span>Loading audio…</span>}
      </div>
      <div className="transport-row">
        <div className="track-meta">
          <img src={record.art} alt="" width="58" height="58" />
          <div>
            <span className="catalogue-code">{record.id}</span>
            <h1>{record.artist}</h1>
            {(selected || record.name) && <p>{selected?.name || record.name}</p>}
          </div>
        </div>
        <button
          className="play-action"
          disabled={unavailable}
          aria-label={action}
          onClick={failed ? player.retry : canPause ? player.pause : player.play}>
          <PlayIcon playing={canPause} />
          <span>{action}</span>
        </button>
        <div className="time-control">
          <div className="wave-seek">
            <PlaybackScope audio={audio} active={playing && !reducedMotion} />
            <input
              type="range"
              className="seek"
              aria-label="Seek playback"
              disabled={!readyToSeek}
              min="0"
              max={readyToSeek ? duration : 0}
              value={readyToSeek ? Math.min(time, duration) : 0}
              step="1"
              aria-valuetext={`${timestamp(time)} of ${readyToSeek ? timestamp(duration) : 'unknown duration'}`}
              onChange={(event) => seek(Number(event.target.value))}
            />
          </div>
          <div className="clock">
            <span>{timestamp(time)}</span>
            <span>{readyToSeek ? timestamp(duration) : '–:––'}</span>
          </div>
        </div>
        {tracks.length > 0 ? (
          <button
            ref={listButton}
            className="tracks-action"
            aria-expanded={showTracks}
            aria-controls="release-tracks"
            onClick={() => setShowTracks(!showTracks)}>
            Tracklist <span>{String(tracks.length).padStart(2, '0')}</span>
          </button>
        ) : (
          fallbackURL && (
            <a className="external-listen" href={fallbackURL}>
              SoundCloud <span aria-hidden="true">↗</span>
            </a>
          )
        )}
      </div>
    </section>
  );
}
