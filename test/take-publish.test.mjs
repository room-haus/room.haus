import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createHash, randomUUID} from 'node:crypto';
import {mkdtemp, readFile, readdir, rename, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createInterface} from 'node:readline';
import {test} from 'node:test';
import {once} from 'node:events';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
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

test('published references are byte-identical to preview across restart, independent readers and variations', async t => {
  const {origin, storeDir, close, recipe} = await setup(t);
  const raw = await bytes(origin, '/v1/passage?' + new URLSearchParams(recipe.passage));
  const prep = await prepare(origin, recipe);
  assert.deepEqual(prep.recipe, recipe);
  const previews = {};
  for (const key of ['dry', 'take']) {
    const ref = prep[key];
    previews[key] = await bytes(origin, ref.url);
    assert.equal(hash(previews[key]), ref.sha256);
    assert.equal(ref.frameCount, 96000);
    assert.equal(ref.byteLength, 384000);
    assert.equal(ref.sampleRate, 48000);
    assert.equal(ref.channels, 2);
    assert.equal(ref.format, 's16le');
  }
  assert.notDeepEqual(previews.dry, previews.take);
  assert.equal(raw.length, previews.dry.length);
  const requestId = randomUUID();
  const parent = await publish(origin, prep.preparationId, requestId);
  assert.equal(parent.parentId, null);
  await close();

  const fresh = (await start(t, storeDir)).origin;
  const reopened = await json(await get(fresh, '/v1/takes/' + parent.id), 200);
  assert.deepEqual(reopened.recipe, recipe);
  for (const key of ['dry', 'take']) {
    assert.notEqual(reopened[key].url, prep[key].url);
    assert.deepEqual(await bytes(fresh, reopened[key].url), previews[key]);
    assert.equal(reopened[key].sha256, prep[key].sha256);
  }
  assert.deepEqual(await publish(fresh, prep.preparationId, requestId), parent);
  const childRecipe = {...recipe, parentId: parent.id, gestures: []};
  const childPrep = await prepare(fresh, childRecipe);
  const child = await publish(fresh, childPrep.preparationId);
  assert.notEqual(child.id, parent.id);
  assert.equal(child.parentId, parent.id);
  const fork = await json(await get(fresh, '/v1/takes/' + child.id), 200);
  assert.deepEqual(fork.recipe, childRecipe);
  assert.equal(fork.take.sha256, prep.dry.sha256);
  assert.deepEqual(await bytes(fresh, reopened.take.url), previews.take);
  const changed = {...childRecipe, passage: {...recipe.passage, startFrame: 1}};
  assert.equal((await post(fresh, '/v1/preparations', changed)).status, 400);
});

test('independent writers bind one request to exactly one preparation and result', async t => {
  const {origin, storeDir, recipe} = await setup(t);
  const second = (await start(t, storeDir)).origin;
  const [a, b] = await Promise.all([prepare(origin, recipe), prepare(second, {...recipe, gestures: []})]);
  const key = randomUUID();
  const [first, other] = await Promise.all([
    post(origin, '/v1/takes', {preparationId: a.preparationId, requestId: key}),
    post(second, '/v1/takes', {preparationId: b.preparationId, requestId: key}),
  ]);
  assert.deepEqual([first.status, other.status].sort(), [200, 409]);
  const winner = first.status === 200 ? a : b;
  const published = await (first.status === 200 ? first : other).json();
  const retryKey = randomUUID();
  const results = await Promise.all([origin, second, origin, second].map(server => publish(server, winner.preparationId, retryKey)));
  assert.ok(results.every(result => result.id === results[0].id));
  assert.deepEqual(await publish(second, winner.preparationId, key), published);
});

test('partial storage exposes no manifest, retries can finish the binding and recover a lost reply', async t => {
  const {origin, storeDir, recipe} = await setup(t);
  const prep = await prepare(origin, recipe);
  const takeFile = join(storeDir, 'prepared-audio', prep.take.sha256);
  await rename(takeFile, takeFile + '.unavailable');
  const requestId = randomUUID();
  const input = {preparationId: prep.preparationId, requestId};
  assert.equal((await post(origin, '/v1/takes', input)).status, 503);
  assert.deepEqual(await readdir(join(storeDir, 'audio')), [prep.dry.sha256]);
  const binding = JSON.parse(await readFile(join(storeDir, 'requests', hash(requestId)), 'utf8'));
  assert.equal((await get(origin, '/v1/takes/' + binding.id)).status, 404);
  await rename(takeFile + '.unavailable', takeFile);
  // A request already bound before expiry must be able to finish.
  const privateRecord = join(storeDir, 'preparations', prep.preparationId);
  const prior = JSON.parse(await readFile(privateRecord));
  await writeFile(privateRecord, JSON.stringify({...prior, expiresAt: Date.now() - 1}));
  const saved = await publish(origin, prep.preparationId, requestId);
  assert.equal(saved.id, binding.id);
  const manifest = await json(await get(origin, '/v1/takes/' + saved.id), 200);
  const publicFile = join(storeDir, 'audio', manifest.take.sha256);
  await rename(publicFile, publicFile + '.unavailable');
  assert.equal((await get(origin, manifest.take.url)).status, 503);
  assert.equal((await get(origin, '/v1/takes/' + saved.id)).status, 503);
  assert.deepEqual(await publish(origin, prep.preparationId, requestId), saved);
  assert.equal(hash(await bytes(origin, manifest.take.url)), prep.take.sha256);
});

