import {test} from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {validateCatalog, records, mixes, routeOf} from '../scripts/catalog.mjs';
import {cloudFrontSource} from '../scripts/routing.mjs';

const handler = runInNewContext(cloudFrontSource() + '\nhandler');
const lookup = (uri, mx) => handler({request: {uri, querystring: mx === undefined ? {} : {mx: {value: mx}}}});

test('each catalog item has artwork, a distinct valid route and secure media', validateCatalog);
test('each permalink resolves to its own shareable document with or without the trailing slash', () => {
  for (const record of records) {
    const canonical = routeOf(record);
    assert.equal(lookup(canonical).uri, canonical + 'index.html');
    assert.equal(lookup(canonical.slice(0, -1)).uri, canonical + 'index.html');
  }
  for (const mix of mixes) assert.equal(lookup('/mixes/', mix.id).uri, routeOf(mix) + 'index.html');
});
test('archive pages, unknown routes and missing assets have distinct behavior', () => {
  assert.equal(lookup('/').uri, '/index.html');
  assert.equal(lookup('/mixes/').uri, '/mixes/index.html');
  assert.equal(lookup('/releases').uri, '/releases/index.html');
  for (const value of ['/missing', '/releases/unknown', '/mixes/MX000']) assert.equal(lookup(value).statusCode, 404);
  assert.equal(lookup('/mixes/', 'MX999').statusCode, 404);
  assert.equal(lookup('/assets/missing.js').uri, '/assets/missing.js');
});
test('CloudFront selects isolated release objects and retains shared fingerprinted assets', () => {
  const prefix = '/_releases/' + 'f'.repeat(40);
  const handler = runInNewContext(cloudFrontSource(prefix) + '\nhandler');
  const resolve = (uri) => handler({request: {uri, querystring: {}}}).uri;
  assert.equal(resolve('/'), prefix + '/index.html');
  assert.equal(resolve('/releases/ROOM001'), prefix + '/releases/ROOM001-AMAL-DANCECONCEPT/index.html');
  assert.equal(resolve('/worklets/index.js'), prefix + '/worklets/index.js');
  assert.equal(resolve('/models/CD/CD.babylon'), prefix + '/models/CD/CD.babylon');
  assert.equal(resolve('/assets/main.123.js'), '/assets/main.123.js');
});
