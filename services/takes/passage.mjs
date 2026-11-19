import {createHash} from 'node:crypto';
import {
  requireSourcePassage,
  TAKE_SOURCE_BYTES_PER_FRAME,
  TAKE_SOURCE_CHANNELS,
  TAKE_SOURCE_FORMAT,
} from '../../src/experiences/takes/source.mjs';

export async function readPassage(catalog, request, store) {
  const source = requireSourcePassage(catalog, request);
  if (source.channels !== TAKE_SOURCE_CHANNELS) {
    throw new Error('Invalid source channel count');
  }

  const {startFrame, endFrame} = request;
  const frameCount = endFrame - startFrame;
  const pcm = new Uint8Array(frameCount * TAKE_SOURCE_BYTES_PER_FRAME);
  let nextFrame = startFrame;
  for (const chunk of source.chunks) {
    const chunkEnd = chunk.startFrame + chunk.frameCount;
    if (chunkEnd <= startFrame) continue;
    if (chunk.startFrame >= endFrame) break;

    const first = Math.max(startFrame, chunk.startFrame);
    const last = Math.min(endFrame, chunkEnd);
    if (first !== nextFrame) {
      throw new Error('Invalid source chunk coverage');
    }

    const contents = await store.readChunk(chunk.sha256);
    if (!(contents instanceof Uint8Array)
      || contents.byteLength !== chunk.frameCount * TAKE_SOURCE_BYTES_PER_FRAME
      || createHash('sha256').update(contents).digest('hex') !== chunk.sha256) {
      throw new Error('Source chunk integrity check failed');
    }
    pcm.set(contents.subarray(
      (first - chunk.startFrame) * TAKE_SOURCE_BYTES_PER_FRAME,
      (last - chunk.startFrame) * TAKE_SOURCE_BYTES_PER_FRAME,
    ), (first - startFrame) * TAKE_SOURCE_BYTES_PER_FRAME);
    nextFrame = last;
    if (nextFrame === endFrame) break;
  }

  if (nextFrame !== endFrame) {
    throw new Error('Invalid source chunk coverage');
  }

  return {pcm, sampleRate: source.sampleRate, channels: source.channels, frameCount, format: TAKE_SOURCE_FORMAT};
}
