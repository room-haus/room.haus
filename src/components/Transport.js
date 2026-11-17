import React, {useEffect, useRef, useState} from 'react';
import LoadingLabel from './LoadingLabel';
import PlaybackScope from './PlaybackScope';

function timestamp(seconds) {
  const value = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
}

export function PlayIcon({playing}) {
  return (
    <svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true" fill="currentColor">
      {playing ? <path d="M5 4h5v16H5zm9 0h5v16h-5z" /> : <path d="M6 3.5v17L20 12z" />}
    </svg>
  );
}

export default function Transport({
  record,
  player,
  trackIndex,
  selectTrack,
  reducedMotion,
  shared,
  startOver,
  getLink,
  scene,
  selectMode,
  children,
}) {
  const [soundBarVisible, setSoundBarVisible] = useState(true);
  const [showTracks, setShowTracks] = useState(false);
  const [share, setShare] = useState(null);
  const options = useRef(null);
  const toggle = useRef(null);
  const [expanded, setExpanded] = useState(false);
  const closeOptions = () => {
    options.current.open = false;
    toggle.current.focus({preventScroll: true});
  };
  useEffect(() => {
    if (!expanded) return;
    const dismiss = (event) => {
      if (options.current && !options.current.contains(event.target)) options.current.open = false;
    };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [expanded]);
  const listButton = useRef(null);
  const shareButton = useRef(null);
  const linkField = useRef(null);
  const playButton = useRef(null);
  const {audio, time, duration, playing, status, error, seek} = player;
  const readyToSeek = duration > 0 && Number.isFinite(duration);
  const failed = status === 'error' || status === 'unavailable';
  useEffect(() => {
    if (failed) setSoundBarVisible(true);
  }, [failed]);
  const loading = status === 'loading';
  const unavailable = status === 'unavailable';
  const canPause = playing || loading;
  const action = unavailable ? 'Unavailable' : failed ? 'Retry' : canPause ? 'Pause' : 'Play';
  const tracks = record.tracks || [];
  const fallbackURL = record.soundcloud || record.purchaseLink;
  const selected = tracks[trackIndex];
  const copyLink = async () => {
    const url = getLink();
    const seconds = Number(new URL(url).searchParams.get('t'));
    try {
      await navigator.clipboard.writeText(url);
      setShare({copied: true, seconds});
    } catch {
      setShare({url});
    }
  };
  const closeLink = () => {
    setShare(null);
    shareButton.current?.focus();
  };
  useEffect(() => {
    if (share?.url) {
      linkField.current?.focus();
      linkField.current?.select();
    }
    if (!share?.copied) return;
    const timeout = setTimeout(() => setShare(null), 3500);
    return () => clearTimeout(timeout);
  }, [share]);
  const closeTracks = () => {
    setShowTracks(false);
    listButton.current?.focus();
  };
  useEffect(() => {
    if (!showTracks) return;
    document.querySelector('#release-tracks button[aria-pressed=true]')?.focus();
  }, [showTracks]);

  return (
    <section className="transport" aria-label="Audio player">
      <div id="sound-bar" className="sound-bar" hidden={!soundBarVisible}>
        <div className="transport-status" role="status">
          {failed && (
            <>
              <span>{error || 'Audio stream unavailable.'}</span>{' '}
              {fallbackURL && (
                <a href={fallbackURL}>{record.soundcloud ? 'Listen on SoundCloud' : 'Listen on Bandcamp'} ↗</a>
              )}
            </>
          )}
          {loading && <LoadingLabel>{playing ? 'Buffering audio…' : 'Loading audio…'}</LoadingLabel>}
        </div>
        {status === 'idle' && time > 0 && (
          <div className="opening-position">
            <span>
              {shared ? 'Shared' : 'Resume'} at {timestamp(time)}
            </span>
            <button
              onClick={() => {
                startOver();
                playButton.current?.focus();
              }}>
              Start over
            </button>
          </div>
        )}
        <div className="transport-row">
          <button
            ref={playButton}
            className="play-action"
            disabled={unavailable}
            title={action}
            aria-label={action}
            onClick={failed ? player.retry : canPause ? player.pause : player.play}>
            <PlayIcon playing={canPause} />
          </button>
          <div className="time-control">
            <div className="wave-seek" style={{'--played': `${readyToSeek ? 100 * Math.min(time / duration, 1) : 0}%`}}>
              <PlaybackScope audio={audio} active={soundBarVisible && playing && !reducedMotion} />
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
          </div>
        </div>
      </div>
      <div className="player-dock">
        <button
          className="sound-bar-toggle"
          aria-label={soundBarVisible ? 'Hide sound bar' : 'Show sound bar'}
          title={soundBarVisible ? 'Hide sound bar' : 'Show sound bar'}
          aria-expanded={soundBarVisible}
          aria-controls="sound-bar"
          onClick={() => setSoundBarVisible(!soundBarVisible)}>
          <svg
            viewBox="0 0 24 24"
            width="20"
            height="20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            aria-hidden="true">
            <path d="M3 10v4m4-8v12m5-16v20m5-16v12m4-8v4" />
          </svg>
        </button>
        <details
          className="player-options"
          ref={options}
          onToggle={(event) => {
            const open = event.currentTarget.open;
            setExpanded(open);
            if (!open) {
              setShowTracks(false);
              setShare(null);
            }
          }}
          onKeyDown={(event) => {
            if (event.key !== 'Escape' || !options.current.open || options.current.querySelector('dialog[open]'))
              return;
            event.preventDefault();
            if (share?.url) closeLink();
            else if (showTracks) closeTracks();
            else closeOptions();
          }}>
          <summary ref={toggle} aria-label="Options" title="Options">
            <svg
              viewBox="0 0 24 24"
              width="20"
              height="20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              aria-hidden="true">
              <path d="M3 6h8m4 0h6M3 12h2m4 0h12M3 18h12m4 0h2" />
              <circle cx="13" cy="6" r="2" />
              <circle cx="7" cy="12" r="2" />
              <circle cx="17" cy="18" r="2" />
            </svg>
          </summary>
          <div className="options-panel">
            <div className="track-meta">
              <img src={record.art} alt="" width="58" height="58" />
              <div>
                <span className="catalogue-code">{record.id}</span>
                <h1>{record.artist}</h1>
                {(selected || record.name) && <p>{selected?.name || record.name}</p>}
              </div>
            </div>
            <div className="clock">
              <span>{timestamp(time)}</span>
              <span>{readyToSeek ? timestamp(duration) : '–:––'}</span>
            </div>
            <div className="visual-modes" role="group" aria-label="Visual mode">
              {[true, false].map((enabled) => (
                <button
                  key={String(enabled)}
                  aria-pressed={scene === enabled}
                  onClick={() => {
                    selectMode(enabled);
                    closeOptions();
                  }}>
                  {enabled ? 'Scene' : 'Still art'}
                </button>
              ))}
            </div>
            <div className="transport-links">
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
              <button
                className="share-action"
                ref={shareButton}
                onClick={copyLink}
                aria-label="Share listening link"
                title="Copy a link at the current time">
                Share
              </button>
            </div>
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
                          setShare(null);
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
            <div className="option-actions">{children}</div>
            {share?.copied && <p role="status">Link copied at {timestamp(share.seconds)}.</p>}
            {share?.url && (
              <div className="share-fallback">
                <label htmlFor="listening-link">Copy this link</label>
                <input
                  ref={linkField}
                  id="listening-link"
                  aria-label="Listening link"
                  readOnly
                  value={share.url}
                  onFocus={(event) => event.target.select()}
                />
                <button onClick={closeLink}>Done</button>
              </div>
            )}
          </div>
        </details>
      </div>
    </section>
  );
}
