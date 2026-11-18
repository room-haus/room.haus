const {test, expect} = require('@playwright/test');
const base = process.env.ROOM_TEST_ORIGIN || 'http://127.0.0.1:4173';

// A changing real browser media clock; zero audio in a quiet passage and bounded
// tones elsewhere. This fixture tests behavior, never musical/artistic fidelity.
const rate = 8000, count = rate * 165;
const wav = Buffer.alloc(44 + count, 128);
wav.write('RIFF'); wav.writeUInt32LE(36 + count, 4); wav.write('WAVEfmt ', 8);
wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(rate, 24); wav.writeUInt32LE(rate, 28);
wav.writeUInt16LE(1, 32); wav.writeUInt16LE(8, 34); wav.write('data', 36); wav.writeUInt32LE(count, 40);
for (let i = 0; i < count; i++) {
  const t = i / rate, pulse = .25 + .75 * Math.exp(-(t % .5) * 16);
  const level = t >= 74 && t < 78 ? 0 : pulse * 40;
  wav[44 + i] = Math.round(128 + Math.sin(t * Math.PI * 2 * 110) * level);
}

async function fixture(page) {
  await page.addInitScript((src) => {
    sessionStorage.setItem('room-labs-session', 'open');
    const Native = window.Audio;
    window.__underlevelMedia = [];
    window.Audio = function () {
      const media = new Native();
      window.__underlevelMedia.push(media);
      media.canPlayType = () => 'probably';
      const descriptor = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'src');
      Object.defineProperty(media, 'src', {get() { return descriptor.get.call(this); }, set() { descriptor.set.call(this, src); }});
      return media;
    };
  }, 'data:audio/wav;base64,' + wav.toString('base64'));
}
const stage = page => page.locator('[data-render-state]');
async function openExperience(page) {
  await page.goto(base + '/labs/#experiences');
  await page.getByRole('button', {name: 'Open The Underlevel ↗'}).click();
  await expect(page.getByRole('dialog', {name: 'The Underlevel', exact: true})).toBeVisible();
}
async function enter(page) {
  await openExperience(page);
  await page.getByRole('button', {name: /enter.*play mix/i}).click();
  await expect.poll(() => page.evaluate(() => window.__underlevelMedia[0]?.currentTime || 0)).toBeGreaterThan(0);
}
async function seek(page, time) {
  await page.evaluate(time => {window.__underlevelMedia[0].currentTime = time;}, time);
  await expect.poll(async () => Math.abs(Number(await stage(page).getAttribute('data-time'))-time)).toBeLessThan(2);
}

test('Underlevel starts only by gesture; reduced motion holds STILL and controls fit', async ({page}) => {
  await fixture(page);
  await openExperience(page);
  await expect(page.getByRole('heading', {name:'The Underlevel',exact:true})).toBeVisible();
  expect(await page.evaluate(() => window.__underlevelMedia.length)).toBe(0);
  await page.getByRole('button', {name:/enter.*play mix/i}).click();
  await expect(stage(page)).toHaveAttribute('data-mode', 'STILL');
  const first = await stage(page).getAttribute('data-pose');
  await seek(page, 90);
  await expect(stage(page)).toHaveAttribute('data-pose', first);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  if (await page.locator('audio[controls]').count()) await expect(page.locator('audio[controls]')).toBeVisible();
  else await expect(page.getByRole('slider', {name:/volume/i})).toBeVisible();
});

test('Underlevel audio clock reconstructs reveal and manual controls keep ownership', async ({page}) => {
  await page.emulateMedia({reducedMotion:'no-preference'});
  await fixture(page);
  await enter(page);
  await expect(stage(page)).toHaveAttribute('data-render-state','ready');
  await seek(page, 90);
  await expect(stage(page)).toHaveAttribute('data-chapter','THE HALL');
  await expect(stage(page)).toHaveAttribute('data-gate','1.000');
  await seek(page, 10);
  await expect(stage(page)).toHaveAttribute('data-chapter','THRESHOLD');
  await expect(stage(page)).toHaveAttribute('data-gate','0.000');
  const canvas = page.locator('canvas');
  await canvas.focus(); await canvas.press('ArrowLeft');
  await expect(stage(page)).toHaveAttribute('data-mode','EXPLORE');
  await page.getByRole('button', {name:'STILL',exact:true}).click();
  await expect(stage(page)).toHaveAttribute('data-mode','STILL');
  const pose = await stage(page).getAttribute('data-pose');
  await seek(page, 95);
  await expect(stage(page)).toHaveAttribute('data-pose',pose);
  expect(await page.evaluate(() => window.__underlevelMedia.length)).toBe(1);
});

