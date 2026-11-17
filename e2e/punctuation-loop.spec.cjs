const {test, expect} = require('@playwright/test');

test('enlarged splash navigation remains scrollable and keyboard reachable on small phones', async ({page, isMobile, browserName}) => {
  await page.emulateMedia({reducedMotion: 'reduce'});
  for (const viewport of [{width: 320, height: 568}, {width: 568, height: 320}]) {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await page.addStyleTag({content: 'html { font-size: 200% !important; }'});
    const links = page.getByRole('navigation', {name: 'ROOM sections'}).getByRole('link');
    const panel = page.locator('[data-room-panel=splash]');
    await expect(panel).toHaveCSS('overflow-y', 'auto');
    await expect(panel).toHaveCSS('touch-action', 'pan-y pinch-zoom');
    if (isMobile && browserName === 'chromium') {
      const session = await page.context().newCDPSession(page);
      const x = viewport.width / 2;
      const y = viewport.height * .8;
      await session.send('Input.dispatchTouchEvent', {type:'touchStart', touchPoints:[{x,y}]});
      for (let step = 1; step <= 6; step++) {
        await session.send('Input.dispatchTouchEvent', {type:'touchMove', touchPoints:[{x,y:y - step * 30}]});
      }
      await session.send('Input.dispatchTouchEvent', {type:'touchEnd', touchPoints:[]});
      await session.detach();
    } else if (isMobile && browserName === 'webkit') {
      // Playwright's mobile WebKit has neither wheel nor swipe input. Check scroll
      // reachability and touch policy here; the Android project exercises a real swipe.
      await links.last().scrollIntoViewIfNeeded();
    } else {
      await page.mouse.move(viewport.width / 2, viewport.height / 2);
      await page.mouse.wheel(0, 1000);
    }
    await expect(links.last()).toBeInViewport({ratio: 1});
    expect(await panel.evaluate(node => node.scrollTop)).toBeGreaterThan(0);
    for (const link of await links.all()) {
      await link.focus();
      await expect(link).toBeInViewport({ratio: 1});
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
    await links.last().press('Enter');
    await expect(page.getByRole('heading', {name: 'Collective'})).toBeFocused();
    await page.getByRole('link', {name: 'ROOM home'}).press('Enter');
    await expect(links.first()).toBeFocused();
  }
});

test('the entire artwork captures drags and the mobile splash stays in the viewport', async ({page, isMobile, browserName}) => {
  await page.emulateMedia({reducedMotion: 'no-preference'});
  await page.goto('http://127.0.0.1:4173/');
  const stage = page.locator('.type-study');
  const canvas = page.locator('.study-model');
  await expect(stage).toHaveClass(/has-model/);
  await expect(stage).toHaveCSS('touch-action', 'pinch-zoom');
  // Start on the artwork's edge, outside the rotated canvas rectangle.
  const bounds = await stage.boundingBox();
  await page.mouse.move(bounds.x + 5, bounds.y + bounds.height * 0.2);
  await page.mouse.down();
  await expect(canvas).toHaveClass(/is-dragging/);
  await page.mouse.move(bounds.x + 40, bounds.y + bounds.height * 0.6, {steps: 5});
  await expect(canvas).toHaveClass(/is-dragging/);
  await page.mouse.up();
  await expect(canvas).not.toHaveClass(/is-dragging/);
  if (isMobile && browserName === 'chromium') {
    // Real browser touch input reproduces the pan/cancel path that mouse input cannot.
    const session = await page.context().newCDPSession(page);
    const x = bounds.x + bounds.width / 2;
    const y = bounds.y + bounds.height / 2;
    await session.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{x, y}]});
    for (let step = 1; step <= 4; step++) {
      await session.send('Input.dispatchTouchEvent', {type: 'touchMove', touchPoints: [{x, y: y + step * 15}]});
    }
    await expect(canvas).toHaveClass(/is-dragging/);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    await session.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
    await expect(canvas).not.toHaveClass(/is-dragging/);
    await session.detach();
  }
  // The rotation control must not start a drag through its parent.
  await page.getByRole('button', {name: 'Pause rotation'}).click();
  await expect(page.getByRole('button', {name: 'Rotate loop'})).toBeVisible();
  await expect(canvas).not.toHaveClass(/is-dragging/);
  if (isMobile) {
    const viewport = page.viewportSize();
    for (const size of [viewport, {width: viewport.height, height: viewport.width}, {width: 320, height: 568}]) {
      await page.setViewportSize(size);
      expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(size.height + 1);
      for (const link of await page.getByRole('navigation', {name: 'ROOM sections'}).getByRole('link').all()) {
        await expect(link).toBeInViewport({ratio: 1});
      }
      await page.evaluate(() => window.scrollTo(0, 100));
      expect(await page.evaluate(() => window.scrollY)).toBe(0);
    }
    await page.getByRole('link', {name: 'S/S 2017-2019'}).click();
    await expect(page.locator('.archive-main')).toBeVisible();
    await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).overflowY)).not.toBe('hidden');
  }
});

