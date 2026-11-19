const {test,expect}=require('@playwright/test');
const {moduleUrl}=require('./helpers/research-module.cjs');
const {fixture}=require('./helpers/rally-media.cjs');
const path=require('node:path'),fs=require('node:fs');
const panel=page=>page.locator('[data-audio-research]');
async function open(page){await fixture(page);await page.goto('/labs/#audio-experiments');await page.getByRole('button',{name:'Open Space & echoes ↗'}).click();await expect(panel(page)).toBeVisible();}

test('real insert impulse timing, feedback extremes, finite decay, stereo and mono',async({page})=>{
  await page.goto('/labs/');
  const result=await page.evaluate(async url=>{
    const {spaceProcessor}=await import(url),rate=24000;
    const render=async(params,channels=1)=>{
      const context=new OfflineAudioContext(2,rate*18,rate),nodes=[];
      const module=spaceProcessor({context,own:n=>{nodes.push(n);return n;},clock:{bpm:params.division===1?40:120,tempoSet:true}});
      module.update(params);const source=context.createBufferSource();source.buffer=context.createBuffer(channels,rate*18,rate);
      for(let c=0;c<channels;c++)source.buffer.getChannelData(c)[rate/10]=1;
      source.connect(module.input);module.output.connect(context.destination);source.start();
      const b=await context.startRendering(),data=[b.getChannelData(0),b.getChannelData(1)];
      const peak=(from,to)=>Math.max(...data[0].slice(Math.floor(from*rate),Math.floor(to*rate)).map(Math.abs));
      const first=data[0].findIndex((v,i)=>i>rate/10&&Math.abs(v)>.00001)/rate;
      const out={dry:data.map(c=>c[rate/10]),first,echo1:peak(.299,.32),echo2:peak(.499,.52),late:peak(16,18),finite:data.every(c=>c.every(Number.isFinite)),difference:data[0].reduce((s,v,i)=>s+Math.abs(v-data[1][i]),0),tailEnergy:data[0].slice(rate*.15).reduce((s,v)=>s+v*v,0)};
      module.dispose?.();nodes.forEach(n=>n.disconnect());return out;
    };
    return {single:await render({time:4/9,feedback:0,stereo:0}),max:await render({time:4/9,feedback:1,stereo:0}),long:await render({division:1,feedback:1,stereo:1}),stereo:await render({time:4/9,feedback:.5,stereo:1},2),reverb:await render({mode:1,time:.4,feedback:1,stereo:1}),monoReverb:await render({mode:1,time:.4,feedback:1,stereo:0}),shortReverb:await render({mode:1,time:.4,feedback:0,stereo:0})};
  },moduleUrl(path.resolve(__dirname,'../src/experiences/audio-space/processor.ts')));
  fs.mkdirSync('artifacts/audio-space',{recursive:true});fs.writeFileSync(`artifacts/audio-space/dsp-${test.info().project.name}.json`,JSON.stringify(result,null,2));
  for(const r of Object.values(result)){expect(r.dry[0]).toBeCloseTo(1,5);expect(r.dry[1]).toBeCloseTo(1,5);expect(r.finite).toBe(true);expect(r.late).toBeLessThan(.0001);}
  expect(result.single.first).toBeCloseTo(.3,3);expect(result.single.echo1).toBeGreaterThan(.01);expect(result.single.echo2).toBeLessThan(.00001);expect(result.max.echo2).toBeGreaterThan(.001);
  expect(result.single.difference).toBeLessThan(.00001);expect(result.stereo.difference).toBeGreaterThan(.01);
  expect(result.reverb.difference).toBeGreaterThan(.01);expect(result.monoReverb.difference).toBeLessThan(.00001);expect(result.reverb.tailEnergy).toBeGreaterThan(.001);
});

