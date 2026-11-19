import {resolve} from 'node:path';
import {reclaimExpiredDuplicates} from '../services/takes/file-store.mjs';

if (process.argv.length !== 3) throw Error('Usage: node scripts/reclaim-take-duplicates.mjs STORE_DIRECTORY');
console.log(JSON.stringify(await reclaimExpiredDuplicates(resolve(process.argv[2]))));
