import entrancePages from '../src/content/entrance.json' with {type: 'json'};
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {records, routeOf} from './catalog.mjs';
const base = new URL(process.argv[2] || 'http://127.0.0.1:4173');
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const checks = [
  ...entrancePages.map(({path, title}) => [path, 200, title]),
  ['/mixes/', 200, 'Mixes'],
  ['/releases/', 200, 'Releases'],
  ['/labs/', 200, 'Labs'],
  ['/labs', 200, 'Labs', '/labs/'],
  ['/underlevel/', 404],
  ['/underlevel', 404],
  ['/underlevel/index.html', 404],
  ...records.map((record) => [routeOf(record), 200, record.id]),
  ['/mixes/?mx=MX029', 200, 'MX029', '/mixes/MX029/'],
  ['/releases/ROOM001-AMAL-DANCECONCEPT', 200, 'Dance Concept'],
  ['/mixes/?mx=MX999', 404],
  ['/releases/unknown', 404],
  ['/assets/room-missing.js', 404],
];
const total = checks.length;
const assets = new Set();
function rememberAsset(value) {
  const url = new URL(value, base);
  if (!/^\/assets\/[\w.-]+$/.test(url.pathname)) throw Error('Unexpected release asset: ' + url.pathname);
  assets.add(url.pathname);
}
async function worker() {
  while (checks.length) {
    const [path, status, title, canonical = path] = checks.shift();
    const res = await fetch(new URL(path, base), {signal: AbortSignal.timeout(15000)});
    assert.equal(res.status, status, path);
    const body = await res.text();
    if (title) {
      const file = 'dist' + canonical.replace(/\/$/, '') + '/index.html';
      assert.equal(digest(body), digest(await readFile(file)), path + ' HTML differs from the tested build');
      assert.ok(body.match(/<title>(.*?)<\/title>/i)?.[1].includes(title), path + ' has wrong title');
      const entry = [...body.matchAll(/<script\b[^>]*\bsrc=["']?([^\s"'<>]+)/gi)];
      assert.ok(entry.length, path + ' has no entry script');
      for (const match of entry) rememberAsset(match[1]);
      const styles = [...body.matchAll(/<link\b[^>]*href=["']?([^\s"'<>]+\.css)\b/gi)];
      assert.ok(styles.length, path + ' has no stylesheet');
      for (const match of styles) rememberAsset(match[1]);
      const art = body.match(/<meta property="og:image" content="([^"]+)"/);
      if (title.startsWith('MX') || title.startsWith('ROOM0')) assert.ok(art, path + ' has no share image');
      if (art) rememberAsset(art[1]);
    }
  }
}
await Promise.all(Array.from({length: 4}, worker));
for (const path of ['/worklets/index.js', '/models/CD/CD.babylon', '/models/MX018/jett.babylon', '/sitemap.xml']) assets.add(path);
const entries = [...assets];
const mime = {
  js: /javascript/,
  css: /text\/css/,
  jpg: /image\/jpeg/,
  xml: /(?:application|text)\/xml/,
  babylon: /application\/(octet-stream|json)|text\/plain/,
};
async function verifyAssets() {
  while (entries.length) {
    const name = entries.shift();
    const result = await fetch(new URL(name, base), {signal: AbortSignal.timeout(20000)});
    assert.equal(result.status, 200, name);
    const type = result.headers.get('content-type') || '';
    assert.match(type, mime[name.split('.').at(-1)], name);
    const expected = await readFile('dist' + name);
    assert.equal(
      digest(Buffer.from(await result.arrayBuffer())),
      digest(expected),
      name + ' differs from the tested build',
    );
  }
}
await Promise.all(Array.from({length: 4}, verifyAssets));
console.log(
  total +
    ' routes and ' +
    assets.size +
    ' assets including scripts, covers, CD model and worklet verified at ' +
    base.origin,
);
