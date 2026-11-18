const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const evidence='docs/endless-rally';
const toy=page=>page.locator('[data-toy="endless-rally"]');
const diagnostics=async page=>JSON.parse(await toy(page).getAttribute('data-diagnostics'));
const {fixture}=require('./helpers/rally-media.cjs');
async function open(page) {
  await page.goto('/labs/#interactives');
  await page.getByRole('button',{name:/Open Endless Rally/}).click();
  await expect(page.getByRole('dialog',{name:'Endless Rally',exact:true})).toBeVisible();
}
async function play(page) {
  await page.getByRole('button',{name:'Play mix',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>window.__rallyMedia[0]?.currentTime||0)).toBeGreaterThan(.1);
}

test('Rally opens without audio, uses slider keyboard, pauses motion independently and closes cleanly',async({page})=>{
  await page.emulateMedia({reducedMotion:'no-preference'});await fixture(page);await open(page);
  expect(await page.evaluate(()=>window.__rallyMedia.length)).toBe(0);
  await play(page);
  const slider=page.getByRole('slider',{name:'Paddle position',exact:true});
  await expect(slider).toBeEnabled();await slider.focus();await slider.press('Home');
  await expect(slider).toHaveValue('-1');await slider.press('ArrowRight');
  await page.getByRole('button',{name:'Pause motion',exact:true}).click();
  await expect(slider).toBeDisabled();
  const time=await page.evaluate(()=>window.__rallyMedia[0].currentTime);
  await expect.poll(()=>page.evaluate(()=>window.__rallyMedia[0].currentTime)).toBeGreaterThan(time+.2);
  await page.getByRole('button',{name:'Back to Labs',exact:true}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await page.evaluate(()=>window.__rallyMedia.every(m=>m.paused))).toBe(true);
  await expect(page.getByRole('button',{name:/Open Endless Rally/})).toBeFocused();
});

