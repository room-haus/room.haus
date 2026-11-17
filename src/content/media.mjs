/* global process -- Webpack substitutes the public media settings at build time. */
import defaults from './media-defaults.json' with {type: 'json'};

function mediaLocation(value) {
  const url = new URL(value);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.username || url.password || (url.protocol !== 'https:' && !(local && url.protocol === 'http:'))) {
    throw Error('Media requires HTTPS or a loopback preview URL');
  }
  return url;
}

export function mediaUrl(path, origin = process.env.ROOM_MEDIA_ORIGIN, sample = process.env.ROOM_MX029_AUDIO_URL) {
  if (typeof path !== 'string' || !/^(mixes|releases|assets)\//.test(path) || path.split('/').includes('..')) {
    throw Error('Expected a catalog media path: ' + path);
  }
  if (sample && path === defaults.mx029Audio) return mediaLocation(sample).href;
  const base = mediaLocation(origin || defaults.origin);
  if (base.search || base.hash) throw Error('Media origin must be a directory URL');
  if (!base.pathname.endsWith('/')) base.pathname += '/';
  return new URL(path, base).href;
}

export function withMedia(record) {
  return record.tracks
    ? {...record, tracks: record.tracks.map(track => ({...track, streamURL: mediaUrl(track.streamPath)}))}
    : {...record, audioSourceURL: mediaUrl(record.audioPath)};
}