test('space controls share transport, manual clock, reset and close lifecycle',async({page,browserName})=>{
  await open(page);await expect(panel(page)).toHaveAttribute('data-mode','original');await page.getByRole('button',{name:'Play source',exact:true}).click();await expect(panel(page)).toHaveAttribute('data-playing','true');
  if(browserName==='webkit'){await expect(page.getByRole('button',{name:'Processed',exact:true})).toBeDisabled();await expect(panel(page).locator('[role=status]')).toContainText('Original playback is preserved');}
  else{
    await expect(panel(page)).toHaveAttribute('data-capable','true');
    await page.getByRole('combobox',{name:'Delay timing'}).selectOption({label:'1/8 · manual tempo'});
    await expect(page.getByRole('combobox',{name:'Delay timing'})).toHaveValue('0.5');
    await expect(page.getByText('Set manual tempo to use divisions.')).toBeVisible();
    await page.getByRole('spinbutton',{name:'Manual tempo (BPM)'}).fill('100');await page.getByRole('button',{name:'Set tempo'}).click();
    await expect(page.locator('.space-timing')).toContainText('300 ms');
    await page.getByRole('checkbox',{name:'Restrained stereo'}).check();
    await page.getByRole('button',{name:'Processed',exact:true}).click();await expect(panel(page)).toHaveAttribute('data-mode','processed');
    await page.getByRole('button',{name:'Reverb',exact:true}).click();await expect(page.getByRole('slider',{name:'Space / pre-delay'})).toBeVisible();
    await page.getByRole('button',{name:'Original',exact:true}).click();await expect(panel(page)).toHaveAttribute('data-mode','original');
    await page.getByRole('button',{name:'Processed',exact:true}).click();await page.getByRole('button',{name:'Pause source',exact:true}).click();await expect(panel(page)).toHaveAttribute('data-mode','original');
    await page.getByRole('button',{name:'Play source',exact:true}).click();await page.getByRole('button',{name:'Processed',exact:true}).click();await page.getByRole('slider',{name:'Source position'}).fill('30');await expect(panel(page)).toHaveAttribute('data-mode','original');
    await page.getByRole('button',{name:'Reset effect',exact:true}).click();await expect(page.getByRole('slider',{name:'Delay time'})).toHaveValue('0.45');await expect(page.getByRole('checkbox',{name:'Restrained stereo'})).not.toBeChecked();
    await page.getByRole('button',{name:'Processed',exact:true}).click();await page.getByRole('button',{name:'Stop effects',exact:true}).click();await expect(panel(page)).toHaveAttribute('data-mode','original');
    await expect(panel(page)).toHaveAttribute('data-playing','true');
  }
  await page.getByRole('button',{name:'Back to Labs'}).click();await expect(page.getByRole('button',{name:'Open Space & echoes ↗'})).toBeFocused();expect(await page.evaluate(()=>window.__rallyMedia.every(m=>m.paused&&!m.getAttribute('src')))).toBe(true);
  await page.getByRole('button',{name:'Open Space & echoes ↗'}).click();await expect(panel(page)).toHaveAttribute('data-mode','original');
});

test('layout, keyboard and reduced motion at 390/768/1440 and enlarged text',async({page})=>{
  await open(page);const errors=[];page.on('pageerror',e=>errors.push(e.message));
  for(const width of [390,768,1440]){await page.setViewportSize({width,height:1100});expect(await page.evaluate(()=>document.querySelector('dialog').scrollWidth<=document.documentElement.clientWidth)).toBe(true);await page.screenshot({path:`artifacts/audio-space/controls-${test.info().project.name}-${width}.png`});}
  await page.setViewportSize({width:390,height:844});await page.addStyleTag({content:'html{font-size:200%!important}'});expect(await page.evaluate(()=>getComputedStyle(document.documentElement).fontSize)).toBe('32px');expect(await page.evaluate(()=>document.querySelector('dialog').scrollWidth<=document.documentElement.clientWidth)).toBe(true);
  await page.getByRole('button',{name:'Play source',exact:true}).focus();await page.keyboard.press('Space');await expect(panel(page)).toHaveAttribute('data-playing','true');await page.emulateMedia({reducedMotion:'reduce'});await expect(page.getByRole('checkbox',{name:'Restrained stereo'})).not.toBeChecked();expect(errors).toEqual([]);
});

