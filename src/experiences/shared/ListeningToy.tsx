import React,{useEffect,useRef,useState} from 'react';
import type {AudioSourceMode,ToyAction,ToyConfig,ToyRenderer} from './contracts.ts';
import {ListeningSession} from './ListeningSession.ts';
import {ToyRuntime} from './ToyRuntime.ts';
import './listening-toy.css';
const stamp=(seconds:number)=>`${Math.floor(seconds/60)}:${String(Math.floor(seconds%60)).padStart(2,'0')}`;
export function ListeningToy<State>({config,onClose}:{config:ToyConfig<State>;onClose:()=>void}) {
  const [runtime]=useState(()=>new ToyRuntime(config.createSimulation(),matchMedia('(prefers-reduced-motion: reduce)').matches));
  const [session]=useState(()=>new ListeningSession(config.mix.url));
  const canvas=useRef<HTMLCanvasElement>(null),renderer=useRef<ToyRenderer<State>|null>(null);
  const sampledSource=useRef<AudioSourceMode>('inactive');
  const rejectedPointers=useRef(new Set<number>());
  const captured=useRef<{element:HTMLCanvasElement|HTMLInputElement;id:number;gesture?:{x:number;y:number;targetId:string;dragged:boolean}}|null>(null);
  const [attempt,setAttempt]=useState(0),[renderState,setRenderState]=useState('loading');
  const [,refresh]=useState(0);
  const update=()=>refresh(n=>n+1);
  const release=()=>{
    const p=captured.current;captured.current=null;
    if(p?.element.hasPointerCapture(p.id))p.element.releasePointerCapture(p.id);
    runtime.release();
  };
  const dispatch=(action:ToyAction)=>{
    if(action.type==='set-value'||action.type==='command'&&action.command==='settle') {
      // Slider holds belong to the DOM control, not to a grabbed scene object.
      if(captured.current?.element===canvas.current)release();
    }
    const accepted=runtime.act(action);
    if(accepted&&captured.current&&captured.current.element!==canvas.current)runtime.director.hold(true,runtime.simTime);
    update();return accepted;
  };
  useEffect(()=>{
    const media=matchMedia('(prefers-reduced-motion: reduce)');
    const reduce=()=>{runtime.reducedMotion=media.matches;if(media.matches){runtime.motionPaused=true;release();runtime.suspend();session.clear();}update();};
    const blur=()=>{rejectedPointers.current.clear();release();update();};
    const pointerEnded=(event:PointerEvent)=>{rejectedPointers.current.delete(event.pointerId);};
    media.addEventListener('change',reduce);window.addEventListener('blur',blur);
    window.addEventListener('pointerup',pointerEnded);window.addEventListener('pointercancel',pointerEnded);
    session.onSeek=time=>{release();runtime.reset(time,'seek');update();};
    session.audio.onChange=snapshot=>{if(snapshot.status!=='playing'){release();runtime.suspend();session.clear();}update();};
    return ()=>{media.removeEventListener('change',reduce);window.removeEventListener('blur',blur);window.removeEventListener('pointerup',pointerEnded);window.removeEventListener('pointercancel',pointerEnded);release();session.dispose();};
  },[session,runtime]);
  useEffect(()=>{
    const element=canvas.current!;
    let active=true,raf=0,previous=0,lastUI=0;
    const fail=()=>{release();runtime.suspend();renderer.current?.dispose();renderer.current=null;if(active)setRenderState('fallback');};
    try {renderer.current=config.createRenderer(element);renderer.current.render(runtime.simulation.snapshot());setRenderState('ready');} catch {fail();}
    const lost=(event:Event)=>{event.preventDefault();fail();};
    element.addEventListener('webglcontextlost',lost);
    const resize=new ResizeObserver(()=>{try{renderer.current?.resize();renderer.current?.render(runtime.simulation.snapshot());}catch{fail();}});resize.observe(element.parentElement!);
    const animate=()=>{
      if(!active||document.hidden)return;
      // RAF timestamps can precede a blocking task; media time reflects callback execution.
      const now=performance.now();
      const sample=session.sample(previous?Math.max(0,(now-previous)/1000):0);previous=now;
      sampledSource.current=sample.source;
      const state=runtime.tick(now,{...sample,mediaTime:sample.playback.time},Boolean(renderer.current));
      if(!runtime.running&&captured.current)release();
      try{renderer.current?.render(state);}catch{fail();}
      if(now-lastUI>=100){lastUI=now;update();}
      raf=requestAnimationFrame(animate);
    };
    const visibility=()=>{
      release();runtime.suspend();session.clear();previous=0;cancelAnimationFrame(raf);
      if(!document.hidden)raf=requestAnimationFrame(animate);
      update();
    };
    document.addEventListener('visibilitychange',visibility);
    if(!document.hidden)raf=requestAnimationFrame(animate);
    return ()=>{active=false;cancelAnimationFrame(raf);resize.disconnect();element.removeEventListener('webglcontextlost',lost);document.removeEventListener('visibilitychange',visibility);renderer.current?.dispose();renderer.current=null;};
  },[attempt,config,runtime,session]);
  const state=runtime.simulation.snapshot(),playback=session.snapshot(),mode=runtime.director.update(runtime.simTime).mode;
  const selected=config.selected(state),target=config.targets.find(t=>t.id===selected);
  const frozen=!runtime.running||renderState!=='ready';
  const source=playback.status==='playing'?sampledSource.current:'inactive';
  const capture=(element:HTMLCanvasElement|HTMLInputElement,id:number)=>{captured.current={element,id};element.setPointerCapture(id);};
  const nudge=(x:number,y:number)=>config.horizontalValueKeys&&config.valueControl
    ?dispatch({type:'set-value',control:config.valueControl.id,value:config.valueControl.read(state)+x*.1})
    :dispatch({type:'nudge',targetId:selected,x,y});
  const reset=()=>{release();runtime.reset(playback.time,'user');session.clear();update();};
  const watch=()=>{release();runtime.director.watch();update();};
  const motion=()=>{release();runtime.motionPaused=!runtime.motionPaused;runtime.suspend();session.clear();update();};
  return <article className="listening-toy" data-toy={config.id} data-render-state={renderState} data-mode={mode} data-source={source}
    data-phase={config.phase?.(state)||mode} data-running={runtime.running} data-grabbed={config.grabbed(state)||''} data-selected={selected} data-diagnostics={JSON.stringify(config.diagnostics(state))}>
    <header className="listening-header"><span className="listening-eyebrow">ROOM / LABS / LISTENING STUDIES</span><button onClick={onClose}>Back to Labs <span aria-hidden="true">↗</span></button></header>
    <div className="listening-title"><div><p className="listening-eyebrow">A LISTENING EXPERIENCE · PROTOTYPE</p><h1>{config.title}</h1></div><p>{config.description}</p></div>
    <div className="listening-layout">
      <section className="listening-stage" aria-label={config.stageLabel||'Experience stage'}>
        <div className="listening-stage-top"><span>{config.phase?.(state)==='returning'?'RETURNING':mode==='watch'?'WATCHING':'IN YOUR HANDS'}</span><span>{config.stageMeta}</span></div>
        <canvas ref={canvas} tabIndex={renderState==='ready'?0:-1} role="application" aria-label={`${config.title} scene. Select a target below; use arrow keys to move it.${config.sceneCommand?' Space to '+config.sceneCommand+'.':''}`}
          onKeyDown={event=>{const keys:Record<string,[number,number]>={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,1],ArrowDown:[0,-1]};if(keys[event.key]){event.preventDefault();nudge(...keys[event.key]);}else if(event.code==='Space'&&config.sceneCommand){event.preventDefault();if(!event.repeat)dispatch({type:'command',command:config.sceneCommand,targetId:selected});}}}
          onPointerDown={event=>{
            if(captured.current||event.button!==0)return;
            const id=renderer.current?.pick(event.clientX,event.clientY);if(!id)return;
            dispatch({type:'select',targetId:id});event.currentTarget.focus({preventScroll:true});
            if(frozen)return;
            const point=renderer.current!.point(event.clientX,event.clientY);
            if(dispatch({type:'grab',targetId:id,...point})){event.preventDefault();capture(event.currentTarget,event.pointerId);if(config.sceneCommand)captured.current!.gesture={x:event.clientX,y:event.clientY,targetId:id,dragged:false};}
          }}
          onPointerMove={event=>{if(captured.current?.element===event.currentTarget&&captured.current.id===event.pointerId){const gesture=captured.current.gesture;if(gesture&&!gesture.dragged){gesture.dragged=Math.hypot(event.clientX-gesture.x,event.clientY-gesture.y)>=8;if(!gesture.dragged)return;}const point=renderer.current?.point(event.clientX,event.clientY);if(point)dispatch({type:'move',...point});}}}
          onPointerUp={event=>{if(captured.current?.id===event.pointerId){const gesture=captured.current.gesture;release();if(gesture&&!gesture.dragged&&Math.hypot(event.clientX-gesture.x,event.clientY-gesture.y)<8&&config.sceneCommand)dispatch({type:'command',command:config.sceneCommand,targetId:gesture.targetId});update();}}}
          onPointerCancel={event=>{if(captured.current?.id===event.pointerId){release();update();}}}
          onLostPointerCapture={event=>{if(captured.current?.id===event.pointerId){release();update();}}}/>
        {renderState!=='ready'&&<div className="listening-fallback"><img src={config.poster} alt={config.posterAlt||config.title} onError={event=>{event.currentTarget.hidden=true;}}/>
          <div><p role="status">{renderState==='loading'?'Preparing the scene…':'The scene is unavailable. The mix can still play.'}</p>{renderState==='fallback'&&<button onClick={()=>{setRenderState('loading');setAttempt(n=>n+1);}}>Retry scene</button>}</div></div>}
        <div className="listening-stage-bottom"><span>{frozen?(config.idleHint||'Motion is paused.'):config.grabbed(state)?(config.activeHint||'You’re in control.'):(config.hint||'Watch, or join in.')}</span><span aria-hidden="true">↔</span></div>
      </section>
      <aside className="listening-controls" aria-label={config.controlLabel||'Scene controls'}>
        <div className="listening-control-heading"><span className="listening-eyebrow">A LITTLE INTERFERENCE</span><span aria-hidden="true">✳</span></div>
        <>{config.targetButtons?<div className="listening-target-buttons" role="group" aria-label="Select a member">{config.targets.map(t=><button key={t.id} aria-pressed={selected===t.id} onClick={()=>dispatch({type:'select',targetId:t.id})}>{t.name}</button>)}</div>:<label className="listening-target">Select a target<select value={selected} onChange={event=>dispatch({type:'select',targetId:event.target.value})}>{config.targets.map(t=><option value={t.id} key={t.id}>{t.name}</option>)}</select></label>}</>
        <div className="listening-directions" role="group" aria-label={`Move ${target?.name||'selected object'}`}>
          <button disabled={frozen} aria-label={config.directionLabels?.left||"Move left"} onClick={()=>nudge(-1,0)}>{config.directionLabels?.left||"←"}</button>{!config.horizontalValueKeys&&<><button disabled={frozen} aria-label={config.directionLabels?.up||"Move up"} onClick={()=>nudge(0,1)}>{config.directionLabels?.up||"↑"}</button><button disabled={frozen} aria-label={config.directionLabels?.down||"Move down"} onClick={()=>nudge(0,-1)}>{config.directionLabels?.down||"↓"}</button></>}<button disabled={frozen} aria-label={config.directionLabels?.right||"Move right"} onClick={()=>nudge(1,0)}>{config.directionLabels?.right||"→"}</button>
        </div>
        {config.valueControl&&<label className="listening-value">{config.valueControl.label}<output>{Math.round((config.valueControl.read(state)+1)*50)}%</output>
          <input aria-label={config.valueControl.label} type="range" min="-1" max="1" step="0.1" disabled={frozen} value={config.valueControl.read(state)}
            onPointerDown={event=>{
              if(captured.current||rejectedPointers.current.size){rejectedPointers.current.add(event.pointerId);event.preventDefault();return;}
              capture(event.currentTarget,event.pointerId);runtime.director.hold(true,runtime.simTime);
            }}
            onKeyDown={event=>{
              const steps:Record<string,number>={ArrowLeft:-.1,ArrowDown:-.1,ArrowRight:.1,ArrowUp:.1,PageDown:-.2,PageUp:.2};
              if(!(event.key in steps)&&event.key!=='Home'&&event.key!=='End')return;
              event.preventDefault();release();
              const value=event.key==='Home'?-1:event.key==='End'?1:config.valueControl!.read(state)+steps[event.key];
              dispatch({type:'set-value',control:config.valueControl!.id,value});
            }}
            onPointerUp={event=>{if(captured.current?.id===event.pointerId)release();}}
            onPointerCancel={event=>{if(captured.current?.id===event.pointerId)release();}}
            onLostPointerCapture={event=>{if(captured.current?.id===event.pointerId)release();}}
            onChange={event=>{
              // A native range still emits input for rejected touches, even after preventDefault.
              if(rejectedPointers.current.size||(captured.current&&captured.current.element!==event.currentTarget)){
                event.currentTarget.value=String(config.valueControl!.read(state));return;
              }
              dispatch({type:'set-value',control:config.valueControl!.id,value:Number(event.target.value)});
            }}/>
          <span className="listening-rail-labels"><span>LEFT</span><span>RIGHT</span></span></label>}
        <div className="listening-button-row">{config.commands.map(c=><button key={c.id} disabled={frozen||(c.targeted&&selected==='counterweight')} onClick={()=>dispatch({type:'command',command:c.id,...(c.targeted?{targetId:selected}:{})})}>{c.label}</button>)}</div>
        <p className="listening-help">{frozen?'Resume motion to interact. Play the mix to let it move.':(config.hint||'Watch, or join in. Nothing to solve.')}</p>
        <div className="listening-mode"><button aria-pressed={mode==='watch'} onClick={watch}>Watch</button><label><input type="checkbox" checked={runtime.director.keep} onChange={event=>{runtime.director.keep=event.target.checked;update();}}/>Keep control</label></div>
        <button className="listening-motion" onClick={motion}>{runtime.motionPaused?(runtime.reducedMotion?'Gentle motion':'Resume motion'):'Pause motion'}</button>
        <button className="listening-reset" onClick={reset}>Reset scene <span aria-hidden="true">↺</span></button>
      </aside>
    </div>
    <section className="listening-transport" aria-label="Mix transport">
      <div className="listening-record"><span className="listening-eyebrow">THE ONLY SOUND</span><strong>{config.mix.artist}</strong><span>{config.mix.id} / ROOM mix</span></div>
      <button className="listening-play" onClick={()=>{if(playback.playing||playback.status==='loading')session.pause();else session.play();update();}}>{playback.status==='loading'?'Cancel loading':playback.playing?'Pause mix':playback.error?'Retry mix':'Play mix'}</button>
      <label className="listening-seek"><span>Mix position <output>{stamp(playback.time)} / {stamp(playback.duration)}</output></span><input aria-label="Mix position" type="range" min="0" max={playback.duration||1} step="1" value={Math.min(playback.time,playback.duration||1)} disabled={!playback.duration} onChange={event=>session.seek(Number(event.target.value))}/></label>
      <label className="listening-volume">Volume<input aria-label="Volume" type="range" min="0" max="1" step="0.05" defaultValue="1" onChange={event=>session.audio.setVolume(Number(event.target.value))}/></label>
    </section>
    <div className="listening-status"><p role="status">{playback.error|| (source==='ambient'?'Ambient motion · live analysis unavailable':source==='live'?'Listening to the mix · gentle forces, no added sound':playback.status==='loading'?'Loading the mix…':'Press Play mix when you’re ready.')}</p><span>Interactions never alter the recording.</span></div>
    <details className="listening-diagnostics"><summary>Labs diagnostics</summary><pre>{JSON.stringify({source,mode,motion:runtime.motionPaused?0:runtime.reducedMotion?.2:1,...config.diagnostics(state),...renderer.current?.metrics()},null,2)}</pre></details>
  </article>;
}
