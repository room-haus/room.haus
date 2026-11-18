const {chromium}=require('playwright'),fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
 const context=await browser.newContext({viewport:{width:1280,height:960},reducedMotion:'no-preference',recordVideo:{dir:'artifacts/odd-ensemble/video',size:{width:960,height:720}}}),page=await context.newPage();
 await page.addInitScript(()=>sessionStorage.setItem('room-labs-session','open'));await page.goto('http://127.0.0.1:4196/labs/#interactives');await page.getByRole('button',{name:'Open Odd Ensemble ↗'}).click();await page.locator('[data-render-state=ready]').waitFor();await page.getByRole('button',{name:'Play mix',exact:true}).click();await page.waitForFunction(()=>document.querySelector('[data-toy]')?.dataset.running==='true');
 await page.locator('.listening-header').scrollIntoViewIfNeeded();const samples=[],started=Date.now();
 for(let minute=0;minute<=5;minute++){if(minute)await page.waitForTimeout(60000);samples.push({wallSeconds:(Date.now()-started)/1000,...JSON.parse(await page.locator('[data-toy]').getAttribute('data-diagnostics'))});await page.locator('.listening-stage').screenshot({path:`artifacts/odd-ensemble/passive-minute-${minute}.png`});}
 const reactions=samples.at(-1).neighbourReactions;await page.getByRole('button',{name:'Knuckle',exact:true}).click();await page.getByRole('button',{name:'Poke',exact:true}).click();await page.waitForFunction(n=>JSON.parse(document.querySelector('[data-toy]').dataset.diagnostics).neighbourReactions>n,reactions);await page.waitForTimeout(450);await page.locator('.listening-stage').screenshot({path:'artifacts/odd-ensemble/neighbour-response.png'});await page.waitForTimeout(3000);
 const video=page.video();await context.close();const file=await video.path();fs.renameSync(file,'artifacts/odd-ensemble/passive-and-poke.webm');fs.writeFileSync('artifacts/odd-ensemble/five-minute-observation.json',JSON.stringify({origin:'http://127.0.0.1:4196',mode:'built, live CDN; headless desktop; video has no audio track',samples,video:'passive-and-poke.webm'},null,2));console.log(JSON.stringify({samples,video:'artifacts/odd-ensemble/passive-and-poke.webm'}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
