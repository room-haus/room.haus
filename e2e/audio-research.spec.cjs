const {test,expect}=require('@playwright/test');
const {fixture}=require('./helpers/rally-media.cjs');
const {moduleUrl}=require('./helpers/research-module.cjs');
const path=require('node:path');
const panel=page=>page.locator('[data-audio-research]');
async function open(page,{guardFailure=false}={}){
  await fixture(page);
  await page.addInitScript(guardFailure=>{
    window.__researchContexts=[];window.__researchAnalysers=[];const Native=window.AudioContext;
    if(Native)window.AudioContext=function(...args){const c=new Native(...args);window.__researchContexts.push(c);
      const create=c.createAnalyser.bind(c);c.createAnalyser=()=>{const node=create();window.__researchAnalysers.push(node);return node;};
      if(guardFailure)c.audioWorklet.addModule=()=>Promise.reject(Error('deliberate guard initialization failure'));
      return c;};
  },guardFailure);
  await page.goto('/labs/#audio-experiments');await page.getByRole('button',{name:'Open Audio routing check ↗'}).click();
  await expect(panel(page)).toBeVisible();
}
async function play(page){await page.getByRole('button',{name:'Play source',exact:true}).click();await expect(panel(page)).toHaveAttribute('data-playing','true');}
test('reference processor changes real output; Original, Stop and Reset preserve one source transport',async({page,browserName})=>{
  await open(page);await play(page);
  // The fixture is native HLS on WebKit; preservation is covered separately below.
  test.skip(browserName==='webkit','Native HLS intentionally bypasses Web Audio.');
  await expect(panel(page)).toHaveAttribute('data-capable','true');
  const before=await page.evaluate(()=>({time:window.__rallyMedia[0].currentTime,rate:window.__rallyMedia[0].playbackRate}));
  await page.getByRole('button',{name:'Processed',exact:true}).click();await expect(panel(page)).toHaveAttribute('data-mode','processed');
  await expect.poll(async()=>Number(await panel(page).getAttribute('data-output-rms'))).toBeGreaterThan(0);
  await page.getByRole('button',{name:'Original',exact:true}).click();await expect(panel(page)).toHaveAttribute('data-mode','original');
  await page.getByRole('button',{name:'Processed',exact:true}).click();await page.getByRole('button',{name:'Quiet kit hit',exact:true}).click();
  await page.getByRole('button',{name:'Stop effects',exact:true}).click();await expect(panel(page)).toHaveAttribute('data-voices','0');
  await page.getByRole('button',{name:'Reset effect',exact:true}).click();
  const after=await page.evaluate(()=>({time:window.__rallyMedia[0].currentTime,rate:window.__rallyMedia[0].playbackRate,count:window.__rallyMedia.length,contexts:window.__researchContexts.length}));
  expect(after.time).toBeGreaterThan(before.time);expect(after.rate).toBe(before.rate);expect(after.count).toBe(1);expect(after.contexts).toBe(1);
});
test('pause, seek, hidden tab, failure and retry require deliberate re-arm; close/reopen releases owner',async({page,browserName})=>{
  await open(page);await play(page);
  if(browserName!=='webkit'){
    await expect(panel(page)).toHaveAttribute('data-capable','true');
    await page.getByRole('button',{name:'Processed',exact:true}).click();
    await page.getByRole('button',{name:'Pause source',exact:true}).click();await expect(panel(page)).toHaveAttribute('data-mode','original');
    await page.getByRole('button',{name:'Play source',exact:true}).click();await expect(panel(page)).toHaveAttribute('data-mode','original');
    await page.getByRole('button',{name:'Processed',exact:true}).click();await page.getByRole('slider',{name:'Source position'}).fill('30');await expect(panel(page)).toHaveAttribute('data-mode','original');
    await page.getByRole('button',{name:'Processed',exact:true}).click();
    await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});await expect(panel(page)).toHaveAttribute('data-mode','original');
    await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});document.dispatchEvent(new Event('visibilitychange'));});
  }
  await page.evaluate(()=>window.__rallyMedia.at(-1).dispatchEvent(new Event('error')));await expect(page.getByRole('button',{name:'Retry source'})).toBeVisible();
  await page.getByRole('button',{name:'Retry source'}).click();await expect(panel(page)).toHaveAttribute('data-playing','true');await expect(panel(page)).toHaveAttribute('data-mode','original');
  for(let i=0;i<3;i++){
    await page.getByRole('button',{name:'Back to Labs'}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(await page.evaluate(()=>window.__rallyMedia.every(m=>m.paused&&!m.getAttribute('src')))).toBe(true);
    await expect.poll(()=>page.evaluate(()=>window.__researchContexts.every(c=>c.state==='closed'))).toBe(true);
    if(i<2){await page.getByRole('button',{name:'Open Audio routing check ↗'}).click();await play(page);}
  }
  await expect(page.getByRole('button',{name:'Open Audio routing check ↗'})).toBeFocused();
});
test('unavailable processing preserves native playback and explains disabled controls',async({page})=>{
  await page.addInitScript(()=>{window.AudioContext=undefined;window.webkitAudioContext=undefined;});await open(page);await play(page);
  await expect(panel(page)).toHaveAttribute('data-capable','false');await expect(page.getByRole('button',{name:'Processed',exact:true})).toBeDisabled();
  await expect(panel(page).locator('p[role=status]')).toContainText('Original playback is preserved');await expect.poll(()=>page.evaluate(()=>window.__rallyMedia[0].currentTime)).toBeGreaterThan(0);
});
test('sound-first controls reflow at 390/768/1440 and 200% text, with reduced motion and keyboard',async({page})=>{
  await open(page);const errors=[];page.on('pageerror',e=>errors.push(e.message));
  for(const width of [390,768,1440]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.querySelector('dialog').scrollWidth<=document.documentElement.clientWidth)).toBe(true);await page.screenshot({path:`artifacts/audio-research/controls-${test.info().project.name}-${width}.png`,fullPage:true});}
  await page.setViewportSize({width:390,height:844});await page.addStyleTag({content:'html{font-size:200%!important}'});
  expect(await page.evaluate(()=>document.querySelector('dialog').scrollWidth<=document.documentElement.clientWidth)).toBe(true);
  await page.getByRole('button',{name:'Play source',exact:true}).focus();await page.keyboard.press('Space');await expect(panel(page)).toHaveAttribute('data-playing','true');
  await page.screenshot({path:'artifacts/audio-research/controls-mobile-200.png',fullPage:true});expect(errors).toEqual([]);
});

