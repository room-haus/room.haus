import {performanceDigest, readPreparationProof} from './preparation-proof.mjs';
import {fragmentTable} from '../../src/experiences/takes/fragment-table.mjs';
import {createHash, randomUUID} from 'node:crypto';
import {link, mkdir, open, readFile, readdir, stat, unlink} from 'node:fs/promises';
import {existsSync, mkdirSync, readdirSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {dirname, join} from 'node:path';

// Keys consist entirely of an internal collection and an opaque ID or digest.
function records(root) {
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


// An empty SQLite database supplies shared/exclusive OS file locks across local
// processes. Process exit releases its lock, including after an abrupt shutdown.
const lockFile = '.take-store-lock.sqlite';
function lock(root, exclusive) {
  const db = new DatabaseSync(join(root, lockFile));
  try {
    db.exec(exclusive ? 'BEGIN EXCLUSIVE' : 'BEGIN; SELECT count(*) FROM sqlite_schema');
    return db;
  } catch (error) {
    db.close();
    if (error.errcode === 5 || error.errcode === 6) throw Error('Take store is in use. Retry after maintenance or service shutdown.');
    throw error;
  }
}

export function fileStore(root) {
  mkdirSync(root, {recursive: true, mode: 0o700});
  const entries = readdirSync(root);
  // Existing stores may have a writer running a pre-lock release. Keep serving
  // those stores, but never opt them into destructive maintenance automatically.
  const lease = entries.length === 0 || entries.includes(lockFile) ? lock(root, false) : null;
  const store = records(root);
  let active = 0;
  let closed = false;
  async function run(method, ...args) {
    if (closed) throw Error('Take store closed.');
    active++;
    try {
      return await store[method](...args);
    } finally {
      active--;
    }
  }
  return {
    read: key => run('read', key),
    putIfAbsent: (key, bytes) => run('putIfAbsent', key, bytes),
    close() {
      if (active) throw Error('Wait for pending store operations before closing.');
      if (!closed) lease?.close();
      closed = true;
    },
  };
}

async function keys(root, collection, pattern) {
  try {
    return (await readdir(join(root, collection))).filter(key => pattern.test(key));
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

export async function reclaimTakeStaging(root) {
  if (!existsSync(join(root, lockFile))) throw Error('Offline cleanup requires a store created by the locking service.');
  const exclusive = lock(root, true);
  try {
    const store = records(root);
    const id = /^[a-f0-9]{32}$/;
    const digest = /^[a-f0-9]{64}$/;
    const valid = (value, pattern) => typeof value === 'string' && pattern.test(value);
    const preparations = new Set(await keys(root, 'preparations', id));
    const protectedPreparations = new Map();
    const retainedAudio = new Set();
    function retainAssets(record) {
      if (!valid(record?.dry?.sha256, digest) || !valid(record?.take?.sha256, digest)) throw Error('Invalid audio references; cleanup stopped.');
      retainedAudio.add(record.dry.sha256);
      retainedAudio.add(record.take.sha256);
      for (const ref of fragmentTable(record)) retainedAudio.add(ref.sha256);
    }
    for (const key of await keys(root, 'requests', digest)) {
      const binding = JSON.parse(await store.read('requests/' + key));
      if (!valid(binding?.id, id) || !valid(binding?.preparationId, id)) throw Error('Invalid publication binding; cleanup stopped.');
      const pinned = protectedPreparations.get(binding.preparationId);
      if (binding.performanceSha256 !== undefined && (!valid(binding.performanceSha256, digest) ||
          (pinned !== undefined && pinned !== binding.performanceSha256))) throw Error('Invalid publication checksum; cleanup stopped.');
      protectedPreparations.set(binding.preparationId, binding.performanceSha256 ?? pinned);
      // A previous release may have removed an expired private manifest after
      // commit. Preserve the pair needed to recover a partially missing commit.
      if (!preparations.has(binding.preparationId)) {
        const committed = JSON.parse(await store.read('takes/' + binding.id));
        if (committed?.id !== binding.id) throw Error('Incomplete binding lacks its preparation; cleanup stopped.');
        if (binding.performanceSha256 !== undefined && binding.performanceSha256 !== performanceDigest(committed)) {
          throw Error('Committed performance checksum mismatch; cleanup stopped.');
        }
        retainAssets(committed);
      }
    }

    const expired = [];
    const now = Date.now();
    for (const key of preparations) {
      const prep = JSON.parse(await store.read('preparations/' + key));
      if (prep?.id !== key || !Number.isSafeInteger(prep.expiresAt) ||
          !valid(prep.dry?.sha256, digest) || !valid(prep.take?.sha256, digest)) throw Error('Invalid preparation; cleanup stopped.');
      if (prep.expiresAt <= now && !protectedPreparations.has(key)) expired.push(key);
      else {
        const proof = await readPreparationProof(store, prep);
        const pinned = protectedPreparations.get(key);
        if (pinned !== undefined && pinned !== (proof ?? performanceDigest(prep))) throw Error('Bound preparation checksum mismatch; cleanup stopped.');
        retainAssets(prep);
      }
    }

    for (const key of expired) {
      await unlink(join(root, 'preparations', key));
      preparations.delete(key);
    }
    let reclaimedBytes = 0;
    // A crash between proof and preparation writes can leave an orphan proof.
    for (const key of await keys(root, 'preparation-proofs', id)) {
      if (preparations.has(key)) continue;
      const path = join(root, 'preparation-proofs', key);
      const {size} = await stat(path);
      await unlink(path);
      reclaimedBytes += size;
    }
    for (const key of await keys(root, 'prepared-audio', digest)) {
      const path = join(root, 'prepared-audio', key);
      // All active and bound reads can fall back to the verified immutable copy.
      if (retainedAudio.has(key)) {
        const permanent = await store.read('audio/' + key);
        if (!permanent || createHash('sha256').update(permanent).digest('hex') !== key) continue;
      }
      const {size} = await stat(path);
      await unlink(path);
      reclaimedBytes += size;
    }
    // These private UUID temporaries never become references. A process can
    // leave one behind if it dies before or after linking the finished key.
    const temporary = /^\.[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
    for (const collection of ['preparations', 'prepared-audio', 'preparation-proofs']) {
      for (const key of await keys(root, collection, temporary)) {
        const path = join(root, collection, key);
        const {size} = await stat(path);
        await unlink(path);
        reclaimedBytes += size;
      }
    }
    return {expiredPreparations: expired.length, reclaimedBytes};
  } finally {
    exclusive.close();
  }
}
