import {chromium,webkit} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
const root='artifacts/audio-memory';mkdirSync(root,{recursive:true});
for(const [name,engine] of [['chromium',chromium],['webkit',webkit]]){
  const browser=await engine.launch({headless:true}),page=await browser.newPage(),report={browser:name,source:'Actual configured MX029 HLS; no fixture replacement',samples:[]};
  try{
    await page.addInitScript(()=>{
      sessionStorage.setItem('room-labs-session','open');window.__memorySamples=[];window.__memoryContexts=[];
      const native=AudioBuffer.prototype.copyToChannel;AudioBuffer.prototype.copyToChannel=function(data,...args){let peak=0,sum=0;for(const v of data){peak=Math.max(peak,Math.abs(v));sum+=v*v;}window.__memorySamples.push({length:data.length,rate:this.sampleRate,peak,rms:Math.sqrt(sum/data.length)});return native.call(this,data,...args);};
      const Native=window.AudioContext;if(Native)window.AudioContext=class extends Native{constructor(...args){super(...args);window.__memoryContexts.push(this);}};
    });
    await page.goto((process.env.ROOM_TEST_ORIGIN||'http://127.0.0.1:4266')+'/labs/#audio-experiments');await page.getByRole('button',{name:'Open Memory & fragments ↗'}).click();await page.getByRole('button',{name:'Open live fragment study'}).click();await page.getByRole('button',{name:'Play source',exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('[data-audio-research]')?.dataset.playing==='true',{},{timeout:25000});
    const listen=page.getByRole('button',{name:'Start recent listening',exact:true});
    try{await listen.waitFor({state:'visible',timeout:2000});await page.waitForFunction(()=>!Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Start recent listening')?.disabled,{},{timeout:5000});}catch{/* Native HLS may honestly remain unsupported. */}
    report.supported=await listen.isEnabled();
    if(report.supported){await listen.click();await page.getByRole('button',{name:'Capture fragment',exact:true}).click();await page.waitForFunction(()=>document.querySelector('[data-memory]')?.dataset.ready==='true',{},{timeout:5000});report.samples=await page.evaluate(()=>window.__memorySamples);await page.getByRole('button',{name:'Play fragment',exact:true}).click();await page.waitForFunction(()=>{const d=JSON.parse(document.querySelector('.research-diagnostics pre').textContent);return d.scheduled===1&&d.voices>0;},{},{timeout:3000});}
    report.sourcePosition=await page.getByRole('slider',{name:'Source position'}).inputValue();report.state=await page.locator('[data-memory]').innerText();report.diagnostics=JSON.parse(await page.locator('.research-diagnostics pre').textContent());await page.locator('dialog').screenshot({path:`${root}/live-${name}.png`});
    await page.getByRole('button',{name:'Back to Labs'}).click();report.contexts=await page.evaluate(()=>window.__memoryContexts.map(c=>c.state));
  }catch(error){report.error=error.message;}finally{await browser.close();}
  writeFileSync(`${root}/live-${name}.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}