test('real guarded output has one dry path, measurable processing, finite bounds, capture cancellation and silent additions after stop',async({page})=>{
  await page.goto('/labs/');
  const urls={owner:moduleUrl(path.resolve(__dirname,'../src/experiences/shared/audio/research/ResearchAudio.ts')),reference:moduleUrl(path.resolve(__dirname,'../src/experiences/shared/audio/research/reference.ts'))};
  const result=await page.evaluate(async urls=>{
    const {ResearchAudio}=await import(urls.owner),{referenceProcessor}=await import(urls.reference);
    const context=new AudioContext();await context.resume();
    const osc=context.createOscillator(),gain=context.createGain();osc.frequency.value=4400;gain.gain.value=.2;osc.connect(gain);osc.start();
    const research=new ResearchAudio(()=>({playing:true,status:'playing',time:context.currentTime}));research.attach(context,gain);research.sync({playing:true,status:'playing',time:0});
    const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
    for(let i=0;i<100&&!research.diagnostics().processing;i++)await wait(20);
    const rms=buffer=>Math.sqrt(buffer.getChannelData(0).reduce((sum,v)=>sum+v*v,0)/buffer.length);
    const capture=async()=>{research.startCapture(.25,'output');await wait(300);return research.capture(.2);};
    const original=await capture();research.install('processor',referenceProcessor);research.setLevel(1);research.arm();await wait(50);const processed=await capture();
    research.original();await wait(50);const bypass=await capture();
    research.arm();const buffer=context.createBuffer(1,context.sampleRate,context.sampleRate);buffer.getChannelData(0).fill(.3);
    let voices=0;for(let i=0;i<20;i++)if(research.playBuffer(buffer,context.currentTime+.08,.2))voices++;
    research.stop();research.arm();const acceptsRetiringOverflow=research.playBuffer(buffer,context.currentTime,.2);research.stop();await wait(100);const stopped=await capture();
    research.startCapture(8);const pending=research.capture(1);research.stop();const cancelled=await pending;
    research.sync({status:'loading',playing:true,time:context.currentTime});const armsDuringBuffering=research.arm(),capturesDuringBuffering=research.startCapture();research.stop();research.sync({status:'playing',playing:true,time:context.currentTime});
    research.install('processor',()=>{throw Error('deliberate module failure');});const failure=research.arm(),modeAfterFailure=research.diagnostics().mode;
    research.install('processor',({context,own})=>{const g=own(context.createGain());g.gain.value=100;return {input:g,output:g};});research.setLevel(1);research.arm();await wait(30);const limited=await capture();
    const peak=Math.max(...limited.getChannelData(0).map(Math.abs));
    const results={original:rms(original),processed:rms(processed),bypass:rms(bypass),stopped:rms(stopped),voices,acceptsRetiringOverflow,armsDuringBuffering,capturesDuringBuffering,cancelled:cancelled===null,failure,modeAfterFailure,peak,finite:limited.getChannelData(0).every(Number.isFinite),capabilities:research.diagnostics()};
    research.dispose();osc.stop();osc.disconnect();gain.disconnect();await context.close();return results;
  },urls);
  expect(result.original).toBeCloseTo(.2*.5/Math.sqrt(2),3);expect(result.bypass).toBeCloseTo(result.original,3);expect(result.stopped).toBeCloseTo(result.original,3);
  expect(result.processed).toBeLessThan(result.original*.1);expect(result.voices).toBe(16);expect(result.cancelled).toBe(true);expect(result.failure).toBe(false);expect(result.modeAfterFailure).toBe('original');expect(result.finite).toBe(true);expect(result.peak).toBeLessThanOrEqual(.981);
  expect(result.acceptsRetiringOverflow).toBe(false);expect(result.armsDuringBuffering).toBe(false);expect(result.capturesDuringBuffering).toBe(false);
  require('node:fs').mkdirSync('artifacts/audio-research',{recursive:true});require('node:fs').writeFileSync(`artifacts/audio-research/real-graph-${test.info().project.name}.json`,JSON.stringify(result,null,2));
});

