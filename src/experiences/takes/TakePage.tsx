import React, {useEffect, useMemo, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {getTake, getCatalog, getMaterials, getEnvelope, loadPassage, failureText, takeURL} from './api.ts';
import type {Catalog, SavedTake} from './api.ts';
import {ComparePlayer} from './ComparePlayer.tsx';
import type {CompareHandle} from './ComparePlayer.tsx';
import {TakeEditor} from './TakeEditor.tsx';
import {forkTake} from './edits.mjs';
import type {MemorySession} from './MemoryControls.tsx';
import {normalizeRecipe, serializeRecipe} from './recipe.mjs';
import {stamp} from './Timeline.tsx';
import {renderPublication} from './Publication.tsx';
import {PlaybackScope} from './PlaybackScope.tsx';
import '../../styles/layout.css';
import './takes.css';

function Listener({saved}: {saved: SavedTake}) {
  const draft = useMemo(() => {
    if (saved.editable === false && saved.recipe.experiment !== 'audio-memory') return null;
    try {
      const recipe = normalizeRecipe(saved.recipe);
      return forkTake({id:saved.id, recipe});
    } catch {
      return null;
    }
  }, [saved]);
  const memory = saved.recipe.experiment === 'audio-memory';
  const [session, setSession] = useState<MemorySession>();
  const [materialFailure, setMaterialFailure] = useState(''), [materialAttempt, retryMaterial] = useState(0);
  useEffect(() => {
    if (draft?.experiment !== 'audio-memory') return;
    const controller = new AbortController();
    const {signal} = controller;
    void (async () => {
      const envelope = materialAttempt ? await getEnvelope(saved.id, signal) : saved;
      if (serializeRecipe(envelope.recipe) !== serializeRecipe(saved.recipe)) throw Error('The saved recipe has changed.');
      const materials = await getMaterials(draft, envelope, '/v1/takes/' + saved.id, signal);
      if (envelope.editable === false) throw Error('The saved fragment recipe is unavailable for editing.');
      if (!signal.aborted) setSession({materials,retained:draft.gestures[0]?.fragmentRef});
    })().catch(e => { if (!signal.aborted) setMaterialFailure(failureText(e)); });
    return () => controller.abort();
  }, [draft, saved, materialAttempt]);
  const comparison = useRef<CompareHandle>(null);
  const [catalog, setCatalog] = useState<Catalog>(),
    [editing, setEditing] = useState(false);
  const [failure, setFailure] = useState(''),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!editing) return;
    const controller = new AbortController();
    void getCatalog(controller.signal)
      .then((result) => {
        if (!result.sources.some((s) => s.id === saved.passage.sourceId && s.revision === saved.passage.revision)) {
          throw Error('The original source revision is unavailable for editing.');
        }
        if (!controller.signal.aborted) setCatalog(result);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setFailure(failureText(e));
      });
    return () => controller.abort();
  }, [editing, attempt, saved]);
  const {passage} = saved,
    source = catalog?.sources.find((s) => s.id === passage.sourceId && s.revision === passage.revision);
  const begin = () => {
    comparison.current?.playFromStart();
    setEditing(true);
  };
  return (
    <>
      <section className="take-body take-listener">
        <h1>{memory ? 'Memory & fragments' : 'Space & echoes'}</h1>
        <p className="take-byline">
          {passage.sourceId} / Saad Ashraf <span>· {saved.parentId ? 'Variation' : memory ? 'Fragment take' : 'Echo take'}</span>
        </p>
        <ComparePlayer ref={comparison} label="Saved performance" {...saved.audio} />
        <div className="take-bounds">
          <span>IN {stamp(passage.startFrame)}</span>
          <span>OUT {stamp(passage.endFrame)}</span>
        </div>
        {saved.parentId && (
          <p>
            <a href={takeURL(saved.parentId)}>Hear the parent take</a>
          </p>
        )}
        {draft ? (
          !editing && <button disabled={memory && !session} onClick={begin}>Make a variation</button>
        ) : (
          <p role="status">You can listen to this saved version. Editing is unavailable for this take.</p>
        )}
        {memory && draft && !session && (materialFailure ? <>
          <p role="alert" className="take-error">{materialFailure}</p>
          <button onClick={() => {setMaterialFailure(''); retryMaterial(n => n+1);}}>Retry material</button>
        </> : <p role="status">Verifying captured audio…</p>)}
        {editing &&
          !catalog &&
          (failure ? (
            <>
              <p role="alert" className="take-error">
                {failure}
              </p>
              <button
                onClick={() => {
                  setFailure('');
                  setAttempt((n) => n + 1);
                }}>
                Retry variation
              </button>
            </>
          ) : (
            <p role="status">Opening variation…</p>
          ))}
      </section>
      {editing && source && catalog && draft && (
        <TakeEditor
          memorySession={session}
          source={source}
          draft={draft}
          loadPassage={loadPassage}
          {...catalog.limits}
          renderPublication={renderPublication}
        />
      )}
    </>
  );
}
function TakePage() {
  const [saved, setSaved] = useState<SavedTake>(),
    [error, setError] = useState(''),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void getTake(new URLSearchParams(location.search).get('id'), controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setSaved(result);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(failureText(e));
      });
    return () => controller.abort();
  }, [attempt]);
  return (
    <PlaybackScope>
      <div className="take-editor take-public">
        <header className="take-header">
          <a href="/" aria-label="ROOM home">
            ROOM
          </a>
          <span>SHARED TAKE</span>
        </header>
        {saved ? (
          <Listener saved={saved} />
        ) : (
          <div className="take-body">
            <h1>{error ? 'Take unavailable' : 'Opening take'}</h1>
            {error ? (
              <>
                <p className="take-error" role="alert">
                  {error}
                </p>
                <button
                  onClick={() => {
                    setError('');
                    setAttempt((n) => n + 1);
                  }}>
                  Retry take
                </button>
              </>
            ) : (
              <p role="status">Loading the saved audio…</p>
            )}
          </div>
        )}
      </div>
    </PlaybackScope>
  );
}
createRoot(document.getElementById('take-root')!).render(<TakePage />);
