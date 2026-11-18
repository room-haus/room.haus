import type {ToyMode} from './contracts.ts';
export class InteractionDirector {
  keep = false;
  private held = false;
  private last = 0;
  private controlled = false;
  accept(time:number) { this.controlled = true; this.last = time; }
  hold(value:boolean, time:number) { this.held=value; if(this.controlled) this.last=time; }
  watch() { this.controlled=false; this.held=false; this.keep=false; }
  update(time:number):{mode:ToyMode;autonomy:number} {
    if(!this.controlled) return {mode:'watch',autonomy:1};
    const autonomy = this.held || this.keep ? 0 : Math.max(0,Math.min(1,(time-this.last-8)/1.5));
    if(autonomy>=1) this.controlled=false;
    return {mode:this.controlled?'control':'watch',autonomy};
  }
}
