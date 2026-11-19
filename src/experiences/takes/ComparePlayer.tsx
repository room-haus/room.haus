import React, {useEffect, useImperativeHandle, useMemo, useRef, useState} from 'react';
import type {AudioPair} from './api.ts';
import {failureText} from './api.ts';
import {stamp, Waveform} from './Timeline.tsx';
import {usePlaybackOwner} from './PlaybackScope.tsx';

export type CompareHandle = {playFromStart: () => void};
type Props = AudioPair & {label: string; onAudition?: () => void; ref?: React.Ref<CompareHandle>};
type Running = {
  ctx: AudioContext;
  sources: AudioBufferSourceNode[];
  gains: GainNode[];
  offset: number;
  when: number;
  ramp: {start: number; from: number; to: number};
  heard: boolean;
  timer?: ReturnType<typeof setInterval>;
};

export function ComparePlayer({original, take, label, onAudition, ref}: Props) {
  const [position, setPosition] = useState(0),
    [mode, setMode] = useState<'Original' | 'Take'>('Take');
  const [playing, setPlaying] = useState(false),
    [error, setError] = useState('');
  const clock = useRef<Running | null>(null),
    selected = useRef(mode),
    heard = useRef(onAudition);
  heard.current = onAudition;
  const owner = usePlaybackOwner();
  const length = take.length,
    rate = take.sampleRate;
  const levels = useMemo(() => {
    const left = original.getChannelData(0),
      right = original.getChannelData(1);
    const bins = Math.min(length, 192);
    return Array.from({length: bins}, (_, b) => {
      let peak = 0;
      for (let i = Math.floor((b * length) / bins); i < Math.floor(((b + 1) * length) / bins); i++) {
        peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
      }
      return peak;
    });
  }, [original, length]);
  function frame(s: Running) {
    return Math.min(
      length,
      s.offset + (Number.isFinite(s.when) ? Math.max(0, Math.floor((s.ctx.currentTime - s.when) * rate)) : 0),
    );
  }
  function stopSources(s: Running) {
    for (const source of s.sources) {
      source.onended = null;
      try {
        source.stop();
      } catch {
        /* user paused while the context resumed */
      }
      source.disconnect();
    }
    s.sources = [];
  }
  function pause(reset = false) {
    const s = clock.current;
    if (!s) return;
    clock.current = null;
    clearInterval(s.timer);
    setPosition(reset ? 0 : frame(s));
    setPlaying(false);
    s.ctx.onstatechange = null;
    stopSources(s);
    s.gains.forEach((g) => g.disconnect());
    void s.ctx.close().catch(() => {});
    owner.release();
  }
  useEffect(() => () => pause(), []);
  function audition(s: Running) {
    if (
      !s.heard &&
      s.ctx.state === 'running' &&
      s.ctx.currentTime >= s.when &&
      s.ramp.to === 1 &&
      s.ctx.currentTime >= s.ramp.start
    ) {
      s.heard = true;
      heard.current?.();
    }
  }
  function schedule(s: Running, offset: number) {
    stopSources(s);
    s.offset = offset;
    // The complete renders already carry common gain and the tail from earlier throws.
    s.when = s.ctx.currentTime + 0.01;
    for (const [index, buffer] of [original, take].entries()) {
      const source = s.ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(s.gains[index]);
      s.sources.push(source);
    }
    s.sources[1].onended = () => {
      if (clock.current === s) {
        audition(s);
        pause(true);
      }
    };
    s.sources.forEach((source) => source.start(s.when, offset / rate));
  }
  async function play(offset: number) {
    pause();
    setError('');
    let session: Running | undefined;
    try {
      const ctx = new AudioContext();
      const wet = Number(selected.current === 'Take');
      const s: Running = {
        ctx,
        sources: [],
        gains: [],
        offset,
        when: Infinity,
        ramp: {start: 0, from: wet, to: wet},
        heard: false,
      };
      session = s;
      clock.current = s;
      owner.claim(() => pause());
      setPlaying(true);
      await ctx.resume();
      if (clock.current !== s) return;
      const currentWet = Number(selected.current === 'Take');
      for (const level of [1 - currentWet, currentWet]) {
        const gain = ctx.createGain();
        gain.gain.value = level;
        gain.connect(ctx.destination);
        s.gains.push(gain);
      }
      s.ramp = {start: 0, from: currentWet, to: currentWet};
      schedule(s, s.offset);
      s.timer = setInterval(() => {
        if (clock.current === s) {
          setPosition(frame(s));
          audition(s);
        }
      }, 35);
      ctx.onstatechange = () => {
        if (clock.current === s && ctx.state !== 'running') {
          pause();
          setError('Audio paused. Press Play to continue.');
        }
      };
    } catch (e) {
      if (session && clock.current !== session) return;
      pause();
      setError(failureText(e));
    }
  }
  function choose(next: 'Original' | 'Take') {
    selected.current = next;
    setMode(next);
    const s = clock.current;
    if (!s || s.gains.length !== 2) return;
    const now = s.ctx.currentTime,
      duration = 0.012;
    const progress = Math.max(0, Math.min(1, (now - s.ramp.start) / duration));
    const current = s.ramp.from + (s.ramp.to - s.ramp.from) * progress,
      target = Number(next === 'Take');
    for (const [param, from, to] of [
      [s.gains[0].gain, 1 - current, 1 - target],
      [s.gains[1].gain, current, target],
    ] as const) {
      param.cancelScheduledValues(now);
      param.setValueAtTime(from, now);
      param.linearRampToValueAtTime(to, now + duration);
    }
    s.ramp = {start: now, from: current, to: target};
  }
  useImperativeHandle(ref, () => ({
    playFromStart() {
      choose('Take');
      void play(0);
    },
  }));
  function seek(value: number) {
    const s = clock.current;
    if (s) {
      s.offset = value;
      if (s.gains.length === 2) schedule(s, value);
    }
    setPosition(value);
  }
  return (
    <section className="take-compare" aria-label={label}>
      <div className="take-meter">
        <span>{stamp(position)}</span>
        <span>/ {stamp(length)}</span>
      </div>
      <div className="take-wave">
        <Waveform levels={levels} />
        <b style={{left: (position / length) * 100 + '%'}} />
        <input
          type="range"
          aria-label="Playback position"
          aria-valuetext={stamp(position)}
          min={0}
          max={length - 1}
          step={1}
          value={Math.min(position, length - 1)}
          onChange={(e) => seek(Number(e.target.value))}
          onKeyDown={(e) => {
            if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
            e.preventDefault();
            const step = e.shiftKey ? rate : rate / 4;
            seek(Math.max(0, Math.min(length - 1, position + (e.key === 'ArrowRight' ? step : -step))));
          }}
        />
      </div>
      <div className="take-actions">
        <button
          className="take-primary"
          onClick={() => (playing ? pause() : void play(position >= length ? 0 : position))}>
          {playing ? 'Pause' : mode === 'Take' ? 'Play take' : 'Play original'}
        </button>
        {(['Original', 'Take'] as const).map((name) => (
          <button key={name} aria-pressed={mode === name} onClick={() => choose(name)}>
            {name}
          </button>
        ))}
      </div>
      {error && (
        <p role="alert" className="take-error">
          {error}
        </p>
      )}
    </section>
  );
}