test('reduced motion starts composed and explicit Gentle motion enables controls',async({page})=>{
  await fixture(page);await open(page);await play(page);
  await expect(page.getByRole('slider',{name:'Paddle position',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'Gentle motion',exact:true}).click();
  await expect(page.getByRole('slider',{name:'Paddle position',exact:true})).toBeEnabled();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('renderer failure retains one mix, transport and close',async({page})=>{
  await fixture(page,{graphicsFailure:true});await open(page);await play(page);
  await expect(page.getByRole('button',{name:/Retry (scene|visuals)/i})).toBeVisible();
  expect(await page.evaluate(()=>window.__rallyMedia.length)).toBe(1);
  await page.getByRole('button',{name:'Back to Labs',exact:true}).click();
  expect(await page.evaluate(()=>window.__rallyMedia.every(m=>m.paused))).toBe(true);
});

test('manual miss returns quietly; Watch, manual and recovery screenshots',async({page,isMobile},info)=>{
  if(!isMobile)await page.setViewportSize({width:1440,height:1100});
  await page.emulateMedia({reducedMotion:'no-preference'});await fixture(page);await open(page);await play(page);
  await expect(toy(page)).toHaveAttribute('data-render-state','ready');
  await expect(toy(page)).toHaveAttribute('data-mode','watch');
  fs.mkdirSync(evidence,{recursive:true});
  await page.getByRole('dialog').evaluate(e=>e.scrollTop=0);
  await page.screenshot({path:`${evidence}/${info.project.name}-watch.png`});
  await page.getByRole('button',{name:/Reset scene/}).click();
  await page.getByLabel('Keep control',{exact:true}).check();
  const slider=page.getByRole('slider',{name:'Paddle position',exact:true});
  await slider.focus();await slider.press('End');
  await expect(toy(page)).toHaveAttribute('data-mode','control');
  await expect.poll(async()=>(await diagnostics(page)).nearX).toBeGreaterThan(.4);
  await page.getByRole('button',{name:'Pause motion',exact:true}).click();
  await expect(toy(page)).toHaveAttribute('data-phase','rally');
  await page.getByRole('dialog').evaluate(e=>e.scrollTop=0);
  await page.screenshot({path:`${evidence}/${info.project.name}-manual.png`});
  await page.getByRole('button',{name:'Resume motion',exact:true}).click();
  await page.getByRole('dialog').evaluate(e=>e.scrollTop=0);
  await expect(toy(page)).toHaveAttribute('data-phase','returning');
  await page.screenshot({path:`${evidence}/${info.project.name}-recovery.png`});
  await expect(toy(page)).toHaveAttribute('data-phase','rally');
  expect((await diagnostics(page)).recoveries).toBeGreaterThan(0);
  expect((await diagnostics(page)).invalidRecoveries).toBe(0);
  expect(await page.evaluate(()=>window.__rallyMedia.length)).toBe(1);
  await page.getByRole('button',{name:'Watch',exact:true}).click();
  await expect(toy(page)).toHaveAttribute('data-mode','watch');
  if(isMobile){
    await page.locator('.listening-controls').scrollIntoViewIfNeeded();
    await page.screenshot({path:`${evidence}/${info.project.name}-controls.png`});
  }
});

test('keyboard and touch buttons, seek reset, hidden lifecycle and 200 percent text',async({page,isMobile})=>{
  await page.emulateMedia({reducedMotion:'no-preference'});await fixture(page);await open(page);await play(page);
  const canvas=page.locator('canvas');await canvas.focus();await canvas.press('ArrowRight');
  await expect(page.getByRole('slider',{name:'Paddle position',exact:true})).toHaveValue('0.1');
  const right=page.getByRole('button',{name:'Move right',exact:true});
  if(isMobile)await right.tap();else await right.click();
  await expect(page.getByRole('slider',{name:'Paddle position',exact:true})).toHaveValue('0.2');
  for(const button of await page.locator('.listening-controls button').all()){
    const box=await button.boundingBox();expect(box.height).toBeGreaterThanOrEqual(44);
  }
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
  const hidden=await diagnostics(page),time=await page.evaluate(()=>window.__rallyMedia[0].currentTime);
  await expect.poll(()=>page.evaluate(()=>window.__rallyMedia[0].currentTime)).toBeGreaterThan(time+.3);
  expect(await diagnostics(page)).toEqual(hidden);
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));});
  await expect(toy(page)).toHaveAttribute('data-running','true');
  await page.getByRole('button',{name:'Pause mix',exact:true}).click();
  await page.evaluate(()=>{window.__rallyMedia[0].currentTime=70;});
  await expect.poll(async()=>(await diagnostics(page)).collisions).toBe(0);
  await expect(page.getByRole('slider',{name:'Paddle position',exact:true})).toBeDisabled();
  await page.addStyleTag({content:'html {font-size:200% !important}'});
  // Compare with the visible layout width, not innerWidth: inert background
  // overflow can otherwise enlarge mobile coordinates and hide misplaced taps.
  expect(await page.evaluate(()=>getComputedStyle(document.documentElement).fontSize)).toBe('32px');
  expect(await page.getByRole('dialog').evaluate(e=>e.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
  await page.getByRole('button',{name:'Play mix',exact:true}).click();
  await expect(right).toBeEnabled();
  if(isMobile)await right.tap();else await right.click();
  await expect(page.getByRole('slider',{name:'Paddle position',exact:true})).toHaveValue('0.1');
});

test('audio error gives retry; ten reopen cycles never overlap media',async({page})=>{
  await fixture(page,{audioFailure:true});await open(page);
  await page.getByRole('button',{name:'Play mix',exact:true}).click();
  await expect(page.getByRole('button',{name:'Retry mix',exact:true})).toBeVisible();
  await expect(page.getByRole('slider',{name:'Paddle position',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'Back to Labs',exact:true}).click();
  for(let i=0;i<10;i++){
    await page.getByRole('button',{name:/Open Endless Rally/}).click();
    await expect(toy(page)).toHaveAttribute('data-render-state','ready');
    await page.getByRole('button',{name:'Play mix',exact:true}).click();
    await expect(page.getByRole('button',{name:'Retry mix',exact:true})).toBeVisible();
    await page.getByRole('button',{name:'Back to Labs',exact:true}).click();
  }
  expect(await page.evaluate(()=>window.__rallyMedia.every(m=>m.paused))).toBe(true);
  expect(await page.locator('canvas').count()).toBe(0);
});

test('high-DPI desktop directly grabs the paddle and follows a rightward drag',async({browser,browserName,isMobile})=>{
  test.skip(browserName!=='chromium'||isMobile,'Desktop DPR picking regression.');
  const context=await browser.newContext({baseURL:process.env.ROOM_TEST_ORIGIN||'http://127.0.0.1:4173',viewport:{width:1440,height:1100},deviceScaleFactor:2,reducedMotion:'no-preference'});
  const page=await context.newPage();await fixture(page);await open(page);await play(page);
  await page.getByRole('dialog').evaluate(e=>e.scrollTop=0);
  const box=await page.locator('canvas').boundingBox();
  const state=await diagnostics(page),halfHeight=Math.max(3.6,2.8/(box.width/box.height));
  const x=box.x+box.width/2+state.nearX*box.height/(2*halfHeight);
  const cameraLength=Math.hypot(8.8,7.6),projectedY=(2.71*8.8-.13*7.6)/cameraLength;
  const y=box.y+box.height/2+projectedY*box.height/(2*halfHeight);
  await page.mouse.move(x,y);await page.mouse.down();
  await expect(toy(page)).toHaveAttribute('data-grabbed','near-paddle');
  await page.mouse.move(x+80,y,{steps:5});
  await expect.poll(async()=>(await diagnostics(page)).nearTarget).toBeGreaterThan(state.nearX);
  await page.mouse.up();await expect(toy(page)).toHaveAttribute('data-grabbed','');
  await context.close();
});

test('close during Returning and ten playing reopen cycles dispose every owned source',async({page})=>{
  await page.emulateMedia({reducedMotion:'no-preference'});await fixture(page);await open(page);await play(page);
  await page.getByRole('slider',{name:'Paddle position',exact:true}).focus();
  await page.getByRole('slider',{name:'Paddle position',exact:true}).press('End');
  await expect(toy(page)).toHaveAttribute('data-phase','returning');
  await page.getByRole('button',{name:'Back to Labs',exact:true}).click();
  for(let i=0;i<10;i++){
    await page.getByRole('button',{name:/Open Endless Rally/}).click();
    await page.getByRole('button',{name:'Play mix',exact:true}).click();
    await expect(toy(page)).toHaveAttribute('data-running','true');
    expect(await page.evaluate(()=>window.__rallyMedia.filter(m=>!m.paused).length)).toBe(1);
    await page.getByRole('button',{name:'Back to Labs',exact:true}).click();
    expect(await page.evaluate(()=>window.__rallyMedia.every(m=>m.paused))).toBe(true);
  }
  expect(await page.locator('canvas').count()).toBe(0);
});

test('context loss and scene retry keep the same advancing mix',async({page})=>{
  await page.emulateMedia({reducedMotion:'no-preference'});await fixture(page);await open(page);await play(page);
  const time=await page.evaluate(()=>window.__rallyMedia[0].currentTime);
  await page.locator('canvas').dispatchEvent('webglcontextlost',{cancelable:true});
  await expect(toy(page)).toHaveAttribute('data-render-state','fallback');
  await expect.poll(()=>page.evaluate(()=>window.__rallyMedia[0].currentTime)).toBeGreaterThan(time+.2);
  await page.getByRole('button',{name:'Retry scene',exact:true}).click();
  await expect(toy(page)).toHaveAttribute('data-render-state','ready');
  expect(await page.evaluate(()=>window.__rallyMedia.length)).toBe(1);
});

test('lower control strip supports pointer cancellation and touch takeover',async({page,isMobile})=>{
  await page.emulateMedia({reducedMotion:'no-preference'});await fixture(page);await open(page);await play(page);
  await page.locator('canvas').scrollIntoViewIfNeeded();
  const box=await page.locator('canvas').boundingBox();
  const x=box.x+box.width*.65,y=box.y+box.height-30;
  if(isMobile){await page.touchscreen.tap(x,y);}else{
    await page.mouse.move(x,y);await page.mouse.down();
    await expect(toy(page)).toHaveAttribute('data-grabbed','near-paddle');
    await page.locator('canvas').dispatchEvent('pointercancel',{pointerId:1});
    await page.mouse.up();
  }
  await expect(toy(page)).toHaveAttribute('data-mode','control');
  await expect(toy(page)).toHaveAttribute('data-grabbed','');
  await expect.poll(async()=>(await diagnostics(page)).nearTarget).toBeGreaterThan(.1);
});
