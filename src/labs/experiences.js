import underlevelPoster from '../experiences/underlevel/assets/threshold.png';
import balancePoster from '../experiences/hanging-balance/assets/poster.svg';
import ensemblePoster from '../experiences/odd-ensemble/assets/poster.svg';
import rallyPoster from '../experiences/endless-rally/assets/poster.svg';
// Static loader functions preserve named lazy chunks and allow retry on reopening.
export const experiences = [
  {id:'underlevel',title:'The Underlevel',description:'A passive-first audiovisual dungeon. Let MX029 guide you from the corridor into the hall.',poster:underlevelPoster,
    load:()=>import(/* webpackChunkName: "underlevel" */ '../experiences/underlevel')},
  {id:'hanging-balance',category:'interactives',title:'Hanging Balance',description:'Five unlikely objects hang together. Listen to a mix, shift a weight, and let the rest follow.',poster:balancePoster,
    load:()=>import(/* webpackChunkName: "hanging-balance" */ '../experiences/hanging-balance')},
  {id:'endless-rally',category:'interactives',title:'Endless Rally',description:'Two imperfect paddles, one ball, and nowhere else to be.',poster:rallyPoster,
    load:()=>import(/* webpackChunkName: "endless-rally" */ '../experiences/endless-rally')},
  {id:'odd-ensemble',category:'interactives',title:'Odd Ensemble',description:'Three peculiar forms, listening together. Pull one out of shape. See who notices.',poster:ensemblePoster,
    load:()=>import(/* webpackChunkName: "odd-ensemble" */ '../experiences/odd-ensemble')},
];
