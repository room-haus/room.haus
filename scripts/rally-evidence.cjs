// Local acceptance evidence; fixture playback is explicitly separate from live-CDN playback.
const {chromium,devices}=require('@playwright/test');
const fs=require('node:fs');
const os=require('node:os');
const {fixture}=require('../e2e/helpers/rally-media.cjs');
const output='docs/endless-rally';
const origin=process.env.ROOM_TEST_ORIGIN||'http://127.0.0.1:4185';
const seconds=Number(process.env.RALLY_SOAK_SECONDS||300);
const mobile=process.env.RALLY_MOBILE==='1';
const live=process.env.RALLY_LIVE==='1';
const name=process.env.RALLY_LABEL||(live?'live-cdn':mobile?'mobile-emulation':'desktop');
(async()=>{
  fs.mkdirSync(output,{recursive:true});
  const browser=await chromium.launch();
  const context=await browser.newContext(mobile?{...devices['Pixel 7'],reducedMotion:'no-preference'}:{viewport:{width:1440,height:1100},reducedMotion:'no-preference'});
  const page=await context.newPage();
  const report={origin,media:live?'Configured catalog MX029 CDN':'Generated 360-second WAV test fixture; not live listening evidence',hardware:os.cpus()[0].model,platform:process.platform,browser:browser.version(),mobileEmulation:mobile,requestedSeconds:seconds,errors:[],samples:[]};
  page.on('pageerror',error=>report.errors.push(error.message));
  if(live)await page.addInitScript(()=>{sessionStorage.setItem('room-labs-session','open');});else await fixture(page);
  await page.goto(origin+'/labs/#interactives');
  await page.getByRole('button',{name:/Open Endless Rally/}).click();
  await page.getByRole('button',{name:'Play mix',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('[data-toy="endless-rally"]')?.getAttribute('data-running')==='true',{},{timeout:30000});
  await page.getByText('Labs diagnostics',{exact:true}).click();
  await page.evaluate(()=>{
    window.__rallyTiming={start:performance.now(),previous:0,intervals:[]};
    const tick=now=>{const t=window.__rallyTiming;if(t.previous)t.intervals.push([now,now-t.previous]);t.previous=now;t.raf=requestAnimationFrame(tick);};
    window.__rallyTiming.raf=requestAnimationFrame(tick);
  });
  for(let elapsed=0;elapsed<seconds;elapsed+=10){
    await page.waitForTimeout(Math.min(10,seconds-elapsed)*1000);
    report.samples.push(await page.evaluate(()=>({wallTime:performance.now(),source:document.querySelector('[data-toy]').getAttribute('data-source'),diagnostics:JSON.parse(document.querySelector('[data-toy]').getAttribute('data-diagnostics')),resources:JSON.parse(document.querySelector('.listening-diagnostics pre').textContent)})));
    fs.writeFileSync(`${output}/${name}-performance.json`,JSON.stringify(report,null,2));
  }
  report.frameTiming=await page.evaluate(()=>{const t=window.__rallyTiming;cancelAnimationFrame(t.raf);const start=Math.max(t.start+2000,t.previous-60000),a=t.intervals.filter(([now])=>now>=start).map(([,delta])=>delta).sort((a,b)=>a-b);return {windowSeconds:(t.previous-start)/1000,count:a.length,p50:a[Math.floor(a.length*.5)],p95:a[Math.floor(a.length*.95)],max:a.at(-1)};});
  report.transport=await page.locator('.listening-transport').innerText();
  await page.getByText('Labs diagnostics',{exact:true}).click();
  await page.getByRole('dialog').evaluate(e=>e.scrollTop=0);
  await page.screenshot({path:`${output}/${name}-settled.png`});
  await page.getByRole('button',{name:'Back to Labs',exact:true}).click();
  report.afterClose=await page.evaluate(()=>({canvasCount:document.querySelectorAll('canvas').length,mediaCount:window.__rallyMedia?.length,allFixtureMediaPaused:window.__rallyMedia?.every(m=>m.paused)}));
  fs.writeFileSync(`${output}/${name}-performance.json`,JSON.stringify(report,null,2));
  console.log(JSON.stringify({name,frameTiming:report.frameTiming,first:report.samples[0],last:report.samples.at(-1),errors:report.errors,afterClose:report.afterClose}));
  await browser.close();
})().catch(error=>{console.error(error);process.exit(1);});
