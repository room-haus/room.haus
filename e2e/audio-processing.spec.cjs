const {test,expect}=require('@playwright/test');
const {moduleUrl}=require('./helpers/research-module.cjs');
const {fixture}=require('./helpers/rally-media.cjs');
const path=require('node:path');
const fs=require('node:fs');
const panel=page=>page.locator('[data-audio-research]');
async function open(page){
  await fixture(page);await page.goto('/labs/#audio-experiments');
  await page.getByRole('button',{name:'Open Tone & texture ↗'}).click();
  await expect(panel(page)).toBeVisible();
}

test('actual processor renders identity, low-pass, bounded saturation, slow movement and smooth updates',async({page})=>{
  await page.goto('/labs/');
  const url=moduleUrl(path.resolve(__dirname,'../src/experiences/audio-processing/processor.ts'));
  const result=await page.evaluate(async url=>{
    const {processingProcessor}=await import(url);
    const rate=48000,seconds=2;
    const stats=data=>({rms:Math.sqrt(data.reduce((s,v)=>s+v*v,0)/data.length),peak:data.reduce((p,v)=>Math.max(p,Math.abs(v)),0),finite:data.every(Number.isFinite)});
    const signal=(hz,amp=.2)=>Float32Array.from({length:rate*seconds},(_,i)=>amp*Math.sin(2*Math.PI*hz*i/rate));
    const render=async(data,params,change)=>{
      const context=new OfflineAudioContext(1,data.length,rate),nodes=[];
      const module=processingProcessor({context,own:n=>{nodes.push(n);return n;}});
      module.update(params);
      const source=context.createBufferSource();source.buffer=context.createBuffer(1,data.length,rate);source.buffer.copyToChannel(data,0);
      source.connect(module.input);module.output.connect(context.destination);source.start();
      if(change){const suspended=context.suspend(1);const rendered=context.startRendering();await suspended;module.update(change);await context.resume();const b=await rendered;module.dispose();nodes.forEach(n=>n.disconnect());return b.getChannelData(0);}
      const b=await context.startRendering();module.dispose();nodes.forEach(n=>n.disconnect());return b.getChannelData(0);
    };
    const identityInput=signal(733,.7),identity=await render(identityInput,{cutoff:18000,saturation:0,movement:0});
    const error=identity.reduce((max,v,i)=>Math.max(max,Math.abs(v-identityInput[i])),0);
    const tones=[];
    for(const hz of [100,1000,8000]){const data=signal(hz),out=await render(data,{cutoff:1000,saturation:0,movement:0});tones.push({hz,db:20*Math.log10(stats(out.slice(rate)).rms/stats(data.slice(rate)).rms)});}
    const input=signal(500,.9),soft=await render(input,{cutoff:18000,saturation:1,movement:0});
    const harmonic=(data,hz)=>{let s=0,c=0;for(let i=rate;i<data.length;i++){s+=data[i]*Math.sin(2*Math.PI*hz*i/rate);c+=data[i]*Math.cos(2*Math.PI*hz*i/rate);}return 2*Math.hypot(s,c)/(data.length-rate);};
    let seed=123;const noise=Float32Array.from({length:rate*seconds},()=>{seed=(1664525*seed+1013904223)>>>0;return (seed/2**32-.5)*.4;});
    const noiseOut=await render(noise,{cutoff:1000,saturation:0,movement:0});
    const dc=new Float32Array(rate*seconds).fill(.7),transition=await render(dc,{cutoff:18000,saturation:0,movement:0},{cutoff:200,saturation:1,movement:1});
    let step=0,stepIndex=0;for(let i=rate-10;i<rate+rate*.15;i++){const d=Math.abs(transition[i]-transition[i-1]);if(d>step){step=d;stepIndex=i;}}
    const extremes=[];
    for(const cutoff of [200,18000])for(const saturation of [0,1])for(const movement of [0,1])extremes.push(stats(await render(input,{cutoff,saturation,movement})));
    const movingInput=Float32Array.from({length:rate*8},(_,i)=>.2*Math.sin(2*Math.PI*2000*i/rate));
    const moving=await render(movingInput,{cutoff:2000,saturation:0,movement:1});
    return {identityMaxError:error,tones,saturation:{...stats(soft.slice(rate)),thirdRatio:harmonic(soft,1500)/harmonic(soft,500)},noiseRatio:stats(noiseOut).rms/stats(noise).rms,transitionMaxStep:step,stepIndex,transitionNearby:Array.from(transition.slice(stepIndex-3,stepIndex+4)),extremes,movementRatio:stats(moving.slice(rate*4,rate*5)).rms/stats(moving.slice(rate,rate*2)).rms};
  },url);
  fs.mkdirSync('artifacts/audio-processing',{recursive:true});fs.writeFileSync(`artifacts/audio-processing/dsp-${test.info().project.name}.json`,JSON.stringify(result,null,2));
  expect(result.identityMaxError).toBeLessThan(1e-6);
  expect(result.tones[0].db).toBeGreaterThan(-.3);expect(result.tones[1].db).toBeLessThan(-5.5);expect(result.tones[1].db).toBeGreaterThan(-6.5);expect(result.tones[2].db).toBeLessThan(-35);
  expect(result.saturation.thirdRatio).toBeGreaterThan(.03);expect(result.saturation.thirdRatio).toBeLessThan(.4);expect(result.saturation.peak).toBeLessThan(.4);
  expect(result.noiseRatio).toBeLessThan(.3);expect(result.transitionMaxStep).toBeLessThan(.01);
  for(const r of result.extremes){expect(r.finite).toBe(true);expect(r.peak).toBeLessThanOrEqual(.901);}
  expect(result.movementRatio).toBeGreaterThan(1.05);
});

