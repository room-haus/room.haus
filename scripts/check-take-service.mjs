// With an origin only, inspect the catalog. --id verifies an existing saved pair.
// --write explicitly creates one permanent test take in a loopback service.
import assert from 'node:assert/strict';
import {createHash, randomUUID} from 'node:crypto';
import {parseArgs} from 'node:util';
import {SPACE_TAKE_DEFAULTS} from '../src/experiences/takes/recipe.mjs';

export async function checkTakeService({origin, id, write = false}) {
  const url = new URL(origin);
  assert.ok(url.href === url.origin + '/' && ['http:', 'https:'].includes(url.protocol), 'Provide an HTTP(S) origin.');
  if (write) {
    assert.ok(['127.0.0.1', '[::1]'].includes(url.hostname), 'Test writes require a literal loopback origin.');
    assert.equal(id, undefined, 'Select either --write or --id.');
  }
  const checkId = (value) => assert.match(value, /^[0-9a-f]{32}$/);
  if (id !== undefined) checkId(id);
  async function request(path, status, body) {
    const response = await fetch(new URL(path, url.origin), {
      redirect: 'error',
      signal: AbortSignal.timeout(30000),
      ...(body ? {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)} : {}),
    });
    assert.equal(response.status, status, path + ' returned HTTP ' + response.status);
    return response;
  }
  async function inspect(record, base) {
    const frames = record.recipe.passage.endFrame - record.recipe.passage.startFrame;
    assert.ok(Number.isSafeInteger(frames) && frames > 0);
    const digests = {};
    for (const mode of ['dry', 'take']) {
      const ref = record[mode];
      assert.equal(ref.format, 's16le');
      assert.equal(ref.sampleRate, 48000);
      assert.equal(ref.channels, 2);
      assert.equal(ref.frameCount, frames);
      assert.equal(ref.byteLength, frames * 4);
      assert.equal(ref.url, base + '/' + mode);
      const audio = await request(base + '/' + mode, 200);
      assert.equal(audio.headers.get('content-type'), 'application/octet-stream');
      const bytes = Buffer.from(await audio.arrayBuffer());
      assert.equal(bytes.byteLength, ref.byteLength);
      digests[mode] = createHash('sha256').update(bytes).digest('hex');
      assert.equal(digests[mode], ref.sha256);
    }
    return digests;
  }
  const catalog = await (await request('/v1/catalog', 200)).json();
  const source = catalog.sources.find((s) => s.id === 'MX029');
  assert.ok(source && source.sampleRate === 48000 && source.channels === 2);
  const result = {source: source.id, revision: source.revision, limits: catalog.limits};
  let auditioned;
  if (write) {
    const settings = SPACE_TAKE_DEFAULTS;
    const recipe = {
      schema: 1,
      experiment: 'audio-space',
      rendererVersion: 1,
      parentId: null,
      passage: {sourceId: source.id, revision: source.revision, ...source.curatedRange},
      initialSettings: settings,
      gestures: [{id: 'service-check', startFrame: 0, endFrame: 12000, settings}],
    };
    const prepared = await (await request('/v1/preparations', 201, recipe)).json();
    checkId(prepared.preparationId);
    assert.deepEqual(prepared.recipe, recipe);
    auditioned = await inspect(prepared, '/v1/preparations/' + prepared.preparationId);
    const publication = {requestId: randomUUID(), preparationId: prepared.preparationId};
    const first = await (await request('/v1/takes', 200, publication)).json();
    const retry = await (await request('/v1/takes', 200, publication)).json();
    assert.deepEqual(first, retry);
    id = retry.id;
    checkId(id);
  }
  if (id) {
    const base = '/v1/takes/' + id;
    const manifest = await (await request(base, 200)).json();
    assert.equal(manifest.id, id);
    const digests = await inspect(manifest, base);
    if (auditioned) assert.deepEqual(digests, auditioned);
    return {...result, id, digests};
  }
  return result;
}

if (import.meta.main) {
  const {positionals, values} = parseArgs({
    allowPositionals: true,
    options: {write: {type: 'boolean'}, id: {type: 'string'}},
  });
  if (positionals.length !== 1) throw Error('Usage: node scripts/check-take-service.mjs ORIGIN [--id ID | --write]');
  console.log(JSON.stringify(await checkTakeService({origin: positionals[0], ...values})));
}
