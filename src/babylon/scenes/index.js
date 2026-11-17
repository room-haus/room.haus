// MX004 was an unpublished experiment. Unassigned catalogue numbers use
// the archive's original starfield with their own jewel case and disc label.
const loadScene = require.context('./', false, /^\.\/(?:MX(?!004)\d{3}|ROOM\d{3}A?|RM001)\.js$/, 'lazy');
const custom = new Set(loadScene.keys());

export async function getMixConfig(record) {
  const key = './' + record.id + '.js';
  const config = custom.has(key) ? await loadScene(key) : await import('./default');
  return {caseTexture: record.art, cdLabelTexture: record.label, ...config};
}
