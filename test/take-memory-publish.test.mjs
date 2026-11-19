import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile, readdir, rename, rm, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {test} from 'node:test';
import {post, get, json, bytes, start, setup, prepare, publish} from '../scripts/fixtures/take-http.mjs';
import {checkTakeService} from '../scripts/check-take-service.mjs';
import {fileStore, reclaimTakeStaging} from '../services/takes/file-store.mjs';
import {takeRepository} from '../services/takes/repository.mjs';
import {fixtureSource} from '../scripts/fixtures/take-service.mjs';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
async function fixture(t) {
  const ctx = await setup(t);
  const {passage} = ctx.recipe;
  const source = await bytes(ctx.origin, '/v1/passage?' + new URLSearchParams(passage));
  function capture(startFrame) {
    const frameCount = 12000;
    const endFrame = startFrame + frameCount;
    const pcm = source.subarray(startFrame * 4, endFrame * 4);
    const ref = {...passage, startFrame, endFrame, frameCount, sampleRate: 48000, channels: 2, format: 's16le', sha256: hash(pcm)};
    return {ref, pcm};
  }
  const a = capture(0), b = capture(1000), twin = capture(48000);
  const g = {id: 'first', startFrame: 0, endFrame: 48000, fragmentRef: a.ref, treatment: 'dissolve', density: 8, level: 1, seedVersion: 1};
  const recipe = {schema: 1, experiment: 'audio-memory', rendererVersion: 1, passage, parentId: null,
    gestures: [g, {...g, id: 'second', startFrame: 48000, endFrame: 96000}]};
  return {...ctx, recipe, a, b, twin};
}
const readTake = (origin, id) => get(origin, '/v1/takes/' + id).then(r => json(r, 200));
async function expire(root, id) {
  const file = join(root, 'preparations', id);
  await writeFile(file, JSON.stringify({...JSON.parse(await readFile(file)), expiresAt: 0}));
}

test('two triggers retain one exact stereo capture across restart, moved and removed variations', async t => {
  const {origin, storeDir, close, recipe, a, b, twin} = await fixture(t);
  const prep = await prepare(origin, {...recipe, captures: [a.ref, b.ref]});
  assert.deepEqual(prep.fragments, [{...a.ref, byteLength: 48000, url: '/v1/preparations/' + prep.preparationId + '/fragments/' + a.ref.sha256}]);
  assert.deepEqual(await bytes(origin, prep.fragments[0].url), a.pcm);
  const {id} = await publish(origin, prep.preparationId);
  const parentFile = join(storeDir, 'takes', id);
  const immutable = await readFile(parentFile);
  await close();
  const fresh = (await start(t, storeDir)).origin;
  const saved = await readTake(fresh, id);
  const publicUrl = '/v1/takes/' + id + '/fragments/' + a.ref.sha256;
  assert.equal(saved.fragments[0].url, publicUrl);
  const independentBytes = await bytes(fresh, publicUrl);
  assert.notEqual(independentBytes.readInt16LE(0), independentBytes.readInt16LE(2));
  assert.deepEqual(independentBytes, a.pcm);
  assert.equal((await get(fresh, publicUrl.replace(a.ref.sha256, b.ref.sha256))).status, 404);
  const moved = {...recipe, parentId: id, gestures: [{...recipe.gestures[0], startFrame: 6000}, {...recipe.gestures[1], fragmentRef: twin.ref}]};
  const child = await publish(fresh, (await prepare(fresh, moved)).preparationId);
  const edited = await readTake(fresh, child.id);
  assert.deepEqual(edited.recipe, moved);
  assert.deepEqual(edited.fragments.map(f => f.startFrame), [0, 48000]);
  assert.equal(edited.fragments[0].url, edited.fragments[1].url);
  const removed = await publish(fresh, (await prepare(fresh, {...moved, gestures: []})).preparationId);
  assert.deepEqual((await readTake(fresh, removed.id)).fragments, []);
  assert.equal((await get(fresh, '/v1/takes/' + removed.id + '/fragments/' + a.ref.sha256)).status, 404);
  assert.deepEqual(await readFile(parentFile), immutable);
  assert.deepEqual(await bytes(fresh, publicUrl), a.pcm);
  assert.deepEqual((await checkTakeService({origin: fresh, id})).digests.fragments, [a.ref.sha256]);
});

