const {test,expect}=require('@playwright/test');
const {moduleUrl}=require('./helpers/research-module.cjs');
const {fixture}=require('./helpers/rally-media.cjs');
const path=require('node:path'),fs=require('node:fs');
const panel=page=>page.locator('[data-audio-research]');
async function open(page){await fixture(page);await page.goto('/labs/#audio-experiments');await page.getByRole('button',{name:'Open Additional rhythm ↗'}).click();await expect(panel(page)).toBeVisible();}

test('rhythm launcher starts off and requires manual anchor after transport interruption',async({page,browserName})=>{
  await open(page);await expect(panel(page)).toHaveAttribute('data-mode','original');
  expect(await page.getByRole('button',{name:'Arm rhythm',exact:true}).count()).toBe(0);
  await page.getByRole('button',{name:'Play source',exact:true}).click();await expect(panel(page)).toHaveAttribute('data-playing','true');
  if(browserName==='webkit'){
    await expect(page.getByRole('button',{name:/Start rhythm on this downbeat/})).toBeDisabled();await expect(page.locator('.rhythm-timing')).toContainText('unavailable');
    expect(await page.locator('.research-meter').locator('..').textContent()).toContain('Matched output metering unavailable');
  }else{
    await expect(panel(page)).toHaveAttribute('data-capable','true');
    await page.getByRole('button',{name:/Start rhythm on this downbeat|Re-anchor downbeat/}).click();await expect(page.locator('.rhythm-timing')).toContainText('Mix + rhythm');
    await expect.poll(()=>panel(page).getAttribute('data-voices').then(Number)).toBeGreaterThan(0);
    await page.getByRole('button',{name:'Later 10 ms',exact:true}).click();await expect(page.locator('.rhythm-timing')).toContainText('+10 ms');
    for(const event of ['waiting','seeking']){
      await page.evaluate(type=>window.__rallyMedia[0].dispatchEvent(new Event(type)),event);
      await expect(page.locator('.rhythm-timing')).toContainText('Rhythm off');
      await page.evaluate(()=>window.__rallyMedia[0].dispatchEvent(new Event('playing')));
      await page.getByRole('button',{name:/Start rhythm on this downbeat|Re-anchor downbeat/}).click();await expect(page.locator('.rhythm-timing')).toContainText('Mix + rhythm');
    }
    await page.getByRole('button',{name:'Original',exact:true}).click();await expect(page.locator('.rhythm-timing')).toContainText('Rhythm off');
    await page.getByRole('button',{name:/Start rhythm on this downbeat|Re-anchor downbeat/}).click();await page.getByRole('button',{name:'Pause source',exact:true}).click();
    await expect(panel(page)).toHaveAttribute('data-mode','original');await page.getByRole('button',{name:'Play source',exact:true}).click();await expect(page.locator('.rhythm-timing')).toContainText('Rhythm off');
    await page.getByRole('button',{name:/Start rhythm on this downbeat|Re-anchor downbeat/}).click();await page.getByRole('button',{name:'Stop effects',exact:true}).click();await expect(panel(page)).toHaveAttribute('data-playing','true');await expect(panel(page)).toHaveAttribute('data-mode','original');
  }
  await page.getByRole('button',{name:'Back to Labs'}).click();await expect(page.getByRole('button',{name:'Open Additional rhythm ↗'})).toBeFocused();expect(await page.evaluate(()=>window.__rallyMedia.every(m=>m.paused&&!m.getAttribute('src')))).toBe(true);
  await page.getByRole('button',{name:'Open Additional rhythm ↗'}).click();await expect(panel(page)).toHaveAttribute('data-mode','original');
});

