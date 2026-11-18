const {chromium,webkit,devices}=require('playwright');
const fs=require('node:fs'),path=require('node:path');
const output=path.resolve('artifacts/hanging-balance');
(async()=>{
 const report=[];
 for(const [name,engine,options] of [
  ['desktop',chromium,{viewport:{width:1440,height:1100}}],
  ['android',chromium,{...devices['Pixel 7']}],
  ['webkit',webkit,{...devices['iPhone 13']}],
 ]){
  const browser=await engine.launch(),page=await browser.newPage({...options,reducedMotion:'no-preference'}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{sessionStorage.setItem('room-labs-session','open');const Audio=window.Audio;window.__media=[];window.Audio=function(...args){const a=new Audio(...args);window.__media.push(a);return a;};});
  await page.goto((process.env.ROOM_TEST_ORIGIN||'http://127.0.0.1:4190')+'/labs/#interactives');
  await page.getByRole('button',{name:'Open Hanging Balance ↗'}).click();await page.locator('[data-render-state="ready"]').waitFor();
  await page.getByRole('button',{name:'Play mix',exact:true}).click();
  let playing=true;try{await page.waitForFunction(()=>window.__media[0]?.currentTime>1,{},{timeout:25000});}catch{playing=false;}
  await page.locator('dialog').evaluate(e=>e.scrollTop=0);await page.screenshot({path:path.join(output,`passive-${name}-final.png`)});
  const source=await page.locator('[data-toy]').getAttribute('data-source');
  let timing=null;
  if(playing&&name!=='webkit'){
   await page.evaluate(()=>{window.__times=[];let last=performance.now();const step=now=>{window.__times.push(now-last);last=now;window.__raf=requestAnimationFrame(step);};window.__raf=requestAnimationFrame(step);});
   await page.waitForTimeout(60000);
   timing=await page.evaluate(()=>{cancelAnimationFrame(window.__raf);const v=window.__times.slice(5).sort((a,b)=>a-b);const canvas=document.querySelector('canvas'),gl=canvas.getContext('webgl2')||canvas.getContext('webgl'),debug=gl?.getExtension('WEBGL_debug_renderer_info');return {frames:v.length,p95:v[Math.floor(v.length*.95)],max:v.at(-1),renderer:debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):'unavailable',metrics:JSON.parse(document.querySelector('.listening-diagnostics pre').textContent)};});
  }
  let interaction=null;
  if(playing){
   await page.getByRole('slider',{name:'Counterweight',exact:true}).fill('-1');await page.getByRole('button',{name:'Settle',exact:true}).click();await page.waitForTimeout(1800);
   const left=JSON.parse(await page.locator('[data-toy]').getAttribute('data-diagnostics')).topAngle;
   await page.getByRole('slider',{name:'Counterweight',exact:true}).fill('1');await page.getByRole('button',{name:'Settle',exact:true}).click();await page.waitForTimeout(1800);
   const right=JSON.parse(await page.locator('[data-toy]').getAttribute('data-diagnostics')).topAngle;interaction={left,right};
   await page.getByRole('checkbox',{name:'Keep control'}).check();await page.locator('dialog').evaluate(e=>e.scrollTop=0);await page.screenshot({path:path.join(output,`interactive-${name}-final.png`)});
   if(name==='android'){
    await page.getByRole('button',{name:'Reset scene'}).click();await page.locator('canvas').scrollIntoViewIfNeeded();
    const box=await page.locator('canvas').boundingBox(),hy=Math.max(2.4,2.1/(box.width/box.height)),hx=hy*box.width/box.height;
    const x=box.x+box.width*(.5-1.32/(2*hx)),y=box.y+box.height*(.5-.48/(2*hy));
    const cdp=await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:11}]});
    await page.waitForTimeout(100);
    interaction.touchGrab=await page.locator('[data-toy]').getAttribute('data-grabbed');
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+35,y:y+30,id:11}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    interaction.touchReleased=await page.locator('[data-toy]').getAttribute('data-grabbed');
   }
  }
  await page.getByRole('button',{name:'Settle',exact:true}).scrollIntoViewIfNeeded();await page.screenshot({path:path.join(output,`controls-${name}.png`)});
  await page.addStyleTag({content:'html{font-size:200%!important}'});await page.locator('dialog').evaluate(e=>e.scrollTop=0);
  const layout=await page.evaluate(()=>({innerWidth,document:document.documentElement.scrollWidth,dialog:document.querySelector('dialog').scrollWidth}));
  await page.screenshot({path:path.join(output,`text-200-${name}.png`)});
  await page.getByRole('button',{name:'Back to Labs',exact:true}).click();
  const cleanup=await page.evaluate(()=>window.__media.every(m=>m.paused));
  report.push({name,playing,source,timing,interaction,layout,errors,cleanup});await browser.close();
 }
 fs.writeFileSync(path.join(output,'live-device-emulation.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
