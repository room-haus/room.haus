import {test} from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {cloudFrontSource} from '../scripts/routing.mjs';

test('labs resolves directly in local and versioned production releases', () => {
  for (const prefix of ['', '/_releases/' + 'a'.repeat(40) + '/' + 'b'.repeat(64)]) {
    const handler = runInNewContext(cloudFrontSource(prefix) + '\nhandler');
    for (const uri of ['/labs', '/labs/']) {
      assert.equal(handler({request: {uri, querystring: {}}}).uri, prefix + '/labs/index.html');
    }
    assert.equal(handler({request: {uri: '/labs/unknown', querystring: {}}}).statusCode, 404);
  }
});
