import {
  TAKE_SOURCE_SAMPLE_RATE as RATE, TAKE_SOURCE_CHANNELS as CHANNELS,
  TAKE_SOURCE_FORMAT as FORMAT, TAKE_SOURCE_BYTES_PER_FRAME as STRIDE,
} from './source.mjs';

/** @typedef {{sourceId:string, revision:string, startFrame:number, endFrame:number, frameCount:number,
 * sampleRate:number, channels:number, format:string, sha256:string}} FragmentRef */

function bounds(passage, startFrame, endFrame) {
  if (typeof passage?.sourceId !== 'string' || !passage.sourceId || typeof passage.revision !== 'string' ||
      !passage.revision || !Number.isSafeInteger(passage.startFrame) || passage.startFrame < 0 ||
      !Number.isSafeInteger(passage.endFrame) || !Number.isSafeInteger(startFrame) ||
      !Number.isSafeInteger(endFrame) || startFrame < passage.startFrame || endFrame > passage.endFrame) {
    throw RangeError('Keep the capture inside the selected source passage.');
  }
  const frameCount = endFrame - startFrame;
  if (frameCount < RATE / 4 || frameCount > 2 * RATE) throw RangeError('Capture between 0.25 and 2 seconds.');
  return {sourceId: passage.sourceId, revision: passage.revision, startFrame, endFrame, frameCount,
    sampleRate: RATE, channels: CHANNELS, format: FORMAT};
}

function requireFormat(metadata, frameCount) {
  if (metadata?.sampleRate !== RATE || metadata.channels !== CHANNELS || metadata.format !== FORMAT ||
      metadata.frameCount !== frameCount) throw RangeError('Invalid stereo PCM format or frame count.');
}

function requireLength(pcm, frameCount) {
  if (!(pcm instanceof Uint8Array) || pcm.byteLength !== frameCount * STRIDE) throw RangeError('Invalid PCM length.');
}

export function normalizeFragmentRef(ref, passage) {
  const fields = bounds(passage, ref?.startFrame, ref?.endFrame);
  if (ref.sourceId !== fields.sourceId || ref.revision !== fields.revision) throw RangeError('Wrong capture source revision.');
  requireFormat(ref, fields.frameCount);
  if (typeof ref.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(ref.sha256)) throw RangeError('Invalid capture digest.');
  return {...fields, sha256: ref.sha256};
}

async function hashPCM(pcm) {
  if (!pcm.some(byte => byte !== 0)) throw RangeError('This capture is silent. Listen and try again.');
  const digest = await crypto.subtle.digest('SHA-256', pcm);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

// Freeze the raw interleaved bytes before yielding to the hash operation. Node Buffers
// and typed-array views can alias the underlying passage even after a caller stops.
export async function captureFragment(sourcePCM, passage, endFrame, lengthFrames) {
  if (!Number.isSafeInteger(lengthFrames)) throw RangeError('Choose a capture length in whole source frames.');
  const fields = bounds(passage, endFrame - lengthFrames, endFrame);
  const sourceFrames = passage.endFrame - passage.startFrame;
  requireFormat(sourcePCM, sourceFrames);
  requireLength(sourcePCM.pcm, sourceFrames);
  const start = (fields.startFrame - passage.startFrame) * STRIDE;
  const pcm = new Uint8Array(sourcePCM.pcm.subarray(start, start + fields.frameCount * STRIDE));
  return {ref: {...fields, sha256: await hashPCM(pcm)}, pcm};
}

export async function verifyFragmentBytes(input, passage, bytes) {
  const ref = normalizeFragmentRef(input, passage);
  requireLength(bytes, ref.frameCount);
  const pcm = new Uint8Array(bytes);
  if (await hashPCM(pcm) !== ref.sha256) throw RangeError('Capture digest does not match its source.');
  return {ref, pcm};
}
