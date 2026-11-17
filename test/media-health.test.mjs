import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {checkMedia} from '../scripts/media-health.mjs';

async function fixture(t) {
  const requested = [];
  const server = createServer((req, res) => {
    requested.push(req.url);
    if (req.url !== '/no-cors.m3u8') res.setHeader('Access-Control-Allow-Origin', '*');
    if (req.url === '/master.m3u8') return res.end('#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=100\ngood.m3u8\n#EXT-X-STREAM-INF:BANDWIDTH=200\nbad.m3u8\n');
    if (['/good.m3u8', '/no-cors.m3u8'].includes(req.url)) return res.end('#EXTM3U\nfirst.ts\nlast.ts\n');
    if (req.url === '/bad.m3u8') return res.end('#EXTM3U\nfirst.ts\nmissing.ts\n');
    if (req.url === '/empty.m3u8') return res.end('#EXTM3U\nempty.ts\n');
    if (req.url === '/empty.ts') return res.end();
    if (req.url === '/redirect.mp4') { res.writeHead(302, {Location:'/clip.mp4'}); return res.end(); }
    if (req.url === '/clip.mp4') { res.setHeader('Content-Type','video/mp4'); return res.end(Buffer.from('0000001866747970', 'hex')); }
    if (req.url === '/html.mp4') { res.setHeader('Content-Type','text/html'); return res.end('<html>missing</html>'); }
    if (['/first.ts', '/last.ts'].includes(req.url)) return res.end('transport bytes');
    res.writeHead(404).end('missing');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const origin = 'http://127.0.0.1:' + server.address().port;
  return {requested, entry: path => ({name:path, url:origin + path})};
}

test('health checks read both boundary segments and follow standalone video redirects', async t => {
  const {entry, requested} = await fixture(t);
  assert.deepEqual(await checkMedia(['/good.m3u8','/redirect.mp4'].map(entry)), []);
  for (const path of ['/first.ts','/last.ts','/clip.mp4']) assert.ok(requested.includes(path), path);
});
test('missing scene video, missing variant segment, empty media and missing CORS fail health checks', async t => {
  const {entry} = await fixture(t);
  const paths = ['/missing.m3u8','/master.m3u8','/empty.m3u8','/no-cors.m3u8','/html.mp4'];
  const errors = await checkMedia(paths.map(entry));
  assert.equal(errors.length, paths.length);
  for (const path of paths) assert.ok(errors.some(error => error.startsWith(path + ':')), path);
});
