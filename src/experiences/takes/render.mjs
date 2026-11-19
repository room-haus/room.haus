import {createMemoryRender} from './memory-render.mjs';
import {normalizeRecipe} from './recipe.mjs';
import {createSpaceRender, SPACE_TAKE_GUARD} from './space-render.mjs';
import {TAKE_SOURCE_BYTES_PER_FRAME, TAKE_SOURCE_CHANNELS, TAKE_SOURCE_FORMAT, TAKE_SOURCE_SAMPLE_RATE} from './source.mjs';

const blockSize = 1024;
const fullScale = 32768;
const guardPCM = Math.floor(SPACE_TAKE_GUARD * fullScale);
export const quantize = value => Math.max(-guardPCM, Math.min(guardPCM, Math.round(value * fullScale)));

/** @typedef {{pcm: Uint8Array, sampleRate: number, channels: number, frameCount: number, format: string}} SourcePCM */

/**
 * Prepare the exact half-open passage for audition and publication.
 * Version 1 Space recipes have no material dependencies.
 * @param {unknown} input @param {SourcePCM} sourcePCM @param {ReadonlyMap<string, Uint8Array>} [materials]
 */
export function renderTake(input, sourcePCM, materials) {
  const recipe = normalizeRecipe(input);
  const frameCount = recipe.passage.endFrame - recipe.passage.startFrame;
  const {pcm, sampleRate, channels, format} = sourcePCM ?? {};
  if (!(pcm instanceof Uint8Array) || sampleRate !== TAKE_SOURCE_SAMPLE_RATE || channels !== TAKE_SOURCE_CHANNELS
    || format !== TAKE_SOURCE_FORMAT || sourcePCM.frameCount !== frameCount
    || pcm.byteLength !== frameCount * TAKE_SOURCE_BYTES_PER_FRAME) {
    throw new RangeError('Source PCM must match the selected passage.');
  }

  const engine = recipe.experiment === 'audio-memory'
    ? createMemoryRender(recipe.gestures, frameCount, materials)
    : createSpaceRender(sampleRate, recipe.rendererVersion, frameCount, recipe.gestures);
  const dry = new Uint8Array(pcm.byteLength);
  const take = new Uint8Array(pcm.byteLength);
  const source = new DataView(pcm.buffer, pcm.byteOffset, pcm.byteLength);
  const dryPCM = new DataView(dry.buffer);
  const takePCM = new DataView(take.buffer);
  const [left, right, dryLeft, dryRight, takeLeft, takeRight] =
    Array.from({length: 6}, () => new Float32Array(blockSize));
  let dryPeak = 0;
  let takePeak = 0;
  let returnEnergy = 0;

  for (let start = 0; start < frameCount; start += blockSize) {
    const count = Math.min(blockSize, frameCount - start);
    for (let i = 0; i < count; i++) {
      const byte = (start + i) * TAKE_SOURCE_BYTES_PER_FRAME;
      left[i] = source.getInt16(byte, true) / fullScale;
      right[i] = source.getInt16(byte + 2, true) / fullScale;
    }
    engine.processBlock(left, right, dryLeft, dryRight, takeLeft, takeRight, 0, count);
    for (let i = 0; i < count; i++) {
      const byte = (start + i) * TAKE_SOURCE_BYTES_PER_FRAME;
      const dl = quantize(dryLeft[i]);
      const dr = quantize(dryRight[i]);
      const tl = quantize(takeLeft[i]);
      const tr = quantize(takeRight[i]);
      dryPCM.setInt16(byte, dl, true);
      dryPCM.setInt16(byte + 2, dr, true);
      takePCM.setInt16(byte, tl, true);
      takePCM.setInt16(byte + 2, tr, true);
      dryPeak = Math.max(dryPeak, Math.abs(dl), Math.abs(dr));
      takePeak = Math.max(takePeak, Math.abs(tl), Math.abs(tr));
      returnEnergy += (tl - dl) ** 2 + (tr - dr) ** 2;
    }
  }

  return {
    dry, take, sampleRate, channels, frameCount, format,
    measurements: {
      dryPeak: dryPeak / fullScale,
      takePeak: takePeak / fullScale,
      // Measure the difference the listener hears after both modes pass the guard.
      returnRms: Math.sqrt(returnEnergy / (frameCount * channels)) / fullScale,
    },
  };
}
