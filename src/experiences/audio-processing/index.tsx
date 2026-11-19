import React,{useState} from 'react';
import {ResearchHost} from '../shared/audio/research/ResearchHost.tsx';
import type {ResearchAudio} from '../shared/audio/research/ResearchAudio.ts';
import {processingDefaults,processingProcessor} from './processor.ts';
import './processing.css';

const configure=(research:ResearchAudio)=>{
  research.install('processor',processingProcessor);
  research.update('processor',processingDefaults);research.setLevel(.5);
};
function ProcessingControls({research,disabled}:{research:ResearchAudio;disabled:boolean}){
  const [settings,setSettings]=useState(processingDefaults);
  const update=(params:Partial<typeof settings>)=>{const next={...settings,...params};setSettings(next);research.update('processor',next);};
  return <div className="processing-controls">
    <label><span>Low-pass cutoff <output>{settings.cutoff===18000?'Open':`${(settings.cutoff/1000).toFixed(1)} kHz`}</output></span><input aria-label="Low-pass cutoff" type="range" min="200" max="18000" step="100" value={settings.cutoff} disabled={disabled} onChange={e=>update({cutoff:Number(e.target.value)})}/></label>
    <label><span>Soft saturation <output>{Math.round(settings.saturation*100)}%</output></span><input aria-label="Soft saturation" type="range" min="0" max="1" step=".05" value={settings.saturation} disabled={disabled} onChange={e=>update({saturation:Number(e.target.value)})}/></label>
    <label className="processing-movement"><input type="checkbox" checked={settings.movement>0} disabled={disabled} onChange={e=>update({movement:e.target.checked?1:0})}/>Slow filter movement</label>
    <p className="research-note">Movement takes 20 seconds per cycle, within half an octave. It follows audio time. Open + zero saturation + movement off gives a neutral insert.</p>
  </div>;
}
export default function AudioProcessing({onClose}:{onClose:()=>void}){
  return <ResearchHost title="Tone & texture" description="How much character can a mix take and still feel like itself? Round the top end, soften peaks, or let the filter drift. Compare with Original as you listen." onClose={onClose} configure={configure} showReferenceTools={false} controls={props=><ProcessingControls {...props}/>}/>;
}
