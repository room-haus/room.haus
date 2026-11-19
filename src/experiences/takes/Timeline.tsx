import React, {useMemo, useRef, useState} from 'react';
import type {SpaceRecipeV1, SpaceGesture} from './recipe.mjs';
import {editGesture} from './edits.mjs';
import {TAKE_SOURCE_SAMPLE_RATE as RATE} from './source.mjs';

export function stamp(frame: number) {
  const ms = Math.round(frame / RATE * 1000);
  return Math.floor(ms / 60000) + ':' + (Math.floor(ms / 1000) % 60).toString().padStart(2, '0') + '.' + (ms % 1000).toString().padStart(3, '0');
}
export function Waveform({levels}: {levels: number[]}) {
  const path = levels.map((v, i) => 'M' + i + ' ' + (50 - v * 49) + 'v' + Math.max(.8, v * 98)).join('');
  return <svg aria-hidden="true" viewBox={'0 0 ' + levels.length + ' 100'} preserveAspectRatio="none"><path d={path} fill="none" stroke="currentColor" strokeWidth=".82"/></svg>;
}
function ThrowRow({gesture, disabled, apply}: {gesture: SpaceGesture; disabled: boolean; apply: (op: Parameters<typeof editGesture>[1]) => void}) {
  const [seconds, setSeconds] = useState(String(gesture.startFrame / RATE));
  return <li><span>{stamp(gesture.startFrame)} – {stamp(gesture.endFrame)}</span>
    <label>Start (seconds)<input type="number" step="any" min="0" value={seconds} disabled={disabled} onChange={e => setSeconds(e.target.value)}/></label>
    <button disabled={disabled || !seconds} onClick={() => apply({type: 'move', id: gesture.id, startFrame: Math.round(Number(seconds) * RATE)})}>Move</button>
    <button disabled={disabled} onClick={() => apply({type: 'remove', id: gesture.id})}>Remove</button></li>;
}
export function Timeline({recipe, maxGestures, disabled, position, setPosition, apply}: {recipe: SpaceRecipeV1; maxGestures: number; disabled: boolean; position: number;
  setPosition: (frame: number) => void; apply: (op: Parameters<typeof editGesture>[1]) => void}) {
  const length = recipe.passage.endFrame - recipe.passage.startFrame;
  return <section className="take-timeline" aria-label="Timeline"><h2>Throw timeline</h2>
    <div className="take-row"><label>Timeline position (seconds)<input type="number" min="0" max={length / RATE} step=".001" disabled={disabled}
      value={position / RATE} onChange={e => setPosition(Math.min(length - 1, Math.max(0, Math.round(Number(e.target.value) * RATE))))}/></label>
    <button disabled={disabled || recipe.gestures.length >= maxGestures} onClick={() => apply({type: 'add', gesture: {id: crypto.randomUUID(), startFrame: position,
      endFrame: Math.min(length, position + RATE / 4), settings: recipe.initialSettings}})}>Add throw</button></div>
    <ol aria-label="Echo throws">{recipe.gestures.map(g => <ThrowRow key={g.id + g.startFrame} gesture={g} disabled={disabled} apply={apply}/>)}</ol>
    <p>{recipe.gestures.length} of {maxGestures} throws</p>
  </section>;
}

function ThrowHandle({gesture, index, length, disabled, move}: {gesture: SpaceGesture; index: number; length: number; disabled: boolean; move: (startFrame: number) => void}) {
  const [preview, setPreview] = useState<number>();
  const drag = useRef<{id: number; originX: number; width: number} | null>(null);
  const clamp = (n: number) => Math.max(0, Math.min(length - (gesture.endFrame - gesture.startFrame), Math.round(n)));
  const fromPointer = (clientX: number) => clamp(gesture.startFrame + (clientX - drag.current!.originX) * length / drag.current!.width);
  const frame = preview ?? gesture.startFrame;
  const cancel = () => { drag.current = null; setPreview(undefined); };
  const percentage = frame / length * 100 + '%';
  return <><i aria-hidden="true" className="take-throw" style={{left:'min(calc(100% - 1px), ' + percentage + ')',
    width:(gesture.endFrame - gesture.startFrame) / length * 100 + '%'}}/>
    <button type="button" role="slider" className="take-handle" aria-label={'Move throw ' + (index + 1)}
    aria-valuemin={0} aria-valuemax={length - (gesture.endFrame - gesture.startFrame)} aria-valuenow={frame} aria-valuetext={stamp(frame)}
    style={{left: 'clamp(0px, calc(' + percentage + ' - 22px), calc(100% - 44px))'}} disabled={disabled}
    onPointerDown={e => { if (e.button !== 0 || drag.current) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      drag.current = {id:e.pointerId, originX:e.clientX, width:e.currentTarget.parentElement!.getBoundingClientRect().width};
    }}
    onPointerMove={e => { if (drag.current?.id === e.pointerId) setPreview(fromPointer(e.clientX)); }}
    onPointerUp={e => { if (drag.current?.id !== e.pointerId) return; const start = fromPointer(e.clientX); cancel(); move(start); }}
    onPointerCancel={cancel} onLostPointerCapture={cancel}
    onKeyDown={e => { if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      e.preventDefault(); move(clamp(frame + (e.key === 'ArrowRight' ? 1 : -1) * (e.shiftKey ? RATE / 10 : RATE / 100))); }}>
    <span aria-hidden="true">{index + 1}</span></button></>;
}

export function PassageWave({pcm, recipe, frame, select, move, disabled}: {pcm?: ArrayBuffer; recipe: SpaceRecipeV1; frame: number; select: (f: number) => void; move: (id: string, startFrame: number) => void; disabled: boolean}) {
  const length = recipe.passage.endFrame - recipe.passage.startFrame;
  const levels = useMemo(() => {
    if (!pcm) return [];
    const data = new DataView(pcm), bins = 192, frames = pcm.byteLength / 4;
    return Array.from({length: bins}, (_, b) => {
      let peak = 0;
      for (let i = Math.floor(b * frames / bins); i < Math.floor((b + 1) * frames / bins); i++) {
        peak = Math.max(peak, Math.abs(data.getInt16(i * 4, true)), Math.abs(data.getInt16(i * 4 + 2, true)));
      }
      return peak / 32768;
    });
  }, [pcm]);
  return <div className="take-wave" role="group" aria-label="Selected passage waveform">
    {levels.length > 0 && <Waveform levels={levels}/>}
    <b style={{left: frame / length * 100 + '%'}}/>
    <input type="range" aria-label="Audition position" min="0" max={length - 1} step="1" value={Math.min(frame, length - 1)}
      aria-valuetext={stamp(frame)} disabled={disabled} onChange={e => select(Number(e.target.value))}/>
    {recipe.gestures.map((g, i) => <ThrowHandle key={g.id} gesture={g} index={i} length={length} disabled={disabled} move={startFrame => move(g.id, startFrame)}/>)}
  </div>;
}
