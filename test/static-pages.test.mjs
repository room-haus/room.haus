import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mixes, releases, records, routeOf, coverName} from '../scripts/catalog.mjs';
import {archiveBody, escape, recordBody} from '../scripts/static-pages.mjs';

const asset = (name) => '/assets/' + name;

test('the cover walls link to every record in catalogue order', () => {
  for (const [section, catalogue] of Object.entries({mixes, releases})) {
    const body = archiveBody(section, asset);
    assert.deepEqual(
      [...body.matchAll(/<a class="sleeve" href="([^"]+)"/g)].map((match) => match[1]),
      catalogue.map(routeOf),
    );
  }
});

test('every document has its recording details, artwork, destinations and ordered tracks before JavaScript', () => {
  for (const record of records) {
    const body = recordBody(record, asset);
    assert.ok(body.includes('<h1>' + escape(record.artist) + '</h1>'), record.id);
    assert.ok(body.includes('src="' + asset(coverName(record) + '.jpg') + '"'), record.id);
    for (const value of [record.id, record.name].filter(Boolean))
      assert.ok(body.includes('>' + escape(value) + '<'), record.id);
    for (const url of [record.soundcloud, record.purchaseLink].filter(Boolean)) {
      assert.ok(body.includes('href="' + escape(url) + '"'), record.id);
    }
    assert.deepEqual(
      [...body.matchAll(/<li>(.*?)<\/li>/g)].map((match) => match[1]),
      (record.tracks || []).map((track) => escape(track.name)),
    );
  }
});

test('the published wall shows distinct mix titles, and Next mix follows the complete catalog exactly once', () => {
  const wall = archiveBody('mixes', asset);
  assert.match(wall, />Music for Rain</);
  assert.doesNotMatch(wall, />MX004: Iwan Thickett</);
  for (const [index, mix] of mixes.entries()) {
    const body = recordBody(mix, asset);
    const next = body.match(/<a class="next-mix" href="([^"]+)"/);
    assert.equal(next?.[1], mixes[index + 1] && routeOf(mixes[index + 1]));
    assert.ok(body.includes('>View sleeve</a>') && body.includes('>View disc</a>'));
  }
  for (const release of releases) assert.doesNotMatch(recordBody(release, asset), /rel="next"/);
});
