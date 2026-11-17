import {createServer} from 'node:http';
import {createReadStream} from 'node:fs';
import {stat} from 'node:fs/promises';
import {resolve, sep, extname} from 'node:path';
import {runInNewContext} from 'node:vm';
import {cloudFrontSource} from './routing.mjs';

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
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.otf': 'font/otf',
  '.xml': 'application/xml',
};
const server = createServer(async (req, res) => {
  try {
    if (req.method !== 'HEAD' && req.method !== 'GET') {
      res.writeHead(405).end();
      return;
    }
    const url = new URL(req.url, 'http://localhost');
    const result = route({
      request: {
        uri: url.pathname,
        querystring: Object.fromEntries([...url.searchParams].map(([k, value]) => [k, {value}])),
      },
    });
    if (result.statusCode) {
      res.writeHead(result.statusCode, {'Content-Type': 'text/html'}).end(result.body);
      return;
    }
    const file = resolve(root, '.' + decodeURIComponent(result.uri));
    if (!file.startsWith(root + sep) || !(await stat(file)).isFile()) throw Error('Not found');
    res.writeHead(200, {'Content-Type': types[extname(file)] || 'application/octet-stream'});
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