test('failed space chunk retries on reopening',async({page})=>{
  await fixture(page);let fail=true;await page.route(/\/audio-space\.[^/]+\.js$/,r=>fail?r.abort():r.continue());await page.goto('/labs/#audio-experiments');await page.getByRole('button',{name:'Open Space & echoes ↗'}).click();await expect(page.getByRole('alert')).toContainText('could not load');await page.getByRole('button',{name:'Back to Labs'}).click();fail=false;await page.getByRole('button',{name:'Open Space & echoes ↗'}).click();await expect(panel(page)).toBeVisible();
});

for(const failure of ['no-audio','guard'])test(`${failure} leaves native Original audible`,async({page})=>{
  await page.addInitScript(f=>{if(f==='no-audio'){window.AudioContext=undefined;window.webkitAudioContext=undefined;}else{const Native=window.AudioContext;if(Native)window.AudioContext=function(...args){const c=new Native(...args);c.audioWorklet.addModule=()=>Promise.reject(Error('fixture'));return c;};}},failure);
  await open(page);await page.getByRole('button',{name:'Play source',exact:true}).click();await expect(panel(page)).toHaveAttribute('data-playing','true');await expect(page.getByRole('button',{name:'Processed',exact:true})).toBeDisabled();await expect(page.getByRole('slider',{name:'Delay time'})).toBeDisabled();await expect.poll(()=>page.evaluate(()=>window.__rallyMedia[0].currentTime)).toBeGreaterThan(0);
});

test('shared guarded output preserves one dry path and removes active delay/reverb tails promptly',async({page})=>{
  await page.goto('/labs/');
  const urls={processor:moduleUrl(path.resolve(__dirname,'../src/experiences/audio-space/processor.ts')),owner:moduleUrl(path.resolve(__dirname,'../src/experiences/shared/audio/research/ResearchAudio.ts'))};
  const result=await page.evaluate(async urls=>{
    const {spaceProcessor}=await import(urls.processor),{ResearchAudio}=await import(urls.owner);
    const context=new AudioContext();await context.resume();const input=context.createGain(),tone=context.createOscillator(),toneGain=context.createGain();tone.frequency.value=733;toneGain.gain.value=.2;tone.connect(toneGain);toneGain.connect(input);tone.start();
    const owner=new ResearchAudio(()=>({status:'playing',playing:true,time:context.currentTime}));owner.attach(context,input);owner.sync({status:'playing',playing:true,time:0});
    const wait=ms=>new Promise(r=>setTimeout(r,ms));for(let i=0;i<100&&!owner.diagnostics().processing;i++)await wait(20);
    if(!owner.diagnostics().processing)throw Error('Missing shared guard');
    const rms=b=>Math.sqrt(b.getChannelData(0).reduce((s,v)=>s+v*v,0)/b.length);
    const measure=async()=>{owner.startCapture(.2,'output');await wait(180);const b=await owner.capture(.1);if(!b)throw Error('Missing output');return rms(b);};
    // Discard guard-attachment startup before measuring stationary dry gain.
    await wait(100);const original=await measure();owner.install('processor',spaceProcessor);owner.update('processor',{feedback:1,time:1,stereo:1});owner.setLevel(0);owner.arm();await wait(60);const zeroLevel=await measure();owner.original();await wait(60);const bypass=await measure();toneGain.gain.value=0;
    const tails=[];
    for(const mode of [0,1])for(const action of ['original','stop']){
      owner.update('processor',{mode,time:4/9,feedback:1,stereo:1});owner.setLevel(1);owner.arm();await wait(60);
      const buffer=context.createBuffer(1,Math.round(context.sampleRate*.3),context.sampleRate);let seed=2;const data=buffer.getChannelData(0);for(let i=0;i<data.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;data[i]=(seed/2**32-.5)*.8;}
      const burst=context.createBufferSource();burst.buffer=buffer;burst.connect(input);owner.startCapture(.7,'output');burst.start();await wait(440);
      const active=await owner.capture(.04);if(!active)throw Error('No tail capture');const before=rms(active);
      owner[action]();owner.startCapture(.2,'output');await wait(130);const b=await owner.capture(.15);if(!b)throw Error('No bypass capture');
      // Shared capture has a 100ms minimum; exclude the deliberate 15ms fade,
      // rather than interpreting its energy as a surviving tail.
      const samples=b.getChannelData(0),settled=samples.slice(Math.round(b.sampleRate*.04));
      let last=0;for(let i=0;i<samples.length;i++)if(Math.abs(samples[i])>.000001)last=i;
      tails.push({mode,action,before,after:Math.sqrt(settled.reduce((s,v)=>s+v*v,0)/settled.length),lastNonzeroSeconds:last/b.sampleRate,modules:owner.diagnostics().modules});burst.disconnect();
    }
    const diagnostics=owner.diagnostics();owner.dispose();tone.stop();tone.disconnect();toneGain.disconnect();input.disconnect();await context.close();return {original,zeroLevel,bypass,tails,diagnostics,closed:context.state==='closed'};
  },urls);
  fs.mkdirSync('artifacts/audio-space',{recursive:true});fs.writeFileSync(`artifacts/audio-space/shared-output-${test.info().project.name}.json`,JSON.stringify(result,null,2));
  expect(result.original).toBeCloseTo(.2*.5/Math.sqrt(2),3);expect(result.zeroLevel).toBeCloseTo(result.original,3);expect(result.bypass).toBeCloseTo(result.original,3);
  for(const r of result.tails){expect(r.before).toBeGreaterThan(.000001);expect(r.after).toBeLessThan(.000001);expect(r.lastNonzeroSeconds).toBeLessThan(.035);expect(r.modules).toBe(0);}expect(result.closed).toBe(true);
});

