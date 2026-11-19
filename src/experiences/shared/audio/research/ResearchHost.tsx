import React,{useEffect,useState,type ReactNode} from 'react';
import {ListeningSession} from '../../ListeningSession.ts';
import {mediaUrl} from '../../../../content/media.mjs';
import {makeReference,makeSamples,toBuffer,wavBytes,type ReferenceKind} from './materials.ts';
import type {ResearchAudio} from './ResearchAudio.ts';
import './research.css';

const stamp=(time:number)=>`${Math.floor(time/60)}:${String(Math.floor(time%60)).padStart(2,'0')}`;
export interface ResearchHostProps {
  title:string;description:string;onClose:()=>void;
  configure:(research:ResearchAudio)=>void;
  controls?:(props:{research:ResearchAudio;disabled:boolean})=>ReactNode;
}
/** Sound-first presentation of the same ListeningSession and modal, with no renderer. */
export function ResearchHost({title,description,onClose,configure,controls}:ResearchHostProps){
  const [source,setSource]=useState('mix'),[session,setSession]=useState<ListeningSession|null>(null);
  const [,refresh]=useState(0),[resetCount,setResetCount]=useState(0),[captureUrl,setCaptureUrl]=useState('');
  const [capturing,setCapturing]=useState(false);
  useEffect(()=>{
    let url=source==='mix'?mediaUrl('mixes/MX029/MX029.m3u8'):URL.createObjectURL(new Blob([wavBytes(makeReference(source as ReferenceKind)).buffer as ArrayBuffer],{type:'audio/wav'}));
    const owner=new ListeningSession(url,{research:true});configure(owner.audio.research!);setSession(owner);
    const timer=setInterval(()=>refresh(n=>n+1),100);
    return ()=>{clearInterval(timer);owner.dispose();if(source!=='mix')URL.revokeObjectURL(url);};
  },[source,configure]);
  useEffect(()=>()=>{if(captureUrl)URL.revokeObjectURL(captureUrl);},[captureUrl]);
  const playback=session?.snapshot(),research=session?.audio.research,diagnostics=research?.diagnostics();
  const capable=Boolean(diagnostics?.processing),playing=Boolean(playback?.playing),armed=diagnostics?.mode==='processed';
  const disabled=!capable||!playing||playback?.status!=='playing';
  return <article className="research-host" data-audio-research data-mode={diagnostics?.mode||'original'} data-capable={capable} data-playing={playing} data-output-rms={diagnostics?.rms||0} data-voices={diagnostics?.voices||0}>
    <header className="research-header"><span className="research-eyebrow">ROOM / AUDIO RESEARCH</span><button onClick={onClose}><span aria-hidden="true">← </span>Back to Labs</button></header>
    <h1>{title}</h1><p className="research-intro">{description}</p>
    <section className="research-source" aria-label="Source playback">
      <label>Listening source<select aria-label="Listening source" value={source} onChange={event=>{research?.stop();setCapturing(false);setCaptureUrl('');setSource(event.target.value);}}>
        <option value="mix">MX029 · Saad Ashraf / original mix</option><option value="loop">Generated diagnostic loop · 120 BPM</option><option value="tone">Generated 440 Hz reference</option><option value="noise">Generated noise reference</option>
      </select></label>
      <button className="research-primary" disabled={!session} onClick={()=>{if(playing||playback?.status==='loading')session!.pause();else session!.play();refresh(n=>n+1);}}>{playback?.status==='loading'?'Cancel loading':playing?'Pause source':playback?.error?'Retry source':'Play source'}</button>
      <label className="research-position"><span>Source position <output>{stamp(playback?.time||0)} / {stamp(playback?.duration||0)}</output></span><input aria-label="Source position" type="range" min="0" max={playback?.duration||1} step=".1" value={Math.min(playback?.time||0,playback?.duration||1)} disabled={!playback?.duration} onChange={event=>session!.seek(Number(event.target.value))}/></label>
    </section>
    <section className="research-comparison" aria-label="Listening comparison">
      <div className="research-buttons"><button aria-pressed={!armed} onClick={()=>research?.original()}>Original</button><button aria-pressed={armed} disabled={disabled} onClick={()=>research?.arm()}>Processed</button><button onClick={()=>{research?.reset();if(research)configure(research);setResetCount(n=>n+1);setCapturing(false);setCaptureUrl('');}}>Reset effect</button><button className="research-stop" onClick={()=>{research?.stop();setCapturing(false);}}>Stop effects</button></div>
      <p role="status">{playback?.error||diagnostics?.reason||'Choose a source, then press Play source.'}</p>
      <p className="research-note">Hearing <strong>{armed?'Processed':'Original'}</strong>{source==='mix'?' · MX029':' · generated reference'}. Effects start off. Stop effects keeps the source playing.</p>
    </section>
    <section className="research-control-grid" aria-label="Experiment controls">
      <label>Effect level<input aria-label="Effect level" type="range" min="0" max="1" step=".05" defaultValue=".5" key={resetCount} disabled={disabled} onChange={event=>research?.setLevel(Number(event.target.value))}/></label>
      {research&&<div key={'controls'+resetCount}>{controls?.({research,disabled})}</div>}
      <div><span className="research-eyebrow">OUTPUT / SAME HEADROOM IN BOTH MODES</span><p className="research-meter">{diagnostics?.peak?`${(20*Math.log10(diagnostics.peak)).toFixed(1)} dBFS peak`:'— dBFS peak'}</p><p className="research-note">Fixed −6 dB headroom. Guard ceiling −0.18 dBFS. Peak is sampled, not a loudness match.</p></div>
    </section>
    <section className="research-control-grid research-tools" aria-label="Shared reference tools">
      <div><h2>Clock check</h2><label>Manual tempo (BPM)<input aria-label="Manual tempo (BPM)" type="number" min="40" max="240" defaultValue="120" disabled={disabled} onChange={event=>research?.clock.setTempo(Number(event.target.value))}/></label>
        <div className="research-buttons"><button disabled={disabled||!armed} onClick={()=>research?.clock.tap(playback!.time)}>Tap tempo</button><button disabled={disabled||!armed} onClick={()=>{research!.clock.setTempo(research!.clock.bpm);research!.clock.anchor(playback!.time);const buffer=toBuffer(research!.context!,makeSamples('rim'));research!.clock.repeat(1,at=>research!.playBuffer(buffer,at,.15));}}>Anchor quiet pulse</button></div>
        <p className="research-note">{diagnostics?.bpm.toFixed(1)} BPM · {diagnostics?.anchored?'phase anchored':'phase unset'}. Anchor starts a quiet manual pulse. No automatic beat grid.</p></div>
      <div><h2>Layer check</h2><button disabled={disabled||!armed} onClick={()=>research?.playBuffer(toBuffer(research.context!,makeSamples('clap')),undefined,.2)}>Quiet kit hit</button><p className="research-note">One generated 909-inspired clap, on the shared layer bus. Original and Stop effects remove it.</p></div>
      <div><h2>Capture check</h2><div className="research-buttons"><button disabled={!diagnostics?.capture||disabled} onClick={()=>setCapturing(Boolean(research?.startCapture(4)))}>Start capture</button><button disabled={!capturing||!diagnostics?.capturing||disabled} onClick={async()=>{
        const owner=research!,buffer=await owner.capture(1);if(!buffer||owner!==session?.audio.research)return;
        setCaptureUrl(URL.createObjectURL(new Blob([wavBytes(buffer.getChannelData(0),buffer.sampleRate).buffer as ArrayBuffer],{type:'audio/wav'})));
      }}>Read last second</button></div>{captureUrl&&<a href={captureUrl} download="room-source-capture.wav">Save source capture ↓</a>}<p className="research-note">Opt-in, pre-effect, four-second ring. Read exports mono for this check. Interruptions erase it.</p></div>
    </section>
    <details className="research-diagnostics"><summary>Capabilities and diagnostics</summary><pre>{JSON.stringify({...diagnostics,source,status:playback?.status},null,2)}</pre></details>
  </article>;
}
