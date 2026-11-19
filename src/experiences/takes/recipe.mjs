import {normalizeFragmentRef} from './fragment-asset.mjs';
import {requireSourcePassage, TAKE_SOURCE_SAMPLE_RATE} from './source.mjs';
import {SPACE_DELAY_CALIBRATION_V1} from '../audio-space/delay-calibration.mjs';

export const TAKE_RECIPE_SCHEMA = 1;
export const SPACE_TAKE_EXPERIMENT = 'audio-space';
export const MEMORY_TAKE_EXPERIMENT = 'audio-memory';
export const MEMORY_TAKE_RENDERER_VERSION = 1;
export const SPACE_TAKE_RENDERER_VERSION = 1;
export const SPACE_TAKE_MAX_DELAY_FRAMES = 1.5 * TAKE_SOURCE_SAMPLE_RATE;
export const SPACE_TAKE_MAX_FEEDBACK = SPACE_DELAY_CALIBRATION_V1.maxFeedback;

/** @typedef {{sourceId: string, revision: string, startFrame: number, endFrame: number}} TakePassage */
/** @typedef {{delayFrames: number, feedback: number, wetLevel: number, stereoWidth: number}} SpaceTakeSettings */
/** @typedef {{id: string, startFrame: number, endFrame: number, settings: SpaceTakeSettings}} SpaceGesture */
/** @typedef {{schema: 1, experiment: 'audio-space', rendererVersion: 1, passage: TakePassage, initialSettings: SpaceTakeSettings, gestures: SpaceGesture[], parentId: string | null}} SpaceRecipeV1 */
/** @typedef {{id: string, startFrame: number, endFrame: number, fragmentRef: import('./fragment-asset.mjs').FragmentRef, treatment: 'repeat'|'dissolve', density: number, level: number, seedVersion: 1}} MemoryGesture */
/** @typedef {{schema: 1, experiment: 'audio-memory', rendererVersion: 1, passage: TakePassage, gestures: MemoryGesture[], parentId: string | null}} MemoryRecipeV1 */
/** @typedef {SpaceRecipeV1 | MemoryRecipeV1} RecipeV1 */
/** @typedef {{id: string, recipe: RecipeV1}} PublishedRecipe */
/** @typedef {{id: string, revision: string, totalFrames: number}} TakeSourceEntry */
/** @typedef {{maxPassageFrames?: number, maxGestures?: number}} RecipeLimits */

/** @type {Readonly<SpaceTakeSettings>} */
export const SPACE_TAKE_DEFAULTS = Object.freeze({
  delayFrames: 9696,
  feedback: 0.168,
  wetLevel: 0.5,
  stereoWidth: 0,
});

const stableId = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
const frame = value => Number.isSafeInteger(value) && value >= 0;
const level = (value, max) => Number.isFinite(value) && value >= 0 && value <= max;

/** @param {unknown} passage @returns {TakePassage} */
export function normalizePassage(passage) {
  const {sourceId, revision, startFrame, endFrame} = passage ?? {};
  if (typeof sourceId !== 'string' || !sourceId || typeof revision !== 'string' || !revision) {
    throw new RangeError('Choose a source revision for this passage.');
  }
  if (!frame(startFrame) || !frame(endFrame) || startFrame >= endFrame) {
    throw new RangeError('Invalid source passage bounds.');
  }
  return {sourceId, revision, startFrame: startFrame + 0, endFrame};
}

/** @param {TakePassage | undefined} left @param {TakePassage} right */
export function samePassage(left, right) {
  return left?.sourceId === right.sourceId && left.revision === right.revision
    && left.startFrame === right.startFrame && left.endFrame === right.endFrame;
}

/** @param {unknown} settings @returns {SpaceTakeSettings} */
function normalizeSettings(settings) {
  const {delayFrames, feedback, wetLevel, stereoWidth} = settings ?? {};
  if (!frame(delayFrames) || delayFrames < 1 || delayFrames > SPACE_TAKE_MAX_DELAY_FRAMES
    || !level(feedback, SPACE_TAKE_MAX_FEEDBACK) || !level(wetLevel, 1) || !level(stereoWidth, 1)) {
    throw new RangeError('Invalid echo settings. Resolve the delay to frames and use finite levels in range.');
  }
  return {delayFrames, feedback: feedback + 0, wetLevel: wetLevel + 0, stereoWidth: stereoWidth + 0};
}

/** @param {unknown} gesture @param {number} length @returns {SpaceGesture} */
export function normalizeSpaceGesture(gesture, length) {
  const {id, startFrame, endFrame, settings} = gesture ?? {};
  if (!stableId(id)) throw new RangeError('Invalid gesture ID.');
  if (!frame(startFrame) || !frame(endFrame) || startFrame >= endFrame || endFrame > length) {
    throw new RangeError('Keep the whole echo throw inside the passage.');
  }
  return {id, startFrame: startFrame + 0, endFrame, settings: normalizeSettings(settings)};
}

