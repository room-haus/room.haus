import {Buffer} from 'node:buffer';
import {TakeError} from './repository.mjs';

const maxBodyBytes = 64 * 1024;
async function readJson(req) {
  if (req.headers['content-type']?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    throw new TakeError(415, 'Send a JSON recipe or publication request.');
  }
  const oversized = () => new TakeError(413, 'The request exceeds the size limit.');
  if (Number(req.headers['content-length']) > maxBodyBytes) throw oversized();
  const chunks = [];
  let size = 0;
  for await (const chunk of req.iterator({destroyOnReturn: false})) {
    size += chunk.length;
    if (size > maxBodyBytes) {
      req.resume();
      throw oversized();
    }
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new TakeError(400, 'Invalid JSON request.');
  }
}

function selection(query) {
  const frame = name => {
    const value = query.get(name);
    if (value === null || !/^\d+$/.test(value)) throw new RangeError('Invalid passage frame.');
    return Number(value);
  };
  return {sourceId: query.get('sourceId'), revision: query.get('revision'), startFrame: frame('startFrame'), endFrame: frame('endFrame')};
}

export function takeHandler(repository, {now = () => performance.now()} = {}) {
  // One local service process shares this rolling window across anonymous writes.
  const recentWrites = [];
  let active = 0;
  return async (req, res, url) => {
    const send = (status, value, binary = false) => {
      const body = binary ? value : JSON.stringify(value);
      res.writeHead(status, {
        'Content-Type': binary ? 'application/octet-stream' : 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(body),
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      }).end(body);
    };
    if (active >= 4) return send(429, {error: 'Service is busy. Try again shortly.'});
    active++;
    try {
      const path = url.pathname;
      if (req.method === 'GET') {
        if (path === '/v1/catalog') return send(200, repository.catalog);
        if (path === '/v1/passage') return send(200, (await repository.passage(selection(url.searchParams))).pcm, true);
        const asset = /^\/v1\/(preparations|takes)\/([a-f0-9]{32})\/(dry|take)$/.exec(path);
        if (asset) return send(200, await repository.audio(asset[1], asset[2], asset[3]), true);
        const fragment = /^\/v1\/(preparations|takes)\/([a-f0-9]{32})\/fragments\/([a-f0-9]{64})$/.exec(path);
        if (fragment) return send(200, await repository.fragment(fragment[1], fragment[2], fragment[3]), true);
        const manifest = /^\/v1\/takes\/([a-f0-9]{32})$/.exec(path);
        if (manifest) return send(200, await repository.take(manifest[1]));
      } else if (req.method === 'POST') {
        const time = now();
        while (recentWrites.length && recentWrites[0] <= time - 60_000) recentWrites.shift();
        if (recentWrites.length >= 60) return send(429, {error: 'Write limit reached. Try again in a minute.'});
        recentWrites.push(time);
        if (path === '/v1/preparations') return send(201, await repository.prepare(await readJson(req)));
        if (path === '/v1/takes') return send(200, await repository.publish(await readJson(req)));
      } else {
        return send(405, {error: 'Method unavailable.'});
      }
      send(404, {error: 'Resource unavailable.'});
    } catch (error) {
      if (error instanceof TakeError) return send(error.status, {error: error.message});
      if (error instanceof RangeError) return send(400, {error: error.message});
      send(503, {error: 'The take service is temporarily unavailable.'});
    } finally {
      active--;
    }
  };
}
