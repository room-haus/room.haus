import assert from 'node:assert/strict';
import test from 'node:test';
import {editGesture, forkTake, replaceTakePassage} from '../src/experiences/takes/edits.mjs';
import {serializeRecipe, validateRecipe} from '../src/experiences/takes/recipe.mjs';

const catalog = [{id: 'MX029', revision: 'mix-r1', totalFrames: 100_000}];
const passage = {sourceId: 'MX029', revision: 'mix-r1', startFrame: 16_000, endFrame: 40_000};
const initialSettings = {delayFrames: 9600, feedback: 0.168, wetLevel: 0.5, stereoWidth: 0};
const throwSettings = {delayFrames: 12_000, feedback: 0.3, wetLevel: 0.7, stereoWidth: 1};
const hitThree = {id: 'throw-1', startFrame: 9000, endFrame: 9900, settings: throwSettings};
const recipe = {schema: 1, experiment: 'audio-space', rendererVersion: 1, passage, initialSettings, gestures: [hitThree], parentId: null};
const parent = {id: 'published-1', recipe};

test('moving a fork from hit three to hit four preserves duration and resolved settings', () => {
  const before = JSON.stringify(parent);
  const draft = forkTake(parent);
  const moved = editGesture(draft, {type: 'move', id: 'throw-1', startFrame: 13_500});

  assert.deepEqual(validateRecipe(moved, catalog, parent).gestures, [
    {id: 'throw-1', startFrame: 13_500, endFrame: 14_400, settings: throwSettings},
  ]);
  assert.equal(moved.parentId, 'published-1');
  assert.notEqual(draft.passage, parent.recipe.passage);
  assert.notEqual(draft.initialSettings, parent.recipe.initialSettings);
  assert.notEqual(draft.gestures[0].settings, parent.recipe.gestures[0].settings);
  assert.equal(draft.gestures[0].startFrame, 9000);
  assert.equal(JSON.stringify(parent), before);
});

test('touching sends with overlapping repeat tails fit on the timeline', () => {
  const touching = {id: 'next-throw', startFrame: 9900, endFrame: 10_000, settings: initialSettings};
  const added = editGesture(recipe, {type: 'add', gesture: touching});
  assert.deepEqual(validateRecipe(added, catalog).gestures, [hitThree, touching]);
});

test('overlapping active sends are rejected on edit and on validation', () => {
  const overlapping = {id: 'early-throw', startFrame: 8999, endFrame: 9001, settings: initialSettings};
  assert.throws(() => editGesture(recipe, {type: 'add', gesture: overlapping}), /overlap/i);
  assert.throws(() => validateRecipe({...recipe, gestures: [hitThree, overlapping]}, catalog), /overlap/i);
});

test('moving a throw past a passage endpoint returns an actionable error', () => {
  for (const startFrame of [-1, 23_101]) {
    assert.throws(() => editGesture(recipe, {type: 'move', id: 'throw-1', startFrame}), /inside the passage/i);
  }
  const atEnd = editGesture(recipe, {type: 'move', id: 'throw-1', startFrame: 23_100});
  assert.equal(atEnd.gestures[0].endFrame, 24_000);
});

test('removing the last throw creates a valid recipe with zero sends', () => {
  const removed = editGesture(recipe, {type: 'remove', id: 'throw-1'});
  assert.deepEqual(validateRecipe(removed, catalog).gestures, []);
  assert.equal(recipe.gestures.length, 1);
});

test('the stored parent must match the claimed parent id, experiment and passage', () => {
  const draft = forkTake(parent);
  assert.throws(() => validateRecipe(draft, catalog), /parent/i);
  assert.throws(() => validateRecipe(draft, catalog, {...parent, id: 'different'}), /parent/i);
  assert.throws(() => validateRecipe(draft, catalog, {...parent, recipe: {...recipe, experiment: 'audio-memory'}}), /parent/i);
  assert.throws(() => validateRecipe({...draft, passage: {...passage, startFrame: 15_999}}, catalog, parent), /parent/i);
  assert.throws(() => validateRecipe({...draft, experiment: 'audio-memory'}, catalog, parent), /experiment/i);
});

