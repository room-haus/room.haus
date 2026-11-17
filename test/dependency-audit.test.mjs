import {test} from 'node:test';
import assert from 'node:assert/strict';
import {assessAudit} from '../scripts/dependency-audit.mjs';

const url = 'https://github.com/advisories/GHSA-fc5q-39xc-vjpf';
const policy = [{url, package: 'picomatch', range: '<=4.0.7', expires: '2026-12-01'}];
const now = new Date('2026-11-17T12:00:00Z');
function fixture() {
  return {
    report: {auditReportVersion: 2, metadata: {vulnerabilities: {total: 2}}, vulnerabilities: {
      picomatch: {severity: 'high', nodes: ['node_modules/picomatch'], via: [{name: 'picomatch', url, range: '<=4.0.7', severity: 'high'}]},
      build: {severity: 'high', nodes: ['node_modules/build'], via: ['picomatch']},
    }},
    lock: {packages: {'node_modules/picomatch': {dev: true}, 'node_modules/build': {dev: true}}},
  };
}
test('the named development advisory is visible and temporarily excepted through its dependency chain', () => {
  const {report, lock} = fixture();
  assert.deepEqual(assessAudit(report, lock, policy, now), {blocked: [], excepted: ['build', 'picomatch']});
});
test('production exposure, unknown advisories, changed ranges and critical severity cannot use the exception', () => {
  for (const mutate of [
    ({lock}) => { lock.packages['node_modules/picomatch'].dev = false; },
    ({report}) => { report.vulnerabilities.picomatch.via[0].url = 'https://github.com/advisories/GHSA-new'; },
    ({report}) => { report.vulnerabilities.picomatch.via[0].range = '*'; },
    ({report}) => { report.vulnerabilities.picomatch.severity = 'critical'; },
    ({report}) => { report.vulnerabilities.picomatch.via.push({name:'picomatch',url:'new',severity:'low'}); },
    ({lock}) => { delete lock.packages['node_modules/picomatch']; },
  ]) {
    const data = fixture(); mutate(data);
    assert.ok(assessAudit(data.report, data.lock, policy, now).blocked.includes('picomatch'));
  }
});
test('exceptions expire at the start of their expiry date', () => {
  const {report, lock} = fixture();
  assert.deepEqual(assessAudit(report, lock, policy, new Date('2026-12-01T00:00:00Z')).blocked, ['build', 'picomatch']);
});
test('broken audit responses and unresolved dependency chains fail closed', () => {
  const {report, lock} = fixture();
  for (const bad of [{}, {...report, error: {code:'ENETUNREACH'}}, {...report, vulnerabilities:null},
    {...report, metadata:{vulnerabilities:{total:0}}}]) {
    assert.throws(() => assessAudit(bad, lock, policy, now));
  }
  report.vulnerabilities.build.via = ['missing'];
  assert.deepEqual(assessAudit(report, lock, policy, now).blocked, ['build']);
  report.vulnerabilities.build.via = ['build'];
  assert.deepEqual(assessAudit(report, lock, policy, now).blocked, ['build']);
});