test('the 3D loop follows a drag, holds a paused pose, and resumes on release', async ({page, baseURL}) => {
  await page.emulateMedia({reducedMotion: 'no-preference'});
  await page.goto(new URL('/', baseURL || 'http://127.0.0.1:4173').href);
  const canvas = page.locator('.study-model');
  const pause = page.getByRole('button', {name: 'Pause rotation'});
  await expect(pause).toBeVisible();
  const bounds = await page.locator('.type-study').boundingBox();
  // The ticker keeps moving while rotation is paused. Compare only the artwork.
  const clip = {
    x: bounds.x + bounds.width * 0.34,
    y: bounds.y + bounds.height * 0.25,
    width: bounds.width * 0.6,
    height: bounds.height * 0.5,
  };
  const frame = () => page.screenshot({clip});
  const moving = await frame();
  await expect.poll(async () => (await frame()).equals(moving)).toBe(false);
  await pause.click();
  await page.mouse.move(0, 0);
  const stopped = await frame();
  expect((await frame()).equals(stopped)).toBe(true);
  const x = bounds.x + bounds.width * 0.55;
  const y = bounds.y + bounds.height * 0.5;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + bounds.width * 0.18, y + 10, {steps: 5});
  await expect(canvas).toHaveClass(/is-dragging/);
  await page.mouse.up();
  const turned = await frame();
  expect(turned.equals(stopped)).toBe(false);
  expect((await frame()).equals(turned)).toBe(true);
  await page.getByRole('button', {name: 'Rotate loop'}).click();
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - 30, y, {steps: 3});
  const held = await frame();
  expect((await frame()).equals(held)).toBe(true);
  await page.mouse.up();
  await expect.poll(async () => (await frame()).equals(held)).toBe(false);
});

test('reduced motion starts with the print and allows an explicit turn', async ({page, baseURL}) => {
  await page.emulateMedia({reducedMotion: 'reduce'});
  await page.goto(new URL('/', baseURL || 'http://127.0.0.1:4173').href);
  await expect(page.locator('.study-poster')).toHaveCSS('opacity', '1');
  await page.getByRole('button', {name: 'Rotate loop'}).click();
  await expect(page.getByRole('button', {name: 'Pause rotation'})).toBeVisible();
  await expect(page.locator('.study-model')).toHaveCSS('opacity', '1');
});

test('without WebGL the print and section links stay usable', async ({page, baseURL}) => {
  await page.emulateMedia({reducedMotion: 'no-preference'});
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      if (type.includes('webgl')) return null;
      return original.call(this, type, ...args);
    };
  });
  const modelLoaded = page.waitForResponse(/\/assets\/punctuation-loop\..*\.js/);
  await page.goto(new URL('/', baseURL || 'http://127.0.0.1:4173').href);
  await modelLoaded;
  await expect(page.locator('.study-model')).toBeHidden();
  await expect(page.locator('.study-poster')).toHaveCSS('opacity', '1');
  await expect(page.getByRole('navigation', {name: 'ROOM sections'}).getByRole('link')).toHaveCount(3);
  await page.getByRole('link', {name: 'Collective'}).click();
  await expect(page.getByRole('heading', {name: 'Collective'})).toBeVisible();
});

test('the marquee scrolls left and respects reduced motion', async ({page, baseURL}) => {
  await page.emulateMedia({reducedMotion: 'no-preference'});
  await page.goto(new URL('/', baseURL || 'http://127.0.0.1:4173').href);
  const track = page.locator('.ticker-track');
  const left = () => track.evaluate((el) => el.getBoundingClientRect().left);
  const start = await left();
  await expect.poll(left).toBeLessThan(start - 2);
  await page.emulateMedia({reducedMotion: 'reduce'});
  await expect(track).toHaveCSS('animation-name', 'none');
});
