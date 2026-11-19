export const TAKE_SOURCE_SAMPLE_RATE = 48_000;
export const TAKE_SOURCE_CHANNELS = 2;
export const TAKE_SOURCE_FORMAT = 's16le';
export const TAKE_SOURCE_BYTES_PER_FRAME = TAKE_SOURCE_CHANNELS * 2;

export function requireSourcePassage(catalog, request) {
  const {sourceId, revision, startFrame, endFrame} = request ?? {};
  const source = catalog.find(entry => entry.id === sourceId && entry.revision === revision);
  if (!source) {
    throw new RangeError('Unknown source revision');
  }
  if (!Number.isSafeInteger(startFrame) || !Number.isSafeInteger(endFrame)
    || startFrame < 0 || startFrame >= endFrame || endFrame > source.totalFrames) {
    throw new RangeError('Invalid source passage bounds');
  }
  return source;
}
