import {streams, validateCatalog} from './catalog.mjs';

async function fetchMedia(url, headers = {}) {
  const response = await fetch(url, {
    headers: {Origin: 'https://room.haus', ...headers},
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw Error('HTTP ' + response.status + ' ' + url);
  const origin = response.headers.get('access-control-allow-origin');
  if (origin !== '*' && origin !== 'https://room.haus') throw Error('CORS blocks the player: ' + url);
  return response;
}

async function checkStream(url, depth = 0) {
  if (depth > 3) throw Error('Too many nested playlists');
  const lines = (await (await fetchMedia(url)).text()).trim().split(/\r?\n/);
  const entries = lines.filter((line) => line && !line.startsWith('#'));
  if (lines[0] !== '#EXTM3U' || !entries.length) throw Error('Invalid playlist: ' + url);
  if (lines.some((line) => line.startsWith('#EXT-X-STREAM-INF'))) {
    return checkStream(new URL(entries[0], url), depth + 1);
  }
  for (const entry of new Set([entries[0], entries.at(-1)])) {
    const segment = await fetchMedia(new URL(entry, url), {Range: 'bytes=0-31'});
    const reader = segment.body.getReader();
    try {
      if (!(await reader.read()).value?.length) throw Error('Empty media segment: ' + entry);
    } finally {
      await reader.cancel();
    }
  }
}

validateCatalog();
const pending = [...streams];
const errors = [];
async function worker() {
  while (pending.length) {
    const {url, name} = pending.shift();
    try {
      await checkStream(url);
    } catch (e) {
      errors.push(name + ': ' + e.message);
    }
  }
}
await Promise.all(Array.from({length: 5}, worker));
for (const err of errors) console.error(err);
console.log(
  streams.length - errors.length + '/' + streams.length + ' playlists with accessible first and last segments.',
);
if (errors.length) process.exitCode = 1;