test('processing controls preserve source and share pause, seek, reset, stop and close lifecycle',async({page,browserName})=>{
  await page.addInitScript(()=>{window.__processingContexts=[];const Native=window.AudioContext;if(Native)window.AudioContext=function(...args){const c=new Native(...args);window.__processingContexts.push(c);return c;};});
  await open(page);await expect(page.getByRole('heading',{name:'Clock check'})).toHaveCount(0);
  await page.getByRole('button',{name:'Play source',exact:true}).click();await expect(panel(page)).toHaveAttribute('data-playing','true');
  if(browserName==='webkit'){
    await expect(page.getByRole('button',{name:'Processed',exact:true})).toBeDisabled();
    await expect(panel(page).locator('[role=status]')).toContainText('Original playback is preserved');
    expect(await page.evaluate(()=>window.__processingContexts.length)).toBe(0);
  }else{
    await expect(panel(page)).toHaveAttribute('data-capable','true');
    const before=await page.evaluate(()=>window.__rallyMedia[0].currentTime);
    await page.getByRole('slider',{name:'Low-pass cutoff'}).fill('1000');
    await page.getByRole('slider',{name:'Soft saturation'}).fill('.8');
    await page.getByRole('checkbox',{name:'Slow filter movement'}).check();
    await page.getByRole('button',{name:'Processed',exact:true}).click();await expect(panel(page)).toHaveAttribute('data-mode','processed');
    await page.getByRole('button',{name:'Original',exact:true}).click();await expect(panel(page)).toHaveAttribute('data-mode','original');
    await page.getByRole('button',{name:'Processed',exact:true}).click();await page.getByRole('button',{name:'Pause source',exact:true}).click();await expect(panel(page)).toHaveAttribute('data-mode','original');
    await page.getByRole('button',{name:'Play source',exact:true}).click();await expect(panel(page)).toHaveAttribute('data-mode','original');
    await page.getByRole('button',{name:'Processed',exact:true}).click();await page.getByRole('slider',{name:'Source position'}).fill('30');await expect(panel(page)).toHaveAttribute('data-mode','original');
    await expect.poll(()=>page.evaluate(()=>window.__rallyMedia[0].currentTime)).toBeGreaterThan(29.9);
    await page.getByRole('button',{name:'Reset effect',exact:true}).click();await expect(page.getByRole('slider',{name:'Low-pass cutoff'})).toHaveValue('8000');await expect(page.getByRole('slider',{name:'Soft saturation'})).toHaveValue('0.2');await expect(page.getByRole('checkbox',{name:'Slow filter movement'})).not.toBeChecked();
    await page.getByRole('button',{name:'Processed',exact:true}).click();await page.getByRole('button',{name:'Stop effects',exact:true}).click();await expect(panel(page)).toHaveAttribute('data-mode','original');
    expect(await page.evaluate(()=>window.__rallyMedia[0].currentTime)).toBeGreaterThan(before);
    expect(await page.evaluate(()=>({count:window.__rallyMedia.length,rate:window.__rallyMedia[0].playbackRate,contexts:window.__processingContexts.length}))).toEqual({count:1,rate:1,contexts:1});
  }
  await page.getByRole('button',{name:'Back to Labs'}).click();
  expect(await page.evaluate(()=>window.__rallyMedia.every(m=>m.paused&&!m.getAttribute('src')))).toBe(true);
  await expect.poll(()=>page.evaluate(()=>window.__processingContexts.every(c=>c.state==='closed'))).toBe(true);
  await expect(page.getByRole('button',{name:'Open Tone & texture ↗'})).toBeFocused();
  await page.getByRole('button',{name:'Open Tone & texture ↗'}).click();await expect(panel(page)).toHaveAttribute('data-mode','original');
});

