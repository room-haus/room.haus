import React from 'react';
import {ListeningToy} from '../shared/ListeningToy.tsx';
import type {ToyConfig} from '../shared/contracts.ts';
import {mediaUrl} from '../../content/media.mjs';
import {MobileSimulation,type MobileState} from './MobileSimulation.ts';
import {BabylonMobile} from './BabylonMobile.ts';
import {targets} from './config.ts';
import poster from './assets/poster.svg';
const config:ToyConfig<MobileState>={
  id:'hanging-balance',title:'Hanging Balance',description:'Five unlikely objects. A little tension. Leave it be, or upset the balance.',poster,
  hint:'Drag the bell. The rest will follow.',stageLabel:'Sculpture stage',stageMeta:'03 RODS / 05 OBJECTS',controlLabel:'Sculpture controls',idleHint:'A moment of balance.',activeHint:'Easy does it. Everything stays attached.',posterAlt:'An off-kilter mobile of a bell, stone, disc, vessel and small onlooker',
  mix:{id:'MX029',artist:'Saad Ashraf',url:mediaUrl('mixes/MX029/MX029.m3u8')},targets,
  valueControl:{id:'counterweight',label:'Counterweight',read:s=>(s.counterweight-.5)/.3},
  commands:[{id:'nudge-object',label:'Nudge',targeted:true},{id:'settle',label:'Settle',targeted:false}],
  createSimulation:()=>new MobileSimulation(),createRenderer:canvas=>new BabylonMobile(canvas),
  selected:s=>s.selectedId,grabbed:s=>s.grabbedId,
  diagnostics:s=>({counterweight:s.counterweight,topAngle:s.rods[0].angle,recoveries:s.recoveries,onsetImpulses:s.onsetImpulses,simTime:s.time}),
};
export default function HangingBalance({onClose}:{onClose:()=>void}) {return <ListeningToy config={config} onClose={onClose}/>;}
