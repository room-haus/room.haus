import type {ToyConfig} from '../shared/contracts.ts';
import {RallySimulation, type RallyState} from './RallySimulation.ts';
import {BabylonCourt} from './BabylonCourt.ts';
import poster from './assets/poster.svg';
import {mediaUrl} from '../../content/media.mjs';

export const rallyConfig: ToyConfig<RallyState> = {
  id:'endless-rally', title:'Endless Rally',
  description:'Two imperfect paddles, one ball, and nowhere else to be.',
  hint:'Drag the blue paddle or the court’s lower edge. Arrow keys and Paddle position also work.',
  stageLabel:'Rally court',stageMeta:'ONE BALL / NO SCORE',
  posterAlt:'A clay court with open ends, blue and chalk paddles, an ink ball and a citron bumper.',
  controlLabel:'Rally controls',idleHint:'The court is still.',activeHint:'Your paddle. The rally will find its way back.',
  phase:state=>state.phase,horizontalValueKeys:true,
  poster,
  mix:{id:'MX029',artist:'Saad Ashraf',url:mediaUrl('mixes/MX029/MX029.m3u8')},
  createSimulation:()=>new RallySimulation(),
  createRenderer:canvas=>new BabylonCourt(canvas),
  targets:[{id:'near-paddle',name:'Blue paddle'}],
  valueControl:{id:'paddle-position',label:'Paddle position',read:state=>state.manualTarget/1.35},
  commands:[{id:'nudge-ball',label:'Nudge ball',targeted:false}],
  selected:()=>'near-paddle',grabbed:state=>state.grabbedId,
  diagnostics:state=>({
    returning:state.phase==='returning'?1:0,ballX:state.ball.x,ballZ:state.ball.z,nearX:state.near.x,
    nearTarget:state.near.target,controlWeight:state.controlWeight,
    speed:state.speed,collisions:state.collisionSequence,recoveries:state.recoveries,
    invalidRecoveries:state.invalidRecoveries,returnProgress:state.returnProgress,
    elapsed:state.elapsed,
  }),
};
