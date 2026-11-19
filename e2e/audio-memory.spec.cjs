const {test,expect}=require('@playwright/test');
const {moduleUrl}=require('./helpers/research-module.cjs');
const {fixture}=require('./helpers/rally-media.cjs');
const path=require('node:path'),fs=require('node:fs');
const root='artifacts/audio-memory',panel=p=>p.locator('[data-audio-research]');
const urls=()=>({owner:moduleUrl(path.resolve(__dirname,'../src/experiences/shared/audio/research/ResearchAudio.ts')),memory:moduleUrl(path.resolve(__dirname,'../src/experiences/audio-memory/fragment.ts'))});
async function open(page){await fixture(page);await page.goto('/labs/#audio-experiments');await page.getByRole('button',{name:'Open Memory & fragments ↗'}).click();await page.getByRole('button',{name:'Open live fragment study'}).click();await expect(panel(page)).toBeVisible();}

test('actual capture and guarded playback bound replacement memory, voices, stalls and all cancellation paths',async({page})=>{
  await page.goto('/labs/');
  const result=await page.evaluate(async urls=>{
    const {ResearchAudio}=await import(urls.owner),{MemoryFragment}=await import(urls.memory);
    const context=new AudioContext({sampleRate:24000});await context.resume();
    const source=context.createOscillator(),gain=context.createGain();source.frequency.value=317;gain.gain.value=.3;source.connect(gain);source.start();
    let state={status:'playing',playing:true};const owner=new ResearchAudio(()=>({...state,time:context.currentTime}));owner.attach(context,gain);owner.sync({...state,time:0});
    const wait=ms=>new Promise(r=>setTimeout(r,ms));for(let i=0;i<100&&!owner.diagnostics().capture;i++)await wait(20);
    const fragment=new MemoryFragment(owner);owner.install('layer',fragment.factory);owner.setLevel(1);
    let maxVoices=0;const track=setInterval(()=>maxVoices=Math.max(maxVoices,owner.diagnostics().voices),10);
    if(!fragment.listen())throw Error('Recent listening failed');fragment.update({length:.5,density:8,mode:1});await wait(650);
    let maxBytes=0;const repeated=[];
    for(let i=0;i<25;i++){if(!await fragment.capture(context.currentTime))throw Error('Capture failed');const s=fragment.snapshot();maxBytes=Math.max(maxBytes,s.bytes);repeated.push(s.bytes);}
    const before=fragment.snapshot();gain.gain.value=0; // Captured sine must now be the only audible output.
    if(!fragment.play(context.currentTime))throw Error('Fragment play failed');
    owner.startCapture(.5,'output');await wait(700);const signal=await owner.capture(.15);if(!signal)throw Error('Output missing');
    const rms=b=>Math.sqrt(b.getChannelData(0).reduce((s,v)=>s+v*v,0)/b.length),audible=rms(signal);
    // One second with both clocks advancing: skip old grains, never burst a backlog.
    const blocked=performance.now();while(performance.now()-blocked<1000){/* Deliberate long JS frame. */}
    await wait(80);const stalled={...owner.diagnostics(),retained:fragment.snapshot().bytes};
    owner.original();await wait(80);const bypass={...owner.diagnostics(),...fragment.snapshot()};
    owner.startCapture(.2,'output');await wait(250);const silent=await owner.capture(.1),after=rms(silent);
    const events=[];
    for(const event of ['stop','reset','pause','seek','hidden']){
      state={status:'playing',playing:true};owner.sync({...state,time:context.currentTime});gain.gain.value=.3;
      fragment.listen();fragment.update({length:.25,density:8,mode:0});await wait(350);await fragment.capture(context.currentTime);fragment.play(context.currentTime);
      if(event==='stop')owner.stop();if(event==='reset')owner.reset();if(event==='pause')owner.sync({status:'paused',playing:false,time:context.currentTime});if(event==='seek')owner.stop('Source seeking');
      if(event==='hidden'){Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));}
      await wait(80);events.push({event,...fragment.snapshot(),...owner.diagnostics()});
      if(event==='hidden'){Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));}
    }
    state={status:'playing',playing:true};owner.sync({...state,time:context.currentTime});fragment.listen();fragment.update({length:.25});await wait(350);
    const pending=fragment.capture(context.currentTime);owner.dispose();const acceptedAfterClose=await pending;await wait(40);clearInterval(track);
    const closed=fragment.snapshot();source.stop();await context.close();return {before,repeated,maxBytes,maxVoices,audible,after,stalled,bypass,events,acceptedAfterClose,closed};
  },urls());
  fs.mkdirSync(root,{recursive:true});fs.writeFileSync(`${root}/guarded-${test.info().project.name}.json`,JSON.stringify(result,null,2));
  expect(result.audible).toBeGreaterThan(.003);expect(result.after).toBeLessThan(.000001);expect(result.maxVoices).toBeLessThanOrEqual(6);
  expect(new Set(result.repeated).size).toBe(1);expect(result.maxBytes).toBeLessThanOrEqual(24000*2*4*(1+1.6));
  expect(result.stalled.voices).toBeLessThanOrEqual(6);expect(result.bypass.bytes).toBe(0);expect(result.bypass.voices).toBe(0);
  for(const e of result.events){expect(e.bytes,e.event).toBe(0);expect(e.voices,e.event).toBe(0);expect(e.mode,e.event).toBe('original');}
  expect(result.acceptedAfterClose).toBe(false);expect(result.closed.bytes).toBe(0);
});

