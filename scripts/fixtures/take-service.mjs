import {createHash} from 'node:crypto';

// Offline 40-second stereo test source. Identical one-second chunks contain
// two distinctive transients and share one verified backing buffer.
export function fixtureSource() {
  const sampleRate = 48000;
  const pcm = Buffer.alloc(sampleRate * 4);
  let minLeft = 0, maxLeft = 0, minRight = 0, maxRight = 0;
  for (let i = 0; i < sampleRate; i++) {
    const age = i % 24000;
    const left = Math.round(18000 * Math.exp(-age / 1250) * Math.cos(.043 * i));
    const right = Math.round(12000 * Math.exp(-age / 800) * Math.cos(.061 * i));
    pcm.writeInt16LE(left, i * 4);
    pcm.writeInt16LE(right, i * 4 + 2);
    minLeft = Math.min(minLeft, left);
    maxLeft = Math.max(maxLeft, left);
    minRight = Math.min(minRight, right);
    maxRight = Math.max(maxRight, right);
  }
  const sha256 = createHash('sha256').update(pcm).digest('hex');
  const chunks = Array.from({length: 40}, (_, i) => ({startFrame: i * sampleRate, frameCount: sampleRate, sha256}));
  const entry = {
    id: 'MX029', revision: 'fixture-v1-' + sha256, sampleRate, channels: 2, totalFrames: 40 * sampleRate,
    curatedRange: {startFrame: 0, endFrame: 8 * sampleRate},
    denseRange: {startFrame: 12 * sampleRate, endFrame: 20 * sampleRate},
    peaks: [{framesPerPeak: sampleRate, values: chunks.map(() => [minLeft, maxLeft, minRight, maxRight])}], chunks,
  };
  return {catalog: [entry], sourceStore: {readChunk: digest => {
    if (digest !== sha256) throw Error('Unknown fixture chunk');
    return pcm;
  }}};
}
