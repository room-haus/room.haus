import React,{useEffect,useRef,useState} from 'react';
import {ResearchHost} from '../shared/audio/research/ResearchHost.tsx';
import type {ResearchAudio} from '../shared/audio/research/ResearchAudio.ts';
import {StructureIntervention,type InterventionKind} from './intervention.ts';
import './structure.css';

const interventions=new WeakMap<ResearchAudio,StructureIntervention>();
const configure=(research:ResearchAudio)=>{
  interventions.get(research)?.dispose();const action=new StructureIntervention(research);interventions.set(research,action);
  research.install('processor',action.factory);research.setLevel(.5);
};
function StructureControls({research,disabled,sourceLabel}:{research:ResearchAudio;disabled:boolean;sourceLabel:string}){
  const action=interventions.get(research)!,state=action.snapshot(),diagnostics=research.diagnostics();
  const [duration,setDuration]=useState(1),[,refresh]=useState(0);
  const held=useRef<{id:number;pointer?:number;key?:string}|null>(null);
  const update=()=>refresh(n=>n+1);
  const release=()=>{if(held.current)action.release(held.current.id);held.current=null;update();};
  useEffect(()=>{
    const blur=()=>{action.cancel('Focus left the window; hearing Original.');held.current=null;};
    window.addEventListener('blur',blur);return ()=>{window.removeEventListener('blur',blur);action.dispose();};
  },[action]);
  useEffect(()=>{if(disabled)held.current=null;},[disabled]);
  useEffect(()=>{if(!state.active)held.current=null;},[state.active]);
  const button=(kind:InterventionKind,label:string)=> <button key={kind} className="structure-action" disabled={disabled||(kind==='stutter'&&!state.active&&(!state.listening||state.buffered<.125||!diagnostics.capture))} aria-pressed={state.kind===kind&&!state.pending}
    onPointerDown={event=>{
      event.preventDefault();if(event.button!==0||held.current)return;
      const id=action.press(kind,duration);if(id===null)return;held.current={id,pointer:event.pointerId};
      try{event.currentTarget.setPointerCapture(event.pointerId);}catch{/* Synthetic/assistive pointer has no native capture. */}update();
    }}
    onPointerUp={event=>{if(held.current?.pointer===event.pointerId)release();}}
    onPointerCancel={event=>{if(held.current?.pointer===event.pointerId)release();}}
    onLostPointerCapture={event=>{if(held.current?.pointer===event.pointerId)release();}}
    onKeyDown={event=>{
      if(event.key!==' '&&event.key!=='Enter')return;event.preventDefault();if(event.repeat||held.current)return;
      const id=action.press(kind,duration);if(id!==null)held.current={id,key:event.key};update();
    }}
    onKeyUp={event=>{if(held.current?.key===event.key){event.preventDefault();release();}}}
    onBlur={()=>{if(held.current?.key)release();}}
    onClick={event=>{if(event.detail===0&&!held.current){action.press(kind,duration);update();}}}
  >{label}</button>;
  return <div className="structure-controls" data-structure data-active={state.active} data-pending={state.pending} data-kind={state.kind} data-bytes={state.bytes}>
    <h2>Hold a change, then let go</h2>
    <p className="research-note">Free time · no beat alignment. The first press owns the action; other presses are ignored until it returns. Holding longer never extends the limit.</p>
    <label>Maximum duration <output>{duration.toFixed(1)} s</output><input aria-label="Maximum duration" type="range" min=".5" max="2" step=".5" value={duration} disabled={state.active} onChange={e=>setDuration(Number(e.target.value))}/></label>
    <div className="structure-capture"><button disabled={disabled||!diagnostics.capture||state.active||Boolean(held.current)} onClick={()=>{action.listen();update();}}>Listen for fragment</button><p className="research-note">{diagnostics.capture?`Capture source: ${sourceLabel}. ${state.listening?`${state.buffered.toFixed(1)} s buffered; Original remains audible.`:'One-second source ring; repeat uses its newest 125 ms.'}`:'Capture unavailable for this source/browser. Original remains available.'}</p></div>
    <div className="structure-actions">{button('stutter','Hold to repeat')}{button('thin','Hold to thin')}{button('fill','Hold to fill')}</div>
    <p role="status">{disabled?'Play source to check support. Interventions unavailable until processing is ready.':state.message}</p>
    <p className="research-note">{state.active?`${state.remaining.toFixed(1)} s remaining. `:''}Repeat replaces the mix with a softened captured fragment. Thin alternates a quiet gate every 125 ms. Fill briefly replaces it with four sparse, generated 909-inspired hits.</p>
    <p className="research-note">Release, pointer cancellation or keyboard blur returns immediately. Original and Stop effects override every action. The mix keeps running underneath and returns at its current position, without a seek or rate change.</p>
  </div>;
}
export default function AudioStructure({onClose}:{onClose:()=>void}){
  return <div className="structure-experiment"><ResearchHost title="Structural intervention" description="How much interruption still feels connected? Briefly repeat a fragment, thin the rhythm, or exchange the mix for a sparse fill. Release and hear where the recording has moved." configure={configure} onClose={onClose} armLabel={null} showReferenceTools={false} processedLabel="Intervention enabled · see action state" levelLabel="Intervention strength" controls={props=><StructureControls {...props}/>}/></div>;
}
