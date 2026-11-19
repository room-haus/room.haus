import {normalizePassage, normalizeRecipe, samePassage} from './recipe.mjs';

/** @typedef {import('./recipe.mjs').RecipeV1} RecipeV1 */
/** @typedef {import('./recipe.mjs').SpaceGesture} SpaceGesture */
/** @typedef {import('./recipe.mjs').TakePassage} TakePassage */
/** @typedef {import('./recipe.mjs').MemoryGesture} MemoryGesture */
/** @typedef {{type: 'add', gesture: SpaceGesture | MemoryGesture} | {type:'update', id:string, treatment?:'repeat'|'dissolve', density?:number, level?:number} | {type: 'move', id: string, startFrame: number} | {type: 'remove', id: string}} GestureEdit */

/** @template {RecipeV1} R @param {R} recipe @param {GestureEdit} operation @returns {R} */
export function editGesture(recipe, operation) {
  if (operation.type === 'add') {
    return normalizeRecipe({...recipe, gestures: [...recipe.gestures, operation.gesture]});
  }
  if (operation.type !== 'move' && operation.type !== 'remove' && operation.type !== 'update') {
    throw new RangeError('Unsupported timeline edit.');
  }
  const index = recipe.gestures.findIndex(gesture => gesture.id === operation.id);
  if (index < 0) throw new RangeError('This gesture is no longer on the timeline.');

  const gestures = [...recipe.gestures];
  if (operation.type === 'remove') {
    gestures.splice(index, 1);
  } else if (operation.type === 'update') {
    if (recipe.experiment !== 'audio-memory') throw new RangeError('Only fragment triggers have a treatment.');
    const current = gestures[index];
    const {treatment = current.treatment, density = current.density, level = current.level} = operation;
    gestures[index] = {...current, treatment, density, level};
  } else {
    const current = gestures[index];
    const startFrame = operation.startFrame;
    const endFrame = startFrame + (current.endFrame - current.startFrame);
    gestures[index] = {...current, startFrame, endFrame};
  }
  return normalizeRecipe({...recipe, gestures});
}

/** @template {RecipeV1} R @param {{id:string, recipe:R}} published @returns {R} */
export function forkTake(published) {
  return normalizeRecipe({...published.recipe, parentId: published.id});
}

/**
 * A changed range begins a separate root draft. Let the caller retain the current draft until confirmation.
 * @template {RecipeV1} R @param {R} recipe @param {TakePassage} passage
 * @param {{confirmed?: boolean}} [options] @returns {R}
 */
export function replaceTakePassage(recipe, passage, {confirmed = false} = {}) {
  const selected = normalizePassage(passage);
  if (samePassage(recipe.passage, selected)) return recipe;
  if (recipe.parentId !== null) throw new RangeError('A variation keeps its inherited passage.');
  if (recipe.gestures.length && confirmed !== true) throw new RangeError('Confirm starting a new draft for this passage.');
  return normalizeRecipe({...recipe, passage: selected, gestures: []});
}
