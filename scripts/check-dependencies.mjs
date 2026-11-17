import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {assessAudit} from './dependency-audit.mjs';

const result = spawnSync('npm', ['audit', '--json'], {encoding: 'utf8', maxBuffer: 8 * 1024 * 1024});
if (result.error || ![0, 1].includes(result.status)) throw Error('npm audit could not complete', {cause: result.error});
const report = JSON.parse(result.stdout);
const exceptions = JSON.parse(readFileSync(new URL('./dependency-exceptions.json', import.meta.url)));
const lock = JSON.parse(readFileSync('package-lock.json'));
const {blocked, excepted} = assessAudit(report, lock, exceptions);
if (excepted.length) {
  console.warn('Temporary development-only audit exception: ' + excepted.join(', '));
  for (const exception of exceptions) console.warn(exception.url + ' expires ' + exception.expires + ': ' + exception.reason);
}
if (blocked.length) {
  console.error('Unaccepted dependency findings: ' + blocked.join(', '));
  process.exitCode = 1;
} else console.log('Dependency policy passed (' + excepted.length + ' explicitly excepted development findings).');