test('failed worklet initialization keeps one measured audible Original path',async({page,browserName})=>{
  test.skip(browserName==='webkit','Native WebKit HLS does not request a worklet.');
  await open(page,{guardFailure:true});await play(page);
  await expect(panel(page).locator('p[role=status]')).toContainText('Original playback is preserved');await expect(page.getByRole('button',{name:'Processed',exact:true})).toBeDisabled();
  await expect.poll(()=>page.evaluate(()=>window.__rallyMedia[0].currentTime)).toBeGreaterThan(0);
  expect(await page.evaluate(()=>window.__researchContexts.length)).toBe(1);
  await expect.poll(()=>page.evaluate(()=>{const node=window.__researchAnalysers.find(n=>n.fftSize===256);if(!node)return 0;const data=new Float32Array(node.fftSize);node.getFloatTimeDomainData(data);return Math.sqrt(data.reduce((sum,v)=>sum+v*v,0)/data.length);})).toBeGreaterThan(.01);
});

test('native WebKit HLS retains native output and exposes capabilities separately from playback',async({page,browserName})=>{
  test.skip(browserName!=='webkit','WebKit-specific native HLS preservation.');await open(page);await play(page);
  await expect(panel(page)).toHaveAttribute('data-capable','false');await expect(page.getByRole('button',{name:'Processed',exact:true})).toBeDisabled();
  expect(await page.evaluate(()=>window.__researchContexts.length)).toBe(0);await expect.poll(()=>page.evaluate(()=>window.__rallyMedia[0].currentTime)).toBeGreaterThan(0);
  await expect(panel(page).locator('p[role=status]')).toContainText('Original playback is preserved');
});
