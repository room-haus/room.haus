// Each scenario starts a fresh Node process and private store. The second prepare
// uses the same process, source and durable store as the first.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {preparedSource} from './local-take-service.mjs';
import {fileStore} from '../services/takes/file-store.mjs';
import {limits, takeRepository} from '../services/takes/repository.mjs';
import {SPACE_TAKE_MAX_DELAY_FRAMES, SPACE_TAKE_MAX_FEEDBACK} from '../src/experiences/takes/recipe.mjs';

const [directory, secondsArg, gesturesArg] = process.argv.slice(2);
if (!directory) throw Error('Usage: node scripts/benchmark-take-service.mjs PREPARED_MX029_DIRECTORY');
if (!secondsArg) {
  for (const seconds of [8, 30, 60]) {
    for (const count of [1, limits.maxGestures]) {
      execFileSync(process.execPath, [process.argv[1], directory, String(seconds), String(count)], {stdio: 'inherit'});
    }
  }
} else {
  const source = await preparedSource(directory);
  const [entry] = source.catalog;
  const seconds = Number(secondsArg),
    gestures = Number(gesturesArg);
  assert.ok([8, 30, 60].includes(seconds) && [1, limits.maxGestures].includes(gestures));
  const root = await mkdtemp(join(tmpdir(), 'room-benchmark-'));
  const store = fileStore(root);
  try {
    // Explicit measurement-only ceiling to exercise a rejected 60s candidate.
    const repo = takeRepository({
      ...source,
      store,
      writeLimits: {...limits, maxPassageFrames: 60 * entry.sampleRate},
    });
    const settings = {
      delayFrames: SPACE_TAKE_MAX_DELAY_FRAMES,
      feedback: SPACE_TAKE_MAX_FEEDBACK,
      wetLevel: 1,
      stereoWidth: 1,
    };
    const startFrame = entry.denseRange.startFrame;
    const recipe = {
      schema: 1,
      experiment: 'audio-space',
      rendererVersion: 1,
      parentId: null,
      passage: {
        sourceId: entry.id,
        revision: entry.revision,
        startFrame,
        endFrame: startFrame + seconds * entry.sampleRate,
      },
      initialSettings: settings,
      // Adjacent early sends keep all 24 independent feedback tails running together.
      gestures: Array.from({length: gestures}, (_, i) => ({
        id: 'throw-' + i,
        startFrame: i * 480,
        endFrame: (i + 1) * 480,
        settings,
      })),
    };
    const timings = [];
    let digest;
    for (let pass = 0; pass < 2; pass++) {
      const at = performance.now();
      const prepared = await repo.prepare(recipe);
      timings.push(Math.round(performance.now() - at));
      assert.notEqual(prepared.dry.sha256, prepared.take.sha256);
      if (pass) assert.equal(prepared.take.sha256, digest);
      digest = prepared.take.sha256;
    }
    console.log(
      JSON.stringify({
        seconds,
        gestures,
        coldMs: timings[0],
        warmMs: timings[1],
        peakRssMiB: Math.ceil(process.resourceUsage().maxRSS / 1024),
        pairBytes: seconds * entry.sampleRate * 8,
      }),
    );
  } finally {
    store.close();
    await rm(root, {recursive: true, force: true});
  }
}
