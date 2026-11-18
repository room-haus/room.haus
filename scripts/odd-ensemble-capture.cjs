const {chromium,webkit,devices}=require('playwright');
const fs=require('node:fs');
const origin=process.env.ROOM_TEST_ORIGIN||'http://127.0.0.1:4195';
(async()=>{
const evidence=[];
for(const kind of (process.env.ODD_CAPTURE_KINDS||'desktop,android,webkit').split(',')){
 const browser=await(kind==='webkit'?webkit:chromium).launch({headless:true});
 try{
 const context=await browser.newContext({...kind==='desktop'?{viewport:{width:1440,height:1000}}:devices[kind==='webkit'?'iPhone 13':'Pixel 7'],reducedMotion:'no-preference'});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{sessionStorage.setItem('room-labs-session','open');const A=window.Audio;window.__captureMedia=[];window.Audio=function(...args){const a=new A(...args);window.__captureMedia.push(a);return a;};});
 await page.goto(origin+'/labs/#interactives');await page.getByRole('button',{name:'Open Odd Ensemble ↗'}).click();await page.locator('[data-render-state=ready]').waitFor();await page.getByRole('button',{name:'Play mix',exact:true}).click();await page.waitForFunction(()=>document.querySelector('[data-toy]')?.dataset.running==='true',{},{timeout:60000});await page.waitForTimeout(3000);
 await page.locator('.listening-header').scrollIntoViewIfNeeded();await page.screenshot({path:`artifacts/odd-ensemble/${kind}-passive.png`});await page.locator('.listening-stage').screenshot({path:`artifacts/odd-ensemble/${kind}-passive-stage.png`});
 await page.locator('canvas').scrollIntoViewIfNeeded();const box=await page.locator('canvas').boundingBox(),hy=Math.max(2.25,2.85/(box.width/box.height)),hx=hy*box.width/box.height;
 const x=box.x+box.width*(.5+.05/(2*hx)),y=box.y+box.height*(.5+.05/(2*hy));
 await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+box.width*.09,y-box.height*.15,{steps:16});await page.waitForTimeout(700);await page.locator('.listening-stage').screenshot({path:`artifacts/odd-ensemble/${kind}-interactive-stage.png`});await page.mouse.up();
 await page.getByRole('checkbox',{name:'Keep control',exact:true}).check();await page.getByRole('button',{name:'Poke',exact:true}).click();await page.waitForTimeout(450);
 await page.locator('.listening-header').scrollIntoViewIfNeeded();await page.screenshot({path:`artifacts/odd-ensemble/${kind}-interactive.png`});
 await page.locator('.listening-controls').screenshot({path:`artifacts/odd-ensemble/${kind}-controls.png`});
 const item=await page.evaluate(()=>({source:document.querySelector('[data-toy]').dataset.source,diagnostics:JSON.parse(document.querySelector('[data-toy]').dataset.diagnostics),media:window.__captureMedia.map(a=>({time:a.currentTime,paused:a.paused,src:a.currentSrc,rate:a.playbackRate,volume:a.volume})),overflow:document.querySelector('dialog').scrollWidth>document.documentElement.clientWidth}));
 await page.getByRole('button',{name:'Knuckle',exact:true}).click();await page.locator('canvas').focus();for(let i=0;i<20;i++)await page.locator('canvas').press('ArrowUp');await page.waitForTimeout(700);await page.locator('.listening-stage').screenshot({path:`artifacts/odd-ensemble/${kind}-maximum-stretch.png`});
 await page.emulateMedia({reducedMotion:'reduce'});await page.waitForFunction(()=>document.querySelector('[data-toy]')?.dataset.running==='false');await page.locator('.listening-header').scrollIntoViewIfNeeded();await page.screenshot({path:`artifacts/odd-ensemble/${kind}-reduced.png`});
 await page.addStyleTag({content:'html{font-size:200%!important}'});await page.locator('.listening-controls').screenshot({path:`artifacts/odd-ensemble/${kind}-200-text.png`});item.zoom=await page.evaluate(()=>({font:getComputedStyle(document.documentElement).fontSize,overflow:document.querySelector('dialog').scrollWidth>document.documentElement.clientWidth}));
 await page.addStyleTag({content:'html{font-size:100%!important}'});await page.locator('canvas').dispatchEvent('webglcontextlost');await page.locator('.listening-header').scrollIntoViewIfNeeded();await page.screenshot({path:`artifacts/odd-ensemble/${kind}-fallback.png`});
 await page.getByRole('button',{name:'Back to Labs',exact:true}).click();await page.getByRole('button',{name:'Open Odd Ensemble ↗'}).click();await page.locator('[data-render-state=ready]').waitFor();await page.locator('.listening-header').scrollIntoViewIfNeeded();await page.screenshot({path:`artifacts/odd-ensemble/${kind}-reduced-fresh.png`});
 item.errors=errors;evidence.push({kind,...item});fs.writeFileSync('artifacts/odd-ensemble/live-captures.json',JSON.stringify(evidence,null,2));
 }finally{await browser.close();}
}
console.log(JSON.stringify(evidence,null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
