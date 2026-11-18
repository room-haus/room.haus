// Local-only evidence runner; original catalog media, no test fixtures.
const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const directory=path.resolve('artifacts/hanging-balance');fs.mkdirSync(directory,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:1100},reducedMotion:'no-preference'});
 const errors=[],responses=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('response',r=>{if(/m3u8|MX029-\d+\.ts/.test(r.url()))responses.push({url:r.url(),status:r.status()});});
 await page.addInitScript(()=>{
  sessionStorage.setItem('room-labs-session','open');window.__evidenceMedia=[];window.__evidenceContexts=[];
  const Audio=window.Audio;window.Audio=function(...args){const media=new Audio(...args);window.__evidenceMedia.push(media);return media;};
  const Context=window.AudioContext;window.AudioContext=function(...args){const context=new Context(...args);window.__evidenceContexts.push(context);return context;};
 });
 await page.goto((process.env.ROOM_TEST_ORIGIN||'http://127.0.0.1:4173')+'/labs/#interactives');await page.getByRole('button',{name:'Open Hanging Balance ↗'}).click();
 await page.locator('[data-toy="hanging-balance"][data-render-state="ready"]').waitFor();await page.getByRole('button',{name:'Play mix',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('[data-toy]').dataset.source==='live');
 await page.locator('dialog').evaluate(e=>e.scrollTop=0);
 const started=Date.now(),duration=Number(process.env.BALANCE_SOAK_SECONDS||1800),samples=[];
 await page.evaluate(()=>{window.__frameTimes=[];let last=performance.now();function tick(now){window.__frameTimes.push(now-last);last=now;window.__frameRequest=requestAnimationFrame(tick);}window.__frameRequest=requestAnimationFrame(tick);});
 await page.screenshot({path:path.join(directory,'passive-desktop.png')});
 for(let i=0;i<duration;i+=10){
  await page.waitForTimeout(Math.min(10,duration-i)*1000);
  samples.push(await page.evaluate(()=>({time:Date.now(),state:JSON.parse(document.querySelector('[data-toy]').dataset.diagnostics),metrics:JSON.parse(document.querySelector('.listening-diagnostics pre').textContent),media:window.__evidenceMedia.map(m=>({time:m.currentTime,paused:m.paused,rate:m.playbackRate,volume:m.volume})),contexts:window.__evidenceContexts.map(c=>c.state),heap:performance.memory?.usedJSHeapSize})));
  if(samples.length>1&&samples.at(-1).state.simTime<samples.at(-2).state.simTime)errors.push('Unexpected scene reset during continuous playback');
  fs.writeFileSync(path.join(directory,'soak-progress.json'),JSON.stringify({started,elapsed:(Date.now()-started)/1000,samples,errors},null,2));
  if(i===50||i===290)await page.screenshot({path:path.join(directory,i===50?'passive-60s.png':'passive-5min.png')});
 }
 const timing=await page.evaluate(()=>{cancelAnimationFrame(window.__frameRequest);const f=window.__frameTimes.slice(5),first=f.slice(0,3600).sort((a,b)=>a-b),all=[...f].sort((a,b)=>a-b);return {frames:f.length,first3600P95:first[Math.floor(first.length*.95)],p95:all[Math.floor(all.length*.95)],max:all.at(-1)};});
 await page.getByRole('slider',{name:'Counterweight',exact:true}).fill('1');await page.getByRole('checkbox',{name:'Keep control'}).check();await page.waitForTimeout(2000);await page.locator('dialog').evaluate(e=>e.scrollTop=0);await page.screenshot({path:path.join(directory,'interactive-desktop.png')});
 await page.getByRole('button',{name:'Back to Labs',exact:true}).click();
 await page.waitForTimeout(300);
 const cleanup=await page.evaluate(()=>({media:window.__evidenceMedia.map(m=>({paused:m.paused,time:m.currentTime})),contexts:window.__evidenceContexts.map(c=>c.state),dialog:!!document.querySelector('dialog'),focus:document.activeElement.textContent}));
 const result={started,finished:Date.now(),duration,origin:'https://roomhauscdnprd.blob.core.windows.net/',browser:'headless Chromium',viewport:'1440x1100',samples,timing,errors,responses,cleanup};
 fs.writeFileSync(path.join(directory,'live-soak.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({duration,samples:samples.length,timing,errors,cleanup},null,2));await browser.close();
})().catch(error=>{console.error(error);process.exitCode=1;});
