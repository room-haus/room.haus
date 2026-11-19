import {createHash, randomUUID} from 'node:crypto';
import {link, mkdir, open, readFile, readdir, unlink} from 'node:fs/promises';
import {dirname, join} from 'node:path';

// Keys consist entirely of an internal collection and an opaque ID or digest.
export function fileStore(root) {
  function pathFor(key) {
    if (!/^[a-z-]+\/[a-f0-9]{32,64}$/.test(key)) throw Error('Invalid storage key');
    return join(root, key);
  }
  return {
    async read(key) {
      try {
        return await readFile(pathFor(key));
      } catch (error) {
        if (error.code === 'ENOENT') return null;
        throw error;
      }
    },
    async putIfAbsent(key, bytes) {
      const target = pathFor(key);
      const directory = dirname(target);
      await mkdir(directory, {recursive: true, mode: 0o700});
      // link() atomically installs complete bytes only if no writer owns the key.
      const temp = join(directory, '.' + randomUUID());
      const file = await open(temp, 'wx', 0o600);
      try {
        try {
          await file.writeFile(bytes);
          await file.sync();
        } finally {
          await file.close();
        }
        try {
          await link(temp, target);
        } catch (error) {
          if (error.code === 'EEXIST') return false;
          throw error;
        }
        const dir = await open(directory, 'r');
        try {
          await dir.sync();
        } finally {
          await dir.close();
        }
        return true;
      } finally {
        await unlink(temp);
      }
    },
  };
}

// Permanent objects are immutable. Every staged read can fall back to the same
// verified permanent digest, including active previews sharing an expired take.
export async function reclaimExpiredDuplicates(root) {
  const store = fileStore(root);
  const entries = await readdir(join(root, 'preparations')).catch(error => {
    if (error.code === 'ENOENT') return [];
    throw error;
  });
  let reclaimedBytes = 0;
  for (const id of entries) {
    if (!/^[a-f0-9]{32}$/.test(id)) continue;
    const record = JSON.parse(await store.read('preparations/' + id));
    if (record?.id !== id || !Number.isSafeInteger(record.expiresAt) || record.expiresAt > Date.now()) continue;
    for (const {sha256} of [record.dry, record.take]) {
      if (!/^[a-f0-9]{64}$/.test(sha256)) continue;
      const staged = await store.read('prepared-audio/' + sha256);
      if (!staged) continue;
      const permanent = await store.read('audio/' + sha256);
      if (!permanent || !permanent.equals(staged) || createHash('sha256').update(permanent).digest('hex') !== sha256) continue;
      try {
        await unlink(join(root, 'prepared-audio', sha256));
        reclaimedBytes += staged.byteLength;
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
    }
  }
  return {reclaimedBytes};
}
