import {resolve} from 'node:path';
import {reclaimTakeStaging} from '../services/takes/file-store.mjs';

if (process.argv.length !== 3) throw Error('Usage: node scripts/reclaim-take-staging.mjs STORE_DIRECTORY');
console.log(JSON.stringify(await reclaimTakeStaging(resolve(process.argv[2]))));
