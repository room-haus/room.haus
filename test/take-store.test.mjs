import assert from 'node:assert/strict';
import {once} from 'node:events';
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
  const repo = takeRepository({...source, store: fileStore(root), writeLimits});
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
  return {repo, recipe};
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

test('expired duplicate cleanup preserves shared active previews, bound retries and committed audio', async (t) => {
  const root = await directory(t);
  const {repo, recipe} = setup(root);
  const expired = await repo.prepare(recipe);
  const committed = await repo.publish({preparationId: expired.preparationId, requestId: 'saved'});
  const active = await repo.prepare(recipe);
  const privateOnly = await repo.prepare({...recipe, gestures: [{...recipe.gestures[0], startFrame: 1200}]});
  const privateFile = join(root, 'prepared-audio', privateOnly.take.sha256);
  await rename(privateFile, privateFile + '.fault');
  const interrupted = {preparationId: privateOnly.preparationId, requestId: 'bound-before-expiry'};
  await assert.rejects(repo.publish(interrupted), {status: 503});
  await rename(privateFile + '.fault', privateFile);
  for (const prep of [expired, privateOnly]) {
    const file = join(root, 'preparations', prep.preparationId);
    await writeFile(file, JSON.stringify({...JSON.parse(await readFile(file)), expiresAt: 0}));
  }
  const {reclaimExpiredDuplicates} = await import('../services/takes/file-store.mjs');
  await Promise.all([reclaimExpiredDuplicates(root), reclaimExpiredDuplicates(root)]);
  const store = fileStore(root);
  for (const mode of ['dry', 'take']) {
    assert.equal(await store.read('prepared-audio/' + expired[mode].sha256), null);
    assert.deepEqual(
      await repo.audio('preparations', active.preparationId, mode),
      await repo.audio('takes', committed.id, mode),
    );
  }
  assert.ok(await store.read('prepared-audio/' + privateOnly.take.sha256));
  assert.ok((await repo.publish(interrupted)).id);
  assert.deepEqual(await repo.publish({preparationId: expired.preparationId, requestId: 'saved'}), committed);
  assert.ok((await repo.publish({preparationId: active.preparationId, requestId: 'second'})).id);
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
