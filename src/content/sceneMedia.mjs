import paths from './scene-media.json' with {type: 'json'};
import {mediaUrl} from './media.mjs';

export function sceneMediaUrl(record, asset, origin) {
  const path = paths[record]?.[asset];
  if (!path) throw Error('Unknown scene media: ' + record + '/' + asset);
  return path.startsWith('https://') ? path : mediaUrl(path, origin);
}

export function sceneStreams(origin) {
  return Object.entries(paths).flatMap(([record, assets]) => Object.keys(assets).map(asset => ({
    name: record + ' video / ' + asset, url: sceneMediaUrl(record, asset, origin),
  })));
}
