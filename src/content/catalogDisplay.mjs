// The catalog order is also the listening order. The last mix has no successor.
export function nextMix(mixes, record) {
  if (record.slug) return undefined;
  const index = mixes.findIndex((mix) => mix.id === record.id);
  return index < 0 ? undefined : mixes[index + 1];
}

export function hasCoverTitle(record) {
  return Boolean(record.name && (record.slug || record.name !== record.id + ': ' + record.artist));
}