test('Underlevel WebGL failure keeps the canonical native audio player', async ({page}) => {
  await fixture(page);
  await page.addInitScript(() => {
    const get = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type, ...args) {
      return /webgl/i.test(type) ? null : get.call(this, type, ...args);
    };
  });
  await enter(page);
  await expect(stage(page)).toHaveAttribute('data-render-state','fallback');
  await expect(page.locator('audio[controls]')).toBeVisible();
  expect(await page.evaluate(() => window.__underlevelMedia.length)).toBe(1);
});

test('Underlevel pause stops media and seeking stays available', async ({page, browserName}) => {
  test.skip(browserName === 'webkit', 'Native player controls are covered by the fallback test.');
  await fixture(page); await enter(page);
  await page.getByRole('button',{name:'Pause mix',exact:true}).click();
  await expect.poll(() => page.evaluate(() => window.__underlevelMedia[0].paused)).toBe(true);
  const paused = await page.evaluate(() => window.__underlevelMedia[0].currentTime);
  await expect(page.getByRole('button',{name:'Play mix',exact:true})).toBeVisible();
  await seek(page,40);
  expect(await page.evaluate(() => window.__underlevelMedia[0].paused)).toBe(true);
  expect(paused).toBeGreaterThan(0);
});

test('Underlevel permits deliberate exploration while the mix is paused', async ({page}) => {
  await page.emulateMedia({reducedMotion:'no-preference'});
  await fixture(page); await enter(page);
  await page.evaluate(() => window.__underlevelMedia[0].pause());
  await page.getByRole('button',{name:'EXPLORE',exact:true}).click();
  const previous = await stage(page).getAttribute('data-pose');
  await page.getByRole('button',{name:'Move forward',exact:true}).click();
  await expect(stage(page)).not.toHaveAttribute('data-pose',previous);
  expect(await page.evaluate(() => window.__underlevelMedia[0].paused)).toBe(true);
});

test('Underlevel does not lower a sought gate through a visitor in STILL', async ({page}) => {
  await page.emulateMedia({reducedMotion:'no-preference'});
  await fixture(page); await enter(page);
  await page.evaluate(() => window.__underlevelMedia[0].pause());
  await seek(page,82);
  await page.getByRole('button',{name:'STILL',exact:true}).click();
  const pose = await stage(page).getAttribute('data-pose');
  expect(JSON.parse(pose).z).toBeCloseTo(32,0);
  await seek(page,0);
  await expect(stage(page)).toHaveAttribute('data-pose',pose);
  await expect(stage(page)).toHaveAttribute('data-gate','1.000');
});

test('Underlevel responds to OS reduced motion during playback', async ({page}) => {
  await page.emulateMedia({reducedMotion:'no-preference'});
  await fixture(page); await enter(page);
  await page.emulateMedia({reducedMotion:'reduce'});
  await expect(stage(page)).toHaveAttribute('data-mode','STILL');
  const pose = await stage(page).getAttribute('data-pose');
  await seek(page,90);
  await expect(stage(page)).toHaveAttribute('data-pose',pose);
});

