import type {ModuleFactory,ResearchAudio} from '../shared/audio/research/ResearchAudio.ts';
import {makeSamples,toBuffer,type KitName} from '../shared/audio/research/materials.ts';

export const lanes=['kick','clap','hat'] as const;
export type Lane=typeof lanes[number];
export const patterns=[
  {name:'Air',kick:0,clap:0,hat:1028}, // 3, 11
  {name:'Reply',kick:0,clap:4096,hat:17476}, // 3, 7, 11, 15; clap 13
  {name:'Punctuation',kick:0,clap:4096,hat:1024}, // hat 11, clap 13
] as const;
export const rhythmDefaults={kick:0,clap:0,hat:1028,cycle:0};
const sounds:Record<Lane,KitName>={kick:'kick',clap:'clap',hat:'closed-hat'};
const levels:Record<Lane,number>={kick:.3,clap:.4,hat:.5};
const mask=(n:number,fallback:number)=>Number.isFinite(n)?Math.max(0,Math.min(65535,Math.floor(n))):fallback;

/** One shared-clock subscription; every hit uses the shared tracked layer bus. */
export function rhythmLayer(owner:Pick<ResearchAudio,'playBuffer'>):ModuleFactory{
  return ({context,own,clock})=>{
    const output=own(context.createGain()); // Silent module output; voices use owner.playBuffer.
    const buffers=Object.fromEntries(lanes.map(lane=>{
      const data=makeSamples(sounds[lane]),peak=data.reduce((p,v)=>Math.max(p,Math.abs(v)),0);
      // Calibrate attacks for a useful sparse comparison; shared kit stays intact.
      for(let i=0;i<data.length;i++)data[i]*=.9/peak;
      return [lane,toBuffer(context,data)];
    })) as Record<Lane,AudioBuffer>;
    let settings={...rhythmDefaults},last=-Infinity,elapsed=-Infinity,cycle=0,generation=clock.generation,cancel:(()=>unknown)|undefined;
    let pending:Array<{index:number;at:number}>=[];
    const settle=()=>{pending=pending.filter(hit=>{if(hit.at>context.currentTime)return true;elapsed=Math.max(elapsed,hit.index);return false;});};
    return {output,update(params){
      settings={kick:mask(params.kick,0),clap:mask(params.clap,0),hat:mask(params.hat,1028),cycle:params.cycle??0};
      settle();
      if(settings.cycle!==cycle){last=elapsed=-Infinity;pending=[];cycle=settings.cycle;}
      else if(generation!==clock.generation){last=elapsed;pending=[];}
      generation=clock.generation;
      cancel?.();
      cancel=clock.repeat(.25,(at,_generation,index)=>{
        settle();if(index<0||index<=last)return;last=index;
        // At most two pending grid positions in the shared 100ms horizon.
        pending.push({index,at});
        const step=index%16;
        for(const lane of lanes)if(settings[lane]&(1<<step))owner.playBuffer(buffers[lane],at,levels[lane]);
      });
    },dispose(){cancel?.();}};
  };
}