test('source replacement restores displayed processing defaults to match the new module',async({page,browserName})=>{
  test.skip(browserName==='webkit','The native fixture has no processing controls.');
  await open(page);await page.getByRole('button',{name:'Play source',exact:true}).click();
  await expect(panel(page)).toHaveAttribute('data-capable','true');
  await page.getByRole('slider',{name:'Low-pass cutoff'}).fill('600');
  await page.getByRole('slider',{name:'Effect level'}).fill('.9');
  await page.getByRole('combobox',{name:'Listening source'}).selectOption('loop');
  await expect(page.getByRole('slider',{name:'Low-pass cutoff'})).toHaveValue('8000');
  await expect(page.getByRole('slider',{name:'Effect level'})).toHaveValue('0.5');
  await expect(panel(page)).toHaveAttribute('data-mode','original');
});

test('panel reflows at 390/768/1440 and 200% text; keyboard and reduced motion retain audio settings',async({page})=>{
  await open(page);const errors=[];page.on('pageerror',e=>errors.push(e.message));
  for(const width of [390,768,1440]){
    await page.setViewportSize({width,height:1000});
    expect(await page.evaluate(()=>document.querySelector('dialog').scrollWidth<=document.documentElement.clientWidth)).toBe(true);
    await page.screenshot({path:`artifacts/audio-processing/controls-${test.info().project.name}-${width}.png`,fullPage:false});
  }
  await page.setViewportSize({width:390,height:844});await page.addStyleTag({content:'html{font-size:200%!important}'});
  expect(await page.evaluate(()=>getComputedStyle(document.documentElement).fontSize)).toBe('32px');
  expect(await page.evaluate(()=>document.querySelector('dialog').scrollWidth<=document.documentElement.clientWidth)).toBe(true);
  await page.getByRole('button',{name:'Play source',exact:true}).focus();await page.keyboard.press('Space');
  await expect(panel(page)).toHaveAttribute('data-playing','true');
  await page.getByRole('slider',{name:'Soft saturation'}).scrollIntoViewIfNeeded();
  await page.screenshot({path:`artifacts/audio-processing/controls-${test.info().project.name}-200.png`,fullPage:false});
  await page.emulateMedia({reducedMotion:'no-preference'});await page.emulateMedia({reducedMotion:'reduce'});
  await expect(page.getByRole('checkbox',{name:'Slow filter movement'})).not.toBeChecked();expect(errors).toEqual([]);
});