test('real sample render follows exact 120 BPM grid, drops stalls and shifts phase without duplicate hits',async({page})=>{
  await page.goto('/labs/');
  const urls={layer:moduleUrl(path.resolve(__dirname,'../src/experiences/audio-rhythm/layer.ts')),clock:moduleUrl(path.resolve(__dirname,'../src/experiences/shared/audio/research/AudioClock.ts'))};
  const result=await page.evaluate(async urls=>{
    const {rhythmLayer,rhythmDefaults}=await import(urls.layer),{AudioClock}=await import(urls.clock);
    const run=async(stall=false,nudge=false,justHeard=false)=>{
      const context=new OfflineAudioContext(1,24000*6,24000),clock=new AudioClock(),hits=[],nodes=[];let now=0;
      // Offline rendering starts after scheduling; expose the simulated mapping
      // time to the module's elapsed-versus-queued deduplication bookkeeping.
      const clockContext=new Proxy(context,{get(target,key){if(key==='currentTime')return now;const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;}});
      const module=rhythmLayer({playBuffer(buffer,at,level){const s=context.createBufferSource(),g=context.createGain();s.buffer=buffer;g.gain.value=level*.125;s.connect(g);g.connect(context.destination);s.start(at);hits.push(at);return true;}})({context:clockContext,clock,own:n=>{nodes.push(n);return n;}});
      clock.setTempo(120);clock.anchor(0);module.update(rhythmDefaults);
      for(let i=0;i<200;i++){
        const time=justHeard&&i===11?.255:i*.025;now=time;if(stall&&time>.3&&time<2)continue;
        if((nudge&&i===16)||(justHeard&&i===11)){clock.anchor(.01);module.update(rhythmDefaults);}
        clock.sync(time,time,true);
      }
      const b=await context.startRendering(),data=b.getChannelData(0),first=data.findIndex(v=>Math.abs(v)>1e-7)/24000;
      module.dispose();nodes.forEach(n=>n.disconnect());return {hits,first,peak:data.reduce((p,v)=>Math.max(p,Math.abs(v)),0),finite:data.every(Number.isFinite)};
    };
    return {plain:await run(),stall:await run(true),nudge:await run(false,true),justHeard:await run(false,false,true)};
  },urls);
  expect(result.plain.hits.slice(0,4)).toEqual([.25,1.25,2.25,3.25]);
  expect(result.plain.first).toBeGreaterThanOrEqual(.25);expect(result.plain.first).toBeLessThan(.251);
  expect(result.stall.hits.slice(0,3)).toEqual([.25,2.25,3.25]);
  expect(result.nudge.hits[0]).toBe(.25);expect(result.nudge.hits[1]).toBeCloseTo(1.26,8);
  expect(result.justHeard.hits[0]).toBe(.25);expect(result.justHeard.hits[1]).toBeCloseTo(1.26,8);expect(result.justHeard.hits).not.toContain(.26);
  for(const r of Object.values(result)){expect(new Set(r.hits.map(t=>t.toFixed(6))).size).toBe(r.hits.length);expect(r.finite).toBe(true);expect(r.peak).toBeGreaterThan(.04);expect(r.peak).toBeLessThan(.1);}
  fs.mkdirSync('artifacts/audio-rhythm',{recursive:true});fs.writeFileSync(`artifacts/audio-rhythm/timing-${test.info().project.name}.json`,JSON.stringify(result,null,2));
});

