const {test,expect}=require('@playwright/test');
const {fixture}=require('./helpers/rally-media.cjs');
const toy=page=>page.locator('[data-toy="odd-ensemble"]');
const diagnostics=page=>toy(page).getAttribute('data-diagnostics').then(JSON.parse);
async function open(page,{play=true,reduced=false,graphicsFailure=false}={}){
 await fixture(page,{graphicsFailure});await page.emulateMedia({reducedMotion:reduced?'reduce':'no-preference'});
 await page.goto('/labs/#interactives');await page.getByRole('button',{name:'Open Odd Ensemble ↗'}).click();
 await expect(toy(page)).toHaveAttribute('data-render-state',graphicsFailure?'fallback':'ready');
 if(play){await page.getByRole('button',{name:'Play mix',exact:true}).click();await expect.poll(()=>page.evaluate(()=>window.__rallyMedia[0]?.currentTime||0)).toBeGreaterThan(0);if(!reduced&&!graphicsFailure)await expect(toy(page)).toHaveAttribute('data-running','true');}
}
async function point(page){await page.locator('canvas').scrollIntoViewIfNeeded();const b=await page.locator('canvas').boundingBox(),hy=Math.max(2.25,2.85/(b.width/b.height)),hx=hy*b.width/b.height;return {x:b.x+b.width*(.5-1.65/(2*hx)),y:b.y+b.height*(.5+.37/(2*hy))};}
test('Odd Ensemble visible selection, Space and direction controls do not alter the mix',async({page})=>{
 await open(page);await page.getByRole('button',{name:'Low',exact:true}).click();await expect(toy(page)).toHaveAttribute('data-mode','watch');
 const before=await page.evaluate(()=>{const a=window.__rallyMedia[0];return {time:a.currentTime,volume:a.volume,rate:a.playbackRate,src:a.src};});
 await page.getByRole('button',{name:'Stretch',exact:true}).click({clickCount:3});await expect(toy(page)).toHaveAttribute('data-mode','control');await expect.poll(async()=>(await diagnostics(page)).lowStretch).toBeGreaterThan(1.015);
 await page.locator('canvas').focus();await page.locator('canvas').press('Space');await expect.poll(async()=>(await diagnostics(page)).pokes).toBe(1);await expect.poll(async()=>(await diagnostics(page)).neighbourReactions).toBe(1);
 await page.locator('canvas').press('ArrowUp');await expect.poll(async()=>(await diagnostics(page)).lowStretch).toBeGreaterThan(1.02);
 await page.locator('canvas').press('ArrowDown');await expect.poll(async()=>(await diagnostics(page)).lowStretch).toBeLessThan(1.01);
 await page.getByRole('button',{name:'Lean right',exact:true}).click();await expect.poll(async()=>(await diagnostics(page)).lowLean).toBeGreaterThan(.01);
 await page.getByRole('button',{name:'Reset scene'}).click();const after=await page.evaluate(()=>{const a=window.__rallyMedia[0];return {time:a.currentTime,volume:a.volume,rate:a.playbackRate,src:a.src};});expect(after.time).toBeGreaterThan(before.time);expect({...after,time:0}).toEqual({...before,time:0});expect(await page.evaluate(()=>window.__rallyMedia.length)).toBe(1);
});
test('tap pokes, drag wins after eight pixels, cancellation and second pointers are safe',async({page,isMobile})=>{
 await open(page);const p=await point(page),canvas=page.locator('canvas');
 if(isMobile)await page.touchscreen.tap(p.x,p.y);else await page.mouse.click(p.x,p.y);
 await expect.poll(async()=>(await diagnostics(page)).pokes).toBe(1);
 await page.waitForTimeout(550);
 await canvas.evaluate(el=>el.addEventListener('pointerdown',e=>{window.__oddPointerId=e.pointerId;},{once:true}));
 await page.mouse.move(p.x,p.y);await page.mouse.down();
 await canvas.dispatchEvent('pointercancel',{pointerId:await page.evaluate(()=>window.__oddPointerId),pointerType:'mouse'});await page.mouse.up();
 expect((await diagnostics(page)).pokes).toBe(1);
 await page.mouse.move(p.x,p.y);await page.mouse.down();await page.mouse.move(p.x+35,p.y-65,{steps:8});await expect(toy(page)).toHaveAttribute('data-grabbed','low');
 await canvas.dispatchEvent('pointerdown',{pointerId:99,pointerType:'touch',button:0,clientX:p.x+180,clientY:p.y});await expect(toy(page)).toHaveAttribute('data-grabbed','low');
 await page.mouse.up();await expect(toy(page)).toHaveAttribute('data-grabbed','');expect((await diagnostics(page)).pokes).toBe(1);
});
test('pause motion freezes while mix advances; seek resets and close cleans playback/focus',async({page})=>{
 await open(page);await page.getByRole('button',{name:'Stretch',exact:true}).click();await page.getByRole('button',{name:'Pause motion',exact:true}).click();
 await expect(toy(page)).toHaveAttribute('data-running','false');const pose=await toy(page).getAttribute('data-diagnostics'),time=await page.evaluate(()=>window.__rallyMedia[0].currentTime);await page.waitForTimeout(350);expect(await toy(page).getAttribute('data-diagnostics')).toBe(pose);expect(await page.evaluate(()=>window.__rallyMedia[0].currentTime)).toBeGreaterThan(time);
 await expect(page.getByRole('button',{name:'Poke',exact:true})).toBeDisabled();await page.getByRole('slider',{name:'Mix position',exact:true}).fill('40');await expect.poll(async()=>(await diagnostics(page)).lowStretch).toBe(1);
 await page.getByRole('button',{name:'Back to Labs',exact:true}).click();await expect(page.getByRole('button',{name:'Open Odd Ensemble ↗'})).toBeFocused();expect(await page.evaluate(()=>window.__rallyMedia.every(a=>a.paused&&!a.getAttribute('src')))).toBe(true);
});
test('reduced motion starts still and Gentle has no transient poke; renderer loss retains transport',async({page})=>{
 await open(page,{reduced:true});await expect(toy(page)).toHaveAttribute('data-running','false');await expect(page.getByRole('button',{name:'Gentle motion',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Gentle motion',exact:true}).click();await expect(toy(page)).toHaveAttribute('data-running','true');await page.getByRole('button',{name:'Poke',exact:true}).click();await page.waitForTimeout(650);expect((await diagnostics(page)).neighbourReactions).toBe(0);
 await page.locator('canvas').dispatchEvent('webglcontextlost');await expect(toy(page)).toHaveAttribute('data-render-state','fallback');await expect(page.locator('canvas')).toBeHidden();const time=await page.evaluate(()=>window.__rallyMedia[0].currentTime);await page.waitForTimeout(300);expect(await page.evaluate(()=>window.__rallyMedia[0].currentTime)).toBeGreaterThan(time);await page.getByRole('button',{name:'Retry scene',exact:true}).click();await expect(toy(page)).toHaveAttribute('data-render-state','ready');expect(await page.evaluate(()=>window.__rallyMedia.length)).toBe(1);
});
test('original poster fallback and responsive 200 percent text retain usable controls',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await open(page,{graphicsFailure:true});await expect(page.locator('.listening-fallback img')).toBeVisible();
 for(const width of [390,768,1440]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.querySelector('dialog').scrollWidth<=document.documentElement.clientWidth)).toBe(true);}
 await page.setViewportSize({width:390,height:844});await page.addStyleTag({content:'html{font-size:200%!important}'});expect(await page.evaluate(()=>getComputedStyle(document.documentElement).fontSize)).toBe('32px');expect(await page.evaluate(()=>document.querySelector('dialog').scrollWidth<=document.documentElement.clientWidth)).toBe(true);
 for(const name of ['Low','Knuckle','Pip']){const b=await page.getByRole('button',{name,exact:true}).boundingBox();expect(b.height).toBeGreaterThanOrEqual(44);}
 expect(errors).toEqual([]);
});
module.exports={open,point,diagnostics};
test('held ownership survives timeout and a second finger cannot change the selected member',async({page,browserName})=>{
 test.skip(browserName!=='chromium','CDP supplies simultaneous native touches in Chromium; WebKit tap/drag is covered separately.');
 await page.setViewportSize({width:768,height:1500});await open(page);const p=await point(page),pip=await page.getByRole('button',{name:'Pip',exact:true}).boundingBox();
 const cdp=await page.context().newCDPSession(page);const touch={id:1,x:p.x,y:p.y,radiusX:3,radiusY:3};
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[touch]});await expect(toy(page)).toHaveAttribute('data-grabbed','low');
 await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...touch,x:p.x+25,y:p.y-35}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...touch,x:p.x+25,y:p.y-35},{id:2,x:pip.x+pip.width/2,y:pip.y+pip.height/2,radiusX:3,radiusY:3}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...touch,x:p.x+25,y:p.y-35}]});await expect(toy(page)).toHaveAttribute('data-selected','low');
 await page.waitForTimeout(10000);await expect(toy(page)).toHaveAttribute('data-grabbed','low');await expect(toy(page)).toHaveAttribute('data-mode','control');
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await expect(toy(page)).toHaveAttribute('data-grabbed','');
 await page.getByRole('checkbox',{name:'Keep control',exact:true}).check();await page.waitForTimeout(10000);await expect(toy(page)).toHaveAttribute('data-mode','control');
 await page.getByRole('button',{name:'Watch',exact:true}).click();await expect(toy(page)).toHaveAttribute('data-mode','watch');await cdp.detach();
});
test('actual 200 percent text has no visual viewport overflow and pointer controls remain operable',async({page,isMobile})=>{
 await open(page);await page.setViewportSize({width:390,height:844});await page.addStyleTag({content:'html{font-size:200%!important}'});
 expect(await page.evaluate(()=>document.querySelector('dialog').scrollWidth<=document.documentElement.clientWidth)).toBe(true);
 const button=page.getByRole('button',{name:'Poke',exact:true});if(isMobile)await button.tap();else await button.click();await expect.poll(async()=>(await diagnostics(page)).pokes).toBe(1);
});
test('desktop 200 percent text keeps every member name fully readable',async({page})=>{
 await page.setViewportSize({width:1440,height:1000});await open(page,{play:false});await page.addStyleTag({content:'html{font-size:200%!important}'});
 for(const name of ['Low','Knuckle','Pip'])expect(await page.getByRole('button',{name,exact:true}).evaluate(e=>e.scrollWidth<=e.clientWidth)).toBe(true);
});
