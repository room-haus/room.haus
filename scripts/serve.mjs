import {createServer} from 'node:http';
import {createReadStream} from 'node:fs';
import {stat} from 'node:fs/promises';
import {resolve, sep, extname} from 'node:path';
import {runInNewContext} from 'node:vm';
import {cloudFrontSource} from './routing.mjs';
import {localTakeService} from './local-take-service.mjs';

const takes = await localTakeService(process.env);
const route = runInNewContext(cloudFrontSource() + '\nhandler');
const root = resolve('dist');
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.wasm': 'application/wasm',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg',
  '.mp3': 'audio/mpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.otf': 'font/otf',
  '.xml': 'application/xml',
  '.m3u8': 'application/vnd.apple.mpegurl',
  '.ts': 'video/mp2t',
};
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (takes && url.pathname.startsWith('/v1/')) return await takes(req, res, url);
    if (req.method !== 'HEAD' && req.method !== 'GET') {
      res.writeHead(405).end();
      return;
    }
    const result = route({
      request: {
        uri: url.pathname,
        querystring: Object.fromEntries([...url.searchParams].map(([k, value]) => [k, {value}])),
      },
    });
    if (result.headers?.location) {
      res.writeHead(result.statusCode, {Location: result.headers.location.value}).end();
      return;
    }
    if (result.statusCode) {
      res.writeHead(result.statusCode, {'Content-Type': 'text/html'}).end(result.body);
      return;
    }
    // Mount only the portable MX029 playlist and its segments when explicitly requested.
    const sample = process.env.ROOM_MX029_SAMPLE_DIR && /^\/sample\/mx029\/(index\.m3u8|MX029-\d+\.ts)$/.exec(url.pathname);
    const directory = sample ? resolve(process.env.ROOM_MX029_SAMPLE_DIR) : root;
    const file = resolve(directory, sample ? sample[1] : '.' + decodeURIComponent(result.uri));
    if (!file.startsWith(directory + sep)) throw Error('Not found');
    const info = await stat(file);
    if (!info.isFile()) throw Error('Not found');
    res.writeHead(200, {'Content-Type': types[extname(file)] || 'application/octet-stream', 'Content-Length': info.size});
    if (req.method === 'HEAD') res.end();
    else
      createReadStream(file)
        .on('error', () => res.destroy())
        .pipe(res);
  } catch {
    res.writeHead(404).end('Not found');
  }
});
server.listen(Number(process.env.PORT || 4173), '127.0.0.1', () =>
  console.log('ROOM at http://127.0.0.1:' + server.address().port),
);
