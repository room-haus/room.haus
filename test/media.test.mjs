import test from 'node:test';
import assert from 'node:assert/strict';
import {mediaUrl} from '../src/content/media.mjs';
import {sceneMediaUrl, sceneStreams} from '../src/content/sceneMedia.mjs';

test('a prefixed mirror retains exact catalog paths and only the MX029 recording takes its sample override', () => {
  const origin = 'https://example.org/archive';
  const sample = 'http://127.0.0.1:4181/track-01/index.m3u8';
  assert.equal(mediaUrl('mixes/MX029/MX029.m3u8', origin, sample), sample);
  for (const path of ['mixes/MX001/MX001.m3u8', 'mixes/MX029/video/bubbles.m3u8', "releases/ROOM003/audio/commitment-Issues-(l'enfant-remix).m3u8"]) {
    assert.equal(mediaUrl(path, origin, sample), origin + '/' + path);
  }
  assert.throws(() => mediaUrl('mixes/test.m3u8', 'http://example.org/'));
});

test('scene backgrounds and video textures use the same portable inventory as health checks', () => {
  const origin = 'https://example.org/archive/';
  assert.equal(sceneMediaUrl('MX029', 'warp', origin), origin + 'mixes/MX029/video/warp.m3u8');
  assert.equal(sceneMediaUrl('MX022', 'MX022BGV-starry', origin), origin + 'assets/MX022/videos/starry/MX022BGV-starry.m3u8');
  const entries = sceneStreams(origin);
  assert.ok(entries.some(entry => entry.url === origin + 'mixes/MX029/video/warp.m3u8'));
  assert.ok(entries.some(entry => entry.url === origin + 'mixes/MX029/video/bubbles.m3u8'));
  assert.ok(entries.some(entry => entry.url === 'https://www.dropbox.com/s/sslop96edbf800p/mx013video.mp4?dl=1'));
  assert.throws(() => sceneMediaUrl('MX029', 'missing', origin));
});
