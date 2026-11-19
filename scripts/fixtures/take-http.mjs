import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createInterface} from 'node:readline';
import {once} from 'node:events';

const settings = {delayFrames: 2400, feedback: .3, wetLevel: .9, stereoWidth: .2};
const post = (origin, path, input) => fetch(origin + path, {
  method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(input),
});
const get = (origin, path) => fetch(origin + path);
async function json(response, status) {
  const body = await response.text();
  assert.equal(response.status, status, body.slice(0, 300));
  return JSON.parse(body);
}
async function bytes(origin, path) {
  const response = await get(origin, path);
  assert.equal(response.status, 200);
  return Buffer.from(await response.arrayBuffer());
}
async function start(t, storeDir) {
  const child = spawn(process.execPath, ['scripts/serve.mjs'], {
    env: {...process.env, PORT: '0', ROOM_TAKE_SOURCE_DIR: '', ROOM_TAKE_FIXTURE: '1', ROOM_TAKE_STORE_DIR: storeDir},
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const exited = once(child, 'exit');
  async function close() {
    if (child.exitCode === null && child.signalCode === null) child.kill();
    await exited;
  }
  t.after(close);
  const [line] = await Promise.race([
    once(createInterface({input: child.stdout}), 'line'),
    exited.then(() => { throw new Error('Test service exited before startup'); }),
  ]);
  assert.match(line, /http:\/\/127\.0\.0\.1:\d+/);
  return {origin: line.split(' ').pop(), close};
}
async function setup(t) {
  const storeDir = await mkdtemp(join(tmpdir(), 'room-take-publish-'));
  t.after(() => rm(storeDir, {recursive: true, force: true}));
  const {origin, close} = await start(t, storeDir);
  const catalog = await json(await get(origin, '/v1/catalog'), 200);
  const [source] = catalog.sources;
  assert.ok(source.revision.includes('fixture'), 'CI must use the offline source');
  assert.equal(source.chunks, undefined);
  const passage = {sourceId: source.id, revision: source.revision, startFrame: 0, endFrame: 96000};
  const recipe = {schema: 1, experiment: 'audio-space', rendererVersion: 1, passage, initialSettings: settings,
    gestures: [{id: 'snare', startFrame: 0, endFrame: 4800, settings}], parentId: null};
  return {origin, storeDir, close, catalog, recipe};
}
const prepare = async (origin, recipe) => json(await post(origin, '/v1/preparations', recipe), 201);
const publish = async (origin, preparationId, requestId = randomUUID()) =>
  json(await post(origin, '/v1/takes', {preparationId, requestId}), 200);

export {post, get, json, bytes, start, setup, prepare, publish};
