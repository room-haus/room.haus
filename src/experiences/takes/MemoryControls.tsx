import React, {useEffect, useLayoutEffect, useRef, useState} from 'react';
import type {MemoryGesture, MemoryRecipeV1} from './recipe.mjs';
import type {FragmentRef} from './fragment-asset.mjs';
import type {GestureEdit} from './edits.mjs';
import {stamp} from './Timeline.tsx';
import {TakeTransport} from './transport.ts';
import {TAKE_SOURCE_SAMPLE_RATE as RATE} from './source.mjs';

export type MemorySession = {materials: Map<string, Uint8Array>; retained?: FragmentRef; selectedId?: string};
export type PerformanceSettings = Pick<MemoryGesture, 'treatment' | 'density' | 'level'>;
export type TriggerSettings = PerformanceSettings & {duration: number};
export const defaultTrigger: TriggerSettings = {treatment: 'repeat', density: 4, level: 0.8, duration: 2};

export function fragmentTrigger(
  recipe: MemoryRecipeV1,
  fragmentRef: FragmentRef,
  startFrame: number,
  settings: TriggerSettings,
): MemoryGesture {
  const {duration, ...performance} = settings;
  return {
    id: crypto.randomUUID(),
    startFrame,
    endFrame: Math.min(recipe.passage.endFrame - recipe.passage.startFrame, startFrame + duration * RATE),
    fragmentRef,
    ...performance,
    seedVersion: 1,
  };
}

function Treatment({
  settings,
  change,
  disabled,
}: {
  settings: PerformanceSettings;
  change: (patch: Partial<PerformanceSettings>) => void;
  disabled: boolean;
}) {
  return (
    <div className="take-row">
      <label>
        Treatment
        <select
          value={settings.treatment}
          disabled={disabled}
          onChange={(e) => change({treatment: e.target.value as MemoryGesture['treatment']})}>
          <option value="repeat">Repeat</option>
          <option value="dissolve">Dissolve</option>
        </select>
      </label>
      <label>
        Density · {settings.density}
        <input
          type="range"
          aria-label="Density"
          min="1"
          max="8"
          value={settings.density}
          disabled={disabled}
          onChange={(e) => change({density: Number(e.target.value)})}
        />
      </label>
      <label>
        Level · {Math.round(settings.level * 100)}%
        <input
          type="range"
          aria-label="Level"
          min="0"
          max="1"
          step=".01"
          value={settings.level}
          disabled={disabled}
          onChange={(e) => change({level: Number(e.target.value)})}
        />
      </label>
    </div>
  );
}

function SourceProof({fragment}: {fragment: FragmentRef}) {
  return (
    <details className="take-proof" aria-label="Capture source">
      <summary>
        Captured {stamp(fragment.startFrame)} – {stamp(fragment.endFrame)} · {fragment.sha256.slice(0, 12)}
      </summary>
      <p>
        {fragment.sourceId} · {fragment.revision}
        <br />
        Source frames {fragment.startFrame}–{fragment.endFrame} (end exclusive) · stereo {fragment.sampleRate} Hz
        <br />
        SHA-256 <code>{fragment.sha256}</code>
      </p>
    </details>
  );
}

