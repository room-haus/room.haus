import {readFile} from 'node:fs/promises';
import {join, resolve} from 'node:path';
import {fileStore} from '../services/takes/file-store.mjs';
import {takeRepository} from '../services/takes/repository.mjs';
import {takeHandler} from '../services/takes/handler.mjs';

export async function preparedSource(directory) {
  const lock = JSON.parse(await readFile(new URL('./fixtures/mx029-take-source.json', import.meta.url), 'utf8'));
  const catalog = JSON.parse(await readFile(join(directory, 'catalog.json'), 'utf8'));
  if (catalog.length !== 1 || catalog[0].id !== lock.id || catalog[0].revision !== lock.canonicalSha256 ||
      catalog[0].totalFrames !== lock.totalFrames) throw Error('Prepare the pinned MX029 source before starting the take service.');
  const sourceStore = {readChunk: digest => {
    if (!/^[a-f0-9]{64}$/.test(digest)) throw Error('Invalid source chunk digest');
    return readFile(join(directory, 'chunks', digest + '.pcm'));
  }};
  return {catalog, sourceStore};
}

export async function localTakeService(env) {
  const fixture = env.ROOM_TAKE_FIXTURE === '1';
  if (!fixture && !env.ROOM_TAKE_SOURCE_DIR) return null;
  if (fixture && env.ROOM_TAKE_SOURCE_DIR) throw Error('Select one take catalog for this server.');
  const source = fixture
    ? (await import('./fixtures/take-service.mjs')).fixtureSource()
    : await preparedSource(resolve(env.ROOM_TAKE_SOURCE_DIR));
  const store = fileStore(resolve(env.ROOM_TAKE_STORE_DIR || (fixture ? '.cache/take-fixture-store' : '.cache/take-store')));
  return takeHandler(takeRepository({...source, store}));
}
