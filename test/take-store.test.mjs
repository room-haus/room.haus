import assert from 'node:assert/strict';
import {once} from 'node:events';
import {spawn} from 'node:child_process';
import {createServer} from 'node:http';
import {mkdtemp, readFile, rename, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {test} from 'node:test';
import {fixtureSource} from '../scripts/fixtures/take-service.mjs';
import {fileStore} from '../services/takes/file-store.mjs';
import {takeHandler} from '../services/takes/handler.mjs';
import {takeRepository} from '../services/takes/repository.mjs';
import {SPACE_TAKE_DEFAULTS as settings} from '../src/experiences/takes/recipe.mjs';

async function directory(t) {
  const root = await mkdtemp(join(tmpdir(), 'room-store-'));
  t.after(() => rm(root, {recursive: true, force: true}));
  return root;
}

test('independent file stores conditionally create only complete immutable bytes', async (t) => {
  const root = await directory(t);
  const key = 'takes/' + '1'.repeat(32);
  const values = [Buffer.alloc(50000, 17), Buffer.alloc(40000, 42)];
  const stores = values.map(() => fileStore(root));
  assert.equal(await stores[0].read(key), null);
  const wins = await Promise.all(stores.map((s, i) => s.putIfAbsent(key, values[i])));
  assert.equal(wins.filter(Boolean).length, 1);
  assert.deepEqual(await fileStore(root).read(key), values[wins.indexOf(true)]);
});

function setup(root, writeLimits) {
  const source = fixtureSource();
  const store = fileStore(root);
  const repo = takeRepository({...source, store, writeLimits});
  const {id: sourceId, revision} = source.catalog[0];
  const recipe = {
    schema: 1,
    experiment: 'audio-space',
    rendererVersion: 1,
    parentId: null,
    initialSettings: settings,
    passage: {sourceId, revision, startFrame: 0, endFrame: 48000},
    gestures: [{id: 'one', startFrame: 0, endFrame: 4800, settings}],
  };
  return {repo, recipe, store};
}

test('published PCM survives stricter duration and gesture policies through HTTP', async (t) => {
  const root = await directory(t);
  const {repo, recipe} = setup(root);
  const prep = await repo.prepare(recipe);
  const {id} = await repo.publish({preparationId: prep.preparationId, requestId: 'save'});
  for (const writeLimits of [
    {maxPassageFrames: 47999, maxGestures: 24},
    {maxPassageFrames: 48000, maxGestures: 0},
  ]) {
    const handler = takeHandler(setup(root, writeLimits).repo);
    const server = createServer((req, res) => handler(req, res, new URL(req.url, 'http://localhost')));
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    try {
      const origin = 'http://127.0.0.1:' + server.address().port;
      const response = await fetch(origin + '/v1/takes/' + id);
      assert.equal(response.status, 200);
      const manifest = await response.json();
      assert.equal(manifest.editable, false);
      for (const mode of ['dry', 'take']) {
        const audio = await fetch(origin + manifest[mode].url);
        assert.equal(audio.status, 200);
        assert.deepEqual(Buffer.from(await audio.arrayBuffer()), await repo.audio('takes', id, mode));
      }
      const edit = await fetch(origin + '/v1/preparations', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({...recipe, parentId: id}),
      });
      assert.equal(edit.status, 400);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  }
});

test('offline cleanup reclaims expired and orphaned staging, preserving active, bound and published PCM', async (t) => {
  const root = await directory(t);
  const {repo, recipe, store} = setup(root);
  const saved = await repo.prepare(recipe);
  const binding = {preparationId: saved.preparationId, requestId: 'committed'};
  const committed = await repo.publish(binding);
  const active = await repo.prepare(recipe);
  const draft = (startFrame) => repo.prepare({...recipe, gestures: [{...recipe.gestures[0], startFrame}]});
  const expired = await draft(1000);
  const privateOnly = await draft(1200);
  const privateFile = join(root, 'prepared-audio', privateOnly.take.sha256);
  await rename(privateFile, privateFile + '.fault');
  const interrupted = {preparationId: privateOnly.preparationId, requestId: 'interrupted'};
  await assert.rejects(repo.publish(interrupted), {status: 503});
  await rename(privateFile + '.fault', privateFile);
  for (const prep of [saved, expired, privateOnly]) {
    const file = join(root, 'preparations', prep.preparationId);
    await writeFile(file, JSON.stringify({...JSON.parse(await readFile(file)), expiresAt: 0}));
  }
  const orphan = 'prepared-audio/' + '8'.repeat(64);
  await store.putIfAbsent(orphan, 'interrupted prepare');
  const temp = join(root, 'prepared-audio', '.b50e337d-a766-4b23-b2e0-d811725cb133');
  await writeFile(temp, 'unfinished file');
  const {reclaimTakeStaging} = await import('../services/takes/file-store.mjs');
  await assert.rejects(reclaimTakeStaging(root), /in use/);
  assert.ok(await store.read('preparations/' + expired.preparationId));
  store.close();
  await reclaimTakeStaging(root);
  const fresh = setup(root);
  assert.equal(await fresh.store.read('preparations/' + expired.preparationId), null);
  assert.equal(await fresh.store.read('prepared-audio/' + expired.take.sha256), null);
  assert.equal(await fresh.store.read(orphan), null);
  await assert.rejects(readFile(temp), {code: 'ENOENT'});
  for (const mode of ['dry', 'take']) {
    assert.equal(await fresh.store.read('prepared-audio/' + saved[mode].sha256), null);
    assert.deepEqual(
      await fresh.repo.audio('preparations', active.preparationId, mode),
      await fresh.repo.audio('takes', committed.id, mode),
    );
  }
  assert.ok(await fresh.store.read('prepared-audio/' + privateOnly.take.sha256));
  assert.ok((await fresh.repo.publish(interrupted)).id);
  assert.deepEqual(await fresh.repo.publish(binding), committed);
  fresh.store.close();
});

test('a live service excludes maintenance across processes and a killed service releases its lease', async (t) => {
  const root = await directory(t);
  const {reclaimTakeStaging} = await import('../services/takes/file-store.mjs');
  const child = spawn(process.execPath, ['scripts/serve.mjs'], {
    env: {...process.env, PORT: '0', ROOM_TAKE_SOURCE_DIR: '', ROOM_TAKE_FIXTURE: '1', ROOM_TAKE_STORE_DIR: root},
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  const exit = once(child, 'exit');
  t.after(async () => {
    child.kill();
    await exit;
  });
  await Promise.race([
    once(child.stdout, 'data'),
    exit.then(() => {
      throw Error('Service exited on startup');
    }),
  ]);
  await assert.rejects(reclaimTakeStaging(root), /in use/);
  child.kill('SIGKILL');
  await exit;
  assert.deepEqual(await reclaimTakeStaging(root), {expiredPreparations: 0, reclaimedBytes: 0});
});

test('a legacy store remains readable and refuses destructive maintenance', async (t) => {
  const root = await directory(t);
  const {reclaimTakeStaging} = await import('../services/takes/file-store.mjs');
  await writeFile(join(root, 'legacy-marker'), 'older service may still be running');
  const {repo, recipe, store} = setup(root);
  const prepared = await repo.prepare(recipe);
  assert.ok((await repo.audio('preparations', prepared.preparationId, 'dry')).length);
  store.close();
  await assert.rejects(reclaimTakeStaging(root), /created by the locking service/);
});

test('per-process write admission leaves public reads available and refills after a minute', async () => {
  let now = 0;
  const handler = takeHandler({prepare: async () => ({}), catalog: {}}, {now: () => now});
  const server = createServer((req, res) => handler(req, res, new URL(req.url, 'http://localhost')));
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const origin = 'http://127.0.0.1:' + server.address().port;
  const write = async () => {
    const r = await fetch(origin + '/v1/preparations', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: '{}',
    });
    await r.text();
    return r.status;
  };
  try {
    for (let i = 0; i < 60; i++) assert.equal(await write(), 201);
    assert.equal(await write(), 429);
    assert.equal((await fetch(origin + '/v1/catalog')).status, 200);
    now += 60000;
    assert.equal(await write(), 201);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
