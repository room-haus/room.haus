import React,{useState} from 'react';
import {ResearchHost} from '../shared/audio/research/ResearchHost.tsx';
import type {ResearchAudio} from '../shared/audio/research/ResearchAudio.ts';
import {MemoryFragment,memorySettings} from './fragment.ts';
import './memory.css';

const fragments=new WeakMap<ResearchAudio,MemoryFragment>();
const configure=(research:ResearchAudio)=>{
  fragments.get(research)?.dispose();const fragment=new MemoryFragment(research);fragments.set(research,fragment);
  research.install('layer',fragment.factory);research.setLevel(.5);
};
const stamp=(time:number)=>`${Math.floor(time/60)}:${(time%60).toFixed(1).padStart(4,'0')}`;
function MemoryControls({research,disabled,readMediaTime,sourceLabel}:{research:ResearchAudio;disabled:boolean;readMediaTime:()=>number;sourceLabel:string}){
  const [settings,setSettings]=useState(memorySettings({}));
  const [,refresh]=useState(0),fragment=fragments.get(research)!,state=fragment.snapshot(),capable=research.diagnostics().capture;
  const update=(patch:Partial<typeof settings>)=>{const next={...settings,...patch};setSettings(next);fragment.update(next);};
  return <div className="memory-controls" data-memory data-ready={state.ready} data-bytes={state.bytes} data-active={state.active}>
    <h2>Keep a moment, briefly</h2>
    <p className="research-note">The selected listening source above is the capture source. Nothing is substituted. Captures stay here until discarded or interrupted.</p>
    <label>Fragment length <output>{settings.length.toFixed(2)} s · next capture</output><input aria-label="Fragment length" type="range" min=".25" max="2" step=".25" value={settings.length} disabled={state.pending||state.playing} onChange={e=>update({length:Number(e.target.value)})}/></label>
    <div className="research-buttons"><button disabled={disabled||!capable||state.pending} onClick={()=>{fragment.listen();refresh(n=>n+1);}}>Start recent listening</button>
      <button disabled={disabled||!capable||!state.active||state.pending||state.playing||state.buffered<settings.length} onClick={async()=>{const work=fragment.capture(readMediaTime());refresh(n=>n+1);await work;refresh(n=>n+1);}}>Capture fragment</button>
      <button disabled={!state.active&&!state.ready} onClick={()=>{research.stop('Fragment discarded; hearing Original.');fragment.dispose();refresh(n=>n+1);}}>Discard fragment</button></div>
    <p role="status">{!capable?(/unavailable|failed|could not/i.test(research.diagnostics().reason)?'Source capture unavailable for this source/browser. Original playback is preserved. Generated references may be selected explicitly above.':'Play source to check capture support.'):state.pending?'Reading the recent source window…':state.failure|| (state.ready?`Captured from selected source: ${sourceLabel} · ${stamp(Math.max(0,state.position-state.duration))}–${stamp(state.position)} · ${state.duration.toFixed(2)} s · ephemeral`:state.active?'Listening to recent audio. Capture when ready.':'No captured material. Start recent listening to fill the four-second ring.')}</p>
    {state.active&&!state.ready&&<p className="research-note">{state.buffered.toFixed(1)} / 4.0 s recent audio</p>}
    <label>Treatment<select aria-label="Treatment" value={settings.mode} onChange={e=>{update({mode:Number(e.target.value)});if(state.playing)fragment.play(readMediaTime());}}><option value="0">Recognizable repetition</option><option value="1">Granular dissolution</option></select></label>
    <label>Repetition / density <output>{settings.density} / 8</output><input aria-label="Repetition / density" type="range" min="1" max="8" step="1" value={settings.density} disabled={state.playing} onChange={e=>update({density:Number(e.target.value)})}/></label>
    <button className="research-primary" disabled={disabled||!state.ready||state.pending||state.playing} onClick={()=>{fragment.play(readMediaTime());refresh(n=>n+1);}}>Play fragment</button>
    <p className="research-note">{state.playing?`Mix + fragment · ${state.remaining.toFixed(1)} s remaining. Switch Treatment to compare the same captured moment; each switch restarts the 12-second audition.`:'Recent listening adds no sound. Play fragment adds a layer for up to 12 seconds.'} Repetition has softened edges. Dissolution scatters eight overlapping, windowed grains through a slow scan of the fragment; it preserves pitch but is not a transparent stretch. Density changes spacing, without synchronization to the mix.</p>
    <p className="research-note">Original, Stop effects, Reset, pause, seek, source change and close erase the fragment. The mix continues at its normal position under the layer. Compare a sparse short capture with a dense one; listen for recurring detail becoming competition.</p>
  </div>;
}
export default function AudioMemory({onClose}:{onClose:()=>void}){
  return <div className="memory-experiment"><ResearchHost title="Memory & fragments" description="Can the recording’s recent history become a complementary layer? Play the source, start recent listening, capture a moment, then compare repetition with granular dissolution." onClose={onClose} configure={configure} showReferenceTools={false} armLabel={null} processedLabel="Memory enabled · see fragment state" levelLabel="Layer level" controls={props=><MemoryControls {...props}/>}/></div>;
}
