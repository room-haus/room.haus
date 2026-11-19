const {test,expect}=require('@playwright/test');
const {moduleUrl}=require('./helpers/research-module.cjs');
const {fixture}=require('./helpers/rally-media.cjs');
const path=require('node:path'),fs=require('node:fs');
const root='artifacts/audio-atmosphere';
const panel=page=>page.locator('[data-audio-research]');
async function open(page){await fixture(page);await page.goto('/labs/#audio-experiments');await page.getByRole('button',{name:'Open Atmospheric layers ↗'}).click();await expect(panel(page)).toBeVisible();}

test('real sustained materials have finite bounds, slow onset, manual tuning and bounded disposal',async({page})=>{
  await page.goto('/labs/');
  const url=moduleUrl(path.resolve(__dirname,'../src/experiences/audio-atmosphere/layer.ts'));
  const results=await page.evaluate(async url=>{
    const {atmosphereLayer}=await import(url),rate=24000;
    async function render(params,stop=0){
      const context=new OfflineAudioContext(1,rate*18,rate),nodes=[],sources=[];
      const module=atmosphereLayer({context,own:n=>{nodes.push(n);if('start' in n)sources.push(n);return n;},clock:{}});
      module.update(params);module.output.connect(context.destination);
      if(stop){const suspended=context.suspend(stop);suspended.then(()=>{module.dispose();context.resume();});}
      const data=(await context.startRendering()).getChannelData(0),rms=(a,b)=>{const v=data.subarray(a*rate,b*rate);return Math.sqrt(v.reduce((s,x)=>s+x*x,0)/v.length);};
      let crossings=0;for(let i=rate*3;i<rate*4;i++)if(data[i-1]<=0&&data[i]>0)crossings++;
      const r={finite:data.every(Number.isFinite),peak:data.reduce((p,v)=>Math.max(p,Math.abs(v)),0),onset:rms(0,.1),steady:rms(3,4),late:rms(16,17),afterStop:rms(5,6),crossings,sources:sources.length,nodes:nodes.length,maxStep:data.reduce((p,v,i)=>i?Math.max(p,Math.abs(v-data[i-1])):p,0)};
      module.dispose();nodes.forEach(n=>n.disconnect());return r;
    }
    return {noise:await render({texture:0,brightness:900,movement:.2,tuning:110}),tone:await render({texture:1,brightness:1200,movement:0,tuning:110}),higher:await render({texture:1,tuning:220}),invalid:await render({texture:Infinity,brightness:NaN,movement:-100,tuning:1e9}),stopped:await render({texture:1},4),bright:await render({texture:0,brightness:5000,movement:1})};
  },url);
  fs.mkdirSync(root,{recursive:true});fs.writeFileSync(`${root}/dsp-${test.info().project.name}.json`,JSON.stringify(results,null,2));
  for(const r of Object.values(results)){expect(r.finite).toBe(true);expect(r.peak).toBeLessThan(.4);expect(r.sources).toBe(3);expect(r.nodes).toBeLessThanOrEqual(10);expect(r.onset).toBeLessThan(r.steady*.15);}
  expect(results.noise.steady).toBeGreaterThan(.008);expect(results.tone.steady).toBeGreaterThan(.02);
  expect(results.tone.crossings).toBeGreaterThanOrEqual(109);expect(results.tone.crossings).toBeLessThanOrEqual(111);expect(results.higher.crossings).toBeGreaterThanOrEqual(219);expect(results.higher.crossings).toBeLessThanOrEqual(221);
  expect(results.noise.late/results.noise.steady).toBeGreaterThan(.7);expect(results.noise.late/results.noise.steady).toBeLessThan(1.3);expect(results.bright.steady).toBeGreaterThan(results.noise.steady*1.3);
  expect(results.stopped.afterStop).toBe(0);expect(results.tone.maxStep).toBeLessThan(.002);
});

