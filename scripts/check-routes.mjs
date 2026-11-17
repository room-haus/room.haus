import assert from 'node:assert/strict';
import {records, routeOf} from './catalog.mjs';
const base = new URL(process.argv[2] || 'http://127.0.0.1:4173');
const checks = [
  ['/', 200, 'ROOM'],
  ['/mixes/', 200, 'Mixes'],
  ['/releases/', 200, 'Releases'],
  ...records.map((record) => [routeOf(record), 200, record.id]),
  ['/mixes/?mx=MX029', 200, 'MX029'],
  ['/releases/ROOM001-AMAL-DANCECONCEPT', 200, 'Dance Concept'],
  ['/mixes/?mx=MX999', 404],
  ['/releases/unknown', 404],
  ['/assets/room-missing.js', 404],
];
const total = checks.length;
async function worker() {
  while (checks.length) {
    const [path, status, title] = checks.shift();
    const res = await fetch(new URL(path, base), {signal: AbortSignal.timeout(15000)});
    assert.equal(res.status, status, path);
    const body = await res.text();
    if (title) assert.ok(body.match(/<title>(.*?)<\/title>/i)?.[1].includes(title), path + ' has wrong title');
  }
}
await Promise.all(Array.from({length: 4}, worker));
console.log(total + ' public route and asset checks passed at ' + base.origin);
