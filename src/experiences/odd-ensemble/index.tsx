import React from 'react';
import {ListeningToy} from '../shared/ListeningToy.tsx';
import type {ToyConfig} from '../shared/contracts.ts';
import {EnsembleSimulation,type EnsembleState} from './EnsembleSimulation.ts';
import {BabylonEnsemble} from './BabylonEnsemble.ts';
import {targets} from './config.ts';
import {mediaUrl} from '../../content/media.mjs';
import poster from './assets/poster.svg';
import './odd-ensemble.css';
const config:ToyConfig<EnsembleState>={
 id:'odd-ensemble',title:'Odd Ensemble',description:'Three peculiar forms, listening together. Pull one out of shape. See who notices.',poster,
 hint:'Drag to stretch or lean. Tap or Space to poke. Arrow keys work too.',stageLabel:'Ensemble stage',stageMeta:'LOW / KNUCKLE / PIP',
 posterAlt:'Low, a broad chalk vessel; Knuckle, a tall cobalt form; and Pip, a small olive observer.',controlLabel:'Ensemble controls',idleHint:'A little company for your mix.',activeHint:'Softly now. Someone is watching.',
 targets,targetButtons:true,directionLabels:{left:'Lean left',right:'Lean right',up:'Stretch',down:'Compress'},sceneCommand:'poke',
 commands:[{id:'poke',label:'Poke',targeted:true}],mix:{id:'MX029',artist:'Saad Ashraf',url:mediaUrl('mixes/MX029/MX029.m3u8')},
 createSimulation:()=>new EnsembleSimulation(),createRenderer:canvas=>new BabylonEnsemble(canvas),selected:s=>s.selectedId,grabbed:s=>s.grabbedId,
 diagnostics:s=>({simTime:s.time,lowStretch:s.members[0].stretch.value,lowLean:s.members[0].lean.value,knuckleStretch:s.members[1].stretch.value,pipStretch:s.members[2].stretch.value,
  onsetNods:s.onsetNods,pokes:s.pokes,neighbourReactions:s.neighbourReactions,gestures:s.gestures,pending:s.pending.length,brightness:s.brightness}),
};
export default function OddEnsemble({onClose}:{onClose:()=>void}){return <ListeningToy config={config} onClose={onClose}/>;}
