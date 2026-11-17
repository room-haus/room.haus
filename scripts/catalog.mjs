import fs from 'node:fs';
import mixes from '../src/content/mixes/records.json' with {type: 'json'};
import releases from '../src/content/releases/records.json' with {type: 'json'};
export {mixes, releases};

export const records = [...mixes, ...releases];
export const routeOf = (record) => (record.slug ? '/releases/' + record.slug + '/' : '/mixes/' + record.id + '/');
export const coverName = (record) => record.art.slice(0, 2).toLowerCase() + record.art.slice(2);
export const streams = records.flatMap((record) =>
  record.tracks
    ? record.tracks.map((track) => ({name: record.id + ' / ' + track.name, url: track.streamURL}))
    : [{name: record.id, url: record.audioSourceURL}],
);

export function validateCatalog() {
  const seenRoutes = new Set();
  const seenIds = new Set();
  for (const record of records) {
    if (
      !record.artist ||
      record.id !== record.catalogueNumber ||
      !/^(MX|ROOM)\d{3}[A-Z]?$/.test(record.id) ||
      (record.slug && !/^[\w-]+$/.test(record.slug)) ||
      seenIds.has(record.id) ||
      seenRoutes.has(routeOf(record))
    ) {
      throw Error('Invalid or duplicate catalog entry: ' + record.id);
    }
    seenIds.add(record.id);
    seenRoutes.add(routeOf(record));
    for (const path of [
      'src/images/mix-art/' + coverName(record) + '.jpg',
      'src/images/mix-labels/cd_template_' + record.label + '.png',
    ]) {
      if (!fs.existsSync(path)) throw Error('Missing catalog asset: ' + path);
    }
    if (record.slug && (!record.name || !record.tracks?.length || record.tracks.some((track) => !track.name))) {
      throw Error('Release is missing title or tracks: ' + record.id);
    }
    for (const url of [record.purchaseLink, record.soundcloud].filter(Boolean)) {
      if (new URL(url).protocol !== 'https:') throw Error('Insecure external link: ' + url);
    }
  }
  for (const {url} of streams) {
    if (!url || new URL(url).protocol !== 'https:' || !new URL(url).pathname.endsWith('.m3u8')) {
      throw Error('Invalid stream: ' + url);
    }
  }
}
