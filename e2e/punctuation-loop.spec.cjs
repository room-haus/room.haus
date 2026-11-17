const {test, expect} = require('@playwright/test');

test('the home scene warms while browsing mixes and stays paused until shown', async ({page}) => {
  await page.emulateMedia({reducedMotion: 'no-preference'});
  await page.addInitScript(() => {
    window.studyContexts = new Set();
    window.studyDraws = 0;
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      const context = getContext.call(this, type, ...args);
      if (context && type.includes('webgl') && this.classList.contains('study-model')) {
        window.studyContexts.add(context);
      }
      return context;
    };
    for (const Context of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) {
      if (!Context) continue;
      const draw = Context.prototype.drawElements;
      Context.prototype.drawElements = function (...args) {
        if (this.canvas.classList.contains('study-model')) window.studyDraws++;
        return draw.apply(this, args);
      };
    }
  });
  await page.goto('/mixes/');
  const stage = page.locator('.type-study');
  await expect(stage).toHaveClass(/has-model/, {timeout: 10000});
  await expect(page.locator('[data-room-panel=splash]')).toHaveAttribute('inert', '');
  const frames = () => page.evaluate(() => new Promise(resolve => {
    let remaining = 6;
    const tick = () => --remaining ? requestAnimationFrame(tick) : resolve(window.studyDraws);
    requestAnimationFrame(tick);
  }));
  const prepared = await frames();
  expect(await frames()).toBe(prepared);
  expect(await page.evaluate(() => window.studyContexts.size)).toBe(1);
  await page.getByRole('link', {name: 'ROOM home'}).click();
  await expect(page.getByRole('button', {name: 'Pause rotation'})).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.studyDraws)).toBeGreaterThan(prepared);
  expect(await page.evaluate(() => window.studyContexts.size)).toBe(1);
  await page.getByRole('link', {name: 'S/S 2017-2019'}).click();
  await expect(stage).not.toBeInViewport();
  const paused = await frames();
  expect(await frames()).toBe(paused);
});

test('a failed background download retries when home is opened', async ({page}) => {
  await page.emulateMedia({reducedMotion: 'no-preference'});
  let attempts = 0;
  await page.route(/\/assets\/punctuation-loop\..*\.js/, route => {
    attempts++;
    return attempts === 1 ? route.abort() : route.continue();
  });
  const failed = page.waitForEvent('requestfailed', request => /punctuation-loop/.test(request.url()));
  await page.goto('/mixes/');
  await failed;
  await page.getByRole('link', {name: 'ROOM home'}).click();
  await expect(page.locator('.type-study')).toHaveClass(/has-model/);
  await expect(page.getByRole('button', {name: 'Pause rotation'})).toBeVisible();
  expect(attempts).toBe(2);
});

test('the loaded model crossfades from the print without moving the artwork frame', async ({page}) => {
  await page.emulateMedia({reducedMotion: 'no-preference'});
  let release;
  const ready = new Promise(resolve => { release = resolve; });
  await page.route(/\/assets\/punctuation-loop\..*\.js/, async route => {
    await ready;
    await route.continue();
  });
  await page.goto('/', {waitUntil: 'domcontentloaded'});
  const poster = page.locator('.study-poster');
  await expect(poster).toHaveCSS('opacity', '1');
  await page.evaluate(() => document.fonts.ready);
  const before = await poster.boundingBox();
  await page.evaluate(() => {
    window.handoffFrames = [];
    const sample = () => {
      const model = Number(getComputedStyle(document.querySelector('.study-model')).opacity);
      const poster = Number(getComputedStyle(document.querySelector('.study-poster')).opacity);
      window.handoffFrames.push({model, poster});
      if (model < 1) requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
  release();
  await expect(page.locator('.study-model')).toHaveCSS('opacity', '1');
  const frames = await page.evaluate(() => window.handoffFrames);
  expect(frames.some(({model, poster}) => model > 0 && model < 1 && poster > 0 && poster < 1)).toBe(true);
  expect(frames.every(({model, poster}) => model + poster >= .99)).toBe(true);
  expect(await poster.boundingBox()).toEqual(before);
  expect(await page.locator('.study-model').boundingBox()).toEqual(before);
});

test('the model retains the printed cobalt ink color', async ({page}) => {
  await page.emulateMedia({reducedMotion: 'reduce'});
  await page.goto('/');
  const inkColor = async () => {
    const shot = await page.locator('.type-study').screenshot();
    return page.evaluate(async base64 => {
      const image = new Image();
      image.src = `data:image/png;base64,${base64}`;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(image, 0, 0);
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      const colors = new Map();
      let bluePixels = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        const [r, g, b] = pixels.subarray(i, i + 3);
        if (b > r * 2 && b > g * 1.4) {
          bluePixels++;
          const key = `${r},${g},${b}`;
          colors.set(key, (colors.get(key) || 0) + 1);
        }
      }
      const dominant = [...colors].sort((a, b) => b[1] - a[1])[0];
      return {rgb: dominant?.[0].split(',').map(Number), coverage: dominant?.[1] / bluePixels};
    }, shot.toString('base64'));
  };
  const printedInk = await inkColor();
  expect(printedInk.rgb).toHaveLength(3);
  await page.getByRole('button', {name: 'Rotate loop'}).click();
  await expect(page.locator('.study-model')).toHaveCSS('opacity', '1');
  await page.getByRole('button', {name: 'Pause rotation'}).click();
  const modelInk = await inkColor();
  expect(modelInk.rgb).toHaveLength(3);
  // Compare solid ink, not the differently antialiased edges of SVG and WebGL.
  // A stray matching shade in a lighting gradient must not pass as the ink color.
  expect(modelInk.coverage).toBeGreaterThan(.1);
  modelInk.rgb.forEach((channel, i) => expect(Math.abs(channel - printedInk.rgb[i])).toBeLessThanOrEqual(3));
});

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
  await expect(canvas).toHaveCSS('opacity', '1');
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
  await expect(page.locator('.study-model')).toHaveCSS('transition-duration', '0s');
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