test('lost or changed inherited material forbids recapture while the saved pair can play', async t => {
  const {origin, recipe, storeDir, a} = await fixture(t);
  const prep = await prepare(origin, recipe);
  const {id} = await publish(origin, prep.preparationId);
  const file = join(storeDir, 'audio', a.ref.sha256);
  const corrupt = Buffer.from(a.pcm);
  corrupt[0] ^= 1;
  for (const fault of ['changed', 'absent']) {
    if (fault === 'changed') await writeFile(file, corrupt);
    else await rm(file);
    const saved = await readTake(origin, id);
    assert.equal((await get(origin, saved.fragments[0].url)).status, 503);
    for (const mode of ['dry', 'take']) assert.equal(hash(await bytes(origin, saved[mode].url)), prep[mode].sha256);
    assert.equal((await post(origin, '/v1/preparations', {...recipe, parentId: id})).status, 503);
    await assert.rejects(checkTakeService({origin, id}));
  }
});

test('incomplete Memory publication survives offline cleanup and concurrent retry after expiry', async t => {
  const {origin, storeDir, close, recipe, a, b} = await fixture(t);
  const other = await prepare(origin, {...recipe, gestures: [{...recipe.gestures[0], fragmentRef: b.ref}]});
  const prep = await prepare(origin, recipe);
  const shared = await prepare(origin, {...recipe, gestures: recipe.gestures.slice(0,1)});
  const input = {requestId: 'interrupted', preparationId: prep.preparationId};
  const performed = join(storeDir, 'prepared-audio', prep.take.sha256);
  await rename(performed, performed + '.missing');
  assert.equal((await post(origin, '/v1/takes', input)).status, 503);
  assert.deepEqual(await readFile(join(storeDir, 'audio', a.ref.sha256)), a.pcm);
  await rename(performed + '.missing', performed);
  const binding = JSON.parse(await readFile(join(storeDir, 'requests', hash(input.requestId))));
  assert.equal((await get(origin, '/v1/takes/' + binding.id)).status, 404);
  await expire(storeDir, prep.preparationId);
  await expire(storeDir, other.preparationId);
  await rm(join(storeDir, 'audio', a.ref.sha256));
  await close();
  const orphanProof = join(storeDir, 'preparation-proofs', '9'.repeat(32));
  await writeFile(orphanProof, '0'.repeat(64));
  assert.equal((await reclaimTakeStaging(storeDir)).expiredPreparations, 1);
  await assert.rejects(readFile(orphanProof), {code:'ENOENT'});
  await assert.rejects(readFile(join(storeDir, 'preparation-proofs', other.preparationId)), {code:'ENOENT'});
  assert.equal((await readFile(join(storeDir, 'preparation-proofs', shared.preparationId))).length, 64);
  assert.deepEqual(await readFile(join(storeDir, 'prepared-audio', a.ref.sha256)), a.pcm);
  await assert.rejects(readFile(join(storeDir, 'prepared-audio', b.ref.sha256)), {code: 'ENOENT'});
  const [one, two] = await Promise.all([start(t, storeDir), start(t, storeDir)]);
  assert.equal((await get(one.origin, prep.fragments[0].url)).status, 410);
  assert.deepEqual(await bytes(one.origin, shared.fragments[0].url), a.pcm);
  const replies = await Promise.all([one, two].map(s => publish(s.origin, input.preparationId, input.requestId)));
  assert.equal(replies[0].id, binding.id);
  assert.deepEqual(replies[0], replies[1]);
  assert.deepEqual(await bytes(two.origin, (await readTake(one.origin, binding.id)).fragments[0].url), a.pcm);
  assert.equal((await post(one.origin, '/v1/takes', {requestId:'expired', preparationId:other.preparationId})).status, 410);
});

test('forged digest, malformed fragment and unknown methods fail before a preparation is written', async t => {
  const {origin, storeDir, recipe, a} = await fixture(t);
  for (const fields of [{fragmentRef:{...a.ref, sha256:'0'.repeat(64)}}, {fragmentRef:{...a.ref, channels:1}},
    {treatment:'echo'}, {seedVersion:2}]) {
    assert.equal((await post(origin, '/v1/preparations', {...recipe, gestures:[{...recipe.gestures[0], ...fields}]})).status, 400);
  }
  await assert.rejects(readdir(join(storeDir,'preparations')), {code:'ENOENT'});
});

test('material byte, event and voice ceilings precede source reads or sample allocation', async t => {
  const {recipe} = await fixture(t);
  const source = fixtureSource();
  for (const [writeLimits, gestures, expected] of [
    [{maxFragmentDecodedBytes:1}, recipe.gestures, /fragment.*bytes/i],
    [{maxFragmentEvents:1}, recipe.gestures, /fragment.*events/i],
    [{}, Array.from({length:17}, (_,i) => ({...recipe.gestures[0], id:'v'+i})), /voices/i],
  ]) {
    const repo = takeRepository({...source, writeLimits, sourceStore:{readChunk(){throw Error('Unexpected sample read');}}});
    await assert.rejects(repo.prepare({...recipe, gestures}), expected);
  }
});

