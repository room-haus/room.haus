import underlevelPoster from '../experiences/underlevel/assets/threshold.png';
import balancePoster from '../experiences/hanging-balance/assets/poster.svg';
import ensemblePoster from '../experiences/odd-ensemble/assets/poster.svg';
import rallyPoster from '../experiences/endless-rally/assets/poster.svg';
import audioPoster from '../experiences/audio-reference/poster.svg';
import processingPoster from '../experiences/audio-processing/poster.svg';
import spacePoster from '../experiences/audio-space/poster.svg';
import rhythmPoster from '../experiences/audio-rhythm/poster.svg';
// Static loader functions preserve named lazy chunks and allow retry on reopening.
export const experiences = [
  {id:'audio-rhythm',category:'audio-experiments',title:'Additional rhythm',description:'A few quiet hats, a clap and an optional kick. Align by ear; listen for support and competition.',poster:rhythmPoster,
    load:()=>import(/* webpackChunkName: "audio-rhythm" */ '../experiences/audio-rhythm')},
  {id:'audio-space',category:'audio-experiments',title:'Space & echoes',description:'Filtered delay, compact reverb and a restrained stereo return. Listen for depth, then compare with Original.',poster:spacePoster,
    load:()=>import(/* webpackChunkName: "audio-space" */ '../experiences/audio-space')},
  {id:'audio-processing',category:'audio-experiments',title:'Tone & texture',description:'A small filter, soft saturation and slow movement. Compare the character with the original recording.',poster:processingPoster,
    load:()=>import(/* webpackChunkName: "audio-processing" */ '../experiences/audio-processing')},
  {id:'audio-reference',category:'audio-experiments',title:'Audio routing check',description:'Development reference for Original, a reversible processor and one quiet kit hit. Shared audio foundation, not a themed experiment.',poster:audioPoster,
    load:()=>import(/* webpackChunkName: "audio-reference" */ '../experiences/audio-reference')},
  {id:'underlevel',title:'The Underlevel',description:'A passive-first audiovisual dungeon. Let MX029 guide you from the corridor into the hall.',poster:underlevelPoster,
    load:()=>import(/* webpackChunkName: "underlevel" */ '../experiences/underlevel')},
  {id:'hanging-balance',category:'interactives',title:'Hanging Balance',description:'Five unlikely objects hang together. Listen to a mix, shift a weight, and let the rest follow.',poster:balancePoster,
    load:()=>import(/* webpackChunkName: "hanging-balance" */ '../experiences/hanging-balance')},
  {id:'endless-rally',category:'interactives',title:'Endless Rally',description:'Two imperfect paddles, one ball, and nowhere else to be.',poster:rallyPoster,
    load:()=>import(/* webpackChunkName: "endless-rally" */ '../experiences/endless-rally')},
  {id:'odd-ensemble',category:'interactives',title:'Odd Ensemble',description:'Three peculiar forms, listening together. Pull one out of shape. See who notices.',poster:ensemblePoster,
    load:()=>import(/* webpackChunkName: "odd-ensemble" */ '../experiences/odd-ensemble')},
];
