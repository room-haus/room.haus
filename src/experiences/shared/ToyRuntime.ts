import type {ToyAction,ToyFrame,ToySimulation} from './contracts.ts';
import {FixedStepClock} from './FixedStepClock.ts';
import {InteractionDirector} from './InteractionDirector.ts';
export class ToyRuntime<State> {
  readonly clock=new FixedStepClock();
  readonly director=new InteractionDirector();
  readonly simulation:ToySimulation<State>;
  reducedMotion:boolean;
  motionPaused:boolean;
  running=false;
  simTime=0;
  constructor(simulation:ToySimulation<State>,reducedMotion:boolean) {
    this.simulation=simulation;this.reducedMotion=reducedMotion;this.motionPaused=reducedMotion;
  }
  release() {this.simulation.act({type:'release'});this.director.hold(false,this.simTime);}
  suspend() {this.release();this.simulation.suspend?.();this.clock.clear();this.running=false;}
  reset(mediaTime:number,reason:'user'|'seek'|'open') {
    this.release();this.clock.clear();this.director.watch();this.simTime=0;this.simulation.reset(29,mediaTime,reason);
  }
  act(action:ToyAction):boolean {
    if(action.type==='select') return this.simulation.act(action);
    if(action.type==='release') {this.release();return true;}
    if(!this.running) return false;
    if(action.type==='set-value'||action.type==='command'&&action.command==='settle')this.release();
    if('x' in action) action={...action,x:Math.max(-1,Math.min(1,action.x)),y:Math.max(-1,Math.min(1,action.y))};
    if(this.reducedMotion && action.type==='nudge')action={...action,x:action.x*.2,y:action.y*.2};
    // Gentle commands use the same damped directional action instead of an impulse command.
    if(this.reducedMotion&&action.type==='command'&&action.command==='nudge-object'&&action.targetId)
      action={type:'nudge',targetId:action.targetId,x:.2,y:0};
    if(this.reducedMotion&&action.type==='command'&&action.command==='poke'&&action.targetId)
      action={type:'nudge',targetId:action.targetId,x:0,y:-.2};
    const accepted=this.simulation.act(action);
    if(accepted) {this.director.accept(this.simTime);if(action.type==='grab')this.director.hold(true,this.simTime);}
    return accepted;
  }
  tick(now:number,frame:Omit<ToyFrame,'dt'|'simTime'|'mode'|'autonomy'|'motion'|'reducedMotion'>,visible:boolean) {
    const running=visible&&!this.motionPaused&&frame.source!=='inactive';
    if(!running&&this.running)this.suspend();
    this.running=running;
    const count=this.clock.advance(now,running);
    for(let i=0;i<count;i++) {
      this.simTime+=this.clock.dt;
      this.simulation.step({...frame,...this.director.update(this.simTime),dt:this.clock.dt,simTime:this.simTime,
        motion:this.reducedMotion?.2:1,reducedMotion:this.reducedMotion});
    }
    return this.simulation.snapshot();
  }
}