test('actual guarded layer is audible and every interruption removes sources and residual output',async({page})=>{
  await page.goto('/labs/');
  const result=await page.evaluate(async urls=>{
    const {ResearchAudio}=await import(urls.owner),{atmosphereLayer}=await import(urls.layer);
    const context=new AudioContext({sampleRate:24000});await context.resume();const silent=context.createConstantSource();silent.offset.value=0;silent.start();
    let state={status:'playing',playing:true,time:0};const owner=new ResearchAudio(()=>({...state,time:context.currentTime}));owner.attach(context,silent);owner.sync(state);
    const wait=ms=>new Promise(r=>setTimeout(r,ms));for(let i=0;i<100&&!owner.diagnostics().layering;i++)await wait(20);
    const active=new Set();let maximum=0,created=0;
    owner.install('layer',scope=>atmosphereLayer({...scope,own:n=>{scope.own(n);if('start' in n){created++;active.add(n);maximum=Math.max(maximum,active.size);n.onended=()=>active.delete(n);}return n;}}));
    owner.update('layer',{texture:1,tuning:110});owner.setLevel(.5);
    const capture=async()=>{owner.startCapture(.5,'output');await wait(220);const b=await owner.capture(.12);if(!b)throw Error('Capture unavailable');const d=b.getChannelData(0);return {rms:Math.sqrt(d.reduce((s,v)=>s+v*v,0)/d.length),peak:d.reduce((p,v)=>Math.max(p,Math.abs(v)),0),finite:d.every(Number.isFinite)};};
    if(!owner.arm())throw Error('Cannot arm');for(let i=0;i<20;i++)owner.arm();await wait(2100);const audible=await capture(),initialCreated=created;
    // Live edit starts a long tuning ramp, then Stop must defeat it.
    owner.update('layer',{texture:1,tuning:880});owner.stop();await wait(80);const stopped=await capture(),afterStop=active.size;
    const events=[];
    for(const event of ['reset','buffering','seek','hidden','suspend']){
      state={status:'playing',playing:true,time:context.currentTime};owner.sync(state);if(!owner.arm())throw Error('Rearm failed');
      if(event==='reset')owner.reset();
      if(event==='buffering')owner.sync({status:'buffering',playing:true,time:context.currentTime});
      if(event==='seek')owner.stop('Source seeking; effects stopped.');
      if(event==='hidden'){Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));}
      if(event==='suspend'){await context.suspend();await wait(60);await context.resume();}
      await wait(80);events.push({event,active:active.size,mode:owner.diagnostics().mode,modules:owner.diagnostics().modules});
      if(event==='hidden'){Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));}
      state={status:'playing',playing:true,time:context.currentTime};owner.sync(state);
    }
    owner.arm();owner.dispose();await wait(30);const closedActive=active.size;silent.stop();await context.close();
    return {audible,stopped,afterStop,initialCreated,maximum,events,closedActive,context:context.state};
  },{owner:moduleUrl(path.resolve(__dirname,'../src/experiences/shared/audio/research/ResearchAudio.ts')),layer:moduleUrl(path.resolve(__dirname,'../src/experiences/audio-atmosphere/layer.ts'))});
  fs.mkdirSync(root,{recursive:true});fs.writeFileSync(`${root}/guarded-${test.info().project.name}.json`,JSON.stringify(result,null,2));
  expect(result.audible.finite).toBe(true);expect(result.audible.rms).toBeGreaterThan(.003);expect(result.audible.peak).toBeLessThan(.02);expect(result.stopped.rms).toBeLessThan(.000001);expect(result.afterStop).toBe(0);expect(result.initialCreated).toBe(3);expect(result.maximum).toBe(3);
  for(const r of result.events){expect(r.active,r.event).toBe(0);expect(r.modules,r.event).toBe(0);expect(r.mode,r.event).toBe('original');}expect(result.closedActive).toBe(0);expect(result.context).toBe('closed');
});

test('host keeps source continuity, resets settings and disposes on close with native fallback',async({page,browserName})=>{
  await open(page);await expect(panel(page)).toHaveAttribute('data-mode','original');await page.getByRole('button',{name:'Play source',exact:true}).click();await expect(panel(page)).toHaveAttribute('data-playing','true');
  if(browserName==='webkit'){await expect(page.getByRole('button',{name:'Start layer',exact:true})).toBeDisabled();await expect(panel(page).locator('[role=status]')).toContainText('Original playback is preserved');}
  else{
    await expect(panel(page)).toHaveAttribute('data-capable','true');await page.getByRole('button',{name:'Warm floor',exact:true}).click();await page.getByRole('spinbutton',{name:'Manual tuning (Hz)'}).fill('113');await page.getByRole('button',{name:'Start layer',exact:true}).click();await expect(panel(page)).toHaveAttribute('data-mode','processed');
    const before=await page.evaluate(()=>window.__rallyMedia[0].currentTime);await page.getByRole('button',{name:'Original',exact:true}).click();await expect(panel(page)).toHaveAttribute('data-mode','original');await expect.poll(()=>page.evaluate(()=>window.__rallyMedia[0].currentTime)).toBeGreaterThan(before);expect(await page.evaluate(()=>window.__rallyMedia.length)).toBe(1);
    await page.getByRole('button',{name:'Start layer',exact:true}).click();await page.getByRole('button',{name:'Pause source',exact:true}).click();await expect(panel(page)).toHaveAttribute('data-mode','original');await page.getByRole('button',{name:'Play source',exact:true}).click();await expect(panel(page)).toHaveAttribute('data-mode','original');
    await page.getByRole('button',{name:'Start layer',exact:true}).click();await page.getByRole('slider',{name:'Source position'}).fill('30');await expect(panel(page)).toHaveAttribute('data-mode','original');
    await page.getByRole('button',{name:'Reset effect',exact:true}).click();await expect(page.getByRole('slider',{name:'Texture',exact:true})).toHaveValue('0');await expect(page.getByRole('slider',{name:'Brightness'})).toHaveValue('900');await expect(page.getByRole('spinbutton',{name:'Manual tuning (Hz)'})).toHaveValue('110');
    await page.getByRole('button',{name:'Start layer',exact:true}).click();await page.getByRole('button',{name:'Stop effects',exact:true}).click();await expect(panel(page)).toHaveAttribute('data-mode','original');await expect(panel(page)).toHaveAttribute('data-playing','true');
  }
  await page.getByRole('button',{name:'Back to Labs'}).click();await expect(page.getByRole('button',{name:'Open Atmospheric layers ↗'})).toBeFocused();expect(await page.evaluate(()=>window.__rallyMedia.every(m=>m.paused&&!m.getAttribute('src')))).toBe(true);
  await page.getByRole('button',{name:'Open Atmospheric layers ↗'}).click();await expect(panel(page)).toHaveAttribute('data-mode','original');await expect(panel(page)).toHaveAttribute('data-playing','false');
});

