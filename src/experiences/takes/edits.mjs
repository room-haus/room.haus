import {normalizePassage, normalizeRecipe, samePassage} from './recipe.mjs';

/** @typedef {import('./recipe.mjs').RecipeV1} RecipeV1 */
/** @typedef {import('./recipe.mjs').SpaceGesture} SpaceGesture */
/** @typedef {import('./recipe.mjs').TakePassage} TakePassage */
/** @typedef {{type: 'add', gesture: SpaceGesture} | {type: 'move', id: string, startFrame: number} | {type: 'remove', id: string}} GestureEdit */

/** @param {RecipeV1} recipe @param {GestureEdit} operation @returns {RecipeV1} */
export function editGesture(recipe, operation) {
  if (operation.type === 'add') {
    return normalizeRecipe({...recipe, gestures: [...recipe.gestures, operation.gesture]});
  }
  if (operation.type !== 'move' && operation.type !== 'remove') {
    throw new RangeError('Unsupported timeline edit.');
  }
  const index = recipe.gestures.findIndex(gesture => gesture.id === operation.id);
  if (index < 0) throw new RangeError('This echo throw is no longer on the timeline.');

  const gestures = [...recipe.gestures];
  if (operation.type === 'remove') {
    gestures.splice(index, 1);
  } else {
    const current = gestures[index];
    const startFrame = operation.startFrame;
    const endFrame = startFrame + (current.endFrame - current.startFrame);
    gestures[index] = {...current, startFrame, endFrame};
  }
  return normalizeRecipe({...recipe, gestures});
}

/** @param {import('./recipe.mjs').PublishedRecipe} published @returns {RecipeV1} */
export function forkTake(published) {
  return normalizeRecipe({...published.recipe, parentId: published.id});
}

/**
 * A changed range begins a separate root draft. Let the caller retain the current draft until confirmation.
 * @param {RecipeV1} recipe @param {TakePassage} passage
 * @param {{confirmed?: boolean}} [options] @returns {RecipeV1}
 */
export function replaceTakePassage(recipe, passage, {confirmed = false} = {}) {
  const selected = normalizePassage(passage);
  if (samePassage(recipe.passage, selected)) return recipe;
  if (recipe.parentId !== null) throw new RangeError('A variation keeps its inherited passage.');
  if (recipe.gestures.length && confirmed !== true) throw new RangeError('Confirm starting a new draft for this passage.');
  return normalizeRecipe({...recipe, passage: selected, gestures: []});
}
