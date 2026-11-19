import {createHash, randomBytes} from 'node:crypto';
import {readPassage} from './passage.mjs';
import {normalizePassage, normalizeRecipe, validateRecipe, reachableFragmentRefs, MEMORY_TAKE_EXPERIMENT, SPACE_TAKE_EXPERIMENT} from '../../src/experiences/takes/recipe.mjs';
import {verifyFragmentBytes} from '../../src/experiences/takes/fragment-asset.mjs';
import {checkMemoryBudget} from '../../src/experiences/takes/memory-render.mjs';
import {fragmentTable} from './fragment-table.mjs';
import {renderTake} from '../../src/experiences/takes/render.mjs';
import {TAKE_SOURCE_SAMPLE_RATE} from '../../src/experiences/takes/source.mjs';

export const limits = Object.freeze({maxPassageFrames: 30 * TAKE_SOURCE_SAMPLE_RATE, maxGestures: 24,
  maxFragmentDecodedBytes: 24 * 2 * TAKE_SOURCE_SAMPLE_RATE * 8, maxFragmentEvents: 2048});
const day = 24 * 60 * 60 * 1000;
const opaqueId = () => randomBytes(16).toString('hex');
const validId = id => typeof id === 'string' && /^[a-f0-9]{32}$/.test(id);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const modes = ['dry', 'take'];

export class TakeError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const unavailable = () => new TakeError(503, 'The saved audio is temporarily unavailable.');
const missing = () => new TakeError(404, 'Take or preparation unavailable.');
const expired = () => new TakeError(410, 'Preparation unavailable. Prepare and audition this draft again.');

// A previously published pair can still be served from its stable PCM envelope
// when this editor cannot interpret the performance that created it.
function publishedPassage(recipe) {
  if (![SPACE_TAKE_EXPERIMENT, MEMORY_TAKE_EXPERIMENT].includes(recipe?.experiment) || !Number.isSafeInteger(recipe.schema) ||
      recipe.schema < 1 || !Number.isSafeInteger(recipe.rendererVersion) || recipe.rendererVersion < 1) {
    throw unavailable();
  }
  return normalizePassage(recipe.passage);
}

function references(record, scope, id, fragments) {
  const fields = scope === 'takes' ? {id, parentId: record.recipe.parentId} : {preparationId: id};
  const result = {...fields, recipe: record.recipe};
  for (const mode of modes) result[mode] = {...record[mode], url: '/v1/' + scope + '/' + id + '/' + mode};
  if (record.recipe.experiment === MEMORY_TAKE_EXPERIMENT) {
    result.fragments = fragments.map(ref => ({...ref, url: '/v1/' + scope + '/' + id + '/fragments/' + ref.sha256}));
  }
  return result;
}