test('offline repetition and grains are windowed, finite, deterministic and stop at the twelve second bound',async({page})=>{
  await page.goto('/labs/');
  const result=await page.evaluate(async urls=>{
    const {MemoryFragment}=await import(urls.memory),{AudioClock}=await import(urls.clock),rate=24000;
    async function render(mode){
      const context=new OfflineAudioContext(1,rate*14,rate),source=context.createBuffer(1,rate,rate);
      source.getChannelData(0).set(Float32Array.from({length:rate},(_,i)=>.3*Math.sin(2*Math.PI*317*i/rate)));
      const clock=new AudioClock(),schedule=[];
      const owner={context,clock,diagnostics:()=>({generation:clock.generation}),capture:async()=>source,stop:()=>clock.cancel(),playBuffer:(buffer,at)=>{
        schedule.push({at,signature:buffer.getChannelData(0)[111]});const voice=context.createBufferSource();voice.buffer=buffer;voice.connect(context.destination);voice.start(at);return true;
      }};
      const fragment=new MemoryFragment(owner);fragment.activate();fragment.update({length:1,density:8,mode});await fragment.capture(0);fragment.play(0);
      for(let time=0;time<14;time+=.025)clock.sync(time,time,true);
      const data=(await context.startRendering()).getChannelData(0);return {data:Array.from(data),peak:data.reduce((p,v)=>Math.max(p,Math.abs(v)),0),finite:data.every(Number.isFinite),schedule,maxStep:data.reduce((p,v,i)=>i?Math.max(p,Math.abs(v-data[i-1])):p,0),tail:data.subarray(rate*12).every(v=>v===0)};
    }
    const repeat=await render(0),grains=await render(1),again=await render(1);const deterministic=grains.data.every((v,i)=>v===again.data[i]),maxDifference=grains.data.reduce((p,v,i)=>Math.max(p,Math.abs(v-again.data[i])),0);const sameSchedule=JSON.stringify(grains.schedule)===JSON.stringify(again.schedule);delete repeat.data;delete grains.data;return {repeat,grains,deterministic,maxDifference,sameSchedule};
  },{...urls(),clock:moduleUrl(path.resolve(__dirname,'../src/experiences/shared/audio/research/AudioClock.ts'))});
  expect(result.sameSchedule).toBe(true);expect(result.maxDifference).toBeLessThan(1e-6);for(const r of [result.repeat,result.grains]){expect(r.finite).toBe(true);expect(r.tail).toBe(true);expect(r.schedule[0].at).toBeLessThanOrEqual(.03);expect(r.maxStep).toBeLessThan(.05);expect(r.peak).toBeLessThan(.6);}
  fs.mkdirSync(root,{recursive:true});fs.writeFileSync(`${root}/offline-${test.info().project.name}.json`,JSON.stringify(result,null,2));
});

