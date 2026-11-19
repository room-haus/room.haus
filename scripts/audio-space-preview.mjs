import {chromium,webkit,devices} from '@playwright/test';
import {writeFileSync,mkdirSync} from 'node:fs';
const root='artifacts/audio-space';mkdirSync(root,{recursive:true});
for(const [name,type,options] of [['chromium',chromium,{viewport:{width:1440,height:1500}}],['android',chromium,devices['Pixel 7']],['mobile-webkit',webkit,devices['iPhone 13']]]){
  if(process.env.ROOM_AUDIO_SPACE_PROJECT&&process.env.ROOM_AUDIO_SPACE_PROJECT!==name)continue;
  const browser=await type.launch({headless:true}),context=await browser.newContext(options),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
    sessionStorage.setItem('room-labs-session','open');window.__spaceMedia=[];window.__spaceContexts=[];
    const Audio=window.Audio;window.Audio=function(...args){const m=new Audio(...args);window.__spaceMedia.push(m);return m;};
    const Context=window.AudioContext;if(Context)window.AudioContext=function(...args){const c=new Context(...args);window.__spaceContexts.push(c);return c;};
  });
  let evidence={name,source:'Actual MX029 CDN HLS, no media fixtures',errors};
  try{
    await page.goto((process.env.ROOM_TEST_ORIGIN||'http://127.0.0.1:4232')+'/labs/#audio-experiments');await page.getByRole('button',{name:'Open Space & echoes ↗'}).click();await page.getByRole('button',{name:'Play source',exact:true}).click();
    await page.waitForFunction(()=>Number(window.__spaceMedia[0]?.currentTime)>1,null,{timeout:30000});
    const host=page.locator('[data-audio-research]');const capable=await host.getAttribute('data-capable');
    if(capable==='true'){
      await page.getByRole('button',{name:'Processed',exact:true}).click();await page.getByRole('checkbox',{name:'Restrained stereo'}).check();await page.getByRole('button',{name:'Reverb',exact:true}).click();
      await page.waitForFunction(()=>Number(document.querySelector('[data-audio-research]')?.dataset.outputRms)>.00001);
    }
    evidence={...evidence,capable,mode:await host.getAttribute('data-mode'),rms:Number(await host.getAttribute('data-output-rms')),status:await host.locator('[role=status]').textContent(),media:await page.evaluate(()=>window.__spaceMedia.map(m=>({time:m.currentTime,paused:m.paused,rate:m.playbackRate}))),contexts:await page.evaluate(()=>window.__spaceContexts.map(c=>c.state))};
    await page.screenshot({path:`${root}/live-${name}.png`});
    if(name==='chromium'){
      await page.getByRole('button',{name:'Delay',exact:true}).click();await page.getByRole('combobox',{name:'Delay timing'}).selectOption('0.5');await page.getByRole('spinbutton',{name:'Manual tempo (BPM)'}).fill('120');await page.getByRole('button',{name:'Set tempo'}).click();await page.waitForFunction(()=>document.querySelector('.space-timing')?.textContent.includes('250 ms'));await page.screenshot({path:`${root}/controls-active.png`});
    }
    await page.getByRole('button',{name:'Back to Labs'}).click();
    evidence.cleanup=await page.evaluate(()=>({media:window.__spaceMedia.every(m=>m.paused&&!m.getAttribute('src')),contexts:window.__spaceContexts.every(c=>c.state==='closed')}));
  }catch(error){evidence.failure=error.message;}
  finally{writeFileSync(`${root}/live-${name}.json`,JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence));await browser.close();}
}
