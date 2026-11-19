const {test,expect}=require('@playwright/test');
const {moduleUrl}=require('./helpers/research-module.cjs');
const {fixture}=require('./helpers/rally-media.cjs');
const path=require('node:path'),fs=require('node:fs');
const root='artifacts/audio-structure',panel=p=>p.locator('[data-audio-research]'),action=p=>p.locator('[data-structure]');
const urls=()=>({owner:moduleUrl(path.resolve(__dirname,'../src/experiences/shared/audio/research/ResearchAudio.ts')),structure:moduleUrl(path.resolve(__dirname,'../src/experiences/audio-structure/intervention.ts'))});
async function open(page){await fixture(page);await page.goto('/labs/#audio-experiments');await page.getByRole('button',{name:'Open Structural intervention ↗'}).click();await expect(panel(page)).toBeVisible();}

test('launcher supports bounded keyboard holds, release, cancellation, source invariance and mobile reflow',async({page})=>{
  await page.addInitScript(()=>sessionStorage.setItem('room-labs-session','open'));await page.goto('/labs/#audio-experiments');
  await page.getByRole('button',{name:'Open Structural intervention ↗'}).click();await page.getByRole('combobox',{name:'Listening source'}).selectOption('loop');await page.getByRole('button',{name:'Play source',exact:true}).click();
  const thin=page.getByRole('button',{name:'Hold to thin',exact:true});await expect(thin).toBeEnabled();
  await thin.focus();await page.keyboard.down('Space');await expect(action(page)).toHaveAttribute('data-kind','thin');await page.keyboard.down('Space');
  await expect(action(page)).toHaveAttribute('data-active','false',{timeout:3500});await page.keyboard.up('Space');await expect(panel(page)).toHaveAttribute('data-mode','original');
  await thin.focus();await page.keyboard.down('Enter');await expect(action(page)).toHaveAttribute('data-active','true');await page.keyboard.up('Enter');await expect(action(page)).toHaveAttribute('data-active','false');
  await page.waitForTimeout(60);await thin.focus();await page.keyboard.down('Space');await page.getByRole('button',{name:'Original',exact:true}).focus();await expect(action(page)).toHaveAttribute('data-active','false');await page.keyboard.up('Space');
  await page.getByRole('button',{name:'Listen for fragment',exact:true}).click();await expect(page.getByRole('button',{name:'Hold to repeat',exact:true})).toBeEnabled();
  const repeat=page.getByRole('button',{name:'Hold to repeat',exact:true});await repeat.focus();await page.keyboard.down('Space');await expect(action(page)).toHaveAttribute('data-kind','stutter');await page.keyboard.up('Space');await expect(action(page)).toHaveAttribute('data-active','false');
  fs.mkdirSync(root,{recursive:true});for(const width of [390,768,1440]){await page.setViewportSize({width,height:1000});expect(await panel(page).evaluate(e=>e.scrollWidth<=e.clientWidth+1)).toBe(true);await page.locator('dialog').screenshot({path:`${root}/controls-${test.info().project.name}-${width}.png`});}
  await page.emulateMedia({reducedMotion:'reduce'});await page.setViewportSize({width:390,height:844});await page.addStyleTag({content:'html{font-size:200%!important}'});expect(await panel(page).evaluate(e=>e.scrollWidth<=e.clientWidth+1)).toBe(true);
  await page.getByRole('button',{name:'Back to Labs'}).click();await expect(page.getByRole('button',{name:'Open Structural intervention ↗'})).toBeFocused();
});

