// Run once per treatment in a fresh Node process with the pinned local MX029 source.
import assert from 'node:assert/strict';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {preparedSource} from './local-take-service.mjs';
import {fileStore} from '../services/takes/file-store.mjs';
import {limits, takeRepository} from '../services/takes/repository.mjs';
import {captureFragment} from '../src/experiences/takes/fragment-asset.mjs';
import {memorySchedule} from '../src/experiences/takes/memory-render.mjs';

const [directory, treatment] = process.argv.slice(2);
if (!directory || !['repeat', 'dissolve'].includes(treatment)) {
  throw Error('Usage: node scripts/benchmark-take-memory.mjs PREPARED_MX029_DIRECTORY repeat|dissolve');
}
const source = await preparedSource(directory);
const [entry] = source.catalog;
const root = await mkdtemp(join(tmpdir(), 'room-memory-benchmark-'));
const store = fileStore(root);
try {
  const repo = takeRepository({...source, store});
  const {startFrame} = entry.denseRange;
  const rate = entry.sampleRate;
  const passage = {sourceId: entry.id, revision: entry.revision, startFrame, endFrame: startFrame + limits.maxPassageFrames};
  const sourcePCM = await repo.passage(passage);
  const gestures = [];
  for (let i = 0; i < limits.maxGestures; i++) {
    const {ref} = await captureFragment(sourcePCM, passage, startFrame + (i + 2) * rate, 2 * rate);
    // Five offset grain streams share exactly 16 simultaneous 200 ms windows.
    // The first eight streams gain one additional tick to reach 2048 events.
    const start = treatment === 'repeat' ? Math.floor(i / 16) * 12 * rate : Math.floor(i / 5) * 6 * rate + i % 5 * 600;
    const length = treatment === 'repeat' ? 12 * rate : 1200 + (i < 8 ? 85 : 84) * 3000 + 9600;
    gestures.push({id: 'event-' + i, startFrame: start, endFrame: start + length, fragmentRef: ref,
      treatment, level: 1, density: 8, seedVersion: 1});
  }
  const unique = new Set(gestures.map(g => g.fragmentRef.sha256));
  assert.equal(unique.size, limits.maxGestures);
  const events = memorySchedule(gestures, limits.maxPassageFrames);
  let active = [], peakVoices = 0;
  for (const event of events) {
    active = active.filter(end => end > event.startFrame);
    active.push(event.endFrame);
    peakVoices = Math.max(peakVoices, active.length);
  }
  assert.equal(peakVoices, 16);
  if (treatment === 'dissolve') assert.equal(events.length, limits.maxFragmentEvents);
  const recipe = {schema:1, experiment:'audio-memory', rendererVersion:1, parentId:null, passage, gestures};
  const timings = [];
  let digest;
  for (let n = 0; n < 2; n++) {
    const begin = performance.now();
    const prep = await repo.prepare(recipe);
    timings.push(Math.round(performance.now() - begin));
    assert.notEqual(prep.dry.sha256, prep.take.sha256);
    if (n) assert.equal(prep.take.sha256, digest);
    digest = prep.take.sha256;
  }
  console.log(JSON.stringify({treatment, coldMs:timings[0], warmMs:timings[1], peakRssMiB:Math.ceil(process.resourceUsage().maxRSS / 1024),
    seconds:30, distinctCaptures:unique.size, sourcePcmBytes:unique.size * 2 * rate * 4, events:events.length, peakVoices}));
} finally {
  store.close();
  await rm(root, {recursive:true, force:true});
}
