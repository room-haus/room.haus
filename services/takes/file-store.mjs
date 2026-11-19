import {randomUUID} from 'node:crypto';
import {link, mkdir, open, readFile, unlink} from 'node:fs/promises';
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
