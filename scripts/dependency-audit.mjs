// Fail closed on registry errors, unknown findings, production exposure and expired exceptions.
export function assessAudit(report, lock, exceptions, now = new Date()) {
  if (report?.error || report?.auditReportVersion !== 2 || !report.vulnerabilities ||
      Array.isArray(report.vulnerabilities) || typeof report.vulnerabilities !== 'object' ||
      report.metadata?.vulnerabilities?.total !== Object.keys(report.vulnerabilities).length || !lock?.packages) {
    throw Error('Invalid or incomplete npm audit report/lockfile');
  }
  const vulnerabilities = report.vulnerabilities;
  function allowed(name, ancestors = new Set()) {
    const item = vulnerabilities[name];
    if (!item || ancestors.has(name) || !['info', 'low', 'moderate', 'high'].includes(item.severity) ||
        !Array.isArray(item.nodes) || !item.nodes.length ||
        !item.nodes.every(node => lock.packages[node]?.dev === true) ||
        !Array.isArray(item.via) || !item.via.length) return false;
    const visited = new Set([...ancestors, name]);
    return item.via.every(via => typeof via === 'string' ? allowed(via, visited) :
      via && ['info', 'low', 'moderate', 'high'].includes(via.severity) && exceptions.some(exception =>
        via.url === exception.url && via.name === exception.package && via.range === exception.range &&
        Number.isFinite(now.getTime()) && now < new Date(exception.expires + 'T00:00:00Z')));
  }
  const result = {blocked: [], excepted: []};
  for (const name of Object.keys(vulnerabilities).sort()) result[allowed(name) ? 'excepted' : 'blocked'].push(name);
  return result;
}
