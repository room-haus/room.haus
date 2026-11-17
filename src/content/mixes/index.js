import records from './records.json';
import {withArtwork} from '../withArtwork';

export const mixes = records.map(withArtwork);
export const getMix = (id) => mixes.find((record) => id === record.id);
