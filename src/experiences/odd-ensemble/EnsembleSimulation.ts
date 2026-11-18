import type {ToyAction,ToyFrame,ToySimulation,ResetReason} from '../shared/contracts.ts';
import {members,limits,clamp} from './config.ts';
import {mapAudio} from './mapAudio.ts';
export interface Spring {value:number;velocity:number}
export interface MemberState {
 id:string;stretch:Spring;lean:Spring;aperture:Spring;attention:string|null;holdUntil:number;
 pose:number;gesture:number;nextNod:number;detail:number;
}
export interface EnsembleState {
 members:MemberState[];selectedId:string;grabbedId:string|null;controlledId:string|null;
 manual:{stretch:number;lean:number};grabOrigin:{x:number;y:number;stretch:number;lean:number}|null;
 time:number;phase:number;random:number;nextGesture:number;lastGroup:number;lastPoke:number;lastSequence:number;
 pending:{id:string;from:string;at:number}[];intensity:number;brightness:number;
 onsetNods:number;pokes:number;neighbourReactions:number;gestures:number;gentle:boolean;motion:number;
}
const spring=(value:number):Spring=>({value,velocity:0});
function integrate(c:Spring,target:number,dt:number,bounds:readonly[number,number],gentle:boolean){
 const w=gentle?7:12.5663706,damping=gentle?1.1:.8;
 c.velocity=clamp(c.velocity+(w*w*(target-c.value)-2*damping*w*c.velocity)*dt,-4,4);
 const next=c.value+c.velocity*dt;c.value=clamp(next,bounds[0],bounds[1]);
 if(next!==c.value)c.velocity=0;
}
export class EnsembleSimulation implements ToySimulation<EnsembleState> {
 private state!:EnsembleState;
 constructor(){this.reset(29,0,'open');}
 private random(){this.state.random=(Math.imul(this.state.random,1664525)+1013904223)>>>0;return this.state.random/4294967296;}
 reset(seed:number,mediaTime:number,_reason:ResetReason):EnsembleState {
  const phase=Number.isFinite(mediaTime)?Math.max(0,mediaTime):0;
  this.state={members:members.map(m=>({id:m.id,stretch:spring(1),lean:spring(0),aperture:spring(.35),attention:null,holdUntil:0,pose:0,gesture:0,nextNod:0,detail:0})),
   selectedId:'low',grabbedId:null,controlledId:null,manual:{stretch:1,lean:0},grabOrigin:null,time:0,phase,
   random:((seed>>>0)^Math.floor(phase*17))>>>0,nextGesture:0,lastGroup:-8,lastPoke:-.5,lastSequence:-1,pending:[],intensity:0,brightness:0,
   onsetNods:0,pokes:0,neighbourReactions:0,gestures:0,gentle:false,motion:1};
  this.state.nextGesture=12+8*this.random();return this.state;
 }
 snapshot(){return this.state;}
 /** Suspension drops discrete reactions without touching physical channels or velocities. */
 suspend(){this.state.pending=[];this.state.lastSequence=-1;}
 private take(id:string){const s=this.state,m=s.members.find(m=>m.id===id)!;if(s.controlledId!==id){s.manual={stretch:m.stretch.value,lean:m.lean.value};}s.controlledId=id;s.selectedId=id;}
 private neighbour(id:string){const i=members.findIndex(m=>m.id===id);return i===1?(this.random()<.5?'low':'pip'):'knuckle';}
 private react(id:string,neighbour=this.neighbour(id)){const s=this.state;if(s.gentle||s.pending.length)return;s.pending.push({id:neighbour,from:id,at:s.time+.2+.4*this.random()});}
 act(action:ToyAction):boolean {
  const s=this.state;
  if(action.type==='release'){if(s.grabbedId)s.controlledId=null;s.grabbedId=null;s.grabOrigin=null;return true;}
  if('targetId' in action&&!members.some(m=>m.id===action.targetId))return false;
  if('x' in action&&(!Number.isFinite(action.x)||!Number.isFinite(action.y)))return false;
  if(action.type==='select'){if(s.grabbedId&&s.grabbedId!==action.targetId)return false;s.selectedId=action.targetId;return true;}
  if(action.type==='grab'){
   if(s.grabbedId)return false;this.take(action.targetId);s.grabbedId=action.targetId;
   s.grabOrigin={x:clamp(action.x,-1,1),y:clamp(action.y,-1,1),...s.manual};return true;
  }
  if(action.type==='move'){
   if(!s.grabbedId||!s.grabOrigin)return false;
   s.manual.lean=clamp(s.grabOrigin.lean+(clamp(action.x,-1,1)-s.grabOrigin.x)*.75,...limits.lean);
   s.manual.stretch=clamp(s.grabOrigin.stretch+(clamp(action.y,-1,1)-s.grabOrigin.y)*.8,...limits.stretch);return true;
  }
  if(action.type==='nudge'){
   if(s.grabbedId&&s.grabbedId!==action.targetId)return false;
   this.take(action.targetId);s.manual.lean=clamp(s.manual.lean+clamp(action.x,-1,1)*.1*Math.PI/12,...limits.lean);
   s.manual.stretch=clamp(s.manual.stretch+clamp(action.y,-1,1)*.1*.3,...limits.stretch);return true;
  }
  if(action.type==='command'&&action.command==='poke'&&action.targetId){
   if(s.grabbedId&&s.grabbedId!==action.targetId)return false;
   this.take(action.targetId);s.pokes++;
   const m=s.members.find(m=>m.id===action.targetId)!;
   if(s.gentle){s.manual.stretch=clamp(s.manual.stretch-.025,...limits.stretch);}
   else {m.stretch.velocity=-1.3;s.manual.stretch=1;if(s.time-s.lastPoke>=.5){s.lastPoke=s.time;this.react(m.id);}}return true;
  }
  return false;
 }
 step(frame:ToyFrame):EnsembleState {
  const s=this.state;if(frame.source==='inactive'||frame.motion<=0||!Number.isFinite(frame.dt)||frame.dt<=0)return s;
  const dt=Math.min(1/30,frame.dt);s.time+=dt;s.gentle=frame.reducedMotion;s.motion=clamp(frame.motion,0,1);
  const a=mapAudio(frame),motion=s.motion;s.intensity+=(a.intensity-s.intensity)*(1-Math.exp(-dt/2));s.brightness+=(a.brightness-s.brightness)*(1-Math.exp(-dt/3));
  // A held member always owns its pose, including when a caller accidentally supplies Watch.
  const autonomy=s.grabbedId?0:frame.mode==='watch'?1:clamp(frame.autonomy,0,1);
  if(autonomy===1&&!s.grabbedId)s.controlledId=null;
  if(s.gentle)s.pending=[];
  if(frame.featureSequence!==s.lastSequence){
   s.lastSequence=frame.featureSequence;
   if(a.onset>.1){
    const candidates=s.members.filter(m=>m.id!==s.controlledId&&s.time>=m.nextNod);
    if(candidates.length){const m=candidates[Math.floor(this.random()*candidates.length)];m.stretch.velocity-=.24*motion;m.nextNod=s.time+.4;s.onsetNods++;}
   }
  }
  if(s.time>=s.nextGesture){
   s.nextGesture=s.time+12+8*this.random();
   if(s.time-s.lastGroup>=8){
    const candidates=s.members.filter(m=>m.id!==s.controlledId);
    const m=candidates[Math.floor(this.random()*candidates.length)];
    if(m){m.attention=this.neighbour(m.id);m.pose=1+Math.floor(this.random()*3);m.gesture=s.time;m.holdUntil=s.time+2.2+this.random();s.gestures++;s.lastGroup=s.time;this.react(m.id,m.attention);}
   }
  }
  for(const reaction of s.pending){if(s.time>=reaction.at){const m=s.members.find(m=>m.id===reaction.id)!;
   if(m.id!==s.controlledId){m.attention=reaction.from;m.pose=1;m.gesture=s.time;m.holdUntil=s.time+1.8;m.stretch.velocity-=.4*motion;s.neighbourReactions++;}
  }}
  s.pending=s.pending.filter(r=>r.at>s.time);
  s.members.forEach((m,i)=>{
   const c=members[i],cycle=(s.time+s.phase)*Math.PI*2/c.period+c.phase;
   const breath=Math.sin(cycle),activity=.45+.55*s.intensity;
   let stretch=1+breath*.018*c.strength*motion-(i===0?a.bass*.06*motion:0);
   let lean=Math.sin(cycle*.57)*.035*c.strength*motion;
   let aperture=.35+(.055*Math.sin(cycle+.8)+(i===1?a.mid*.2:0))*motion;
   if(s.time<m.holdUntil){
    const other=members.find(c=>c.id===m.attention),direction=other?Math.sign(other.x-c.x):1;
    const envelope=Math.min(1,(s.time-m.gesture)/.5,(m.holdUntil-s.time)/.65)*motion;
    if(m.pose===1)lean+=direction*.16*envelope*activity;
    else if(m.pose===2)stretch-=.12*envelope;
    else {lean-=direction*.11*envelope;aperture+=.3*envelope;}
   }else {m.attention=null;m.pose=0;}
   if(m.id===s.controlledId){stretch=s.manual.stretch*(1-autonomy)+stretch*autonomy;lean=s.manual.lean*(1-autonomy)+lean*autonomy;}
   integrate(m.stretch,clamp(stretch,...limits.stretch),dt,limits.stretch,s.gentle);
   integrate(m.lean,clamp(lean,...limits.lean),dt,limits.lean,s.gentle);
   integrate(m.aperture,clamp(aperture,...limits.aperture),dt,limits.aperture,s.gentle);
   m.detail=i===2&&!s.gentle?Math.sin(s.time*17)*a.high*.01*motion:0;
  });return s;
 }
}