test('shared guarded layer cancels queued and sounding voices, bounds dense edits and never auto-resumes',async({page})=>{
  await page.goto('/labs/');
  const urls={layer:moduleUrl(path.resolve(__dirname,'../src/experiences/audio-rhythm/layer.ts')),owner:moduleUrl(path.resolve(__dirname,'../src/experiences/shared/audio/research/ResearchAudio.ts'))};
  const result=await page.evaluate(async urls=>{
    const {rhythmLayer}=await import(urls.layer),{ResearchAudio}=await import(urls.owner);
    const context=new AudioContext();await context.resume();const input=context.createGain(),wait=ms=>new Promise(r=>setTimeout(r,ms));
    let state='playing';const snapshot=()=>({status:state,playing:state==='playing',time:context.currentTime});
    const owner=new ResearchAudio(snapshot);owner.attach(context,input);owner.sync(snapshot());
    for(let i=0;i<100&&!owner.diagnostics().layering;i++)await wait(20);
    if(!owner.diagnostics().layering)throw Error('Shared guard did not load');
    const hits=[],play=owner.playBuffer.bind(owner);let rejected=0,maxVoices=0;
    owner.playBuffer=(buffer,at,level)=>{const accepted=play(buffer,at,level);if(accepted)hits.push(at);else rejected++;maxVoices=Math.max(maxVoices,owner.diagnostics().voices);return accepted;};
    owner.install('layer',rhythmLayer(owner));owner.setLevel(1);
    const params={kick:65535,clap:65535,hat:65535,cycle:1};owner.update('layer',params);owner.arm();owner.clock.setTempo(240);
    const now=context.currentTime;owner.clock.anchor(now+.08);owner.update('layer',params);owner.clock.sync(now,now,true);
    const queued=hits.length;owner.clock.anchor(now+.09);owner.update('layer',params);owner.clock.sync(now,now,true);
    const replacements=hits.slice(queued),originalTimes=hits.slice(0,queued);
    owner.stop();owner.startCapture(.3,'output');await wait(220);const cancelled=await owner.capture(.2);
    const peak=b=>b?b.getChannelData(0).reduce((p,v)=>Math.max(p,Math.abs(v)),0):null;
    const cancelledPeak=peak(cancelled);await wait(50);
    owner.arm();owner.clock.setTempo(240);owner.clock.anchor(context.currentTime);owner.update('layer',{...params,cycle:2});await wait(2100);
    owner.startCapture(.2,'output');await wait(150);const soundingPeak=peak(await owner.capture(.1));
    owner.stop();owner.startCapture(.3,'output');await wait(200);const stoppedPeak=peak(await owner.capture(.1));
    const stopped=owner.diagnostics(),beforeResume=hits.length;owner.arm();await wait(240);const autoResumeHits=hits.length-beforeResume;
    state='loading';owner.sync(snapshot());const bufferingArm=owner.arm();state='playing';owner.sync(snapshot());await wait(80);
    const beforeAnchor=hits.length;owner.arm();owner.clock.setTempo(120);owner.clock.anchor(context.currentTime+.06);owner.update('layer',{kick:1,clap:0,hat:0,cycle:3});await wait(140);const deliberateHits=hits.length-beforeAnchor;
    // The visibility listener must invalidate clock and gates independently of UI.
    Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));
    const hidden=owner.diagnostics();Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));await wait(100);const returned=owner.diagnostics();
    owner.dispose();input.disconnect();await context.close();
    return {queued,replacements,originalTimes,cancelledPeak,soundingPeak,stoppedPeak,stopped,maxVoices,rejected,autoResumeHits,bufferingArm,deliberateHits,hidden,returned,closed:context.state==='closed'};
  },urls);
  expect(result.queued).toBe(3);expect(result.cancelledPeak).toBe(0);expect(result.soundingPeak).toBeGreaterThan(.00001);expect(result.stoppedPeak).toBeLessThan(.000001);
  expect(result.replacements.length).toBe(3);for(let i=0;i<3;i++)expect(result.replacements[i]-result.originalTimes[i]).toBeCloseTo(.01,5);
  expect(result.maxVoices).toBeLessThanOrEqual(16);expect(result.maxVoices).toBeGreaterThan(5);expect(result.rejected).toBeGreaterThan(0);
  expect(result.stopped.voices).toBe(0);expect(result.stopped.scheduled).toBe(0);expect(result.autoResumeHits).toBe(0);expect(result.bufferingArm).toBe(false);expect(result.deliberateHits).toBe(1);
  expect(result.hidden.mode).toBe('original');expect(result.hidden.anchored).toBe(false);expect(result.returned.mode).toBe('original');expect(result.closed).toBe(true);
  fs.mkdirSync('artifacts/audio-rhythm',{recursive:true});fs.writeFileSync(`artifacts/audio-rhythm/shared-layer-${test.info().project.name}.json`,JSON.stringify(result,null,2));
});

