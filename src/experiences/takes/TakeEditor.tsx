import React, {useCallback, useEffect, useRef, useState} from 'react';
import type {SpaceRecipeV1, SpaceTakeSettings, TakePassage} from './recipe.mjs';
import {normalizeRecipe, samePassage} from './recipe.mjs';
import {editGesture, replaceTakePassage} from './edits.mjs';
import {TAKE_SOURCE_SAMPLE_RATE as RATE} from './source.mjs';
import {TakeTransport} from './transport.ts';
import {PassageWave, stamp, Timeline, Waveform} from './Timeline.tsx';
import {usePlaybackOwner} from './PlaybackScope.tsx';
import './takes.css';

export type Bounds = {startFrame: number; endFrame: number};
export type SourceOverview = {id: string; revision: string; totalFrames: number; curatedRange: Bounds; denseRange: Bounds;
  peaks: {framesPerPeak: number; values: number[][]}[]};
export type LoadPassage = (passage: TakePassage, signal: AbortSignal) => Promise<ArrayBuffer>;
export type PublicationControls = (props: {recipe: SpaceRecipeV1; busy: boolean; stop: () => void}) => React.ReactNode;
type EditorProps = {draft: SpaceRecipeV1; source: SourceOverview; loadPassage: LoadPassage; maxPassageFrames: number; maxGestures: number;
  onDraftChange?: (draft: SpaceRecipeV1) => void; renderPublication?: PublicationControls; header?: React.ReactNode};

const message = (error: unknown) => error instanceof Error ? error.message : 'The passage could not load.';

function PassageRange({source, passage, apply, disabled, maxFrames}: {source: SourceOverview; passage: TakePassage;
  apply: (bounds: Bounds) => void; disabled: boolean; maxFrames: number}) {
  const [range, setRange] = useState<Bounds>(passage);
  const [time, setTime] = useState(stamp(passage.startFrame));
  const [rangeError, setRangeError] = useState('');
  function choose(bounds: Bounds) {
    setRange(bounds); setTime(stamp(bounds.startFrame)); setRangeError('');
  }
  function shift(start: number) {
    const duration = Math.max(1, Math.min(maxFrames, range.endFrame - range.startFrame));
    const startFrame = Math.max(0, Math.min(source.totalFrames - duration, start));
    choose({startFrame, endFrame: startFrame + duration});
  }
  function enterTime() {
    const match = /^(?:(\d+):)?(\d+(?:\.\d+)?)$/.exec(time.trim());
    if (!match || (match[1] && Number(match[2]) >= 60)) { setRangeError('Enter minutes and seconds, such as 12:34.500.'); return; }
    shift(Math.round((Number(match[1] ?? 0) * 60 + Number(match[2])) * RATE));
  }
  const levels = React.useMemo(() => {
    const values = source.peaks.at(-1)?.values ?? [];
    const bins = Math.min(220, values.length);
    return Array.from({length: bins}, (_, b) => {
      let amplitude = 0;
      for (let i = Math.floor(b * values.length / bins); i < Math.floor((b + 1) * values.length / bins); i++)
        for (const v of values[i]) amplitude = Math.max(amplitude, Math.abs(v));
      return amplitude / 32768;
    });
  }, [source]);
  return <details className="take-range"><summary>Choose passage <span>{stamp(passage.startFrame)} – {stamp(passage.endFrame)}</span></summary>
    <p>{source.id} · {stamp(source.totalFrames)} total · up to {maxFrames / RATE} s per take</p>
    <div className="take-overview">{levels.length > 0 && <Waveform levels={levels}/>}
      <i style={{left: range.startFrame / source.totalFrames * 100 + '%', width: Math.max(0, range.endFrame - range.startFrame) / source.totalFrames * 100 + '%'}}/>
      <input type="range" aria-label="Mix position" aria-valuetext={stamp(range.startFrame)} min="0" max={source.totalFrames}
        value={range.startFrame} disabled={disabled} onChange={e => shift(Number(e.target.value))}/></div>
    <div className="take-row"><label>Start at mix time<input value={time} disabled={disabled} onChange={e => setTime(e.target.value)} placeholder="12:34.500"/></label>
      <button disabled={disabled} onClick={enterTime}>Set start</button></div>
    {rangeError && <p role="alert">{rangeError}</p>}
    <div className="take-row">{(['startFrame', 'endFrame'] as const).map((key, i) => <label key={key}>{i ? 'Out' : 'In'} · {stamp(range[key])}
      <input type="range" aria-label={i ? 'Out handle' : 'In handle'} min="0" max={source.totalFrames} step="1" value={range[key]} disabled={disabled}
        onChange={e => choose({...range, [key]: Number(e.target.value)})}/>
      <span>{i ? 'Out frame' : 'In frame'}</span><input type="number" aria-label={i ? 'Out frame' : 'In frame'} min="0" max={source.totalFrames} step="1" value={range[key]} disabled={disabled}
        onChange={e => choose({...range, [key]: Number(e.target.value)})}/></label>)}</div>
    <div className="take-row"><button disabled={disabled} onClick={() => choose(source.curatedRange)}>Curated range</button>
      <button disabled={disabled} onClick={() => choose(source.denseRange)}>Dense range</button>
      <button disabled={disabled} onClick={() => apply(range)}>Load passage</button></div>
  </details>;
}

