import React,{useState} from 'react';
import {ResearchHost} from '../shared/audio/research/ResearchHost.tsx';
import type {ResearchAudio} from '../shared/audio/research/ResearchAudio.ts';
import {lanes,patterns,rhythmDefaults,rhythmLayer,type Lane} from './layer.ts';
import './rhythm.css';

const configure=(research:ResearchAudio)=>{research.install('layer',rhythmLayer(research));research.update('layer',rhythmDefaults);research.setLevel(.5);};
function RhythmControls({research,disabled,readMediaTime}:{research:ResearchAudio;disabled:boolean;readMediaTime:()=>number}){
  const [settings,setSettings]=useState({...rhythmDefaults}),[tempo,setTempo]=useState('120');
  const [anchor,setAnchor]=useState(0),[offset,setOffset]=useState(0),[notice,setNotice]=useState('');
  const d=research.diagnostics(),valid=Number.isFinite(Number(tempo))&&Number(tempo)>=40&&Number(tempo)<=240;
  const update=(patch:Partial<typeof settings>)=>{const next={...settings,...patch};setSettings(next);research.update('layer',next);};
  const anchorNow=()=>{
    if(!valid||!research.arm()){setNotice('Play a supported source, then try the anchor again.');return;}
    const time=readMediaTime();research.clock.setTempo(Number(tempo));research.clock.anchor(time);setAnchor(time);setOffset(0);setNotice('');update({cycle:settings.cycle+1});
  };
  const nudge=(delta:number)=>{const next=Math.max(-.1,Math.min(.1,Math.round((offset+delta)*1000)/1000));research.clock.anchor(anchor+next);setOffset(next);research.update('layer',settings);};
  const toggle=(lane:Lane,step:number)=>update({[lane]:settings[lane]^(1<<step)});
  const tap=()=>{research.stop('Tempo tapped; start rhythm on a downbeat.');research.clock.tap(readMediaTime());setTempo(research.clock.bpm.toFixed(1));research.clock.cancel();setOffset(0);};
  return <div className="rhythm-controls">
    <div className="rhythm-clock">
      <label>Manual tempo (BPM)<input aria-label="Manual tempo (BPM)" type="number" min="40" max="240" step=".1" value={tempo} disabled={disabled} onChange={e=>{setTempo(e.target.value);research.stop('Tempo edited; start rhythm again on a downbeat.');}}/></label>
      <div className="research-buttons"><button disabled={disabled} onClick={tap}>Tap tempo</button><button className="research-primary" disabled={disabled||!valid} onClick={anchorNow}>{d.anchored&&d.mode==='processed'?'Re-anchor downbeat':'Start rhythm on this downbeat'}</button></div>
      <p className="rhythm-timing" role="status">{!d.layering?'Layering unavailable · Original preserved.':d.anchored&&d.mode==='processed'?`Mix + rhythm · ${d.bpm.toFixed(1)} BPM · anchor ${anchor.toFixed(3)} s · ${offset>=0?'+':''}${Math.round(offset*1000)} ms`:'Rhythm off · press Start rhythm on this downbeat.'}</p>
      {notice&&<p role="status">{notice}</p>}
      <div className="research-buttons"><button disabled={disabled||!d.anchored} onClick={()=>nudge(-.01)}>Earlier 10 ms</button><button disabled={disabled||!d.anchored} onClick={()=>nudge(.01)}>Later 10 ms</button></div>
      <p className="research-note">Play the source, then press Start rhythm on this downbeat on the mix’s first beat. This starts the drums and anchors the pattern together. Taps set tempo only; the downbeat is your choice. Nudges shift the grid up to ±100 ms. This is manual alignment, with no automatic beat synchronization.</p>
    </div>
    <div className="rhythm-patterns"><h2>Leave room for the mix</h2><div className="research-buttons" role="group" aria-label="Sparse patterns">{patterns.map(p=><button key={p.name} disabled={disabled} aria-pressed={lanes.every(l=>settings[l]===p[l])} onClick={()=>update({kick:p.kick,clap:p.clap,hat:p.hat})}>{p.name}</button>)}</div>
      <label className="rhythm-kick"><input type="checkbox" checked={Boolean(settings.kick&1)} disabled={disabled} onChange={()=>toggle('kick',0)}/>Optional kick · toggle first step</label>
      <p className="research-note">Air: two hats. Reply: four hats and one clap. Punctuation: one hat and one clap. Generated 909-inspired sounds; no hardware recordings. Kick starts off.</p>
    </div>
    <details className="rhythm-editor"><summary>Edit 16 steps · kick / clap / hat</summary>{lanes.map(lane=><fieldset key={lane}><legend>{lane==='hat'?'Closed hat':lane==='clap'?'Clap':'Kick'}</legend><div className="rhythm-steps">{Array.from({length:16},(_,step)=><button key={step} disabled={disabled} aria-label={`${lane} step ${step+1}`} aria-pressed={Boolean(settings[lane]&(1<<step))} onClick={()=>toggle(lane,step)}>{step+1}</button>)}</div></fieldset>)}</details>
    <p className="research-note">Pause, seek, buffering, source changes, hidden tabs and Stop effects clear alignment and all scheduled hits. On return, press Start rhythm on this downbeat again. No automatic resume or catch-up burst. Edits affect unscheduled hits; Stop effects also cancels the next 100 ms already queued.</p>
  </div>;
}
export default function AudioRhythm({onClose}:{onClose:()=>void}){
  return <ResearchHost title="Additional rhythm" description="When does another pattern support the groove, and when does it compete? Play the source, then start the rhythm on a downbeat to hear the added drums. Align them by ear and compare with Original. Start with Air; bring in the kick only if there is room." onClose={onClose} configure={configure} showReferenceTools={false} armLabel={null} processedLabel="Mix + rhythm" levelLabel="Layer level" controls={props=><RhythmControls {...props}/>}/>;
}