test('layout, keyboard editing and reduced motion at 390/768/1440 and 200% text',async({page})=>{
  await open(page);const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.getByRole('button',{name:'Play source',exact:true}).focus();await page.keyboard.press('Space');await expect(panel(page)).toHaveAttribute('data-playing','true');
  await page.getByText('Edit 16 steps · kick / clap / hat',{exact:true}).click();
  for(const width of [390,768,1440]){
    await page.setViewportSize({width,height:1100});expect(await page.evaluate(()=>document.querySelector('dialog').scrollWidth<=document.documentElement.clientWidth)).toBe(true);
    const small=await page.locator('.rhythm-steps button').evaluateAll(nodes=>nodes.some(n=>n.getBoundingClientRect().width<44||n.getBoundingClientRect().height<44));expect(small).toBe(false);
    await page.screenshot({path:`artifacts/audio-rhythm/controls-${test.info().project.name}-${width}.png`});
  }
  await page.setViewportSize({width:390,height:844});await page.addStyleTag({content:'html{font-size:200%!important}'});
  expect(await page.evaluate(()=>getComputedStyle(document.documentElement).fontSize)).toBe('32px');expect(await page.evaluate(()=>document.querySelector('dialog').scrollWidth<=document.documentElement.clientWidth)).toBe(true);
  if(await page.getByRole('button',{name:'hat step 1',exact:true}).isEnabled()){
    await page.getByRole('button',{name:'hat step 1',exact:true}).focus();await page.keyboard.press('Space');await expect(page.getByRole('button',{name:'hat step 1',exact:true})).toHaveAttribute('aria-pressed','true');
    await page.emulateMedia({reducedMotion:'reduce'});await expect(page.getByRole('button',{name:'hat step 1',exact:true})).toHaveAttribute('aria-pressed','true');
  }
  await page.screenshot({path:`artifacts/audio-rhythm/controls-${test.info().project.name}-200.png`});expect(errors).toEqual([]);
});

test('replacement and reset restore sparse defaults, errors retry and failed chunks reopen',async({page,browserName})=>{
  await fixture(page);let fail=true;await page.route(/\/audio-rhythm\.[^/]+\.js$/,r=>fail?r.abort():r.continue());await page.goto('/labs/#audio-experiments');
  await page.getByRole('button',{name:'Open Additional rhythm ↗'}).click();await expect(page.getByRole('alert')).toContainText('could not load');await page.getByRole('button',{name:'Back to Labs'}).click();fail=false;
  await page.getByRole('button',{name:'Open Additional rhythm ↗'}).click();await expect(panel(page)).toBeVisible();await page.getByRole('button',{name:'Play source',exact:true}).click();await expect(panel(page)).toHaveAttribute('data-playing','true');
  if(browserName!=='webkit'){
    await page.getByRole('button',{name:'Reply',exact:true}).click();await page.getByRole('checkbox',{name:'Optional kick · toggle first step'}).check();
    await page.getByRole('button',{name:/Start rhythm on this downbeat|Re-anchor downbeat/}).click();await page.getByRole('button',{name:'Reset effect',exact:true}).click();
    await expect(page.getByRole('button',{name:'Air',exact:true})).toHaveAttribute('aria-pressed','true');await expect(page.getByRole('checkbox',{name:'Optional kick · toggle first step'})).not.toBeChecked();
    await page.evaluate(()=>window.__rallyMedia[0].dispatchEvent(new Event('error')));await page.getByRole('button',{name:'Retry source',exact:true}).click();await expect(panel(page)).toHaveAttribute('data-playing','true');await expect(page.locator('.rhythm-timing')).toContainText('Rhythm off');
  }
  await page.getByRole('combobox',{name:'Listening source'}).selectOption('loop');await expect(panel(page)).toHaveAttribute('data-mode','original');await page.getByRole('button',{name:'Play source',exact:true}).click();await expect(page.getByRole('button',{name:'Air',exact:true})).toBeEnabled();await expect(page.getByRole('button',{name:'Air',exact:true})).toHaveAttribute('aria-pressed','true');
});