export function TakeEditor({draft, source, loadPassage, maxPassageFrames, maxGestures, onDraftChange, renderPublication, header}: EditorProps) {
  const [recipe, setRecipe] = useState(draft);
  const current = useRef(draft);
  const [pcm, setPCM] = useState<ArrayBuffer>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState<Bounds>();
  const [position, setPosition] = useState(0);
  const [, redraw] = useState(0);
  const update = useCallback(() => redraw(n => n + 1), []);
  const output = usePlaybackOwner();
  const owner = useRef<TakeTransport | null>(null);
  const request = useRef<AbortController | null>(null);
  const padOwner = useRef<string | number | null>(null);
  const change = (next: SpaceRecipeV1) => { current.current = next; setRecipe(next); onDraftChange?.(next); };
  const stop = () => owner.current?.end();

  const load = async (next: SpaceRecipeV1) => {
    if (owner.current) return;
    const previous = current.current;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setError(''); setLoading(true);
    try {
      const result = await loadPassage(next.passage, controller.signal);
      if (controller.signal.aborted || owner.current || current.current !== previous) return;
      if (result.byteLength !== (next.passage.endFrame - next.passage.startFrame) * 4) throw Error('The selected passage arrived incomplete. Retry the passage.');
      setPCM(result); setPosition(0); change(next);
    } catch (e) { if (!controller.signal.aborted) setError(message(e)); }
    finally {
      if (request.current === controller) {
        request.current = null;
        if (!controller.signal.aborted) setLoading(false);
      }
    }
  };

  useEffect(() => {
    void load(draft);
    return () => { request.current?.abort(); owner.current?.dispose(); owner.current = null; };
    // Mount a new editor for a different initial draft. Range requests are owned here.
  }, []);

  useEffect(() => {
    const release = () => { padOwner.current = null; owner.current?.release(); };
    const hidden = () => { if (document.hidden && owner.current?.recording) owner.current.fail('Recording was interrupted.'); };
    window.addEventListener('blur', release);
    document.addEventListener('visibilitychange', hidden);
    const timer = setInterval(() => { if (owner.current?.ready) { owner.current.checkClock(); update(); } }, 50);
    return () => { clearInterval(timer); window.removeEventListener('blur', release); document.removeEventListener('visibilitychange', hidden); };
  }, [update]);
  const player = owner.current;
  const start = (recording: boolean) => {
    if (!pcm || owner.current || request.current) return;
    const recorded = current.current;
    setError('');
    try {
      const transport = new TakeTransport(recorded, pcm, recording, recording ? 0 : position, {
        update, finish: (gestures, failure) => {
          if (owner.current !== transport) return;
          output.release(); owner.current = null; padOwner.current = null;
          if (failure) setError(failure + ' Your earlier edits are saved in this draft.');
          else if (gestures.length && samePassage(recorded.passage, current.current.passage)) {
            change(normalizeRecipe({...current.current, gestures: [...current.current.gestures, ...gestures]}));
          }
          update();
        },
      });
      output.claim(() => transport.end());
      owner.current = transport; update();
      void transport.start().catch(e => transport.fail(message(e)));
    } catch (e) { setError(message(e)); }
  };
  const press = (key: string | number) => {
    if (padOwner.current !== null) return;
    try { setError(''); owner.current?.press(current.current.initialSettings, maxGestures); padOwner.current = key; }
    catch (e) { setError(message(e)); }
  };
  const release = (key?: string | number) => {
    if (key !== undefined && padOwner.current !== key) return;
    padOwner.current = null; owner.current?.release();
  };
  const rangeChange = (bounds: Bounds, confirmed = false) => {
    if (owner.current) return;
    const passage = {...recipe.passage, ...bounds};
    setError('');
    if (bounds.endFrame > source.totalFrames || bounds.endFrame - bounds.startFrame > maxPassageFrames) {
      setError('Choose a range within the mix and its passage length limit.'); return;
    }
    try {
      if (recipe.gestures.length && !confirmed && !samePassage(recipe.passage, passage)) { setConfirm(bounds); return; }
      const next = replaceTakePassage(recipe, passage, {confirmed});
      setConfirm(undefined); void load(next);
    } catch (e) { setError(message(e)); }
  };
  const apply = (op: Parameters<typeof editGesture>[1]) => {
    try {
      if (op.type === 'add' && recipe.gestures.length >= maxGestures) throw Error('The throw limit for this take has been reached.');
      change(editGesture(recipe, op)); setError('');
    } catch (e) { setError(message(e)); }
  };
  const length = recipe.passage.endFrame - recipe.passage.startFrame, frame = player?.positionFrame() ?? position;
  const settings = recipe.initialSettings, busy = Boolean(player) || loading;
  return <article className="take-editor">
    {header}
    <div className="take-body">{recipe.parentId ? <h2 className="take-edit-title">Edit your variation</h2> : <h1>Space &amp; echoes</h1>}
    <p className="take-byline">{recipe.passage.sourceId} / Saad Ashraf <span>· {recipe.parentId ? 'Variation' : 'Echo take'}</span></p>
    <div className="take-meter"><span>{stamp(frame)}</span><span>/ {stamp(length)}</span></div>
    <PassageWave pcm={pcm} recipe={recipe} frame={frame} select={setPosition} move={(id,startFrame) => apply({type:'move',id,startFrame})} disabled={busy}/>
    <div className="take-bounds"><span>IN {stamp(recipe.passage.startFrame)}</span><span>OUT {stamp(recipe.passage.endFrame)}</span></div>
    <div className="take-actions">
      {player ? <button onClick={stop}>Stop</button> : <button className="take-primary" disabled={!pcm || loading} onClick={() => start(false)}>Play passage</button>}
      <button disabled={!pcm || loading || player?.recording} onClick={() => { if (owner.current) { owner.current.dispose(); owner.current = null; } start(true); }}>Record</button>
      <button className="take-pad" aria-pressed={Boolean(player?.recording && player.echoState() === 'Sending')} disabled={!player?.recording || !player.ready}
        onPointerDown={e => { if (e.button !== 0 || padOwner.current !== null) return; e.preventDefault(); e.currentTarget.focus({preventScroll:true});
          if (e.currentTarget.hasPointerCapture(e.pointerId) || e.nativeEvent.isTrusted) e.currentTarget.setPointerCapture(e.pointerId); press(e.pointerId); }}
        onPointerUp={e => release(e.pointerId)} onPointerCancel={e => release(e.pointerId)} onLostPointerCapture={e => release(e.pointerId)}
        onBlur={() => release()} onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); if (!e.repeat) press(e.key); } }}
        onKeyUp={e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); release(e.key); } }}>Echo</button>
    </div>
    <p role="status">{loading ? 'Loading passage…' : player ? (player.recording ? 'Recording · ' : 'Playing · ') +
      (player.original ? 'Original' : player.echoState()) : pcm ? 'Ready to play' : 'Passage unavailable'}</p>
    <p className="take-hint">Press Record, then hold Echo on a sound. Release to hear it repeat.</p>
    {player && <button onClick={() => player.compare()} disabled={!player.ready}>{player.original ? 'Hear take' : 'Hear original'}</button>}
    {error && <p className="take-error" role="alert">{error}</p>}
    {!pcm && !loading && <button onClick={() => void load(recipe)}>Retry passage</button>}
    {recipe.parentId === null && <PassageRange key={recipe.passage.startFrame + '/' + recipe.passage.endFrame} source={source} passage={recipe.passage}
      maxFrames={maxPassageFrames} disabled={Boolean(player)} apply={rangeChange}/>}
    {confirm && <div className="take-confirm"><p>Start a new draft for this passage? It will replace the current throws.</p>
      <button disabled={busy} onClick={() => rangeChange(confirm, true)}>Start new draft</button> <button onClick={() => setConfirm(undefined)}>Keep draft</button></div>}
    <details className="take-settings"><summary>Echo settings</summary>
      {([{k:'delayFrames',label:'Delay (ms)',max:1500,scale:48,step:1,min:1},{k:'feedback',label:'Feedback (%)',max:48,scale:.01,step:1,min:0},
        {k:'wetLevel',label:'Echo level (%)',max:100,scale:.01,step:1,min:0},{k:'stereoWidth',label:'Stereo width (%)',max:100,scale:.01,step:1,min:0}] as const).map(({k,label,max,scale,step,min}) =>
        <label key={k}>{label} <output>{Number((settings[k] / scale).toFixed(2))}</output><input aria-label={label} type="range" min={min} max={max} step={step}
          value={settings[k] / scale} disabled={loading} onChange={e => { const initialSettings: SpaceTakeSettings = {...settings, [k]: Number(e.target.value) * scale}; change({...recipe, initialSettings}); }}/></label>)}
    </details>
    <Timeline recipe={recipe} maxGestures={maxGestures} disabled={busy} position={position} setPosition={setPosition} apply={apply}/>
    {renderPublication?.({recipe, busy, stop})}
    </div></article>;
}
