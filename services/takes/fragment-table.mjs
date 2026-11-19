import {normalizeFragmentRef} from '../../src/experiences/takes/fragment-asset.mjs';
import {MEMORY_TAKE_EXPERIMENT, reachableFragmentRefs} from '../../src/experiences/takes/recipe.mjs';

// Preparation, publication and offline collection use the same reachability check.
// Every table row records one exact capture, even when two rows share PCM bytes.
export function fragmentTable(record) {
  if (record.recipe?.experiment !== MEMORY_TAKE_EXPERIMENT) {
    if (record.fragments !== undefined) throw Error('Unexpected stored fragment table.');
    return [];
  }
  const {recipe, fragments} = record;
  const refs = reachableFragmentRefs(recipe);
  if (!Array.isArray(fragments) || fragments.length !== refs.length) throw Error('Incomplete stored fragment table.');
  return refs.map((input, index) => {
    const ref = normalizeFragmentRef(input, recipe.passage);
    const row = fragments[index];
    if (!row || Object.entries(ref).some(([key, value]) => row[key] !== value) || row.byteLength !== ref.frameCount * 4) {
      throw Error('Invalid stored fragment descriptor.');
    }
    return {...ref, byteLength: row.byteLength};
  });
}