test('each action preserves real source time/rate and stops for pause, seek, buffering, bypass and close',async({page,browserName})=>{
  await open(page);await page.getByRole('button',{name:'Play source',exact:true}).click();await expect(panel(page)).toHaveAttribute('data-playing','true');
  if(browserName==='webkit'){await expect(page.getByRole('button',{name:'Hold to thin',exact:true})).toBeDisabled();await expect(action(page)).toContainText('unavailable');expect(await page.evaluate(()=>window.__rallyMedia[0].paused)).toBe(false);await page.getByRole('combobox',{name:'Listening source'}).selectOption('loop');await page.getByRole('button',{name:'Play source',exact:true}).click();}
  const events=[];
  for(const kind of ['repeat','thin','fill'])for(const event of ['release','pause','seek','buffering','Original','Stop effects','Reset effect','close']){
    if(kind==='repeat'){await page.getByRole('button',{name:'Listen for fragment',exact:true}).click();await expect(page.getByRole('button',{name:'Hold to repeat',exact:true})).toBeEnabled();}
    const button=page.getByRole('button',{name:`Hold to ${kind}`,exact:true});await expect(button).toBeEnabled();await button.focus();const before=await page.evaluate(()=>({time:window.__rallyMedia.at(-1).currentTime,rate:window.__rallyMedia.at(-1).playbackRate,wall:performance.now()}));await page.keyboard.down('Space');await expect(action(page),kind+'/'+event).toHaveAttribute('data-active','true');await expect(action(page),kind+'/'+event).toHaveAttribute('data-pending','false');
    if(event==='release')await page.keyboard.up('Space');
    else if(event==='pause')await page.getByRole('button',{name:'Pause source',exact:true}).evaluate(e=>e.click());
    else if(event==='seek')await page.evaluate(()=>{window.__rallyMedia.at(-1).currentTime=30;});
    else if(event==='buffering')await page.evaluate(()=>window.__rallyMedia.at(-1).dispatchEvent(new Event('waiting')));
    else if(event==='close')await page.getByRole('button',{name:'Back to Labs'}).evaluate(e=>e.click());
    else await page.getByRole('button',{name:event,exact:true}).evaluate(e=>e.click());
    await page.keyboard.up('Space');
    if(event==='close'){
      expect(await page.evaluate(()=>window.__rallyMedia.every(m=>m.paused&&!m.getAttribute('src')))).toBe(true);await page.getByRole('button',{name:'Open Structural intervention ↗'}).click();if(browserName==='webkit')await page.getByRole('combobox',{name:'Listening source'}).selectOption('loop');await page.getByRole('button',{name:'Play source',exact:true}).click();
    }else{
      await expect(action(page)).toHaveAttribute('data-active','false');await expect(panel(page)).toHaveAttribute('data-mode','original');
      const after=await page.evaluate(()=>({time:window.__rallyMedia.at(-1).currentTime,rate:window.__rallyMedia.at(-1).playbackRate,wall:performance.now()}));expect(after.rate).toBe(before.rate);if(event!=='seek'){expect(after.time).toBeGreaterThanOrEqual(before.time);expect(Math.abs(after.time-before.time-(after.wall-before.wall)/1000)).toBeLessThan(.3);}else expect(Math.abs(after.time-30)).toBeLessThan(.3);events.push({kind,event,before,after});
      if(event==='pause')await page.getByRole('button',{name:'Play source',exact:true}).click();if(event==='buffering')await page.evaluate(()=>window.__rallyMedia.at(-1).dispatchEvent(new Event('playing')));
    }
    await page.waitForTimeout(80);
  }
  fs.mkdirSync(root,{recursive:true});fs.writeFileSync(`${root}/transport-${test.info().project.name}.json`,JSON.stringify(events,null,2));
});

test('actual guarded signals return to unity after all interventions and a stalled JS thread',async({page})=>{
  await page.goto('/labs/');
  const results=await page.evaluate(async urls=>{
    const {ResearchAudio}=await import(urls.owner),{StructureIntervention}=await import(urls.structure),context=new AudioContext({sampleRate:24000});await context.resume();
    const tone=context.createOscillator(),input=context.createGain();tone.frequency.value=317;input.gain.value=.2;tone.connect(input);tone.start();
    let state={status:'playing',playing:true};const owner=new ResearchAudio(()=>({...state,time:context.currentTime}));owner.attach(context,input);owner.sync({...state,time:context.currentTime});
    const wait=ms=>new Promise(r=>setTimeout(r,ms));for(let i=0;i<100&&!owner.diagnostics().capture;i++)await wait(20);
    const effect=new StructureIntervention(owner);owner.install('processor',effect.factory);owner.setLevel(1);const results=[];
    const rms=b=>Math.sqrt(b.getChannelData(0).reduce((s,v)=>s+v*v,0)/b.length);
    for(const kind of ['stutter','thin','fill']){
      if(kind==='stutter'){effect.listen();await wait(200);}effect.press(kind,.5);await wait(35);
      if(kind==='stutter')input.gain.value=0; // Only the captured fragment can now be audible.
      owner.startCapture(2,'output');await wait(180);const active=await owner.capture(.1);if(!active)throw Error('Missing active output');
      input.gain.value=.2;
      const blocked=performance.now();while(performance.now()-blocked<700){/* Stall across the deadline. */}
      await wait(100);const returned=await owner.capture(.15); // cleanup clears ring; explicitly start a new diagnostic read below
      void returned;owner.startCapture(.3,'output');await wait(250);const original=await owner.capture(.15);if(!original)throw Error('Missing original output');
      const effectState=effect.snapshot();results.push({intervention:kind,activeRms:rms(active),original:rms(original),...owner.diagnostics(),...effectState});await wait(70);
    }
    owner.dispose();effect.dispose();tone.stop();await context.close();return results;
  },urls());
  fs.mkdirSync(root,{recursive:true});fs.writeFileSync(`${root}/guarded-${test.info().project.name}.json`,JSON.stringify(results,null,2));
  for(const r of results){expect(r.original,r.intervention).toBeCloseTo(.0707107,3);expect(r.activeRms,r.intervention).toBeGreaterThan(r.intervention==='stutter'?.03:.001);expect(r.activeRms,r.intervention).toBeLessThan(r.intervention==='thin'?.067:r.intervention==='fill'?.035:.15);expect(r.mode,r.intervention).toBe('original');expect(r.voices).toBe(0);expect(r.active).toBe(false);expect(r.bytes).toBe(0);}
});