test('host captures selected source, clears on interruptions and preserves native unsupported playback',async({page,browserName})=>{
  await open(page);await page.getByRole('button',{name:'Play source',exact:true}).click();await expect(panel(page)).toHaveAttribute('data-playing','true');
  if(browserName==='webkit'){
    await expect(page.getByRole('button',{name:'Start recent listening',exact:true})).toBeDisabled();await expect(page.getByText(/Source capture unavailable/)).toBeVisible();expect(await page.evaluate(()=>window.__rallyMedia[0].paused)).toBe(false);
  }else{
    const listen=page.getByRole('button',{name:'Start recent listening',exact:true}),capture=page.getByRole('button',{name:'Capture fragment',exact:true}),memory=page.locator('[data-memory]');
    await listen.click();await expect(capture).toBeEnabled();await capture.click();await expect(memory).toHaveAttribute('data-ready','true');await expect(memory).toContainText('Captured from selected source');await page.getByRole('button',{name:'Play fragment',exact:true}).click();
    const before=await page.evaluate(()=>window.__rallyMedia[0].currentTime);await page.getByRole('button',{name:'Original',exact:true}).click();await expect(memory).toHaveAttribute('data-bytes','0');await expect.poll(()=>page.evaluate(()=>window.__rallyMedia[0].currentTime)).toBeGreaterThan(before);
    for(const action of ['Stop effects','Reset effect','Pause source']){await listen.click();await expect(capture).toBeEnabled();await capture.click();await expect(memory).toHaveAttribute('data-ready','true');await page.getByRole('button',{name:action,exact:true}).click();await expect(memory).toHaveAttribute('data-bytes','0');if(action==='Pause source')await page.getByRole('button',{name:'Play source',exact:true}).click();}
    await listen.click();await expect(capture).toBeEnabled();await capture.click();await expect(memory).toHaveAttribute('data-ready','true');await page.getByRole('slider',{name:'Source position'}).fill('30');await expect(memory).toHaveAttribute('data-bytes','0');
  }
  await page.getByRole('button',{name:'Back to Labs'}).click();await expect(page.getByRole('button',{name:'Open Memory & fragments ↗'})).toBeFocused();expect(await page.evaluate(()=>window.__rallyMedia.every(m=>m.paused&&!m.getAttribute('src')))).toBe(true);
  await page.getByRole('button',{name:'Open Memory & fragments ↗'}).click();await page.getByRole('button',{name:'Open live fragment study'}).click();await expect(page.locator('[data-memory]')).toHaveAttribute('data-bytes','0');
});

test('explicit generated reference works with keyboard and responsive controls',async({page})=>{
  await page.addInitScript(()=>sessionStorage.setItem('room-labs-session','open'));await page.goto('/labs/#audio-experiments');await page.getByRole('button',{name:'Open Memory & fragments ↗'}).focus();await page.keyboard.press('Enter');await page.getByRole('button',{name:'Open live fragment study'}).click();
  await page.getByRole('combobox',{name:'Listening source'}).selectOption('loop');await page.getByRole('button',{name:'Play source',exact:true}).click();await page.getByRole('button',{name:'Start recent listening',exact:true}).click();await page.getByRole('button',{name:'Capture fragment',exact:true}).click();await expect(page.locator('[data-memory]')).toHaveAttribute('data-ready','true');
  await page.getByRole('combobox',{name:'Treatment'}).selectOption('1');await page.getByRole('slider',{name:'Repetition / density'}).focus();await page.keyboard.press('ArrowRight');await expect(page.getByRole('slider',{name:'Repetition / density'})).toHaveValue('4');await page.getByRole('button',{name:'Play fragment',exact:true}).click();
  const retained=await page.locator('[data-memory]').getAttribute('data-bytes');await page.getByRole('combobox',{name:'Treatment'}).selectOption('0');await expect(page.locator('[data-memory]')).toHaveAttribute('data-bytes',retained);
  fs.mkdirSync(root,{recursive:true});for(const width of [390,768,1440]){await page.setViewportSize({width,height:1100});expect(await panel(page).evaluate(e=>e.scrollWidth<=e.clientWidth+1)).toBe(true);await page.locator('.memory-controls').scrollIntoViewIfNeeded();await page.locator('dialog').screenshot({path:`${root}/controls-${test.info().project.name}-${width}.png`});}
  await page.setViewportSize({width:390,height:844});await page.addStyleTag({content:'html{font-size:200%!important}'});expect(await panel(page).evaluate(e=>e.scrollWidth<=e.clientWidth+1)).toBe(true);
  await page.getByRole('combobox',{name:'Listening source'}).selectOption('tone');await expect(page.locator('[data-memory]')).toHaveAttribute('data-bytes','0');await expect(panel(page)).toHaveAttribute('data-mode','original');
});

test('missing Web Audio retains original and failed lazy download retries on reopening',async({page})=>{
  await page.addInitScript(()=>{window.AudioContext=undefined;window.webkitAudioContext=undefined;});await fixture(page);let failed=false;await page.route(/audio-memory.*\.js/,r=>{if(!failed){failed=true;return r.abort();}return r.continue();});await page.goto('/labs/#audio-experiments');await page.getByRole('button',{name:'Open Memory & fragments ↗'}).click();await expect(page.getByText(/could not load|couldn’t load|unable to load/i)).toBeVisible();await page.getByRole('button',{name:/Back to Labs|Close/i}).first().click();await page.getByRole('button',{name:'Open Memory & fragments ↗'}).click();await page.getByRole('button',{name:'Open live fragment study'}).click();
  await page.getByRole('button',{name:'Play source',exact:true}).click();await expect(panel(page)).toHaveAttribute('data-playing','true');await expect(page.getByRole('button',{name:'Start recent listening',exact:true})).toBeDisabled();await expect(page.getByText(/Source capture unavailable/)).toBeVisible();
});
