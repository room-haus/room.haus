const {test,expect}=require('@playwright/test');
const base=process.env.ROOM_TEST_ORIGIN||'http://127.0.0.1:4173';
const rate=8000,seconds=180,wav=Buffer.alloc(44+rate*seconds);
wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(rate,24);wav.writeUInt32LE(rate,28);wav.writeUInt16LE(1,32);wav.writeUInt16LE(8,34);wav.write('data',36);wav.writeUInt32LE(rate*seconds,40);
for(let i=0;i<rate*seconds;i++)wav[44+i]=Math.round(128+Math.sin(i/rate*Math.PI*220)*28*(.2+.8*Math.exp(-(i/rate%.5)*16)));
async function fixture(page) {
  await page.addInitScript(src=>{
    sessionStorage.setItem('room-labs-session','open');
    const add=EventTarget.prototype.addEventListener,remove=EventTarget.prototype.removeEventListener,tracked=[];
    const selected=(target,type)=>(target===window||target===document)&&['visibilitychange','blur','resize','focus','pointerup','pointercancel'].includes(type);
    EventTarget.prototype.addEventListener=function(type,fn,options){if(selected(this,type)&&!tracked.some(t=>t.target===this&&t.type===type&&t.fn===fn))tracked.push({target:this,type,fn});return add.call(this,type,fn,options);};
    EventTarget.prototype.removeEventListener=function(type,fn,options){const i=tracked.findIndex(t=>t.target===this&&t.type===type&&t.fn===fn);if(i>=0)tracked.splice(i,1);return remove.call(this,type,fn,options);};
    window.__toyListenerCount=()=>tracked.length;
    const Native=window.Audio;window.__toyMedia=[];window.__toyContexts=[];
    window.Audio=function(){const media=new Native();window.__toyMedia.push(media);media.canPlayType=()=> 'probably';const d=Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype,'src');Object.defineProperty(media,'src',{get(){return d.get.call(this);},set(){d.set.call(this,src);}});return media;};
    const Context=window.AudioContext;if(Context)window.AudioContext=function(...args){const context=new Context(...args);window.__toyContexts.push(context);return context;};
  },'data:audio/wav;base64,'+wav.toString('base64'));
}
const toy=page=>page.locator('[data-toy="hanging-balance"]');
const diagnostics=page=>toy(page).getAttribute('data-diagnostics').then(JSON.parse);
async function open(page,{play=true,motion=true}={}) {
  await fixture(page);await page.emulateMedia({reducedMotion:motion?'no-preference':'reduce'});
  await page.goto(base+'/labs/#interactives');await page.getByRole('button',{name:'Open Hanging Balance ↗'}).click();
  await expect(toy(page)).toHaveAttribute('data-render-state','ready');
  if(play){await page.getByRole('button',{name:'Play mix',exact:true}).click();await expect.poll(()=>page.evaluate(()=>window.__toyMedia[0]?.currentTime||0)).toBeGreaterThan(0);}
  if(play&&motion)await expect(toy(page)).toHaveAttribute('data-running','true');
}
async function bellPoint(page) {
  await page.locator('canvas').scrollIntoViewIfNeeded();
  const box=await page.locator('canvas').boundingBox(),aspect=box.width/box.height,hy=Math.max(2.4,2.1/aspect),hx=hy*aspect;
  return {x:box.x+box.width*(.5-1.32/(2*hx)),y:box.y+box.height*(.5-.48/(2*hy))};
}
test('gesture start, keyboard and buttons retain one unaltered mix; reset never seeks',async({page})=>{
  await open(page,{play:false});expect(await page.evaluate(()=>window.__toyMedia.length)).toBe(0);
  await page.getByRole('button',{name:'Play mix',exact:true}).click();await expect(toy(page)).toHaveAttribute('data-running','true');
  await page.getByRole('combobox',{name:'Select a target'}).selectOption('counterweight');
  const slider=page.getByRole('slider',{name:'Counterweight',exact:true});await slider.focus();await slider.press('End');
  await expect.poll(async()=>(await diagnostics(page)).counterweight).toBeCloseTo(.8);
  await page.locator('canvas').focus();await page.locator('canvas').press('ArrowLeft');
  await expect.poll(async()=>(await diagnostics(page)).counterweight).toBeCloseTo(.77);
  await page.getByRole('button',{name:'Move left',exact:true}).click();await expect(toy(page)).toHaveAttribute('data-mode','control');
  const before=await page.evaluate(()=>({time:window.__toyMedia[0].currentTime,volume:window.__toyMedia[0].volume,rate:window.__toyMedia[0].playbackRate,src:window.__toyMedia[0].src}));
  await page.getByRole('button',{name:'Reset scene'}).click();
  const after=await page.evaluate(()=>({time:window.__toyMedia[0].currentTime,volume:window.__toyMedia[0].volume,rate:window.__toyMedia[0].playbackRate,src:window.__toyMedia[0].src}));
  expect(after.time).toBeGreaterThanOrEqual(before.time);expect(after.time-before.time).toBeLessThan(3);expect({...after,time:0}).toEqual({...before,time:0});
  expect(await page.evaluate(()=>window.__toyMedia.length)).toBe(1);await expect.poll(async()=>(await diagnostics(page)).counterweight).toBe(.5);
});
test('pause freezes pose and disables manipulation; seek resets safely while paused',async({page})=>{
  await open(page);await page.getByRole('slider',{name:'Counterweight',exact:true}).fill('1');
  await page.getByRole('button',{name:'Pause mix',exact:true}).click();await expect(toy(page)).toHaveAttribute('data-running','false');
  const pose=await toy(page).getAttribute('data-diagnostics');await page.waitForTimeout(300);await expect(toy(page)).toHaveAttribute('data-diagnostics',pose);
  await expect(page.getByRole('button',{name:'Nudge',exact:true})).toBeDisabled();
  await page.getByRole('slider',{name:'Mix position',exact:true}).fill('65');await expect.poll(async()=>(await diagnostics(page)).counterweight).toBe(.5);
  expect(await page.evaluate(()=>window.__toyMedia[0].paused)).toBe(true);
});
test('pointer cancellation releases the compliant grab and Settle preserves weight',async({page})=>{
  await open(page);const canvas=page.locator('canvas'),p=await bellPoint(page);
  await page.mouse.move(p.x,p.y);await page.mouse.down();await expect(toy(page)).toHaveAttribute('data-grabbed','bell');
  await page.mouse.move(p.x+40,p.y+25,{steps:5});await canvas.dispatchEvent('pointercancel',{pointerId:1});await expect(toy(page)).toHaveAttribute('data-grabbed','');await page.mouse.up();
  await page.getByRole('slider',{name:'Counterweight',exact:true}).fill('-1');await page.getByRole('button',{name:'Settle',exact:true}).click();
  await expect.poll(async()=>(await diagnostics(page)).counterweight).toBeCloseTo(.2);
});
test('reduced motion starts still, Gentle is explicit, OS preference pauses again',async({page})=>{
  await open(page,{motion:false});await expect(toy(page)).toHaveAttribute('data-running','false');
  await expect(page.getByRole('slider',{name:'Counterweight',exact:true})).toBeDisabled();await page.getByRole('button',{name:'Gentle motion',exact:true}).click();await expect(toy(page)).toHaveAttribute('data-running','true');
  await page.emulateMedia({reducedMotion:'no-preference'});
  await expect.poll(async()=>JSON.parse(await page.locator('.listening-diagnostics pre').textContent()).motion).toBe(1);
  await page.emulateMedia({reducedMotion:'reduce'});await expect(toy(page)).toHaveAttribute('data-running','false');
  expect(await page.evaluate(()=>window.__toyMedia[0].paused)).toBe(false);
});
test('hidden tab releases input and resumes held pose without resetting counterweight',async({page})=>{
  await open(page);await page.getByRole('slider',{name:'Counterweight',exact:true}).fill('1');
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});
  await expect(toy(page)).toHaveAttribute('data-running','false');const pose=await diagnostics(page);await page.waitForTimeout(500);
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});document.dispatchEvent(new Event('visibilitychange'));});
  await expect(toy(page)).toHaveAttribute('data-running','true');const next=await diagnostics(page);
  expect(next.counterweight).toBe(.8);expect(Math.abs(next.topAngle-pose.topAngle)).toBeLessThan(.15);
});
test('context loss falls back without pausing or recreating mix; retry replaces only renderer',async({page})=>{
  await open(page);const time=await page.evaluate(()=>window.__toyMedia[0].currentTime);
  await page.locator('canvas').dispatchEvent('webglcontextlost');await expect(toy(page)).toHaveAttribute('data-render-state','fallback');
  await expect(page.getByRole('button',{name:'Pause mix',exact:true})).toBeVisible();await expect.poll(()=>page.evaluate(()=>window.__toyMedia[0].currentTime)).toBeGreaterThan(time);
  await page.getByRole('button',{name:'Retry scene',exact:true}).click();await expect(toy(page)).toHaveAttribute('data-render-state','ready');expect(await page.evaluate(()=>window.__toyMedia.length)).toBe(1);
});
test('missing Web Audio retains playback with honest ambient label',async({page})=>{
  await page.addInitScript(()=>{window.AudioContext=undefined;window.webkitAudioContext=undefined;});await open(page);
  await expect(toy(page)).toHaveAttribute('data-source','ambient');await expect(page.getByText('Ambient motion · live analysis unavailable',{exact:true})).toBeVisible();
});
test('audio failure holds motion and offers Retry mix',async({page})=>{
  await open(page);await page.evaluate(()=>window.__toyMedia[0].dispatchEvent(new Event('error')));
  await expect(toy(page)).toHaveAttribute('data-running','false');await expect(page.getByRole('button',{name:'Retry mix',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Retry mix',exact:true}).click();await expect(toy(page)).toHaveAttribute('data-running','true');
  expect(await page.evaluate(()=>window.__toyMedia.filter(m=>!m.paused).length)).toBe(1);
});
test('ten close/reopen cycles stop every source, close contexts and restore launcher focus',async({page})=>{
  test.setTimeout(150000);await open(page);let closedListeners;
  for(let i=0;i<10;i++){
    await page.getByRole('button',{name:'Back to Labs'}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('button',{name:'Open Hanging Balance ↗'})).toBeFocused();
    expect(await page.evaluate(()=>window.__toyMedia.every(m=>m.paused))).toBe(true);
    const count=await page.evaluate(()=>window.__toyListenerCount());if(closedListeners===undefined)closedListeners=count;else expect(count).toBe(closedListeners);
    await expect.poll(()=>page.evaluate(()=>window.__toyContexts.every(c=>c.state==='closed'))).toBe(true);
    if(i<9){await page.getByRole('button',{name:'Open Hanging Balance ↗'}).click();await expect(toy(page)).toHaveAttribute('data-render-state','ready');await page.getByRole('button',{name:'Play mix',exact:true}).click();await expect(toy(page)).toHaveAttribute('data-running','true');}
  }
  expect(await page.evaluate(()=>document.body.style.overflow)).not.toBe('hidden');expect(await page.evaluate(()=>document.documentElement.style.overflow)).not.toBe('hidden');await expect(page).toHaveURL(/#interactives$/);
});
test('responsive layout, 200 percent text and touch target controls stay accessible',async({page,isMobile})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await open(page);for(const width of [390,768,1440]){
    await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.querySelector('dialog').scrollWidth<=document.documentElement.clientWidth)).toBe(true);
  }
  await page.setViewportSize({width:390,height:844});await page.addStyleTag({content:'html{font-size:200%!important}'});
  expect(await page.evaluate(()=>document.querySelector('dialog').scrollWidth<=document.documentElement.clientWidth)).toBe(true);
  await page.getByRole('combobox',{name:'Select a target'}).selectOption('stone');
  if(isMobile)await page.getByRole('button',{name:'Move right',exact:true}).tap({timeout:8000});else await page.getByRole('button',{name:'Move right',exact:true}).click();
  await expect(toy(page)).toHaveAttribute('data-mode','control');
  expect(await page.evaluate(()=>getComputedStyle(document.documentElement).fontSize)).toBe('32px');
  expect(errors).toEqual([]);
});
test('a long render stall drops physics time without interpreting continuous playback as a seek',async({page})=>{
 await open(page);await page.getByRole('slider',{name:'Counterweight',exact:true}).fill('1');
 await page.evaluate(()=>{const until=performance.now()+700;while(performance.now()<until){ /* Simulate one blocked rendering frame. */ }});
 await page.waitForTimeout(150);
 expect((await diagnostics(page)).counterweight).toBe(.8);
});
test('a second touch cannot steal a held object through the native counterweight range',async({page,isMobile,browserName})=>{
 test.skip(!isMobile||browserName!=='chromium','Actual CDP multi-touch coverage on Android emulation.');
 await page.setViewportSize({width:768,height:1200});await open(page);
 const p=await bellPoint(page),box=await page.getByRole('slider',{name:'Counterweight',exact:true}).boundingBox();
 const cdp=await page.context().newCDPSession(page);
 const first={x:p.x,y:p.y,id:1},second={x:box.x+box.width*.9,y:box.y+box.height/2,id:2};
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[first]});await expect(toy(page)).toHaveAttribute('data-grabbed','bell');
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[first,second]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[first,{...second,x:box.x+box.width*.1}]});
 await expect(toy(page)).toHaveAttribute('data-grabbed','bell');expect((await diagnostics(page)).counterweight).toBe(.5);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await expect(toy(page)).toHaveAttribute('data-grabbed','');
});