type ControlsProps = {
  player: TakeTransport | null;
  enabled: boolean;
  loading: boolean;
  start: (record: boolean) => void;
  stop: () => void;
  recipe: MemoryRecipeV1;
  session: MemorySession;
  retain: (ref?: FragmentRef, pcm?: Uint8Array) => void;
  settings: TriggerSettings;
  setSettings: (settings: TriggerSettings) => void;
  check: (op: GestureEdit) => void;
  report: (error: string) => void;
};
export function MemoryControls({
  player,
  enabled,
  loading,
  start,
  stop,
  recipe,
  session,
  retain,
  settings,
  setSettings,
  check,
  report,
}: ControlsProps) {
  const [length, setLength] = useState(0.5),
    [pending, setPending] = useState(false),
    [retry, setRetry] = useState(false);
  const operation = useRef(0);
  const pressed = useRef<{player: TakeTransport; pointerId: number} | null>(null);
  function releasePointer(event: React.PointerEvent<HTMLButtonElement>) {
    if (pressed.current?.pointerId === event.pointerId) pressed.current = null;
  }
  const performancePointer = {
    onPointerDown(event: React.PointerEvent<HTMLButtonElement>) {
      if (player?.recording && event.isPrimary && event.button === 0)
        pressed.current = {player, pointerId: event.pointerId};
    },
    onPointerUp: releasePointer,
    onPointerLeave: releasePointer,
    onPointerCancel(event: React.PointerEvent<HTMLButtonElement>) {
      const contact = pressed.current;
      if (contact && contact.player === player && contact.pointerId === event.pointerId) {
        pressed.current = null;
        stop();
      }
    },
  };
  useEffect(() => {
    setPending(false);
    setRetry(false);
    return () => {
      operation.current++;
      pressed.current = null;
    };
  }, [player]);
  const fragment = session.retained;
  const referenced =
    fragment &&
    recipe.gestures.some(
      (g) => g.fragmentRef.startFrame === fragment.startFrame && g.fragmentRef.endFrame === fragment.endFrame,
    );
  const ready = Boolean(player?.recording && player?.ready && player.recentFrames() >= length * RATE);
  async function capture() {
    if (!player || player.triggerPending || pending) return;
    const token = ++operation.current;
    setPending(true);
    report('');
    try {
      const result = await player.captureRecent(length * RATE);
      if (operation.current !== token || !player.ready) return;
      retain(result.ref, result.pcm);
      setRetry(false);
    } catch (e) {
      if (operation.current === token && player.ready) {
        report((e as Error).message);
        setRetry(true);
      }
    } finally {
      if (operation.current === token) setPending(false);
    }
  }
  function trigger() {
    if (!player || !fragment || pending || player.triggerPending) return;
    const gesture = fragmentTrigger(recipe, fragment, player.positionFrame(), settings);
    try {
      check({type: 'add', gesture});
      player.triggerMemory(gesture);
      report('');
    } catch (e) {
      report((e as Error).message);
    }
  }
  return (
    <>
      <div className="take-actions take-memory-actions">
        {player ? (
          <button onClick={stop}>Stop</button>
        ) : (
          <button className="take-primary" disabled={!enabled} onClick={() => start(true)}>
            Record
          </button>
        )}
        <button
          {...performancePointer}
          disabled={!ready || player?.triggerPending || pending}
          onClick={() => void capture()}>
          {retry ? 'Retry capture' : 'Capture fragment'}
        </button>
        <button
          {...performancePointer}
          disabled={!player?.recording || !player.ready || player.triggerPending || pending || !fragment}
          onClick={trigger}>
          Trigger fragment
        </button>
      </div>
      <p role="status">
        {pending
          ? 'Reading recent audio…'
          : player?.triggerPending
            ? 'Placing trigger…'
            : player?.recording
              ? ready
                ? 'Ready to capture'
                : 'Listening for recent audio…'
              : player
                ? 'Playing'
                : enabled
                  ? 'Ready to record'
                  : loading
                    ? 'Loading passage…'
                    : 'Passage unavailable'}
        {player?.ready && ' · Hearing ' + player.sounding(recipe.gestures)}
      </p>
      <p className="take-hint">
        Record the passage, capture the last {length.toFixed(2)} s, then trigger it where you want it to sound.
      </p>
      <div className="take-row">
        {!player && (
          <button disabled={!enabled} onClick={() => start(false)}>
            Play passage
          </button>
        )}
        {player && (
          <button disabled={!player.ready} onClick={() => player.compare()}>
            {player.original ? 'Hear take' : 'Hear original'}
          </button>
        )}
        {fragment && (
          <button disabled={pending || player?.triggerPending} onClick={() => retain()}>
            {referenced ? 'Clear capture selection' : 'Discard fragment'}
          </button>
        )}
      </div>
      {fragment && (
        <div role="group" aria-label="Retained fragment">
          <SourceProof fragment={fragment} />
        </div>
      )}
      <details className="take-settings">
        <summary>Capture and trigger settings</summary>
        <label>
          Capture length · {length.toFixed(2)} s
          <input
            type="range"
            aria-label="Capture length"
            min=".25"
            max="2"
            step=".25"
            value={length}
            disabled={pending}
            onChange={(e) => setLength(Number(e.target.value))}
          />
        </label>
        <label>
          Trigger duration · {settings.duration} s
          <input
            type="range"
            aria-label="Trigger duration"
            min=".5"
            max="12"
            step=".5"
            value={settings.duration}
            onChange={(e) => setSettings({...settings, duration: Number(e.target.value)})}
          />
        </label>
        <Treatment settings={settings} change={(patch) => setSettings({...settings, ...patch})} disabled={pending} />
      </details>
    </>
  );
}

