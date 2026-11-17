import {streams, validateCatalog} from './catalog.mjs';
import {sceneStreams} from '../src/content/sceneMedia.mjs';
import {checkMedia} from './media-health.mjs';

validateCatalog();
const videos = sceneStreams();
const entries = [...streams, ...videos];
const errors = await checkMedia(entries);
for (const error of errors) console.error(error);
console.log(`${entries.length - errors.length}/${entries.length} media entries checked (${streams.length} audio, ${videos.length} scene videos); HLS checks include each variant's first and last segments.`);
if (errors.length) process.exitCode = 1;