test('Underlevel enemies react in DRIFT and take attacks only in EXPLORE', async ({page}) => {
  await page.emulateMedia({reducedMotion:'no-preference'});
  await fixture(page); await enter(page);
  await page.evaluate(() => window.__underlevelMedia[0].pause());
  await expect(stage(page)).toHaveAttribute('data-enemy','bone-listener');
  await expect(stage(page)).toHaveAttribute('data-enemy-health','3');
  await page.getByRole('button',{name:'Provoke Bone listener',exact:true}).press('Enter');
  await expect(stage(page)).toHaveAttribute('data-enemy-health','3');
  await expect(stage(page)).toHaveAttribute('data-mode','DRIFT');
  await page.getByRole('button',{name:'EXPLORE',exact:true}).click();
  for (const health of ['2','1']) {
    // The authored hit cooldown prevents rapid repeated flashing.
    await page.waitForTimeout(700);
    await page.getByRole('button',{name:'Attack Bone listener',exact:true}).click();
    await expect(stage(page)).toHaveAttribute('data-enemy-health',health);
  }
  await page.waitForTimeout(700);
  await page.getByRole('button',{name:'Attack Bone listener',exact:true}).click();
  await expect(stage(page)).toHaveAttribute('data-reaction',/disperses/);
  await expect(page.getByRole('button',{name:'Attack Bone listener',exact:true})).toHaveCount(0);
  await expect(stage(page)).toHaveAttribute('data-mode','EXPLORE');
  expect(await page.evaluate(() => window.__underlevelMedia[0].paused)).toBe(true);
});

