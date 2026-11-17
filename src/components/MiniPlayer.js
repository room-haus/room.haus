import React from 'react';
import {createPortal} from 'react-dom';
import {recordPath} from '../pages/navigation';
import {PlayIcon} from './Transport';
import WaveformSeek, {PlaybackClock} from './WaveformSeek';

export default function MiniPlayer({record, trackIndex, player, onClose, onOpen}) {
  const {status, playing, error} = player;
  const loading = status === 'loading';
  const failed = status === 'error';
  const canPause = playing || loading;
  const action = failed ? 'Retry' : canPause ? 'Pause' : 'Play';
  const track = record.tracks?.[trackIndex]?.name || record.name;
  return createPortal(
    <section className="mini-player" aria-label="Listening player">
      <div className="mini-player-record">
        <a
          href={recordPath(record)}
          onClick={onOpen}
          title={`${record.id} · ${record.artist}${track ? ' · ' + track : ''}`}
          aria-label={`Return to ${record.id}, ${record.artist}${track ? ', ' + track : ''}`}>
          <img src={record.art} alt="" width="44" height="44" />
          <span className="mini-player-meta">
            <span><span className="mini-player-code">{record.id}</span> {record.artist}</span>
            {track && <span className="mini-player-track">{track}</span>}
          </span>
        </a>
      </div>
      <div className="mini-player-playback">
        <WaveformSeek player={player} />
        <div className="mini-player-playback-info">
          <span className="mini-player-compact-title" title={track || record.artist}>{track || record.artist}</span>
          <PlaybackClock time={player.time} duration={player.duration} />
        </div>
        <span className="mini-player-status" role="status">
          {failed ? error : loading ? (playing ? 'Buffering audio…' : 'Loading audio…') : ''}
        </span>
      </div>
      <button
        type="button"
        aria-label={action}
        title={action}
        onClick={failed ? player.retry : canPause ? player.pause : player.play}>
        {failed ? (
          <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <path d="M20 4v6h-6m6-.3a8 8 0 1 0-.3 5.3" />
          </svg>
        ) : <PlayIcon playing={canPause} />}
      </button>
      <button type="button" aria-label="Close player" title="Close player" onClick={onClose}>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <path d="m6 6 12 12M18 6 6 18" />
        </svg>
      </button>
    </section>,
    document.querySelector('.room-shell'),
  );
}