export function takeRepository({catalog, sourceStore, store, writeLimits = limits}) {
  writeLimits = {...limits, ...writeLimits};
  const publicSources = catalog.map(({id, revision, sampleRate, channels, totalFrames, curatedRange, denseRange, peaks}) =>
    ({id, revision, sampleRate, channels, totalFrames, curatedRange, denseRange, peaks}));

  async function document(key) {
    const bytes = await store.read(key);
    return bytes === null ? null : JSON.parse(bytes);
  }

  async function saved(scope, id, allowExpired = false) {
    if (!validId(id)) throw missing();
    const record = await document(scope + '/' + id);
    if (!record) throw missing();
    try {
      // Treat malformed stored records as unavailable, including paths/digests.
      if (record.id !== id) throw unavailable();
      const recipe = record.recipe;
      if (recipe.parentId !== null && !validId(recipe.parentId)) throw unavailable();
      const passage = publishedPassage(recipe);
      const frames = passage.endFrame - passage.startFrame;
      if (!Number.isSafeInteger(frames * 4)) throw unavailable();
      for (const mode of modes) {
        const ref = record[mode];
        if (!ref || !/^[a-f0-9]{64}$/.test(ref.sha256) || ref.frameCount !== frames ||
          ref.byteLength !== frames * 4 || ref.channels !== 2 || ref.format !== 's16le' ||
          ref.sampleRate !== TAKE_SOURCE_SAMPLE_RATE) throw unavailable();
      }
      if (scope === 'preparations' && !Number.isSafeInteger(record.expiresAt)) throw unavailable();
    } catch {
      throw unavailable();
    }
    if (scope === 'preparations' && !allowExpired && record.expiresAt <= Date.now()) {
      throw expired();
    }
    return record;
  }

  async function verifiedAudio(collection, ref) {
    const pcm = await store.read(collection + '/' + ref.sha256);
    if (pcm === null) return collection === 'prepared-audio' ? verifiedAudio('audio', ref) : null;
    if (pcm.byteLength !== ref.byteLength || hash(pcm) !== ref.sha256) throw unavailable();
    return pcm;
  }

  async function passage(selection) {
    if (selection.endFrame - selection.startFrame > writeLimits.maxPassageFrames) throw new RangeError('This passage is too long.');
    return readPassage(catalog, selection, sourceStore);
  }

  function checkWritePolicy(recipe) {
    const normalized = normalizeRecipe(recipe, writeLimits);
    if (normalized.experiment === MEMORY_TAKE_EXPERIMENT) checkMemoryBudget(normalized, writeLimits);
  }

  async function stage(ref, bytes) {
    await store.putIfAbsent('prepared-audio/' + ref.sha256, bytes);
    if (!await verifiedAudio('prepared-audio', ref)) throw unavailable();
  }

  async function loadMaterials(refs, parent, recipe, source) {
    const inherited = parent ? fragmentTable(parent) : [];
    const materials = new Map();
    for (const ref of refs) {
      const ancestor = inherited.find(row => row.startFrame === ref.startFrame && row.endFrame === ref.endFrame);
      if (ancestor) {
        if (ancestor.sha256 !== ref.sha256) throw new RangeError('The inherited capture digest has changed.');
        const bytes = await verifiedAudio('audio', ancestor);
        if (!bytes) throw unavailable();
        materials.set(ref.sha256, bytes);
      } else {
        const offset = (ref.startFrame - recipe.passage.startFrame) * 4;
        // Verify each interval independently, including different intervals claiming identical bytes.
        const {pcm} = await verifyFragmentBytes(ref, recipe.passage, source.pcm.subarray(offset, offset + ref.byteLength));
        materials.set(ref.sha256, pcm);
      }
    }
    return materials;
  }

  async function prepare(input) {
    let parent = null;
    if (input?.parentId != null) {
      if (!validId(input.parentId)) throw new RangeError('Invalid parent take ID.');
      try {
        parent = await saved('takes', input.parentId);
        checkWritePolicy(parent.recipe);
      } catch (error) {
        if (error.status === 404) throw new RangeError('Parent take unavailable.');
        throw error;
      }
    }
    const recipe = validateRecipe(input, catalog, parent, writeLimits);
    const memory = recipe.experiment === MEMORY_TAKE_EXPERIMENT;
    if (memory) checkMemoryBudget(recipe, writeLimits);
    const fragments = memory ? reachableFragmentRefs(recipe).map(ref => ({...ref, byteLength: ref.frameCount * 4})) : [];
    const source = await passage(recipe.passage);
    const materials = await loadMaterials(fragments, parent, recipe, source);
    const render = renderTake(recipe, source, materials);
    const id = opaqueId();
    const record = {id, recipe, expiresAt: Date.now() + day};
    if (memory) {
      record.fragments = fragments;
      for (const [sha256, bytes] of materials) await stage({sha256, byteLength: bytes.byteLength}, bytes);
    }
    for (const mode of modes) {
      const {channels, sampleRate, format, frameCount} = render;
      const bytes = render[mode];
      const ref = {channels, sampleRate, format, frameCount, byteLength: bytes.byteLength, sha256: hash(bytes)};
      await stage(ref, bytes);
      record[mode] = ref;
    }
    if (!await store.putIfAbsent('preparations/' + id, JSON.stringify(record))) throw unavailable();
    return references(record, 'preparations', id, fragments);
  }

  // Resume each stage using its durable output. The first successful binding owns
  // the request across processes, including after a crash before the manifest.
  async function publish(input) {
    const {preparationId, requestId} = input ?? {};
    if (!validId(preparationId) || typeof requestId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(requestId)) {
      throw new RangeError('Invalid preparation or publication request ID.');
    }
    const key = 'requests/' + hash(requestId);
    let binding = await document(key);
    if (!binding) {
      const preparation = await saved('preparations', preparationId).catch(error => {
        // Cleanup can already have removed the expired private manifest.
        if (error.status === 404) throw expired();
        throw error;
      });
      checkWritePolicy(preparation.recipe);
      fragmentTable(preparation);
      await store.putIfAbsent(key, JSON.stringify({preparationId, id: opaqueId()}));
      binding = await document(key);
    }
    if (!binding || !validId(binding.id) || !validId(binding.preparationId)) throw unavailable();
    if (binding.preparationId !== preparationId) throw new TakeError(409, 'Request ID belongs to another preparation.');
    const {id} = binding;
    let committed = null;
    try {
      committed = await saved('takes', id);
    } catch (error) {
      if (error.status !== 404) throw error;
    }
    const record = committed ?? await saved('preparations', preparationId, true);
    const assets = [...fragmentTable(record), ...modes.map(mode => record[mode])];
    for (const ref of assets) {
      if (await verifiedAudio('audio', ref)) continue;
      const bytes = await verifiedAudio('prepared-audio', ref);
      if (!bytes) throw unavailable();
      await store.putIfAbsent('audio/' + ref.sha256, bytes);
      if (!await verifiedAudio('audio', ref)) throw unavailable();
    }
    if (!committed) {
      const manifest = {id, recipe: record.recipe, dry: record.dry, take: record.take};
      if (record.fragments) manifest.fragments = record.fragments;
      await store.putIfAbsent('takes/' + id, JSON.stringify(manifest));
      const visible = await saved('takes', id);
      if (JSON.stringify(visible) !== JSON.stringify(manifest)) throw unavailable();
    }
    return {id, parentId: record.recipe.parentId};
  }

  async function take(id) {
    const record = await saved('takes', id);
    for (const mode of modes) if (!await verifiedAudio('audio', record[mode])) throw unavailable();
    let editable = true;
    let fragments = [];
    try {
      fragments = fragmentTable(record);
      checkWritePolicy(record.recipe);
    } catch {
      editable = false;
    }
    return {...references(record, 'takes', id, fragments), editable};
  }

  async function audio(scope, id, mode) {
    const record = await saved(scope, id);
    const bytes = await verifiedAudio(scope === 'takes' ? 'audio' : 'prepared-audio', record[mode]);
    if (!bytes) throw unavailable();
    return bytes;
  }

  async function fragment(scope, id, sha256) {
    const record = await saved(scope, id);
    const ref = fragmentTable(record).find(row => row.sha256 === sha256);
    if (!ref) throw missing();
    const bytes = await verifiedAudio(scope === 'takes' ? 'audio' : 'prepared-audio', ref);
    if (!bytes) throw unavailable();
    return bytes;
  }

  return {catalog: {sources: publicSources, limits: writeLimits}, passage, prepare, publish, take, audio, fragment};
}