test('source failure retry and replacement stay Original and release the prior source',async({page,browserName})=>{
  await open(page);await page.getByRole('button',{name:'Play source',exact:true}).click();await expect(panel(page)).toHaveAttribute('data-playing','true');
  if(browserName!=='webkit'){await expect(panel(page)).toHaveAttribute('data-capable','true');await page.getByRole('slider',{name:'Feedback'}).fill('1');await page.getByRole('button',{name:'Processed',exact:true}).click();}
  await page.evaluate(()=>window.__rallyMedia[0].dispatchEvent(new Event('error')));
  await expect(page.getByRole('button',{name:'Retry source',exact:true})).toBeVisible();await expect(panel(page)).toHaveAttribute('data-mode','original');
  await page.getByRole('button',{name:'Retry source',exact:true}).click();await expect(panel(page)).toHaveAttribute('data-playing','true');await expect(panel(page)).toHaveAttribute('data-mode','original');
  expect(await page.evaluate(()=>({count:window.__rallyMedia.length,oldPaused:window.__rallyMedia[0].paused,oldSrc:window.__rallyMedia[0].getAttribute('src')}))).toEqual({count:2,oldPaused:true,oldSrc:null});
  await page.getByRole('combobox',{name:'Listening source'}).selectOption('loop');await expect(page.getByRole('slider',{name:'Feedback'})).toHaveValue('0.35');await expect(panel(page)).toHaveAttribute('data-mode','original');
});

test('keyboard launcher and explicit generated source process through the host on every browser',async({page})=>{
  await page.addInitScript(()=>sessionStorage.setItem('room-labs-session','open'));
  await page.goto('/labs/#audio-experiments');await page.getByRole('button',{name:'Open Space & echoes ↗'}).focus();await page.keyboard.press('Enter');
  await page.getByRole('combobox',{name:'Listening source'}).selectOption('loop');await page.getByRole('button',{name:'Play source',exact:true}).click();
  await expect(panel(page)).toHaveAttribute('data-capable','true');await page.getByRole('button',{name:'Processed',exact:true}).click();await expect(panel(page)).toHaveAttribute('data-mode','processed');
  await page.getByRole('button',{name:'Reverb',exact:true}).click();await expect.poll(()=>panel(page).getAttribute('data-output-rms').then(Number)).toBeGreaterThan(.00001);
  await page.getByRole('button',{name:'Stop effects',exact:true}).click();await expect(panel(page)).toHaveAttribute('data-mode','original');await expect(panel(page)).toHaveAttribute('data-playing','true');
});