for(const failure of ['no-audio','guard'])test(`${failure} failure preserves Original and disables processing`,async({page})=>{
  await page.addInitScript(failure=>{
    if(failure==='no-audio'){window.AudioContext=undefined;window.webkitAudioContext=undefined;}
    else {const Native=window.AudioContext;if(Native)window.AudioContext=function(...args){const c=new Native(...args);c.audioWorklet.addModule=()=>Promise.reject(Error('intentional guard failure'));return c;};}
  },failure);
  await open(page);await page.getByRole('button',{name:'Play source',exact:true}).click();
  await expect(panel(page)).toHaveAttribute('data-playing','true');
  await expect(page.getByRole('button',{name:'Processed',exact:true})).toBeDisabled();
  await expect(page.getByRole('slider',{name:'Soft saturation'})).toBeDisabled();
  await expect(panel(page).locator('[role=status]')).toContainText('Original playback is preserved');
  await expect.poll(()=>page.evaluate(()=>window.__rallyMedia[0].currentTime)).toBeGreaterThan(0);
});

test('failed processing chunk can be retried by closing and reopening',async({page})=>{
  await fixture(page);let fail=true;
  await page.route(/\/audio-processing\.[^/]+\.js$/,route=>fail?route.abort():route.continue());
  await page.goto('/labs/#audio-experiments');await page.getByRole('button',{name:'Open Tone & texture ↗'}).click();
  await expect(page.getByRole('alert')).toContainText('could not load');
  await page.getByRole('button',{name:'Back to Labs'}).click();fail=false;
  await page.getByRole('button',{name:'Open Tone & texture ↗'}).click();await expect(panel(page)).toBeVisible();
});

test('actual shared output returns to measured Original and releases every processing oscillator',async({page})=>{
  await page.goto('/labs/');
  const urls={owner:moduleUrl(path.resolve(__dirname,'../src/experiences/shared/audio/research/ResearchAudio.ts')),processor:moduleUrl(path.resolve(__dirname,'../src/experiences/audio-processing/processor.ts'))};
  const result=await page.evaluate(async urls=>{
    const {ResearchAudio}=await import(urls.owner),{processingProcessor}=await import(urls.processor);
    const context=new AudioContext();await context.resume();
    const source=context.createOscillator(),input=context.createGain();source.frequency.value=4400;input.gain.value=.2;source.connect(input);source.start();
    let created=0,stopped=0;
    const create=context.createOscillator.bind(context);context.createOscillator=()=>{created++;const o=create(),stop=o.stop.bind(o);o.stop=(...args)=>{stopped++;return stop(...args);};return o;};
    const owner=new ResearchAudio(()=>({status:'playing',playing:true,time:context.currentTime}));owner.attach(context,input);owner.sync({status:'playing',playing:true,time:0});
    const wait=ms=>new Promise(r=>setTimeout(r,ms));
    for(let i=0;i<100&&!owner.diagnostics().processing;i++)await wait(20);
    if(!owner.diagnostics().processing)throw Error('No shared processing guard');
    const capture=async()=>{owner.startCapture(.2,'output');await wait(300);const b=await owner.capture(.15);if(!b)throw Error('Missing shared output');return Math.sqrt(b.getChannelData(0).reduce((s,v)=>s+v*v,0)/b.length);};
    const original=await capture();owner.install('processor',processingProcessor);owner.update('processor',{cutoff:1000,saturation:.6,movement:1});owner.setLevel(1);owner.arm();await wait(60);const processed=await capture();
    owner.original();await wait(60);const bypass=await capture();owner.arm();await wait(60);owner.stop();await wait(60);const stop=await capture();
    owner.arm();await wait(60);owner.update('processor',{cutoff:NaN,saturation:Infinity,movement:-Infinity});await wait(60);const invalid=await capture();
    owner.dispose();source.stop();source.disconnect();input.disconnect();await context.close();
    return {original,processed,bypass,stop,invalid,created,stopped,closed:context.state==='closed'};
  },urls);
  expect(result.original).toBeCloseTo(.2*.5/Math.sqrt(2),3);expect(result.bypass).toBeCloseTo(result.original,3);expect(result.stop).toBeCloseTo(result.original,3);
  expect(result.processed).toBeLessThan(result.original*.1);expect(Number.isFinite(result.invalid)).toBe(true);expect(result.created).toBe(3);expect(result.stopped).toBe(result.created);expect(result.closed).toBe(true);
  fs.writeFileSync(`artifacts/audio-processing/shared-output-${test.info().project.name}.json`,JSON.stringify(result,null,2));
});