test('a damaged fragment table disables editing while independently stored listener audio remains playable', async t => {
  const {origin, recipe, storeDir} = await fixture(t);
  const prep = await prepare(origin, recipe);
  const {id} = await publish(origin, prep.preparationId);
  const file = join(storeDir, 'takes', id);
  await writeFile(file, JSON.stringify({...JSON.parse(await readFile(file)), fragments: []}));
  const saved = await readTake(origin, id);
  assert.equal(saved.editable, false);
  assert.deepEqual(saved.fragments, []);
  assert.deepEqual(await bytes(origin, saved.take.url), await bytes(origin, prep.take.url));
  assert.equal((await post(origin, '/v1/preparations', {...recipe, parentId:id})).status, 503);
});

test('a digest cannot vouch for another source interval, and damaged staging cannot commit', async t => {
  const {origin, storeDir, recipe, a, b} = await fixture(t);
  const forged = {...b.ref, sha256:a.ref.sha256};
  const invalid = {...recipe, gestures:[recipe.gestures[0], {...recipe.gestures[1], fragmentRef:forged}]};
  assert.equal((await post(origin, '/v1/preparations', invalid)).status, 400);
  const prep = await prepare(origin, recipe);
  const file = join(storeDir, 'prepared-audio', a.ref.sha256);
  await writeFile(file, b.pcm);
  const input = {preparationId: prep.preparationId, requestId:'damaged'};
  assert.equal((await post(origin, '/v1/takes', input)).status, 503);
  const binding = JSON.parse(await readFile(join(storeDir,'requests', hash(input.requestId))));
  assert.equal((await get(origin, '/v1/takes/' + binding.id)).status, 404);
});

test('a render and capture sharing one digest survive reclamation and repair without their private manifest', async t => {
  const {storeDir, close, recipe} = await fixture(t);
  await close();
  const n = 12000;
  const pcm = Buffer.alloc(n * 4);
  for (let i = 0; i < n; i++) {
    pcm.writeInt16LE(1, i * 4);
    // Half-gain quantization maps +1 back to +1 and 0 back to 0.
  }
  const sha256 = hash(pcm);
  const {sourceId:id, revision} = recipe.passage;
  const source = {catalog:[{id, revision, totalFrames:n, channels:2, sampleRate:48000, chunks:[{startFrame:0, frameCount:n, sha256}]}],
    sourceStore:{readChunk: () => pcm}};
  const store = fileStore(storeDir);
  const repo = takeRepository({...source, store});
  const silentTrigger = {...recipe.gestures[0], level:0, endFrame:n, fragmentRef:{...recipe.gestures[0].fragmentRef, sha256}};
  const prep = await repo.prepare({...recipe, passage:{...recipe.passage,endFrame:n}, gestures:[silentTrigger]});
  assert.equal(prep.dry.sha256, sha256);
  assert.equal(prep.take.sha256, sha256);
  const input = {preparationId:prep.preparationId, requestId:'shared'};
  const result = await repo.publish(input);
  await rm(join(storeDir,'preparations',prep.preparationId));
  await rm(join(storeDir,'audio',sha256));
  store.close();
  await reclaimTakeStaging(storeDir);
  const fresh = fileStore(storeDir);
  try {
    const reopened = takeRepository({...source, store:fresh});
    assert.deepEqual(await reopened.publish(input), result);
    assert.deepEqual(await reopened.fragment('takes', result.id, sha256), pcm);
    assert.deepEqual(await reopened.audio('takes', result.id, 'dry'), pcm);
  } finally {
    fresh.close();
  }
});

test('each descriptor length must verify even when multiple intervals claim the same digest', async t => {
  const {origin, storeDir, recipe, twin} = await fixture(t);
  const prep = await prepare(origin, {...recipe, gestures: [recipe.gestures[0], {...recipe.gestures[1], fragmentRef: twin.ref}]});
  const file = join(storeDir, 'preparations', prep.preparationId);
  const record = JSON.parse(await readFile(file));
  // The longer row claims the same bytes as the valid later row. A digest-only
  // deduplication pass would validate the final row's length and accept both.
  for (const ref of [record.fragments[0], record.recipe.gestures[0].fragmentRef]) {
    ref.endFrame++;
    ref.frameCount++;
  }
  record.fragments[0].byteLength += 4;
  await writeFile(file, JSON.stringify(record));
  assert.equal((await post(origin, '/v1/takes', {preparationId: prep.preparationId, requestId: 'bad-length'})).status, 503);
  await assert.rejects(readdir(join(storeDir, 'takes')), {code: 'ENOENT'});
});