/** @param {unknown} gesture @param {TakePassage} passage @returns {MemoryGesture} */
export function normalizeMemoryGesture(gesture, passage) {
  const {id, startFrame, endFrame, fragmentRef, treatment, density, level: gain, seedVersion} = gesture ?? {};
  if (!stableId(id)) throw new RangeError('Invalid gesture ID.');
  if (!frame(startFrame) || !frame(endFrame) || startFrame >= endFrame || endFrame > passage.endFrame - passage.startFrame) {
    throw new RangeError('Keep the whole fragment trigger inside the passage.');
  }
  if (!['repeat', 'dissolve'].includes(treatment) || !Number.isInteger(density) || density < 1 || density > 8
    || !level(gain, 1) || seedVersion !== 1) throw new RangeError('Invalid fragment treatment or seed version.');
  return {id, startFrame: startFrame + 0, endFrame, fragmentRef: normalizeFragmentRef(fragmentRef, passage),
    treatment, density, level: gain + 0, seedVersion};
}

/** @param {unknown[]} gestures @param {number} length @returns {SpaceGesture[]} */
function normalizeGestures(gestures, length) {
  const ids = new Set();
  const ordered = Array.from(gestures, gesture => normalizeSpaceGesture(gesture, length))
    .sort((a, b) => a.startFrame - b.startFrame);

  let lastEnd = 0;
  for (const gesture of ordered) {
    if (ids.has(gesture.id)) throw new RangeError(`Duplicate gesture ID: ${gesture.id}.`);
    ids.add(gesture.id);
    if (gesture.startFrame < lastEnd) throw new RangeError('Echo throws cannot overlap while sending.');
    lastEnd = gesture.endFrame;
  }
  return ordered;
}

/** @overload @param {{experiment:'audio-space', [key:string]: unknown}} input @param {RecipeLimits} [limits] @returns {SpaceRecipeV1} */
/** @overload @param {{experiment:'audio-memory', [key:string]: unknown}} input @param {RecipeLimits} [limits] @returns {MemoryRecipeV1} */
/** @overload @param {unknown} input @param {RecipeLimits} [limits] @returns {RecipeV1} */
/**
 * Copy the versioned fields in stable order and enforce invariants needed by a local edit.
 * Use validateRecipe at catalog and publication boundaries.
 * @param {unknown} input @param {RecipeLimits} [limits] @returns {RecipeV1}
 */
export function normalizeRecipe(input, {maxPassageFrames, maxGestures} = {}) {
  const {schema, experiment, rendererVersion, passage, initialSettings, gestures, parentId} = input ?? {};
  if (schema !== TAKE_RECIPE_SCHEMA) throw new RangeError('Unsupported take recipe schema.');
  if (experiment !== SPACE_TAKE_EXPERIMENT && experiment !== MEMORY_TAKE_EXPERIMENT) throw new RangeError('Unsupported take experiment.');
  if (rendererVersion !== (experiment === SPACE_TAKE_EXPERIMENT ? SPACE_TAKE_RENDERER_VERSION : MEMORY_TAKE_RENDERER_VERSION)) throw new RangeError('Unsupported take renderer version.');
  if (parentId !== null && !stableId(parentId)) throw new RangeError('Invalid parent take ID.');
  if (!Array.isArray(gestures)) throw new RangeError('The recipe must have a gesture list.');

  const selected = normalizePassage(passage);
  const length = selected.endFrame - selected.startFrame;
  if (maxPassageFrames !== undefined && length > maxPassageFrames) throw new RangeError('This passage is too long.');
  if (maxGestures !== undefined && gestures.length > maxGestures) throw new RangeError('This take has too many gestures.');

  if (experiment === MEMORY_TAKE_EXPERIMENT) {
    const ordered = Array.from(gestures, g => normalizeMemoryGesture(g, selected)).sort((a, b) => a.startFrame - b.startFrame);
    if (new Set(ordered.map(g => g.id)).size !== ordered.length) throw new RangeError('Duplicate fragment trigger ID.');
    return {schema, experiment, rendererVersion, passage: selected, gestures: ordered, parentId};
  }
  return {
    schema, experiment, rendererVersion,
    passage: selected,
    initialSettings: normalizeSettings(initialSettings),
    gestures: normalizeGestures(gestures, length),
    parentId,
  };
}

/**
 * Return a canonical copy validated against the catalog and, for a variation, the stored parent.
 * @param {unknown} input @param {TakeSourceEntry[]} catalog
 * @param {PublishedRecipe | null} [parent] @param {RecipeLimits} [limits] @returns {RecipeV1}
 */
export function validateRecipe(input, catalog, parent, limits) {
  if (input?.parentId != null && (!parent || parent.id !== input.parentId || parent.recipe?.experiment !== input.experiment)) {
    throw new RangeError('A variation must use its stored parent’s experiment and passage.');
  }
  const recipe = normalizeRecipe(input, limits);
  requireSourcePassage(catalog, recipe.passage);
  if (recipe.parentId !== null && !samePassage(parent.recipe.passage, recipe.passage)) {
    throw new RangeError('A variation must use its stored parent’s experiment and passage.');
  }
  return recipe;
}

/** Reachable capture intervals in first-trigger order. A digest alone omits provenance.
 * @param {MemoryRecipeV1} recipe */
export function reachableFragmentRefs(recipe) {
  const intervals = new Map();
  for (const {fragmentRef} of recipe.gestures) {
    const key = fragmentRef.startFrame + '/' + fragmentRef.endFrame;
    const existing = intervals.get(key);
    if (existing && existing.sha256 !== fragmentRef.sha256) throw new RangeError('Conflicting capture digests for the same interval.');
    if (!existing) intervals.set(key, fragmentRef);
  }
  return [...intervals.values()];
}

/** @param {unknown} recipe */
export function serializeRecipe(recipe) {
  return JSON.stringify(normalizeRecipe(recipe));
}