for(const failure of ['no-audio','guard'])test(`${failure} preserves Original and disables rhythm`,async({page})=>{
  await page.addInitScript(f=>{if(f==='no-audio'){window.AudioContext=undefined;window.webkitAudioContext=undefined;}else{const Native=window.AudioContext;if(Native)window.AudioContext=function(...args){const c=new Native(...args);c.audioWorklet.addModule=()=>Promise.reject(Error('fixture'));return c;};}},failure);
  await open(page);await page.getByRole('button',{name:'Play source',exact:true}).click();await expect(panel(page)).toHaveAttribute('data-playing','true');await expect(page.getByRole('button',{name:/Start rhythm on this downbeat|Re-anchor downbeat/})).toBeDisabled();await expect(page.locator('.rhythm-timing')).toContainText('unavailable');await expect.poll(()=>page.evaluate(()=>window.__rallyMedia[0].currentTime)).toBeGreaterThan(0);
  expect(await page.locator('.research-meter').locator('..').textContent()).toContain('Matched output metering unavailable');
});

test('seven seconds of actual 120 BPM media transport retain phase without accumulating grid drift',async({page})=>{
  await page.addInitScript(()=>{
    sessionStorage.setItem('room-labs-session','open');window.__rhythmMedia=[];window.__rhythmStarts=[];
    const Media=window.Audio;window.Audio=function(...args){const m=new Media(...args);window.__rhythmMedia.push(m);return m;};
    const Context=window.AudioContext||window.webkitAudioContext,create=Context.prototype.createBufferSource;
    Context.prototype.createBufferSource=function(){const source=create.call(this),start=source.start.bind(source),context=this;source.start=function(at){window.__rhythmStarts.push({at,audio:context.currentTime,media:window.__rhythmMedia.at(-1).currentTime});return start(at);};return source;};
  });
  await page.goto('/labs/#audio-experiments');await page.getByRole('button',{name:'Open Additional rhythm ↗'}).click();await page.getByRole('combobox',{name:'Listening source'}).selectOption('loop');
  await page.getByRole('button',{name:'Play source',exact:true}).click();await expect(page.getByRole('button',{name:/Start rhythm on this downbeat|Re-anchor downbeat/})).toBeEnabled();await page.getByRole('button',{name:/Start rhythm on this downbeat|Re-anchor downbeat/}).click();
  await expect(page.locator('.rhythm-timing')).toContainText('Mix + rhythm');const anchor=Number((await page.locator('.rhythm-timing').textContent()).match(/anchor ([\d.]+) s/)[1]);
  await page.waitForTimeout(7000);
  const hits=await page.evaluate(()=>window.__rhythmStarts),errors=hits.map((h,i)=>(h.media+h.at-h.audio-(anchor+.25+i))*1000);
  const result={source:'Actual generated 8s / 120 BPM WAV through ListeningSession and shared owner, no source substitution',intervalSeconds:7,anchorDisplaySeconds:anchor,anchorRoundingMs:.5,hits,errorsMs:errors,maxAbsoluteErrorMs:Math.max(...errors.map(Math.abs)),endMinusStartDriftMs:errors.at(-1)-errors[0],scope:'Scheduled starts versus media/audio mapping sampled at source.start; excludes physical audio output latency and is not live DJ beat alignment.'};
  expect(hits.length).toBeGreaterThanOrEqual(6);expect(result.maxAbsoluteErrorMs).toBeLessThan(40);expect(Math.abs(result.endMinusStartDriftMs)).toBeLessThan(20);
  await expect(page.locator('.rhythm-timing')).toContainText('Mix + rhythm');await page.getByRole('button',{name:'Stop effects',exact:true}).click();await expect(panel(page)).toHaveAttribute('data-voices','0');
  fs.mkdirSync('artifacts/audio-rhythm',{recursive:true});fs.writeFileSync(`artifacts/audio-rhythm/transport-drift-${test.info().project.name}.json`,JSON.stringify(result,null,2));
});
