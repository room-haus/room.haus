import {chromium,webkit,devices} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
const root='artifacts/audio-rhythm';mkdirSync(root,{recursive:true});
for(const [name,engine,device] of [['chromium',chromium,{viewport:{width:1440,height:1100}}],['android',chromium,devices['Pixel 7']],['mobile-webkit',webkit,devices['iPhone 13']]]){
  const browser=await engine.launch({headless:true}),context=await browser.newContext({...device,reducedMotion:'reduce'}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  try{
    await page.addInitScript(()=>{
      sessionStorage.setItem('room-labs-session','open');window.__rhythmMedia=[];window.__rhythmContexts=[];
      const Media=window.Audio;window.Audio=function(...args){const m=new Media(...args);window.__rhythmMedia.push(m);return m;};
      const Native=window.AudioContext||window.webkitAudioContext;
      if(Native){const Wrapped=function(...args){const c=new Native(...args);window.__rhythmContexts.push(c);return c;};Wrapped.prototype=Native.prototype;window.AudioContext=Wrapped;}
    });
    await page.goto((process.env.ROOM_TEST_ORIGIN||'http://127.0.0.1:4243')+'/labs/#audio-experiments');
    await page.getByRole('button',{name:'Open Additional rhythm ↗'}).click();
    await page.getByRole('button',{name:'Play source',exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('[data-audio-research]')?.getAttribute('data-playing')==='true',{},{timeout:30000});
    await page.waitForTimeout(600);
    const capable=await page.locator('[data-audio-research]').getAttribute('data-capable')==='true';
    if(capable){await page.getByRole('button',{name:'Reply',exact:true}).click();await page.getByRole('button',{name:/Start rhythm on this downbeat|Re-anchor downbeat/}).click();await page.waitForTimeout(1200);}
    const before=await page.evaluate(()=>({status:document.querySelector('.research-diagnostics pre').textContent,media:window.__rhythmMedia.map(m=>({time:m.currentTime,paused:m.paused})),contexts:window.__rhythmContexts.map(c=>c.state),timing:document.querySelector('.rhythm-timing').textContent}));
    for(const width of [390,768,1440]){
      await page.setViewportSize({width,height:1100});await page.locator('dialog').evaluate(d=>d.scrollTop=0);await page.screenshot({path:`${root}/host-${name}-${width}.png`});
    }
    await page.setViewportSize({width:390,height:844});await page.addStyleTag({content:'html{font-size:200%!important}'});await page.locator('dialog').evaluate(d=>d.scrollTop=0);await page.screenshot({path:`${root}/host-${name}-200.png`});
    await page.getByRole('button',{name:'Back to Labs'}).click();
    const after=await page.evaluate(()=>({media:window.__rhythmMedia.map(m=>({paused:m.paused,src:m.getAttribute('src')})),contexts:window.__rhythmContexts.map(c=>c.state)}));
    if(errors.length||after.media.some(m=>!m.paused||m.src)||after.contexts.some(s=>s!=='closed'))throw Error('Live cleanup/page error: '+JSON.stringify({errors,after}));
    writeFileSync(`${root}/live-${name}.json`,JSON.stringify({source:'Actual MX029 HLS, not substituted by a fixture',manualAnchor:'Trial 120 BPM; user-action phase. Not a beat synchronization or listening qualification.',before,after,errors},null,2));
    console.log(JSON.stringify({name,capable,before,after,errors}));
  }finally{await browser.close();}
}