test('source catalog authority and exact integer frames are required', () => {
  assert.throws(() => validateRecipe({...recipe, passage: {...passage, revision: 'older'}}, catalog), /revision/i);
  assert.throws(() => validateRecipe({...recipe, passage: {...passage, endFrame: 100_001}}, catalog), /bounds/i);
  assert.throws(() => validateRecipe({...recipe, passage: {...passage, startFrame: 0.5}}, catalog), /bounds/i);
});

test('unknown versions and duplicate ids fail before rendering', () => {
  assert.throws(() => validateRecipe({...recipe, schema: 2}, catalog), /schema/i);
  assert.throws(() => validateRecipe({...recipe, rendererVersion: 2}, catalog), /renderer/i);
  const copy = {...hitThree, startFrame: 0, endFrame: 9000};
  assert.throws(() => validateRecipe({...recipe, gestures: [hitThree, copy]}, catalog), /duplicate/i);
});

test('effect settings must contain finite bounded values and a resolved delay in frames', () => {
  for (const settings of [
    {...throwSettings, delayFrames: undefined, bpm: 120, division: 0.5},
    {...throwSettings, delayFrames: 12.5},
    {...throwSettings, delayFrames: 72_001},
    {...throwSettings, feedback: 0.8},
    {...throwSettings, wetLevel: Number.NaN},
    {...throwSettings, stereoWidth: Number.POSITIVE_INFINITY},
  ]) {
    assert.throws(() => validateRecipe({...recipe, gestures: [{...hitThree, settings}]}, catalog), /settings/i);
    assert.throws(() => serializeRecipe({...recipe, initialSettings: settings}), /settings/i);
  }
});

test('the service can limit the passage length and gesture count independently', () => {
  assert.throws(() => validateRecipe(recipe, catalog, null, {maxPassageFrames: 23_999}), /too long/i);
  assert.throws(() => validateRecipe(recipe, catalog, null, {maxGestures: 0}), /too many gestures/i);
  assert.deepEqual(validateRecipe(recipe, catalog, null, {maxPassageFrames: 24_000, maxGestures: 1}), recipe);
});

test('a copied recipe round-trips as canonical JSON independent of incidental metadata and ordering', () => {
  const earlier = {...hitThree, id: 'intro', startFrame: 0, endFrame: 9000};
  const child = forkTake({...parent, recipe: {...recipe, gestures: [hitThree, earlier]}});
  const json = serializeRecipe(child);
  const received = JSON.parse(json);
  assert.deepEqual(received.gestures.map(gesture => gesture.id), ['intro', 'throw-1']);
  assert.deepEqual(validateRecipe(received, catalog, parent), received);
  const reordered = {id: 'untrusted-public-id', ...received, gestures: [...received.gestures].reverse(), passage: {
    endFrame: 40_000, startFrame: 16_000, revision: 'mix-r1', sourceId: 'MX029', url: 'not-from-the-catalog',
  }};
  assert.equal(serializeRecipe(reordered), json);
});

test('reselecting after recording needs confirmation and creates a separate empty draft', () => {
  const alternatePassage = {...passage, startFrame: 0};
  assert.equal(replaceTakePassage(recipe, {...passage}), recipe);
  assert.throws(() => replaceTakePassage(recipe, alternatePassage), /confirm/i);
  assert.throws(() => replaceTakePassage(recipe, alternatePassage, {confirmed: 'false'}), /confirm/i);
  const replacement = replaceTakePassage(recipe, alternatePassage, {confirmed: true});
  assert.deepEqual(validateRecipe(replacement, catalog), {...recipe, passage: alternatePassage, gestures: []});
  assert.equal(recipe.gestures.length, 1);
  assert.deepEqual(replaceTakePassage({...recipe, gestures: []}, alternatePassage), replacement);
  assert.throws(() => replaceTakePassage(forkTake(parent), alternatePassage, {confirmed: true}), /inherited passage/i);
});