test('keyboard, three layouts, enlarged text and selected generated source work on each browser',async({page})=>{
  await page.addInitScript(()=>sessionStorage.setItem('room-labs-session','open'));await page.goto('/labs/#audio-experiments');await page.getByRole('button',{name:'Open Atmospheric layers ↗'}).focus();await page.keyboard.press('Enter');
  await page.getByRole('combobox',{name:'Listening source'}).selectOption('tone');await page.getByRole('button',{name:'Play source',exact:true}).click();await expect(panel(page)).toHaveAttribute('data-capable','true');await page.getByRole('button',{name:'Suspended',exact:true}).click();await page.getByRole('button',{name:'Start layer',exact:true}).click();await expect(panel(page)).toHaveAttribute('data-mode','processed');
  await page.getByRole('slider',{name:'Texture',exact:true}).focus();await page.keyboard.press('ArrowRight');await expect(page.getByRole('slider',{name:'Texture',exact:true})).toHaveValue('0.4');
  const tuning=page.getByRole('spinbutton',{name:'Manual tuning (Hz)'});await tuning.focus();await tuning.press('ControlOrMeta+A');await tuning.pressSequentially('220');await expect(tuning).toHaveValue('220');await tuning.press('Tab');
  await tuning.focus();await tuning.press('ControlOrMeta+A');await tuning.pressSequentially('220.5');await expect(tuning).toHaveValue('220.5');await tuning.press('Enter');
  await tuning.fill('');await tuning.press('Tab');await expect(tuning).toHaveValue('220.5');await tuning.fill('9000');await tuning.press('Tab');await expect(tuning).toHaveValue('880');
  await page.emulateMedia({reducedMotion:'reduce'});fs.mkdirSync(root,{recursive:true});
  for(const width of [390,768,1440]){
    await page.setViewportSize({width,height:1100});expect(await panel(page).evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
    expect(await page.getByRole('slider',{name:'Layer level'}).locator('..').evaluate(el=>el.getBoundingClientRect().height)).toBeLessThan(140);
    await page.locator('dialog').evaluate(d=>d.scrollTop=0);await page.locator('dialog').screenshot({path:`${root}/host-${test.info().project.name}-${width}.png`});
    await page.locator('.atmosphere-controls').scrollIntoViewIfNeeded();await page.locator('dialog').screenshot({path:`${root}/controls-${test.info().project.name}-${width}.png`});
  }
  await page.setViewportSize({width:390,height:844});await page.addStyleTag({content:'html{font-size:200%!important}'});expect(await panel(page).evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);await page.screenshot({path:`${root}/controls-${test.info().project.name}-200.png`,fullPage:true});
  await page.getByRole('button',{name:'Stop effects',exact:true}).click();await expect(panel(page)).toHaveAttribute('data-mode','original');
});

test('missing Web Audio and source error keep native playback and retry bypassed',async({page})=>{
  await page.addInitScript(()=>{window.AudioContext=undefined;window.webkitAudioContext=undefined;});await open(page);await page.getByRole('button',{name:'Play source',exact:true}).click();await expect(panel(page)).toHaveAttribute('data-playing','true');await expect(page.getByRole('button',{name:'Start layer',exact:true})).toBeDisabled();
  await page.evaluate(()=>window.__rallyMedia[0].dispatchEvent(new Event('error')));await expect(page.getByRole('button',{name:'Retry source',exact:true})).toBeVisible();await page.getByRole('button',{name:'Retry source',exact:true}).click();await expect(panel(page)).toHaveAttribute('data-playing','true');await expect(panel(page)).toHaveAttribute('data-mode','original');
  expect(await page.evaluate(()=>({count:window.__rallyMedia.length,paused:window.__rallyMedia[0].paused,src:window.__rallyMedia[0].getAttribute('src')}))).toEqual({count:2,paused:true,src:null});
});

test('failed lazy module download retries when reopened',async({page})=>{
  await fixture(page);let failed=false;await page.route(/audio-atmosphere.*\.js/,route=>{if(!failed){failed=true;return route.abort();}return route.continue();});await page.goto('/labs/#audio-experiments');await page.getByRole('button',{name:'Open Atmospheric layers ↗'}).click();await expect(page.getByText(/could not load|couldn’t load|unable to load/i)).toBeVisible();
  await page.getByRole('button',{name:/Back to Labs|Close/i}).first().click();await page.getByRole('button',{name:'Open Atmospheric layers ↗'}).click();await expect(panel(page)).toBeVisible();
});
