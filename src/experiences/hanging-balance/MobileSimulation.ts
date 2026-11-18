import type {ResetReason,ToyAction,ToyFrame,ToySimulation} from '../shared/contracts.ts';
import {rods,objects,targets,clamp,finite,ROD_LIMIT,OBJECT_LIMIT,SPEED_LIMIT} from './config.ts';
import {mapAudio} from './mapAudio.ts';
export interface Body {angle:number;velocity:number}
export interface Point {x:number;y:number}
export interface MobileState {
  rods:Body[];objects:Body[];counterweight:number;selectedId:string;grabbedId:string|null;
  controlTarget:Point|null;time:number;nextGesture:number;settling:number;recoveries:number;
  onsetImpulses:number;brightness:number;detail:number;contacts:number[];
}
const point=(p:Point, distance:number, angle:number):Point=>({x:p.x+distance*Math.cos(angle),y:p.y+distance*Math.sin(angle)});
export function transforms(state:Readonly<MobileState>) {
  const anchors:Point[]=[{x:0,y:1.55}];
  for(let i=1;i<3;i++) {
    const r=rods[i],p=point(anchors[r.parent],r.attachment,state.rods[r.parent].angle);
    anchors.push({x:p.x,y:p.y-r.drop});
  }
  const joints=objects.map(o=>point(anchors[o.rod],o.attachment,state.rods[o.rod].angle));
  const positions=objects.map((o,i)=>({x:joints[i].x+o.length*Math.sin(state.objects[i].angle),y:joints[i].y-o.length*Math.cos(state.objects[i].angle)}));
  const counterweight=point(anchors[0],(state.counterweight-.5)*2,state.rods[0].angle);
  return {anchors,joints,positions,counterweight};
}
export class MobileSimulation implements ToySimulation<MobileState> {
  private state!:MobileState;
  private safe!:MobileState;
  private sequence=-1;
  private lastOnset=-Infinity;
  private lastNudge=-Infinity;
  private phase=0;
  private drive=0;
  constructor() { this.reset(29,0,'open'); }
  reset(seed:number,mediaTime:number,_reason:ResetReason):MobileState {
    this.phase=((finite(seed)+finite(mediaTime)*.17)%997)*.13;
    this.state={rods:[-.04,.09,-.13].map((angle,i)=>({angle:angle+Math.sin(this.phase+i)*.02,velocity:0})),
      objects:objects.map((_,i)=>({angle:Math.sin(this.phase+i)*.04,velocity:0})),counterweight:.5,
      selectedId:'bell',grabbedId:null,controlTarget:null,time:0,nextGesture:20+Math.abs(Math.sin(this.phase))*15,
      settling:0,recoveries:0,onsetImpulses:0,brightness:.5,detail:0,contacts:[0,0,0,0,0]};
    this.sequence=-1;this.lastOnset=this.lastNudge=-Infinity;this.drive=0;
    this.safe=structuredClone(this.state);return this.state;
  }
  snapshot() { return this.state; }
  act(action:ToyAction):boolean {
    const s=this.state;
    if('targetId' in action && action.targetId && !targets.some(t=>t.id===action.targetId)) return false;
    if(action.type==='select') {s.selectedId=action.targetId;return true;}
    if(action.type==='release') {s.grabbedId=null;s.controlTarget=null;return true;}
    if(action.type==='set-value') {
      if(action.control!=='counterweight'||!Number.isFinite(action.value)) return false;
      this.act({type:'release'});s.counterweight=.5+clamp(action.value,-1,1)*.3;return true;
    }
    if(action.type==='grab'||action.type==='move') {
      if(!Number.isFinite(action.x)||!Number.isFinite(action.y)) return false;
      if(action.type==='grab') {s.grabbedId=s.selectedId=action.targetId;s.settling=0;}
      if(!s.grabbedId) return false;
      s.controlTarget={x:clamp(action.x,-1,1)*2.5,y:clamp(action.y,-1,1)*2.5};
      if(s.grabbedId==='counterweight') {
        const a=s.rods[0].angle,p=s.controlTarget;
        const rail=p.x*Math.cos(a)+(p.y-1.55)*Math.sin(a);
        s.counterweight=clamp(.5+rail/2,.2,.8);
      }
      return true;
    }
    if(action.type==='command'&&action.command==='settle') {
      this.act({type:'release'});s.settling=1.5;for(const b of [...s.rods,...s.objects]) b.velocity=0;return true;
    }
    if(action.type==='command'&&action.command!=='nudge-object') return false;
    if(action.type==='nudge'||action.type==='command') {
      if(!action.targetId) return false;
      if(action.targetId==='counterweight') {
        if(action.type!=='nudge') return false;
        return this.act({type:'set-value',control:'counterweight',value:(s.counterweight-.5)/.3+finite(action.x)*.1});
      }
      if(s.time-this.lastNudge<.12) return false;
      const i=objects.findIndex(o=>o.id===action.targetId);if(i<0)return false;
      const x=action.type==='nudge'?finite(action.x):1,y=action.type==='nudge'?finite(action.y):0;
      s.objects[i].velocity=clamp(s.objects[i].velocity+clamp(x*.25+y*.12,-.3,.3),-SPEED_LIMIT,SPEED_LIMIT);
      this.lastNudge=s.time;return true;
    }
    return false;
  }
  step(frame:ToyFrame):MobileState {
    const s=this.state;
    if(frame.source==='inactive'||frame.motion<=0) {this.sequence=frame.featureSequence;return s;}
    const dt=clamp(finite(frame.dt),0,1/60),gentle=frame.reducedMotion;
    const motion=clamp(finite(frame.motion),0,gentle?.2:1),audio=mapAudio(frame);
    s.time+=dt;
    const settling=s.settling>0;
    const tr=transforms(s),force=objects.map(()=>({x:0,y:0}));
    const rodTorque=rods.map((_,i)=>{
      const massTorque=objects.reduce((sum,o,j)=>i===0||o.rod===i?sum-o.mass*(tr.positions[j].x-tr.anchors[i].x)*.65:sum,0);
      return massTorque+(i===0?-3.8*(tr.counterweight.x-tr.anchors[0].x):0);
    });
    this.drive+=(audio.intensity-this.drive)*(1-Math.exp(-dt/3));
    if(!settling) {
      const drive=motion*(.025+this.drive*.015);
      rodTorque.forEach((_,i)=>{rodTorque[i]+=Math.sin(s.time*(.43+i*.12)+this.phase+i)*drive;
        if(i===0)rodTorque[i]+=audio.bass*(Math.PI/60)*5*motion;});
      for(let i=0;i<objects.length;i++) {
        const controlled=s.selectedId===objects[i].id?frame.autonomy:1;
        force[i].x+=Math.sin(s.time*(.7+i*.11)+this.phase+i)*.035*motion*controlled;
      }
      if(frame.featureSequence!==this.sequence) {
        this.sequence=frame.featureSequence;
        const target=objects.findIndex(o=>o.id===s.selectedId);
        const i=target<0?0:target;
        if(audio.onset>0&&s.time-this.lastOnset>=.6&&s.grabbedId!==objects[i].id) {
          s.objects[i].velocity=clamp(s.objects[i].velocity+.07*audio.onset*motion,-SPEED_LIMIT,SPEED_LIMIT);
          this.lastOnset=s.time;s.onsetImpulses++;
        }
      }
      if(s.time>=s.nextGesture) {
        if(!gentle) {const i=Math.floor(s.time)%5;if(s.grabbedId!==objects[i].id)force[i].x+=.2*motion;}
        s.nextGesture=s.time+20+Math.abs(Math.sin(s.time+this.phase))*15;
      }
    } else this.sequence=frame.featureSequence;
    if(s.grabbedId&&s.controlTarget&&s.grabbedId!=='counterweight') {
      const i=objects.findIndex(o=>o.id===s.grabbedId),p=tr.positions[i];
      force[i].x+=clamp((s.controlTarget.x-p.x)*5,-2,2)*(gentle?.35:1);
      force[i].y+=clamp((s.controlTarget.y-p.y)*5,-2,2)*(gentle?.35:1);
    }
    for(let i=0;i<5;i++) {
      s.contacts[i]=Math.max(0,s.contacts[i]-dt);
      for(let j=i+1;j<5;j++) {
        const dx=tr.positions[i].x-tr.positions[j].x,dy=tr.positions[i].y-tr.positions[j].y,d=Math.hypot(dx,dy),overlap=objects[i].radius+objects[j].radius-d;
        if(overlap>0) {
          const fx=clamp(dx/(d||1)*overlap*3,-.4,.4),fy=clamp(dy/(d||1)*overlap*3,-.4,.4);
          force[i].x+=fx;force[j].x-=fx;force[i].y+=fy;force[j].y-=fy;
          s.contacts[i]=s.contacts[j]=.15;
        }
      }
    }
    const integrate=(b:Body,torque:number,limit:number,damping:number)=>{
      b.velocity=clamp((b.velocity+clamp(torque,-8,8)*dt)*Math.exp(-damping*dt),-SPEED_LIMIT,SPEED_LIMIT);
      b.angle=clamp(b.angle+b.velocity*dt,-limit,limit);
      if(Math.abs(b.angle)>=limit&&Math.sign(b.velocity)===Math.sign(b.angle))b.velocity=0;
    };
    objects.forEach((o,i)=>{
      const b=s.objects[i],f=force[i];
      for(const rod of o.rod===0?[0]:[o.rod,0]) {
        const arm={x:tr.positions[i].x-tr.anchors[rod].x,y:tr.positions[i].y-tr.anchors[rod].y};
        rodTorque[rod]+=clamp(arm.x*f.y-arm.y*f.x,-1.5,1.5)*.45;
      }
      if(settling) {b.angle*=Math.exp(-dt*5);b.velocity=0;}
      else integrate(b,-9.8/o.length*Math.sin(b.angle)+f.x*Math.cos(b.angle)*3+f.y*Math.sin(b.angle)*3-s.rods[o.rod].velocity*.9,OBJECT_LIMIT,gentle?4:1.2);
    });
    s.rods.forEach((b,i)=>{
      const stiffness=i===0?5:3.2;
      if(settling) {b.angle+=(clamp(rodTorque[i]/stiffness,-ROD_LIMIT,ROD_LIMIT)-b.angle)*(1-Math.exp(-dt*5));b.velocity=0;}
      else integrate(b,rodTorque[i]-stiffness*b.angle,ROD_LIMIT,gentle?4:1.6);
    });
    s.settling=Math.max(0,s.settling-dt);
    s.brightness+=(audio.brightness-s.brightness)*(1-Math.exp(-dt/4));s.detail=audio.detail*motion;
    if([...s.rods,...s.objects].some(b=>!Number.isFinite(b.angle)||!Number.isFinite(b.velocity))) {
      const recoveries=s.recoveries+1;this.state=structuredClone(this.safe);this.state.recoveries=recoveries;
      this.act({type:'release'});for(const b of [...this.state.rods,...this.state.objects])b.velocity=0;
    }
    this.safe=structuredClone(this.state);return this.state;
  }
}
