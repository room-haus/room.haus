import assert from 'node:assert/strict';
import {mkdtempSync, mkdirSync, renameSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {runInNewContext} from 'node:vm';
import test from 'node:test';
import {releaseDigest, releaseFiles} from '../scripts/release-files.mjs';
import {cloudFrontSource} from '../scripts/routing.mjs';

test('rebuilds of one commit get isolated CDN objects when asset bytes or paths change', t => {
  const dir = mkdtempSync(path.join(tmpdir(), 'room-release-test-'));
  t.after(() => rmSync(dir, {recursive: true, force: true}));
  mkdirSync(path.join(dir, 'assets'));
  const asset = path.join(dir, 'assets/player.js');
  writeFileSync(asset, 'original host');
  writeFileSync(path.join(dir, 'index.html'), 'archive');
  const identity = () => releaseDigest(dir, releaseFiles(dir));
  const original = identity();
  writeFileSync(path.join(dir, '_redirects'), 'Netlify only');
  assert.equal(identity(), original);
  writeFileSync(asset, 'mirror host');
  const mirror = identity();
  assert.notEqual(mirror, original);
  const sha = 'e'.repeat(40);
  for (const digest of [original, mirror]) {
    const prefix = '/_releases/' + sha + '/' + digest;
    const handle = runInNewContext(cloudFrontSource(prefix) + '\nhandler');
    assert.equal(handle({request: {uri: '/', querystring: {}}}).uri, prefix + '/index.html');
  }
  renameSync(asset, path.join(dir, 'assets/renamed.js'));
  assert.notEqual(identity(), mirror);
});
