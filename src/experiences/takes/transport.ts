import {captureFragment} from './fragment-asset.mjs';
import {decodePCM} from './pcm.ts';
import type {RecipeV1, SpaceGesture, SpaceTakeSettings} from './recipe.mjs';
import {renderTake} from './render.mjs';
import {SPACE_TAKE_OUTPUT_GAIN, SPACE_TAKE_PROCESSOR_NAME, SPACE_TAKE_WORKLET_URL} from './space-render.mjs';
import {TAKE_SOURCE_SAMPLE_RATE as RATE} from './source.mjs';

const commandLead = .045;
export type TransportEvents = {
  update: () => void;
  finish: (gestures: SpaceGesture[], error?: string) => void;
};

export class TakeTransport {
  private context = new AudioContext();
  private dry = this.context.createGain();
  private take = this.context.createGain();
  private sources: AudioBufferSourceNode[] = [];
  private node?: AudioWorkletNode;
  private startTime = 0;
  private length: number;
  private recent?: {since: number};
  private held?: SpaceGesture;
  private gestures: SpaceGesture[] = [];
  private pending = new Set<string>();
  private closed = false;
  private ending = false;
  private deadline?: ReturnType<typeof setTimeout>;
  private clock?: {wall: number; audio: number};
  ready = false;
  original = false;

  private recipe: RecipeV1;
  private pcm: ArrayBuffer;
  readonly recording: boolean;
  private offset: number;
  private events: TransportEvents;

  constructor(recipe: RecipeV1, pcm: ArrayBuffer, recording: boolean, offset: number, events: TransportEvents) {
    this.recipe = recipe;
    this.pcm = pcm;
    this.recording = recording;
    this.offset = offset;
    this.events = events;
    this.length = recipe.passage.endFrame - recipe.passage.startFrame;
  }

  async start() {
    const ctx = this.context;
    await ctx.resume();
    if (this.closed) return;
    const raw = decodePCM(this.pcm);
    const source = ctx.createBufferSource();
    source.buffer = raw;
    this.sources.push(source);
    this.dry.gain.value = 0;
    this.dry.connect(ctx.destination);
    this.take.connect(ctx.destination);
    source.connect(this.dry);

    if (this.offset) {
      // Render from frame zero before seeking so earlier throws still ring.
      const rendered = renderTake(this.recipe, {pcm: new Uint8Array(this.pcm), sampleRate: RATE, channels: 2,
        frameCount: this.length, format: 's16le'});
      const performed = ctx.createBufferSource();
      performed.buffer = decodePCM(rendered.take.buffer as ArrayBuffer);
      performed.connect(this.take);
      this.sources.push(performed);
    } else {
      await ctx.audioWorklet.addModule(SPACE_TAKE_WORKLET_URL);
      if (this.closed) return;
    }
    const startContextFrame = Math.ceil((ctx.currentTime + .12) * ctx.sampleRate);
    this.startTime = startContextFrame / ctx.sampleRate;
    if (!this.offset) {
      this.node = new AudioWorkletNode(ctx, SPACE_TAKE_PROCESSOR_NAME, {numberOfInputs: 1, numberOfOutputs: 1,
        outputChannelCount: [2], processorOptions: {startContextFrame, frameCount: this.length,
          rendererVersion: this.recipe.rendererVersion, gestures: this.recipe.gestures}});
      this.node.onprocessorerror = () => this.fail('The echo processor stopped.');
      this.node.port.onmessage = ({data}) => {
        if (this.closed) return;
        if (data.type === 'rejected') return this.fail('Echo timing was interrupted.');
        this.pending.delete(data.action + data.id);
        if (this.ending && !this.pending.size) this.complete();
      };
      source.connect(this.node);
      this.node.connect(this.take);
    }
    source.onended = () => this.end(true);
    this.clock = {wall: performance.now(), audio: ctx.currentTime};
    ctx.onstatechange = () => {
      if (!this.closed && ctx.state !== 'running') this.fail('The audio clock was interrupted.');
    };
    this.sources.forEach(input => input.start(this.startTime, this.offset / RATE));
    this.ready = true;
    this.events.update();
  }

