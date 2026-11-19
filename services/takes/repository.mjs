import {createHash, randomBytes} from 'node:crypto';
import {readPassage} from './passage.mjs';
import {normalizePassage, normalizeRecipe, validateRecipe, SPACE_TAKE_EXPERIMENT} from '../../src/experiences/takes/recipe.mjs';
import {renderTake} from '../../src/experiences/takes/render.mjs';
import {TAKE_SOURCE_SAMPLE_RATE} from '../../src/experiences/takes/source.mjs';

export const limits = Object.freeze({maxPassageFrames: 30 * TAKE_SOURCE_SAMPLE_RATE, maxGestures: 24});
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

// A previously published pair can still be served from its stable PCM envelope
// when this editor cannot interpret the performance that created it.
function publishedPassage(recipe) {
  if (recipe?.experiment !== SPACE_TAKE_EXPERIMENT || !Number.isSafeInteger(recipe.schema) ||
      recipe.schema < 1 || !Number.isSafeInteger(recipe.rendererVersion) || recipe.rendererVersion < 1) {
    throw unavailable();
  }
  return normalizePassage(recipe.passage);
}

function references(record, scope, id) {
  const fields = scope === 'takes' ? {id, parentId: record.recipe.parentId} : {preparationId: id};
  const result = {...fields, recipe: record.recipe};
  for (const mode of modes) result[mode] = {...record[mode], url: '/v1/' + scope + '/' + id + '/' + mode};
  return result;
}

export function takeRepository({catalog, sourceStore, store, writeLimits = limits}) {
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
      const passage = scope === 'takes' ? publishedPassage(recipe) : normalizeRecipe(recipe, writeLimits).passage;
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
      throw new TakeError(410, 'Preparation expired. Prepare and audition this draft again.');
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

  async function prepare(input) {
    let parent = null;
    if (input?.parentId != null) {
      if (!validId(input.parentId)) throw new RangeError('Invalid parent take ID.');
      try {
        parent = await saved('takes', input.parentId);
        normalizeRecipe(parent.recipe, writeLimits);
      } catch (error) {
        if (error.status === 404) throw new RangeError('Parent take unavailable.');
        throw error;
      }
    }
    const recipe = validateRecipe(input, catalog, parent, writeLimits);
    const render = renderTake(recipe, await passage(recipe.passage));
    const id = opaqueId();
    const record = {id, recipe, expiresAt: Date.now() + day};
    for (const mode of modes) {
      const {channels, sampleRate, format, frameCount} = render;
      const bytes = render[mode];
      const ref = {channels, sampleRate, format, frameCount, byteLength: bytes.byteLength, sha256: hash(bytes)};
      await store.putIfAbsent('prepared-audio/' + ref.sha256, bytes);
      if (!await verifiedAudio('prepared-audio', ref)) throw unavailable();
      record[mode] = ref;
    }
    if (!await store.putIfAbsent('preparations/' + id, JSON.stringify(record))) throw unavailable();
    return references(record, 'preparations', id);
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
      await saved('preparations', preparationId);
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
    for (const mode of modes) {
      const ref = record[mode];
      if (await verifiedAudio('audio', ref)) continue;
      const bytes = await verifiedAudio('prepared-audio', ref);
      if (!bytes) throw unavailable();
      await store.putIfAbsent('audio/' + ref.sha256, bytes);
      if (!await verifiedAudio('audio', ref)) throw unavailable();
    }
    if (!committed) {
      const manifest = {id, recipe: record.recipe, dry: record.dry, take: record.take};
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
    try {
      normalizeRecipe(record.recipe, writeLimits);
    } catch {
      editable = false;
    }
    return {...references(record, 'takes', id), editable};
  }

  async function audio(scope, id, mode) {
    const record = await saved(scope, id);
    const bytes = await verifiedAudio(scope === 'takes' ? 'audio' : 'prepared-audio', record[mode]);
    if (!bytes) throw unavailable();
    return bytes;
  }

  return {catalog: {sources: publicSources, limits: writeLimits}, passage, prepare, publish, take, audio};
}
