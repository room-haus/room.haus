import React, {useEffect, useRef, useState} from 'react';
import {TakeEditor} from './TakeEditor.tsx';
import {getCatalog, loadPassage, serviceMissing} from './api.ts';
import type {Catalog} from './api.ts';
import type {MemorySession} from './MemoryControls.tsx';
import {renderPublication} from './Publication.tsx';
import {PlaybackScope} from './PlaybackScope.tsx';
import type {RecipeV1} from './recipe.mjs';
import {normalizeRecipe, SPACE_TAKE_DEFAULTS} from './recipe.mjs';

export function TakeLauncher({
  experiment,
  onClose,
  study: studyContent,
}: {
  experiment: RecipeV1['experiment'];
  onClose: () => void;
  study: React.ReactNode;
}) {
  const [retained, setRetained] = useState<RecipeV1>();
  const memory = experiment === 'audio-memory';
  const session = useRef<MemorySession>({materials: new Map()}).current;
  const studyLink = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);

  const [study, setStudy] = useState(false),
    [catalog, setCatalog] = useState<Catalog>();
  const [failure, setFailure] = useState<'missing' | 'retry'>(),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (study) return;
    const controller = new AbortController();
    void (async () => {
      setFailure(undefined);
      try {
        const result = await getCatalog(controller.signal);
        if (!result.sources?.some((s) => s.id === 'MX029') || !result.limits) throw Error('Missing MX029');
        if (!controller.signal.aborted) setCatalog(result);
      } catch (error) {
        if (!controller.signal.aborted) setFailure(serviceMissing(error) ? 'missing' : 'retry');
      }
    })();
    return () => controller.abort();
  }, [attempt, study]);
  useEffect(() => {
    if (!study && restoreFocus.current) {
      studyLink.current?.focus();
      restoreFocus.current = false;
    }
  }, [study]);
  if (study)
    return (
      <>
        <div className="space-study-link">
          <button
            autoFocus
            onClick={() => {
              restoreFocus.current = true;
              setStudy(false);
            }}>
            Back to {memory ? 'fragment' : 'echo'} take
          </button>
        </div>
        {studyContent}
      </>
    );
  const source = catalog?.sources.find((s) => s.id === 'MX029');
  const header = (
    <header className="take-header">
      <span>ROOM / AUDIO LABS</span>
      <button onClick={onClose}>Back to Labs</button>
    </header>
  );
  const studyButton = (
    <button ref={studyLink} onClick={() => setStudy(true)}>
      {memory ? 'Open live fragment study' : 'Open continuous delay and reverb study'}
    </button>
  );
  return (
    <PlaybackScope>
      {catalog && source ? (
        <TakeEditor
          memorySession={session}
          renderPublication={renderPublication}
          header={header}
          source={source}
          {...catalog.limits}
          loadPassage={loadPassage}
          onDraftChange={setRetained}
          draft={
            retained ??
            normalizeRecipe({
              schema: 1,
              experiment,
              rendererVersion: 1,
              parentId: null,
              gestures: [],
              initialSettings: SPACE_TAKE_DEFAULTS,
              passage: {sourceId: source.id, revision: source.revision, ...source.curatedRange},
            })
          }
        />
      ) : (
        <article className="take-launch">
          {header}
          <section>
            <h1>{memory ? 'Memory & fragments' : 'Space & echoes'}</h1>
            <p role="status">{failure ? 'The MX029 take source is unavailable.' : 'Opening MX029…'}</p>
            {studyButton}
            {failure === 'retry' && <button onClick={() => setAttempt((n) => n + 1)}>Retry source</button>}
          </section>
        </article>
      )}
      {catalog && source && <div className="space-study-link">{studyButton}</div>}
    </PlaybackScope>
  );
}
