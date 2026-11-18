const {chromium}=require('playwright');
const fs=require('node:fs');const os=require('node:os');
const origin=process.env.ROOM_TEST_ORIGIN||'http://127.0.0.1:4195';
const duration=Number(process.env.ODD_SOAK_SECONDS||1800);
const destination='artifacts/odd-ensemble/soak.json';
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
 const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'no-preference'});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  sessionStorage.setItem('room-labs-session','open');window.__oddMedia=[];window.__oddContexts=[];
  const A=window.Audio;window.Audio=function(...args){const a=new A(...args);window.__oddMedia.push(a);return a;};
  const C=window.AudioContext;window.AudioContext=function(...args){const c=new C(...args);window.__oddContexts.push(c);return c;};
  const add=EventTarget.prototype.addEventListener,remove=EventTarget.prototype.removeEventListener,active=[];
  EventTarget.prototype.addEventListener=function(type,fn,opts){if((this===window||this===document)&&!active.some(x=>x.target===this&&x.type===type&&x.fn===fn))active.push({target:this,type,fn});return add.call(this,type,fn,opts);};
  EventTarget.prototype.removeEventListener=function(type,fn,opts){const i=active.findIndex(x=>x.target===this&&x.type===type&&x.fn===fn);if(i>=0)active.splice(i,1);return remove.call(this,type,fn,opts);};window.__oddListeners=()=>active.length;
 });
 await page.goto(origin+'/labs/#interactives');const baseline=await page.evaluate(()=>window.__oddListeners());
 await page.getByRole('button',{name:'Open Odd Ensemble ↗'}).click();await page.locator('[data-render-state=ready]').waitFor();await page.getByRole('button',{name:'Play mix',exact:true}).click();await page.waitForFunction(()=>document.querySelector('[data-toy]')?.dataset.source==='live',{},{timeout:60000});
 await page.getByText('Labs diagnostics',{exact:true}).click();
 await page.evaluate(()=>{window.__oddIntervals=[];let previous=performance.now();function tick(now){if(window.__oddIntervals.length<120000)window.__oddIntervals.push(now-previous);previous=now;requestAnimationFrame(tick);}requestAnimationFrame(tick);});
 const started=Date.now(),samples=[];
 const read=()=>page.evaluate(()=>({wall:Date.now(),...JSON.parse(document.querySelector('.listening-diagnostics pre').textContent),media:window.__oddMedia.map(a=>({time:a.currentTime,paused:a.paused,src:a.currentSrc,volume:a.volume,rate:a.playbackRate})),contexts:window.__oddContexts.map(c=>c.state),listeners:window.__oddListeners()}));
 const report={hardware:{platform:os.platform(),arch:os.arch(),cpus:os.cpus()[0].model},origin,mode:'webpack development, HMR/live reload disabled; live CDN',durationTarget:duration,started:new Date().toISOString(),samples,errors};
 while(Date.now()-started<duration*1000){samples.push(await read());fs.writeFileSync(destination,JSON.stringify(report,null,2));await page.waitForTimeout(Math.min(30000,duration*1000-(Date.now()-started)));}
 samples.push(await read());report.wallSeconds=(Date.now()-started)/1000;
 const intervals=await page.evaluate(()=>window.__oddIntervals);const settled=intervals.slice(300).sort((a,b)=>a-b);report.frameMs={count:settled.length,p50:settled[Math.floor(settled.length*.5)],p95:settled[Math.floor(settled.length*.95)],max:settled.at(-1)};
 await page.getByRole('button',{name:'Back to Labs',exact:true}).click();report.closed=await page.evaluate(()=>({media:window.__oddMedia.map(a=>({paused:a.paused,src:a.getAttribute('src')})),contexts:window.__oddContexts.map(c=>c.state),listeners:window.__oddListeners()}));report.listenerBaseline=baseline;
 report.reopen=[];
 for(let i=0;i<10;i++){
  await page.getByRole('button',{name:'Open Odd Ensemble ↗'}).click();await page.locator('[data-render-state=ready]').waitFor();await page.getByRole('button',{name:'Play mix',exact:true}).click();await page.waitForFunction(()=>document.querySelector('[data-toy]')?.dataset.running==='true');await page.waitForTimeout(200);
  await page.getByRole('button',{name:'Back to Labs',exact:true}).click();report.reopen.push(await page.evaluate(()=>({listeners:window.__oddListeners(),activeMedia:window.__oddMedia.filter(a=>!a.paused).length,activeContexts:window.__oddContexts.filter(c=>c.state!=='closed').length})));fs.writeFileSync(destination,JSON.stringify(report,null,2));
 }
 fs.writeFileSync(destination,JSON.stringify(report,null,2));console.log(JSON.stringify({wallSeconds:report.wallSeconds,first:samples[0],last:samples.at(-1),frameMs:report.frameMs,closed:report.closed,reopen:report.reopen,errors},null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
