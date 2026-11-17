import {readRoute, recordPath} from './navigation';

const keyFor = (record) => 'room.listening.v1.' + record.id;
const first = {trackIndex: 0, seconds: 0, shared: false};

function trackToken(track) {
  const path = track.streamPath || new URL(track.streamURL).pathname;
  return path.slice(path.lastIndexOf('/') + 1).replace(/\.m3u8$/i, '');
}

function findTrack(record, token) {
  if (token == null) return 0;
  const tracks = record.tracks || [];
  const match = tracks.findIndex((track) => trackToken(track) === token);
  if (match >= 0) return match;
  const number = Number(token);
  return /^\d+$/.test(token) && number >= 1 && number <= tracks.length ? number - 1 : -1;
}

export function linkedPosition(record, search) {
  const params = new URLSearchParams(search);
  if (!params.has('track') && !params.has('t')) return null;
  const time = params.get('t') ?? '0';
  const trackIndex = findTrack(record, params.get('track'));
  if (trackIndex < 0) return first;
  const seconds = /^\d+$/.test(time) && Number.isSafeInteger(Number(time)) ? Number(time) : 0;
  return {trackIndex, seconds, shared: true};
}

export function openingPosition(record, search) {
  const linked = linkedPosition(record, search);
  if (linked) return linked;
  try {
    const saved = JSON.parse(localStorage.getItem(keyFor(record)));
    const trackIndex = findTrack(record, saved?.track);
    if (trackIndex >= 0 && Number.isSafeInteger(saved?.seconds) && saved.seconds >= 0) {
      return {...first, trackIndex, seconds: saved.seconds};
    }
  } catch {
    // Local checkpoints are optional in browsers with restricted storage.
  }
  return first;
}

export function savePosition(record, trackIndex, seconds, entrySearch = location.search) {
  const url = new URL(location.href);
  let stored = true;
  try {
    if (trackIndex === 0 && seconds === 0) localStorage.removeItem(keyFor(record));
    else {
      const track = record.tracks ? trackToken(record.tracks[trackIndex]) : undefined;
      localStorage.setItem(keyFor(record), JSON.stringify({track, seconds}));
    }
  } catch {
    stored = false;
  }
  // A reset must survive refresh even when local checkpoints are unavailable.
  // Keep the selected release track in the URL if storage cannot remember it.
  if (!stored && seconds !== 0) return;
  // Once listening begins, a refresh resumes progress beyond the original link.
  if (url.searchParams.has('track') || url.searchParams.has('t') || (!stored && trackIndex > 0)) {
    if (url.search !== entrySearch || readRoute().record !== record) return;
    if (!stored && record.tracks && trackIndex > 0) url.searchParams.set('track', trackToken(record.tracks[trackIndex]));
    else url.searchParams.delete('track');
    url.searchParams.delete('t');
    history.replaceState(history.state, '', url);
  }
}

export function listeningLink(record, trackIndex, seconds) {
  const url = new URL(recordPath(record), location.origin);
  if (record.tracks) url.searchParams.set('track', trackToken(record.tracks[trackIndex]));
  url.searchParams.set('t', String(Math.floor(seconds)));
  return url.href;
}
