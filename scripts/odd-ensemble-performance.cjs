const {chromium,devices}=require('playwright');
const fs=require('node:fs');const os=require('node:os');
const origin=process.env.ROOM_TEST_ORIGIN||'http://127.0.0.1:4196';
(async()=>{
 const results=[];
 for(const kind of ['desktop','android']){
  const headless=process.env.ODD_HEADFUL!=='1';const browser=await chromium.launch({headless,args:['--mute-audio']});
  try{
   const page=await browser.newPage({...kind==='desktop'?{viewport:{width:1440,height:1000},deviceScaleFactor:2}:devices['Pixel 7'],reducedMotion:'no-preference'});
   await page.addInitScript(()=>sessionStorage.setItem('room-labs-session','open'));await page.goto(origin+'/labs/#interactives');await page.getByRole('button',{name:'Open Odd Ensemble ↗'}).click();await page.locator('[data-render-state=ready]').waitFor();await page.getByRole('button',{name:'Play mix',exact:true}).click();await page.waitForFunction(()=>document.querySelector('[data-toy]')?.dataset.running==='true');await page.waitForTimeout(5000);
   const graphics=await page.evaluate(()=>{const canvas=document.querySelector('canvas'),gl=canvas.getContext('webgl2')||canvas.getContext('webgl');const ext=gl.getExtension('WEBGL_debug_renderer_info');return {renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),dpr:devicePixelRatio,pixels:[canvas.width,canvas.height]};});
   const before=await page.locator('.listening-diagnostics pre').textContent();
   const intervals=await page.evaluate(()=>new Promise(resolve=>{const times=[],start=performance.now();let previous=start;const sample=now=>{times.push(now-previous);previous=now;if(now-start>=60000)resolve(times);else requestAnimationFrame(sample);};requestAnimationFrame(sample);}));
   intervals.shift();intervals.sort((a,b)=>a-b);const after=JSON.parse(await page.locator('.listening-diagnostics pre').textContent());
   results.push({kind,hardware:os.cpus()[0].model,headless,graphics,origin,seconds:60,before:JSON.parse(before),after,frameMs:{samples:intervals.length,p50:intervals[Math.floor(intervals.length*.5)],p95:intervals[Math.floor(intervals.length*.95)],max:intervals.at(-1)}});
   fs.writeFileSync('artifacts/odd-ensemble/frame-timing.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results.at(-1)));
  }finally{await browser.close();}
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
