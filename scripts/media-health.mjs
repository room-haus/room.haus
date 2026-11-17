async function fetchMedia(url, headers = {}) {
  const response = await fetch(url, {
    headers: {Origin: 'https://room.haus', ...headers}, signal: AbortSignal.timeout(20000),
  });
  const origin = response.headers.get('access-control-allow-origin');
  if (!response.ok || (origin !== '*' && origin !== 'https://room.haus')) {
    await response.body?.cancel();
    throw Error(!response.ok ? 'HTTP ' + response.status + ' ' + url : 'CORS blocks the player: ' + url);
  }
  return response;
}

async function checkBytes(url, mp4 = false) {
  const response = await fetchMedia(url, {Range: 'bytes=0-31'});
  const reader = response.body.getReader();
  try {
    let bytes = new Uint8Array();
    while (bytes.length < (mp4 ? 8 : 1)) {
      const {value, done} = await reader.read();
      if (done) break;
      bytes = Buffer.concat([bytes, value]);
    }
    if (!bytes.length) throw Error('Empty media segment: ' + url);
    // Some legacy hosts supply the wrong MIME type: verify the MP4 container itself.
    if (mp4 && Buffer.from(bytes).toString('ascii', 4, 8) !== 'ftyp') throw Error('Not an MP4 container: ' + url);
  } finally { await reader.cancel(); }
}

async function checkStream(url, depth = 0) {
  if (depth > 3) throw Error('Too many nested playlists');
  const lines = (await (await fetchMedia(url)).text()).trim().split(/\r?\n/).map(line => line.trim());
  const entries = lines.filter(line => line && !line.startsWith('#'));
  if (lines[0] !== '#EXTM3U' || !entries.length) throw Error('Invalid playlist: ' + url);
  if (lines.some(line => line.startsWith('#EXT-X-STREAM-INF'))) {
    for (const entry of new Set(entries)) await checkStream(new URL(entry, url), depth + 1);
  } else {
    for (const entry of new Set([entries[0], entries.at(-1)])) await checkBytes(new URL(entry, url));
  }
}

export async function checkMedia(entries) {
  const pending = [...entries];
  const errors = [];
  async function worker() {
    while (pending.length) {
      const {url, name} = pending.shift();
      try {
        if (new URL(url).pathname.endsWith('.mp4')) await checkBytes(url, true);
        else await checkStream(url);
      } catch (error) { errors.push(name + ': ' + error.message); }
    }
  }
  await Promise.all(Array.from({length: 5}, worker));
  return errors.sort();
}
