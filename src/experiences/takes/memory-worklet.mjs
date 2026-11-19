/* global AudioWorkletProcessor, currentFrame, registerProcessor, sampleRate */
import {quantize} from './render.mjs';
import {createMemoryMixer} from './memory-render.mjs';
import {TAKE_SOURCE_SAMPLE_RATE as RATE} from './source.mjs';

// Render canonical stereo blocks before interpolating to the device clock.
// Keep two adjacent blocks so an interpolation can cross a block boundary.
const size = 128;
class MemoryProcessor extends AudioWorkletProcessor {
  constructor({processorOptions: {pcm, events, offset}}) {
    super();
    this.pcm = new DataView(pcm);
    this.length = pcm.byteLength / 4;
    this.offset = offset;
    this.windows = new Map();
    this.events = this.install(events);
    this.engine = createMemoryMixer(this.events, this.length);
    this.engine.seek(offset);
    this.next = offset;
    this.start = Infinity;
    this.input = [new Float32Array(size), new Float32Array(size)];
    this.cache = Array.from({length: 2}, () => Array.from({length: 4}, () => new Float32Array(size)));
    this.port.onmessage = ({data}) => {
      if (data.type === 'start') {
        this.start = data.frame;
        return;
      }
      if (data.type !== 'trigger') return;
      if (data.events.some((event) => event.startFrame < this.next)) {
        this.port.postMessage({type: 'rejected', id: data.id});
        return;
      }
      this.events = [...this.events, ...this.install(data.events)].sort(
        (a, b) => a.startFrame - b.startFrame || a.triggerFrame - b.triggerFrame,
      );
      this.engine = createMemoryMixer(this.events, this.length);
      this.engine.seek(this.next);
      this.port.postMessage({type: 'trigger', id: data.id});
    };
  }

  install(events) {
    return events.map((event) => {
      const key = event.sha256 + '/' + event.grain;
      if (event.channels) this.windows.set(key, event.channels);
      return {...event, channels: this.windows.get(key)};
    });
  }

  fill(frame) {
    while (this.next <= frame) {
      const frames = Math.min(size, this.length - this.next);
      for (let i = 0; i < frames; i++) {
        this.input[0][i] = this.pcm.getInt16(4 * (this.next + i), true) / 32768;
        this.input[1][i] = this.pcm.getInt16(4 * (this.next + i) + 2, true) / 32768;
      }
      const index = Math.floor((this.next - this.offset) / size) % 2;
      this.engine.processBlock(...this.input, ...this.cache[index], 0, frames);
      for (const channel of this.cache[index]) {
        for (let i = 0; i < frames; i++) channel[i] = quantize(channel[i]) / 32768;
      }
      this.next += frames;
    }
  }

  process(_, [original, take]) {
    const frames = take[0].length;
    for (let i = 0; i < frames; i++) {
      const elapsed = currentFrame + i - this.start;
      if (elapsed < 0) continue;
      const position = (elapsed * RATE) / sampleRate;
      const frame = Math.floor(position),
        fraction = position - frame;
      const at = this.offset + frame;
      if (at >= this.length) {
        this.port.postMessage({type: 'ended'});
        return false;
      }
      const after = Math.min(this.length - 1, at + 1) - this.offset;
      this.fill(this.offset + after);
      const a = this.cache[Math.floor(frame / size) % 2],
        b = this.cache[Math.floor(after / size) % 2];
      for (let c = 0; c < 4; c++) {
        const x = a[c][frame % size],
          y = b[c][after % size];
        (c < 2 ? original : take)[c % 2][i] = x + (y - x) * fraction;
      }
    }
    return true;
  }
}
registerProcessor('room-memory-take-v1', MemoryProcessor);
