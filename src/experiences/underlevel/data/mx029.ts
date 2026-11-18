import type {Cue} from '../contracts.ts';

// The first slice uses the archive recording unchanged. Cue times are explicit,
// replaceable musical-direction decisions, not automatic beat/drop recognition.
export const mix = {
  id: 'MX029', artist: 'Saad Ashraf', title: 'Settle Another Day',
  audioPath: 'mixes/MX029/MX029.m3u8', seed: 29, cycleDuration: 150,
  cueStatus: 'Authored around the measured 74–77s quiet / 78s return; final listening pass required',
};
export const cues: Cue[] = [
  {id:'threshold', time:0, kind:'breakdown', intensity:.18, chapter:'THRESHOLD'},
  {id:'catacombs', time:18, kind:'build', intensity:.3, chapter:'CATACOMBS'},
  {id:'transmitter', time:34, kind:'transition', intensity:.45, chapter:'TRANSMITTER'},
  {id:'silence', time:74, kind:'breakdown', intensity:.08, chapter:'TRANSMITTER'},
  {id:'gate', time:78, kind:'build', intensity:.65, chapter:'TRANSMITTER'},
  {id:'hall', time:84, kind:'transition', intensity:.85, chapter:'THE HALL'},
  {id:'afterimage', time:118, kind:'outro', intensity:.25, chapter:'AFTERIMAGE'},
];
