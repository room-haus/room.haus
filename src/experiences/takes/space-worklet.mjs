/* global AudioWorkletProcessor, currentFrame, registerProcessor, sampleRate */
import {contextFrameFor, createSpaceRender, SPACE_TAKE_PROCESSOR_NAME} from './space-render.mjs';

class SpaceTakeProcessor extends AudioWorkletProcessor {
  constructor({processorOptions}) {
    super();
    const {startContextFrame, frameCount, rendererVersion, gestures} = processorOptions;
    if (!Number.isSafeInteger(startContextFrame) || startContextFrame < 0
      || !Number.isSafeInteger(frameCount) || frameCount < 1) {
      throw new RangeError('Invalid Space take playback bounds.');
    }
    this.start = startContextFrame;
    this.end = startContextFrame + contextFrameFor(frameCount, sampleRate);
    this.started = false;
    this.engine = createSpaceRender(sampleRate, rendererVersion, frameCount, gestures);
    this.port.onmessage = ({data}) => this.schedule(data);
  }

  schedule(message) {
    const action = message?.type;
    const id = action === 'open' ? message.gesture?.id : message?.id;
    try {
      if (!this.engine) throw new RangeError('Space take playback ended.');
      if (action === 'open') this.engine.open(message.gesture);
      else if (action === 'close') this.engine.close(id, message.endFrame);
      else throw new RangeError('Unknown Space take playback command.');
      this.port.postMessage({type: 'scheduled', id, action});
    } catch (error) {
      this.port.postMessage({type: 'rejected', id, error: error.message});
    }
  }

  process(inputs, outputs) {
    if (!this.engine) return false;
    const [takeLeft, takeRight] = outputs[0];
    const quantumEnd = currentFrame + takeLeft.length;
    if (quantumEnd <= this.start) return true;
    if (!this.started && currentFrame > this.start) {
      this.engine = null;
      this.port.postMessage({type: 'rejected', id: null, error: 'Space take playback started late.'});
      return false;
    }
    this.started = true;
    const from = Math.max(0, this.start - currentFrame);
    const to = Math.min(takeLeft.length, this.end - currentFrame);
    const [left, right] = inputs[0];
    this.engine.processBlock(left, right, undefined, undefined, takeLeft, takeRight, from, to);
    if (quantumEnd < this.end) return true;
    this.engine = null;
    return false;
  }
}

registerProcessor(SPACE_TAKE_PROCESSOR_NAME, SpaceTakeProcessor);