  positionFrame() {
    if (!this.ready) return this.offset;
    return Math.max(this.offset, Math.min(this.length, this.offset + Math.floor((this.context.currentTime - this.startTime) * RATE)));
  }
  armRecent() {
    this.checkClock();
    if (!this.ready || this.ending) throw Error('Start listening before arming a capture.');
    this.recent = {since: this.positionFrame()};
    this.events.update();
  }
  recentFrames() {
    if (!this.recent || !this.ready || this.ending || this.context.state !== 'running') return 0;
    return Math.min(4 * RATE, Math.max(0, this.positionFrame() - this.recent.since));
  }
  async captureRecent(lengthFrames: number) {
    this.checkClock();
    const listening = this.recent;
    const end = this.positionFrame();
    if (!listening || !this.ready || this.ending || end - listening.since < lengthFrames) {
      throw Error('Listen continuously for the full capture window and try again.');
    }
    const passage = this.recipe.passage;
    const captured = await captureFragment({pcm: new Uint8Array(this.pcm), sampleRate: RATE, channels: 2,
      frameCount: this.length, format: 's16le'}, passage, passage.startFrame + end, lengthFrames);
    this.checkClock();
    if (this.recent !== listening) throw Error('Capture interrupted. Listen and try again.');
    return captured;
  }
  checkClock() {
    if (!this.ready || this.ending || !this.clock) return;
    const wall = performance.now(), audio = this.context.currentTime;
    if (this.context.state !== 'running' || audio < this.clock.audio || Math.abs((wall - this.clock.wall) / 1000 - (audio - this.clock.audio)) > .35) {
      this.fail('The audio clock was interrupted.');
      return;
    }
    this.clock = {wall, audio};
    if (this.held && this.positionFrame() >= this.held.endFrame) this.held = undefined;
  }
  private scheduledFrame() {
    return Math.max(0, Math.min(this.length, Math.ceil((this.context.currentTime + commandLead - this.startTime) * RATE)));
  }
  press(settings: SpaceTakeSettings, maxGestures: number) {
    if (!this.recording || !this.ready || this.ending || this.held) return;
    const existing = [...this.recipe.gestures, ...this.gestures];
    if (existing.length >= maxGestures) throw Error('The throw limit for this take has been reached.');
    const startFrame = this.scheduledFrame();
    if (startFrame >= this.length) return;
    if (existing.some(g => startFrame >= g.startFrame && startFrame < g.endFrame)) throw Error('A throw is already sending here.');
    const endFrame = Math.min(this.length, ...existing.filter(g => g.startFrame > startFrame).map(g => g.startFrame));
    const gesture = {id: crypto.randomUUID(), startFrame, endFrame, settings: {...settings}};
    this.held = gesture;
    this.gestures.push(gesture);
    this.pending.add('open' + gesture.id);
    this.node!.port.postMessage({type: 'open', gesture});
    this.events.update();
  }
  release() {
    if (!this.held) return;
    const g = this.held;
    this.held = undefined;
    const endFrame = Math.min(g.endFrame, Math.max(g.startFrame + 1, this.scheduledFrame()));
    if (endFrame < g.endFrame) {
      g.endFrame = endFrame;
      this.pending.add('close' + g.id);
      this.node!.port.postMessage({type: 'close', id: g.id, endFrame});
    }
    this.events.update();
  }
  echoState() {
    const frame = this.positionFrame();
    if (this.held) return 'Sending';
    const gestures = [...this.recipe.gestures, ...this.gestures];
    if (gestures.some(g => g.startFrame <= frame && frame < g.endFrame && !this.gestures.includes(g))) return 'Sending';
    // An estimate of the audible decay to -60 dB, including the initial return.
    const tail = gestures.some(g => frame >= g.startFrame && frame <
      g.endFrame + g.settings.delayFrames * (1 + Math.ceil(Math.log(.001) / Math.log(Math.max(.001, g.settings.feedback)))));
    return tail ? 'Echo tail' : 'Listening';
  }
  compare() {
    this.original = !this.original;
    const now = this.context.currentTime;
    for (const [gain, target] of [[this.dry.gain, this.original ? SPACE_TAKE_OUTPUT_GAIN : 0],
      [this.take.gain, this.original ? 0 : 1]] as const) {
      gain.cancelScheduledValues(now); gain.setValueAtTime(gain.value, now); gain.linearRampToValueAtTime(target, now + .012);
    }
    this.events.update();
  }
  end(natural = false) {
    if (this.closed || this.ending) return;
    this.recent = undefined;
    if (!this.ready) return this.complete();
    if (!natural) this.release();
    this.held = undefined;
    this.ending = true;
    this.dry.disconnect();
    this.take.disconnect();
    if (!this.pending.size) return this.complete();
    this.deadline = setTimeout(() => this.fail('The echo processor did not confirm this pass.'), 500);
  }
  private complete() {
    this.dispose();
    this.events.finish(this.gestures);
  }
  fail(message: string) {
    if (this.closed) return;
    this.dispose();
    this.events.finish([], message);
  }
  dispose() {
    if (this.closed) return;
    this.closed = true;
    this.recent = undefined;
    this.ready = false;
    clearTimeout(this.deadline);
    this.context.onstatechange = null;
    this.sources.forEach(source => {
      source.onended = null;
      try { source.stop(); } catch { /* start may have been cancelled */ }
      source.disconnect();
    });
    this.node?.port.close(); this.node?.disconnect();
    this.dry.disconnect(); this.take.disconnect();
    void this.context.close().catch(() => {});
  }
}
