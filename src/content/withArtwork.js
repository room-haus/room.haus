import {withMedia} from './media.mjs';
import * as covers from '../images/mix-art';
import * as labels from '../images/mix-labels';

export const withArtwork = (record) => ({
  ...withMedia(record),
  art: covers[record.art],
  label: labels[record.label],
});