test('pointer owner rejects overlap and ignores stale release; cancellation and window blur end output',async({page})=>{
  await open(page);await page.getByRole('combobox',{name:'Listening source'}).selectOption('tone');await page.getByRole('button',{name:'Play source',exact:true}).click();const thin=page.getByRole('button',{name:'Hold to thin',exact:true});await expect(thin).toBeEnabled();
  await thin.dispatchEvent('pointerdown',{pointerId:21,pointerType:'touch',button:0,isPrimary:true});await expect(action(page)).toHaveAttribute('data-kind','thin');
  const fill=page.getByRole('button',{name:'Hold to fill',exact:true});await fill.dispatchEvent('pointerdown',{pointerId:22,pointerType:'touch',button:0,isPrimary:false});await fill.dispatchEvent('pointerup',{pointerId:22,pointerType:'touch'});await expect(action(page)).toHaveAttribute('data-kind','thin');
  await thin.dispatchEvent('pointercancel',{pointerId:21,pointerType:'touch'});await expect(action(page)).toHaveAttribute('data-active','false');await page.waitForTimeout(70);
  await fill.dispatchEvent('pointerdown',{pointerId:23,pointerType:'touch',button:0,isPrimary:true});await thin.dispatchEvent('pointerup',{pointerId:21,pointerType:'touch'});await expect(action(page)).toHaveAttribute('data-kind','fill');await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await expect(action(page)).toHaveAttribute('data-active','false');
});

test('audio-thread envelope is smooth and restores the source even without a cleanup timer',async({page})=>{
  await page.goto('/labs/');
  const result=await page.evaluate(async urls=>{
    const {StructureIntervention}=await import(urls.structure),rate=24000,context=new OfflineAudioContext(1,rate,rate),source=context.createConstantSource();source.offset.value=.2;
    let effect;const owner={context,diagnostics:()=>({generation:0}),arm:()=>true,clearCapture(){},stop(){}};effect=new StructureIntervention(owner);
    const nodes=[],module=effect.factory({context,own:n=>{nodes.push(n);return n;}});source.connect(module.input);module.output.connect(context.destination);source.start();effect.press('thin',.5);
    const data=(await context.startRendering()).getChannelData(0),maxStep=data.reduce((p,v,i)=>i?Math.max(p,Math.abs(v-data[i-1])):p,0),tail=Array.from(data.subarray(rate*.6)),bodyMin=Math.min(...data.subarray(3000,10000));effect.dispose();return {maxStep,bodyMin,tailMin:Math.min(...tail),tailMax:Math.max(...tail)};
  },urls());
  expect(result.maxStep).toBeLessThan(.002);expect(result.bodyMin).toBeLessThan(.05);expect(result.tailMin).toBeCloseTo(.2,6);expect(result.tailMax).toBeCloseTo(.2,6);
});

test('missing Web Audio and failed lazy download retain original playback and retry',async({page})=>{
  await page.addInitScript(()=>{window.AudioContext=undefined;window.webkitAudioContext=undefined;});await fixture(page);let failed=false;await page.route(/audio-structure.*\.js/,r=>{if(!failed){failed=true;return r.abort();}return r.continue();});await page.goto('/labs/#audio-experiments');await page.getByRole('button',{name:'Open Structural intervention ↗'}).click();await expect(page.getByText(/could not load|couldn’t load|unable to load/i)).toBeVisible();await page.getByRole('button',{name:/Back to Labs|Close/i}).first().click();await page.getByRole('button',{name:'Open Structural intervention ↗'}).click();
  await page.getByRole('button',{name:'Play source',exact:true}).click();await expect(page.getByRole('button',{name:'Hold to fill',exact:true})).toBeDisabled();expect(await page.evaluate(()=>window.__rallyMedia[0].paused)).toBe(false);
});