test('private previews expire while a published take and its request stay readable', async t => {
  const {origin, storeDir, recipe} = await setup(t);
  const prep = await prepare(origin, recipe);
  const requestId = randomUUID();
  const published = await publish(origin, prep.preparationId, requestId);
  const record = join(storeDir, 'preparations', prep.preparationId);
  const expired = JSON.parse(await readFile(record));
  await writeFile(record, JSON.stringify({...expired, expiresAt: Date.now() - 1}));
  assert.equal((await get(origin, prep.take.url)).status, 410);
  assert.equal((await post(origin, '/v1/takes', {preparationId: prep.preparationId, requestId: randomUUID()})).status, 410);
  await rm(record);
  assert.deepEqual(await publish(origin, prep.preparationId, requestId), published);
  const manifest = await json(await get(origin, '/v1/takes/' + published.id), 200);
  assert.equal(hash(await bytes(origin, manifest.take.url)), prep.take.sha256);
});

test('input limits, invalid parents and unknown IDs fail without publishing or exposing raw storage', async t => {
  const {origin, recipe, catalog} = await setup(t);
  for (const modified of [
    {...recipe, passage: {...recipe.passage, revision: 'unknown'}},
    {...recipe, passage: {...recipe.passage, endFrame: catalog.limits.maxPassageFrames + 1}},
    {...recipe, gestures: Array(catalog.limits.maxGestures + 1).fill(recipe.gestures[0])},
    {...recipe, parentId: '../secrets'}, {...recipe, parentId: 'a'.repeat(32)},
  ]) assert.equal((await post(origin, '/v1/preparations', modified)).status, 400);
  for (const overrides of [{revision: 'unknown'}, {startFrame: ''}, {endFrame: '1.5'}, {endFrame: catalog.limits.maxPassageFrames + 1}]) {
    assert.equal((await get(origin, '/v1/passage?' + new URLSearchParams({...recipe.passage, ...overrides}))).status, 400);
  }
  assert.equal((await post(origin, '/v1/preparations', 'x'.repeat(70000))).status, 413);
  assert.equal((await post(origin, '/v1/takes', {preparationId: 'a'.repeat(32), requestId: randomUUID()})).status, 404);
  assert.equal((await get(origin, '/v1/takes/bad!')).status, 404);
  assert.equal((await get(origin, '/v1/takes/' + 'b'.repeat(32))).status, 404);
  assert.equal((await get(origin, '/v1/audio/' + 'c'.repeat(64))).status, 404);
});


test('a malformed committed record or changed same-size PCM yields an unavailable response', async t => {
  const {origin, storeDir, recipe} = await setup(t);
  const prep = await prepare(origin, recipe);
  const {id} = await publish(origin, prep.preparationId);
  const path = '/v1/takes/' + id;
  const manifest = await json(await get(origin, path), 200);
  const record = join(storeDir, 'takes', id);
  const saved = await readFile(record);
  await writeFile(record, '{');
  assert.equal((await get(origin, path)).status, 503);
  await writeFile(record, saved);
  const audio = join(storeDir, 'audio', manifest.take.sha256);
  const changed = await readFile(audio);
  changed[0] ^= 1;
  await writeFile(audio, changed);
  assert.equal((await get(origin, path)).status, 503);
  assert.equal((await get(origin, manifest.take.url)).status, 503);
});

test('a published Space render from a newer editor stays playable through the real API', async t => {
  const {origin,storeDir,recipe} = await setup(t);
  const prep = await prepare(origin,recipe), parent = await publish(origin,prep.preparationId);
  const file = join(storeDir,'takes',parent.id);
  const record = JSON.parse(await readFile(file));
  // Represent an immutable record written by a subsequent compatible media service.
  record.recipe.rendererVersion = 2;
  await writeFile(file,JSON.stringify(record));
  const manifest = await json(await get(origin,'/v1/takes/'+parent.id),200);
  assert.equal(manifest.recipe.rendererVersion,2);
  for (const mode of ['dry','take']) assert.equal(hash(await bytes(origin,manifest[mode].url)),prep[mode].sha256);
  assert.equal((await post(origin,'/v1/preparations',{...recipe,parentId:parent.id})).status,400);
});
