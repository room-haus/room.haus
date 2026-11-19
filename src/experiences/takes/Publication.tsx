import React, {useEffect, useRef, useState} from 'react';
import type {PublicationControls} from './TakeEditor.tsx';
import {serializeRecipe} from './recipe.mjs';
import {prepareTake, publishTake, expired, failureText} from './api.ts';
import {ComparePlayer} from './ComparePlayer.tsx';

function Publication({recipe, busy}: Parameters<PublicationControls>[0]) {
  const [prepared, setPrepared] = useState<Awaited<ReturnType<typeof prepareTake>>>();
  const [working, setWorking] = useState(''),
    [auditioned, setAuditioned] = useState(false);
  const [link, setLink] = useState(''),
    [copied, setCopied] = useState(false),
    [error, setError] = useState('');
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  async function run(action: 'prepare' | 'publish') {
    if (pending.current || busy || (action === 'publish' && (!prepared || !auditioned))) return;
    const controller = new AbortController();
    pending.current = controller;
    setError('');
    setWorking(action);
    try {
      if (action === 'prepare') {
        const result = await prepareTake(recipe, controller.signal);
        if (!controller.signal.aborted) {
          setPrepared(result);
          setAuditioned(false);
        }
      } else if (prepared) {
        const url = await publishTake(prepared.id, prepared.requestId, recipe.parentId, controller.signal);
        if (!controller.signal.aborted) setLink(url);
      }
    } catch (e) {
      if (!controller.signal.aborted) {
        if (expired(e)) {
          setPrepared(undefined);
          setAuditioned(false);
        }
        setError(failureText(e) + ' Your draft is still here.');
      }
    } finally {
      if (!controller.signal.aborted) {
        pending.current = null;
        setWorking('');
      }
    }
  }
  return (
    <section className="take-publish" aria-label="Share this performance">
      <h2>Share this performance</h2>
      {!prepared ? (
        <>
          <p>Prepare your edited passage, then listen to the audio your link will share.</p>
          <button disabled={busy || Boolean(working)} onClick={() => void run('prepare')}>
            Prepare take
          </button>
        </>
      ) : (
        <>
          <ComparePlayer {...prepared.audio} label="Prepared performance" onAudition={() => setAuditioned(true)} />
          {link ? (
            <div className="take-shared">
              <a href={link}>Open shared take</a>
              <button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(link);
                    setCopied(true);
                  } catch {
                    setError('Copy the address below to share your take.');
                  }
                }}>
                {copied ? 'Link copied' : 'Copy link'}
              </button>
              <input aria-label="Share link" value={link} readOnly onFocus={(e) => e.target.select()} />
            </div>
          ) : (
            <>
              <p>{auditioned ? 'Ready to share this version.' : 'Play the prepared take before publishing.'}</p>
              <button disabled={!auditioned || busy || Boolean(working)} onClick={() => void run('publish')}>
                Publish take
              </button>
            </>
          )}
        </>
      )}
      {working && <p role="status">{working === 'prepare' ? 'Preparing your audio…' : 'Publishing your take…'}</p>}
      {error && (
        <p className="take-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

// A draft change unmounts its pending requests, audition and publication identity.
export const renderPublication: PublicationControls = (props) => (
  <Publication key={serializeRecipe(props.recipe)} {...props} />
);
