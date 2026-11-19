import React,{useState} from 'react';
import {ResearchHost} from '../shared/audio/research/ResearchHost.tsx';
import type {ResearchAudio} from '../shared/audio/research/ResearchAudio.ts';
import {atmosphereDefaults,atmosphereLayer,atmospherePresets} from './layer.ts';
import './atmosphere.css';

const configure=(research:ResearchAudio)=>{research.install('layer',atmosphereLayer);research.update('layer',atmosphereDefaults);research.setLevel(.5);};
function AtmosphereControls({research,disabled}:{research:ResearchAudio;disabled:boolean}){
  const [settings,setSettings]=useState({...atmosphereDefaults});
  const [tuning,setTuning]=useState(String(atmosphereDefaults.tuning));
  const update=(patch:Partial<typeof settings>)=>{const next={...settings,...patch};setSettings(next);research.update('layer',next);};
  return <div className="atmosphere-controls">
    <h2>Choose a starting texture</h2>
    <div className="research-buttons" role="group" aria-label="Atmosphere settings">{atmospherePresets.map(p=><button key={p.name} disabled={disabled} aria-pressed={(['texture','brightness','movement','tuning'] as const).every(k=>settings[k]===p[k])} onClick={()=>{update({texture:p.texture,brightness:p.brightness,movement:p.movement,tuning:p.tuning});setTuning(String(p.tuning));}}>{p.name}</button>)}</div>
    <label>Texture <output>{settings.texture===0?'Unpitched noise':settings.texture===1?'Tonal sine':`${Math.round(settings.texture*100)}% tone`}</output><input aria-label="Texture" type="range" min="0" max="1" step=".05" value={settings.texture} disabled={disabled} onChange={e=>update({texture:Number(e.target.value)})}/></label>
    <label>Noise brightness <output>{settings.brightness} Hz</output><input aria-label="Noise brightness" type="range" min="150" max="5000" step="50" value={settings.brightness} disabled={disabled||settings.texture===1} onChange={e=>update({brightness:Number(e.target.value)})}/></label>
    <label>Noise movement <output>{Math.round(settings.movement*100)}%</output><input aria-label="Noise movement" type="range" min="0" max="1" step=".05" value={settings.movement} disabled={disabled||settings.texture===1} onChange={e=>update({movement:Number(e.target.value)})}/></label>
    <label>Manual tuning (Hz)<input aria-label="Manual tuning (Hz)" type="number" min="55" max="880" step=".5" value={tuning} disabled={disabled||settings.texture===0} onChange={e=>{setTuning(e.target.value);const value=e.target.valueAsNumber;if(Number.isFinite(value)&&value>=55&&value<=880)update({tuning:value});}} onBlur={e=>{const value=e.target.valueAsNumber,next=Number.isFinite(value)?Math.max(55,Math.min(880,value)):settings.tuning;setTuning(String(next));update({tuning:next});}} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();}}/></label>
    <p className="research-note">Veil is unpitched filtered noise. Warm floor is a 110 Hz sine; Suspended blends noise with a 220 Hz sine. Tune by ear for the passage. These frequencies are starting points, with no key detection or harmonic matching.</p>
    <p className="research-note">Start fades in over two seconds. Texture and tuning changes glide over 0.75 seconds. Original and Stop effects remove the layer immediately with a short safety fade. Pause, seek, source changes, buffering and hidden tabs require a deliberate restart.</p>
    <p className="research-note">Listen for a change of setting, then for lost detail: hats disappearing under noise, or a tone beating against the bass. Compare with Original at the same source position. A louder blend is not evidence of improvement.</p>
  </div>;
}
export default function AudioAtmosphere({onClose}:{onClose:()=>void}){
  return <div className="atmosphere-experiment"><ResearchHost title="Atmospheric layers" description="Can a quiet sustained layer change the setting without covering the recording? Play the source, choose a texture, then Start layer. Compare with Original. Tonal settings need your own tuning by ear." onClose={onClose} configure={configure} showReferenceTools={false} armLabel="Start layer" processedLabel="Mix + atmosphere" levelLabel="Layer level" controls={props=><AtmosphereControls {...props}/>}/></div>;
}