test('Underlevel HUD explains signal mappings and encounters reset on seek', async ({page}) => {
  await page.emulateMedia({reducedMotion:'no-preference'});
  await fixture(page); await enter(page);
  await page.evaluate(() => window.__underlevelMedia[0].pause());
  await page.getByRole('button',{name:'EXPLORE',exact:true}).click();
  await page.getByRole('button',{name:'Attack Bone listener',exact:true}).click();
  await expect(stage(page)).toHaveAttribute('data-enemy-health','2');
  await seek(page,20);
  await expect(stage(page)).toHaveAttribute('data-enemy-health','3');
  await page.getByText('Signal map',{exact:true}).click();
  await expect(page.getByText(/Bass.*lantern|Lantern.*bass/i).first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('Underlevel character cards accept direct pointer attacks and hold mana while paused', async ({page, isMobile}) => {
  await page.emulateMedia({reducedMotion:'no-preference'});
  await fixture(page); await enter(page);
  await page.evaluate(() => window.__underlevelMedia[0].pause());
  await page.getByRole('button',{name:'EXPLORE',exact:true}).click();
  await page.locator('canvas').scrollIntoViewIfNeeded();
  const box = await page.locator('canvas').boundingBox();
  const x = box.x + box.width * .5, y = box.y + box.height * .55;
  if (isMobile) await page.touchscreen.tap(x,y);
  else await page.mouse.click(x,y);
  await expect(stage(page)).toHaveAttribute('data-enemy-health','2');
  await expect(page.getByRole('meter',{name:'Health 2 of 3',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Cast static',exact:true})).toBeDisabled();
  await expect(stage(page)).toHaveAttribute('data-signal-source','paused');
  const mana = await stage(page).getAttribute('data-mana');
  await page.waitForTimeout(600);
  await expect(stage(page)).toHaveAttribute('data-mana',mana);
});

test('Underlevel mobile targeting excludes a card outside the viewport', async ({page, isMobile}) => {
  test.skip(!isMobile,'Narrow viewport regression.');
  await page.emulateMedia({reducedMotion:'no-preference'});
  await fixture(page); await enter(page);
  await page.evaluate(() => window.__underlevelMedia[0].pause());
  await seek(page,86);
  await page.getByRole('button',{name:'EXPLORE',exact:true}).click();
  await page.getByRole('button',{name:'Move forward',exact:true}).click();
  await expect.poll(async () => JSON.parse(await stage(page).getAttribute('data-pose')).z).toBeCloseTo(40,0);
  await expect(page.getByRole('button',{name:'Attack Ash moth',exact:true})).toHaveCount(0);
});

test('Underlevel narration holds on pause and follows actual location after seeking', async ({page}) => {
  await page.emulateMedia({reducedMotion:'no-preference'});
  await fixture(page); await enter(page);
  const messages = page.getByRole('region',{name:'Dungeon messages',exact:true});
  await expect(messages).not.toHaveAttribute('data-message-id','');
  const text = await messages.innerText();
  await page.evaluate(() => window.__underlevelMedia[0].pause());
  await page.waitForTimeout(600);
  await expect(messages).toHaveText(text);
  await page.getByRole('button',{name:'EXPLORE',exact:true}).click();
  await seek(page,25);
  await expect(messages).toHaveAttribute('data-message-id','');
  await seek(page,90);
  await page.evaluate(() => window.__underlevelMedia[0].play());
  await expect(messages).not.toHaveAttribute('data-message-id','');
  await expect(messages).not.toHaveAttribute('data-message-kind','hall');
  await expect(stage(page)).toHaveAttribute('data-mode','EXPLORE');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('Underlevel player card reflects mode and shared mana', async ({page}) => {
  await fixture(page); await enter(page);
  const player = page.getByRole('region',{name:'Player character',exact:true});
  await expect(player).toContainText('HP 3/3');
  await expect(player).toContainText('STILL');
  await expect(player).toHaveAttribute('data-tempo','false');
  await page.getByRole('button',{name:'EXPLORE',exact:true}).click();
  await expect(player).toContainText('EXPLORE');
  await expect.poll(async () => {
    const charge = await page.getByRole('meter',{name:'Mana charge',exact:true}).getAttribute('value');
    return (await player.innerText()).includes(`MP ${charge}`);
  }).toBe(true);
});

test('Underlevel modal keeps Labs inert, closes with Escape or Exit, and releases playback', async ({page}) => {
  await fixture(page);
  await openExperience(page);
  const dialog = page.getByRole('dialog', {name: 'The Underlevel', exact: true});
  await expect(page).toHaveURL(/\/labs\/#experiences$/);
  await expect(page.getByRole('button', {name: /enter.*play mix/i})).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.querySelector('dialog').contains(document.activeElement))).toBe(true);
  expect(await dialog.evaluate(element => element.matches(':modal'))).toBe(true);
  // A native modal can tab into browser chrome, but never into the inert Labs UI.
  await page.getByRole('button', {name: 'Open The Underlevel ↗'}).evaluate(element => element.focus());
  expect(await page.locator('#labs-root').evaluate(element => element.contains(document.activeElement))).toBe(false);
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Tab');
    expect(await page.locator('#labs-root').evaluate(element => element.contains(document.activeElement))).toBe(false);
  }
  await page.getByRole('button', {name: /enter.*play mix/i}).click();
  await expect(stage(page)).toHaveAttribute('data-render-state', 'ready');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('button', {name: 'Open The Underlevel ↗'})).toBeFocused();
  expect(await page.evaluate(() => window.__underlevelMedia.every(media => media.paused))).toBe(true);
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe('hidden');
  await page.getByRole('button', {name: 'Open The Underlevel ↗'}).click();
  await page.getByRole('button', {name: /enter.*play mix/i}).click();
  await expect(stage(page)).toHaveAttribute('data-render-state', 'ready');
  await page.getByRole('button', {name: 'Exit Underlevel', exact: true}).click();
  await expect(dialog).toHaveCount(0);
  expect(await page.evaluate(() => window.__underlevelMedia.every(media => media.paused))).toBe(true);
  await expect(page.getByRole('button', {name: 'Open The Underlevel ↗'})).toBeFocused();
});

test('Underlevel has no standalone URL and a Labs refresh does not reopen it', async ({page, request}) => {
  for (const path of ['/underlevel', '/underlevel/', '/underlevel/index.html']) {
    expect((await request.get(base + path)).status()).toBe(404);
  }
  await fixture(page);
  await openExperience(page);
  await page.reload();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('heading', {name: 'Experiences', exact: true})).toBeVisible();
  await page.getByRole('button', {name: 'Sign out', exact: true}).click();
  await expect(page.getByLabel('Username')).toBeVisible();
  await expect(page.getByRole('button', {name: 'Open The Underlevel ↗'})).toHaveCount(0);
});

test('Underlevel retries a failed download when reopened', async ({page}) => {
  await fixture(page);
  let blocked = false;
  await page.route('**/assets/underlevel.*.js', async route => {
    if (!blocked) { blocked = true; await route.abort(); }
    else await route.continue();
  });
  await openExperience(page);
  await expect(page.getByRole('alert')).toContainText('could not load');
  await page.getByRole('button', {name: 'Back to Labs', exact: true}).click();
  await page.getByRole('button', {name: 'Open The Underlevel ↗'}).click();
  await expect(page.getByRole('button', {name: /enter.*play mix/i})).toBeVisible();
  expect(blocked).toBe(true);
  expect(await page.evaluate(() => window.__underlevelMedia.length)).toBe(0);
});
