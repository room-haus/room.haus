// Native HLS in WebKit plays through its own audio output. Read a short window
// from the same VOD segment without connecting another source to the speakers.
import {TransportPacketStream, TransportParseStream, ElementaryStream} from 'mux.js/lib/m2ts/m2ts';

function readSegments(text, base) {
  // ROOM publishes complete VOD playlists with individually addressable TS files.
  if (!text.includes('#EXT-X-ENDLIST') || /#EXT-X-(BYTERANGE|KEY|MAP|STREAM-INF):/.test(text)) return [];
  const segments = [];
  let start = 0;
  let duration;
  for (const line of text.split(/\r?\n/).map(line => line.trim())) {
    if (line.startsWith('#EXTINF:')) duration = parseFloat(line.slice(8));
    else if (line && !line.startsWith('#') && Number.isFinite(duration) && duration > 0) {
      segments.push({start, end: start + duration, url: new URL(line, base).href});
      start += duration;
      duration = undefined;
    }
  }
  return segments;
}

function audioFrames(bytes) {
  const packets = new TransportPacketStream();
  const elementary = new ElementaryStream();
  packets.pipe(new TransportParseStream()).pipe(elementary);
  const chunks = [];
  elementary.on('data', ({type, data}) => {
    if (type === 'audio') chunks.push(data);
  });
  packets.push(bytes);
  packets.flush();
  const aac = new Uint8Array(chunks.reduce((size, chunk) => size + chunk.length, 0));
  let offset = 0;
  for (const chunk of chunks) {
    aac.set(chunk, offset);
    offset += chunk.length;
  }
  return aac.buffer;
}

export async function nativeWaveform(url, signal) {
  const response = await fetch(url, {signal});
  if (!response.ok) return;
  const segments = readSegments(await response.text(), response.url);
  if (!segments.length || signal.aborted) return;
  const decoder = new OfflineAudioContext(1, 1, 22050);
  const windows = new Map();
  let index = 0;
  signal.addEventListener('abort', () => {
    for (const entry of windows.values()) entry.request.abort();
    windows.clear();
  }, {once: true});
  const trace = new Uint8Array(2048);

  async function load(segment, entry) {
    const response = await fetch(segment.url, {signal: entry.request.signal});
    if (!response.ok) return;
    const bytes = new Uint8Array(await response.arrayBuffer());
    const decoded = await decoder.decodeAudioData(audioFrames(bytes));
    if (!entry.request.signal.aborted) entry.samples = decoded.getChannelData(0);
  }

  function windowAt(i) {
    if (!windows.has(i)) {
      const entry = {request: new AbortController()};
      windows.set(i, entry);
      // Missing visual data must never interrupt the native audio output.
      load(segments[i], entry).catch(() => {});
    }
    return windows.get(i);
  }

  return function read(time) {
    if (signal.aborted) return;
    let segment = segments[index];
    if (!segment || time < segment.start || time >= segment.end) {
      index = segments.findIndex(item => time >= item.start && time < item.end);
      for (const [i, entry] of windows) {
        if (i !== index) {
          entry.request.abort();
          windows.delete(i);
        }
      }
      segment = segments[index];
      if (!segment) return;
    }
    const {samples} = windowAt(index);
    if (segment.end - time < 1.5 && index + 1 < segments.length) windowAt(index + 1);
    if (!samples) return;
    const start = Math.floor((time - segment.start) * decoder.sampleRate);
    const count = Math.min(trace.length, samples.length - start);
    if (count < 2) return;
    for (let i = 0; i < count; i++) {
      trace[i] = 128 + 127 * Math.max(-1, Math.min(1, samples[start + i]));
    }
    return trace.subarray(0, count);
  };
}
