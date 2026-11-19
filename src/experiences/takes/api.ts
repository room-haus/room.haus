import {decodePCM} from './pcm.ts';
import type {RecipeV1, TakePassage} from './recipe.mjs';
import {normalizePassage, serializeRecipe} from './recipe.mjs';
import type {LoadPassage, SourceOverview} from './TakeEditor.tsx';
import {TAKE_SOURCE_SAMPLE_RATE as RATE, TAKE_SOURCE_BYTES_PER_FRAME as STRIDE} from './source.mjs';

export type Catalog = {sources: SourceOverview[]; limits: {maxPassageFrames: number; maxGestures: number}};
export type AudioPair = {original: AudioBuffer; take: AudioBuffer};
export type SavedTake = {editable?: boolean; id: string; parentId: string | null; recipe: unknown; passage: TakePassage; audio: AudioPair};
type Descriptor = {
  url: string;
  sha256: string;
  frameCount: number;
  byteLength: number;
  sampleRate: number;
  channels: number;
  format: string;
};
type References = {dry: Descriptor; take: Descriptor};

class ServiceError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
export const serviceMissing = (error: unknown) => error instanceof ServiceError && error.status === 404;
export const expired = (error: unknown) => error instanceof ServiceError && error.status === 410;
export const failureText = (e: unknown) => (e instanceof Error ? e.message : 'The request could not be completed.');
const validId = (id: unknown): id is string => typeof id === 'string' && /^[a-f0-9]{32}$/.test(id);

async function json<T>(url: string, signal: AbortSignal, body?: unknown): Promise<T> {
  const response = await fetch(url, {
    signal,
    ...(body === undefined
      ? {}
      : {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify(body),
        }),
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => null);
    throw new ServiceError(response.status, detail?.error || 'The take service is unavailable.');
  }
  return response.json();
}

export async function getCatalog(signal: AbortSignal) {
  const catalog = await json<Catalog>('/v1/catalog', signal);
  if (!catalog.sources?.length || !catalog.limits) throw Error('The take source catalog is unavailable.');
  return catalog;
}
export const loadPassage: LoadPassage = async (passage, signal) => {
  const query = new URLSearchParams(Object.entries(passage).map(([key, value]) => [key, String(value)]));
  const response = await fetch('/v1/passage?' + query, {signal});
  if (!response.ok || !response.headers.get('content-type')?.includes('application/octet-stream'))
    throw Error('The selected PCM passage is unavailable.');
  return response.arrayBuffer();
};

async function reference(ref: Descriptor, expectedPath: string, frames: number, signal: AbortSignal) {
  if (
    !ref ||
    ref.url !== expectedPath ||
    ref.format !== 's16le' ||
    ref.channels !== 2 ||
    ref.sampleRate !== RATE ||
    ref.frameCount !== frames ||
    ref.byteLength !== frames * STRIDE ||
    !/^[a-f0-9]{64}$/.test(ref.sha256)
  ) {
    throw Error('The saved audio description is invalid.');
  }
  const response = await fetch(ref.url, {signal, redirect: 'error'});
  if (!response.ok || !response.headers.get('content-type')?.includes('application/octet-stream'))
    throw Error('The saved audio is unavailable.');
  const data = await response.arrayBuffer();
  if (data.byteLength !== ref.byteLength) throw Error('The saved audio is incomplete.');
  const digest = await crypto.subtle.digest('SHA-256', data);
  const hex = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
  if (hex !== ref.sha256) throw Error('The saved audio failed its integrity check.');
  signal.throwIfAborted();
  return decodePCM(data);
}

async function references(
  refs: References,
  base: string,
  passage: TakePassage,
  signal: AbortSignal,
): Promise<AudioPair> {
  const frames = passage.endFrame - passage.startFrame;
  const [original, take] = await Promise.all([
    reference(refs.dry, base + '/dry', frames, signal),
    reference(refs.take, base + '/take', frames, signal),
  ]);
  return {original, take};
}
export async function getTake(id: string | null, signal: AbortSignal): Promise<SavedTake> {
  if (!validId(id)) throw Error('This link is missing a valid take ID.');
  const path = '/v1/takes/' + id;
  const result = await json<References & {editable?: boolean; id: string; parentId: string | null; recipe: {passage: unknown}}>(
    path,
    signal,
  );
  if (result.id !== id || !(result.parentId === null || validId(result.parentId)))
    throw Error('The saved take is unavailable.');
  const passage = normalizePassage(result.recipe?.passage);
  return {...result, passage, audio: await references(result, path, passage, signal)};
}
export async function prepareTake(recipe: RecipeV1, signal: AbortSignal) {
  const result = await json<References & {preparationId: string; recipe: unknown}>('/v1/preparations', signal, recipe);
  if (!validId(result.preparationId) || serializeRecipe(result.recipe) !== serializeRecipe(recipe)) {
    throw Error('The service returned a different draft. Prepare this take again.');
  }
  const audio = await references(result, '/v1/preparations/' + result.preparationId, recipe.passage, signal);
  return {id: result.preparationId, audio, requestId: crypto.randomUUID()};
}
export async function publishTake(
  preparationId: string,
  requestId: string,
  parentId: string | null,
  signal: AbortSignal,
) {
  const result = await json<{id: string; parentId: string | null}>('/v1/takes', signal, {preparationId, requestId});
  if (!validId(result.id) || result.parentId !== parentId)
    throw Error('The service could not confirm this publication.');
  return takeURL(result.id);
}
export function takeURL(id: string) {
  const url = new URL('/takes/', window.location.origin);
  url.searchParams.set('id', id);
  return url.href;
}
