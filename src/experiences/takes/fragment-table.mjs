import {normalizeFragmentRef} from './fragment-asset.mjs';
import {MEMORY_TAKE_EXPERIMENT, reachableFragmentRefs} from './recipe.mjs';

// Preparation, publication and offline collection use the same reachability check.
// Every table row records one exact capture, even when two rows share PCM bytes.
export function fragmentTable(record) {
  if (record.recipe?.experiment !== MEMORY_TAKE_EXPERIMENT) {
    if (record.fragments !== undefined) throw Error('Unexpected stored fragment table.');
    return [];
  }
  const {recipe, fragments} = record;
  const refs = reachableFragmentRefs(recipe);
  if (!Array.isArray(fragments) || fragments.length !== refs.length) {
    const missing = refs.find(ref => !fragments?.some?.(row => row?.sha256 === ref.sha256 && row.startFrame === ref.startFrame && row.endFrame === ref.endFrame));
    throw Error('Incomplete stored fragment table.' + (missing ? ' Missing capture ' + missing.sha256.slice(0,12) + ' at source frame ' + missing.startFrame + '.' : ''));
  }
  return refs.map((input, index) => {
    const ref = normalizeFragmentRef(input, recipe.passage);
    const row = fragments[index];
    if (!row || Object.entries(ref).some(([key, value]) => row[key] !== value) || row.byteLength !== ref.frameCount * 4) {
      throw Error('Invalid stored fragment descriptor. Check capture ' + ref.sha256.slice(0,12) + ' at source frame ' + ref.startFrame + '.');
    }
    return {...ref, byteLength: row.byteLength};
  });
}
