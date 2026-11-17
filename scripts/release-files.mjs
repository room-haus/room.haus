import {createHash} from 'node:crypto';
import {readdirSync, readFileSync} from 'node:fs';
import path from 'node:path';

export function releaseFiles(directory) {
  return readdirSync(directory, {recursive: true, withFileTypes: true})
    .filter(entry => entry.isFile())
    .map(entry => path.relative(directory, path.join(entry.parentPath, entry.name)).split(path.sep).join('/'))
    .filter(name => name !== '_redirects')
    .sort();
}

export function releaseDigest(directory, files) {
  const hash = createHash('sha256');
  for (const name of files) {
    const content = createHash('sha256').update(readFileSync(path.join(directory, name))).digest('hex');
    hash.update(name).update('\0').update(content).update('\n');
  }
  return hash.digest('hex');
}
