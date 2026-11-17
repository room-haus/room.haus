import records from './records.json';
import {withArtwork} from '../withArtwork';

export const releases = records.map(withArtwork);
export const getRelease = (id) => releases.find((record) => id === record.id);
export const getReleaseBySlug = (slug) => releases.find((record) => slug === record.slug);