test('publication pins the auditioned recipe and all asset mappings before first use and across interrupted retries', async t => {
  const {origin, storeDir, recipe, b} = await fixture(t);
  const mutations = {
    unsupported: record => { record.recipe.gestures[0].treatment = 'unknown'; },
    supported: record => { record.recipe.gestures[0].treatment = 'repeat'; },
    swappedRender: record => { record.take = record.dry; },
    swappedCapture: (record, other) => {
      record.fragments = other.fragments;
      for (const gesture of record.recipe.gestures) gesture.fragmentRef = b.ref;
    },
  };
  const other = await prepare(origin, {...recipe, gestures: recipe.gestures.map(g => ({...g, fragmentRef: b.ref}))});
  const stagedOther = JSON.parse(await readFile(join(storeDir, 'preparations', other.preparationId)));
  for (const bound of [true, false]) {
    const prep = await prepare(origin, recipe);
    const file = join(storeDir, 'preparations', prep.preparationId);
    const pristine = await readFile(file);
    const input = {preparationId: prep.preparationId, requestId: 'pinned-' + bound};
    const bindingFile = join(storeDir, 'requests', hash(input.requestId));
    if (bound) {
      const performed = join(storeDir, 'prepared-audio', prep.take.sha256);
      await rename(performed, performed + '.fault');
      assert.equal((await post(origin, '/v1/takes', input)).status, 503);
      await rename(performed + '.fault', performed);
    }
    for (const [name, change] of Object.entries(mutations)) {
      const record = JSON.parse(pristine);
      change(record, stagedOther);
      await writeFile(file, JSON.stringify(record));
      assert.equal((await post(origin, '/v1/takes', input)).status, 503, 'bound=' + bound + ' mutation=' + name);
      if (bound) {
        const binding = JSON.parse(await readFile(bindingFile));
        assert.equal((await get(origin, '/v1/takes/' + binding.id)).status, 404);
      } else {
        await assert.rejects(readFile(bindingFile), {code:'ENOENT'});
      }
    }
    if (bound) {
      // Even replacing both private records with a different complete, internally
      // consistent preparation cannot replace the performance pinned by the request.
      const proofFile = join(storeDir, 'preparation-proofs', prep.preparationId);
      const originalProof = await readFile(proofFile);
      await writeFile(file, JSON.stringify({...stagedOther, id:prep.preparationId}));
      await writeFile(proofFile, await readFile(join(storeDir, 'preparation-proofs', other.preparationId)));
      assert.equal((await post(origin, '/v1/takes', input)).status, 503);
      await writeFile(proofFile, originalProof);
    }
    await writeFile(file, pristine);
    const {id} = await publish(origin, input.preparationId, input.requestId);
    assert.deepEqual((await readTake(origin, id)).recipe, recipe);
  }
});

test('a private record rewritten using legacy fields cannot replace a newly auditioned performance', async t => {
  const {origin, storeDir, recipe} = await fixture(t);
  const prep = await prepare(origin, recipe);
  const file = join(storeDir, 'preparations', prep.preparationId);
  const {id, expiresAt, dry, take, fragments} = JSON.parse(await readFile(file));
  const changed = {...recipe, gestures: recipe.gestures.map(g => ({...g, id:g.id + '-changed'}))};
  await writeFile(file, JSON.stringify({id, expiresAt, dry, take, fragments, recipe: changed}));
  // These renamed gestures sound identical. Re-rendering alone cannot detect the substitution.
  const input = {preparationId:id, requestId:'rewritten'};
  assert.equal((await post(origin, '/v1/takes', input)).status, 503);
});

test('offline cleanup preserves staged bytes when an active preparation loses its fragment references', async t => {
  const {origin, storeDir, close, recipe, a} = await fixture(t);
  const prep = await prepare(origin, recipe);
  await close();
  const file = join(storeDir, 'preparations', prep.preparationId);
  const record = JSON.parse(await readFile(file));
  await writeFile(file, JSON.stringify({...record, fragments:[], recipe:{...recipe, gestures:[]}}));
  await assert.rejects(reclaimTakeStaging(storeDir), /checksum/i);
  assert.deepEqual(await readFile(join(storeDir, 'prepared-audio', a.ref.sha256)), a.pcm);
});