function TriggerEdit({
  gesture,
  disabled,
  apply,
  remove,
  retain,
}: {
  gesture: MemoryGesture;
  disabled: boolean;
  apply: (op: GestureEdit) => void;
  remove: () => void;
  retain: () => void;
}) {
  const [seconds, setSeconds] = useState(String(gesture.startFrame / RATE));
  useEffect(() => setSeconds(String(gesture.startFrame / RATE)), [gesture.startFrame]);
  return (
    <>
      <SourceProof fragment={gesture.fragmentRef} />
      <label>
        Start (seconds)
        <input
          type="number"
          min="0"
          step="any"
          value={seconds}
          disabled={disabled}
          onChange={(e) => setSeconds(e.target.value)}
        />
      </label>
      <button
        disabled={disabled || !seconds}
        onClick={() => apply({type: 'move', id: gesture.id, startFrame: Math.round(Number(seconds) * RATE)})}>
        Move
      </button>
      <button disabled={disabled} onClick={remove}>
        Remove
      </button>
      <Treatment
        settings={gesture}
        disabled={disabled}
        change={(patch) => apply({type: 'update', id: gesture.id, ...patch})}
      />
      <button disabled={disabled} onClick={retain}>
        Use this capture
      </button>
    </>
  );
}

export function MemoryTimeline({
  recipe,
  disabled,
  apply,
  session,
  select,
  retain,
  position,
  setPosition,
  add,
}: {
  recipe: MemoryRecipeV1;
  disabled: boolean;
  apply: (op: GestureEdit) => void;
  session: MemorySession;
  select: (id?: string) => void;
  retain: (ref: FragmentRef) => void;
  position: number;
  setPosition: (frame: number) => void;
  add: () => void;
}) {
  const list = useRef<HTMLOListElement>(null),
    positionInput = useRef<HTMLInputElement>(null);
  const restore = useRef(false);
  const length = recipe.passage.endFrame - recipe.passage.startFrame;
  const selected = session.selectedId ?? recipe.gestures[0]?.id;
  useLayoutEffect(() => {
    if (!restore.current) return;
    restore.current = false;
    const next = list.current?.querySelector<HTMLButtonElement>('button[aria-pressed="true"]');
    (next ?? positionInput.current)?.focus();
  }, [recipe]);
  return (
    <section className="take-timeline" aria-label="Timeline">
      <h2>Fragment timeline</h2>
      <label>
        Timeline position (seconds)
        <input
          ref={positionInput}
          type="number"
          min="0"
          max={length / RATE}
          step=".001"
          disabled={disabled}
          value={position / RATE}
          onChange={(e) => setPosition(Math.min(length - 1, Math.max(0, Math.round(Number(e.target.value) * RATE))))}
        />
      </label>
      <button disabled={disabled || !session.retained} onClick={add}>
        Add trigger
      </button>
      <ol ref={list} aria-label="Fragment triggers">
        {recipe.gestures.map((g, index) => (
          <li key={g.id}>
            <button
              aria-label={'Select trigger ' + (index + 1)}
              aria-pressed={selected === g.id}
              onClick={() => select(g.id)}>
              Trigger {stamp(g.startFrame)} – {stamp(g.endFrame)} · {g.treatment}
            </button>
            {selected === g.id && (
              <TriggerEdit
                gesture={g}
                disabled={disabled}
                apply={apply}
                retain={() => retain(g.fragmentRef)}
                remove={() => {
                  restore.current = true;
                  select((recipe.gestures[index + 1] ?? recipe.gestures[index - 1])?.id);
                  apply({type: 'remove', id: g.id});
                }}
              />
            )}
          </li>
        ))}
      </ol>
      {!recipe.gestures.length && <p>No triggers recorded.</p>}
    </section>
  );
}
