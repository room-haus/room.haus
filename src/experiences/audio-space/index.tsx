import React,{useState} from 'react';
import {ResearchHost} from '../shared/audio/research/ResearchHost.tsx';
import type {ResearchAudio} from '../shared/audio/research/ResearchAudio.ts';
import {delaySeconds,spaceDefaults,spaceProcessor} from './processor.ts';
import './space.css';

const configure=(research:ResearchAudio)=>{research.install('processor',spaceProcessor);research.update('processor',spaceDefaults);research.setLevel(.5);};
function SpaceControls({research,disabled}:{research:ResearchAudio;disabled:boolean}){
  const [settings,setSettings]=useState(spaceDefaults),[tempo,setTempo]=useState(research.clock.bpm);
  const update=(p:Partial<typeof settings>)=>{const next={...settings,...p};setSettings(next);research.update('processor',next);};
  const delay=settings.mode===0,seconds=delaySeconds(research.clock,settings.division,.04+settings.time*.36);
  return <div className="space-controls">
    <div className="research-buttons" role="group" aria-label="Space mode"><button disabled={disabled} aria-pressed={delay} onClick={()=>update({mode:0})}>Delay</button><button disabled={disabled} aria-pressed={!delay} onClick={()=>update({mode:1})}>Reverb</button></div>
    <label><span>{delay?'Delay time':'Space / pre-delay'} <output>{delay?`${Math.round(seconds*1000)} ms`:`${Math.round(5+settings.time*40)} ms`}</output></span><input aria-label={delay?'Delay time':'Space / pre-delay'} type="range" min="0" max="1" step=".01" value={settings.time} disabled={disabled||(delay&&settings.division>0&&research.clock.tempoSet)} onChange={e=>update({time:Number(e.target.value)})}/></label>
    <label><span>{delay?'Feedback':'Decay blend'} <output>{delay?`${Math.round(settings.feedback*48)}%`:`${Math.round(settings.feedback*100)}% air`}</output></span><input aria-label={delay?'Feedback':'Decay blend'} type="range" min="0" max="1" step=".01" value={settings.feedback} disabled={disabled} onChange={e=>update({feedback:Number(e.target.value)})}/></label>
    <label className="space-stereo"><input type="checkbox" checked={Boolean(settings.stereo)} disabled={disabled} onChange={e=>update({stereo:e.target.checked?1:0})}/>Restrained stereo</label>
    {delay&&<div className="space-clock"><label>Delay timing<select aria-label="Delay timing" value={settings.division} disabled={disabled} onChange={e=>update({division:Number(e.target.value)})}><option value="0">Free time</option><option value="0.25">1/16 · manual tempo</option><option value="0.5">1/8 · manual tempo</option><option value="1">1/4 · manual tempo</option></select></label>
      {settings.division>0&&<><label>Manual tempo (BPM)<input type="number" aria-label="Manual tempo (BPM)" min="40" max="240" value={tempo} disabled={disabled} onChange={e=>setTempo(Number(e.target.value))}/></label><button disabled={disabled||!Number.isFinite(tempo)||tempo<40||tempo>240} onClick={()=>{research.clock.setTempo(tempo);research.update('processor',settings);}}>Set tempo</button><p className="research-note space-timing">{research.clock.tempoSet?`${research.clock.bpm} BPM · ${Math.round(seconds*1000)} ms. Interval only; no phase-aligned beat grid.`:'Set manual tempo to use divisions.'} Estimates are advisory. Tempo changes clear shared clock phase.</p></>}
    </div>}
    <p className="research-note">{delay?'Filtered repeats: 80 Hz–6.5 kHz, feedback capped at 48%.':'Close / air: two generated responses, 0.18 / 0.9 seconds. Decay blends their tails.'} The dry mix stays present. Delay / Reverb chooses the effect; Processed turns it on. Compare sparse gaps with dense transients; more space can hide detail.</p>
  </div>;
}
export default function AudioSpace({onClose}:{onClose:()=>void}){
  return <ResearchHost title="Space & echoes" description="Press Play source, then Processed to hear filtered echoes or a compact reverb. Raise Effect level to explore the space, then compare with Original. Listen for intimacy and rhythmic space, and for the point where detail starts to blur." onClose={onClose} configure={configure} showReferenceTools={false} controls={props=><SpaceControls {...props}/>}/>;
}
