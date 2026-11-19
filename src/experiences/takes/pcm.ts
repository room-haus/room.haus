import {TAKE_SOURCE_SAMPLE_RATE as RATE, TAKE_SOURCE_BYTES_PER_FRAME as STRIDE} from './source.mjs';

export function decodePCM(data: ArrayBuffer) {
  const bytes = new DataView(data);
  const buffer = new AudioBuffer({numberOfChannels: 2, length: data.byteLength / STRIDE, sampleRate: RATE});
  for (let ch = 0; ch < 2; ch++) {
    const samples = buffer.getChannelData(ch);
    for (let frame = 0; frame < samples.length; frame++)
      samples[frame] = bytes.getInt16(frame * STRIDE + 2 * ch, true) / 32768;
  }
  return buffer;
}
