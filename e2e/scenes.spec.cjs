const {openOptions} = require('./options.cjs');
const {test, expect} = require('@playwright/test');

test.use({reducedMotion: 'no-preference'});
for (const [id, collection] of [['MX001', 'mixes'], ['MX029', 'mixes'], ['ROOM001', 'releases']]) {
  test(id + ' renders its animated CD, plays, and returns to its cover', async ({page, isMobile}) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    if (id === 'MX029') await page.addInitScript(() => {
      const createElement = document.createElement.bind(document);
      window.roomSceneVideos = [];
      document.createElement = function (...args) {
        const element = createElement(...args);
        if (element.tagName === 'VIDEO') window.roomSceneVideos.push(element);
        return element;
      };
    });
    await page.goto((process.env.ROOM_TEST_ORIGIN || 'http://127.0.0.1:4173') + '/' + collection + '/');
    const sleeve = page.locator('#record-' + id);
    if (isMobile) await sleeve.tap();
    else {
      await sleeve.focus();
      await page.keyboard.press('Enter');
    }
    const canvas = page.getByLabel(id + ' animated CD scene');
    await expect(page.locator('.listening-scene')).toHaveAttribute('data-scene-state', 'ready', {timeout: 40000});
    await expect(canvas).toBeVisible();
    const play = page.getByRole('button', {name: 'Play', exact: true});
    if (isMobile) await play.tap();
    else {
      await play.focus();
      await page.keyboard.press('Space');
    }
    const seek = page.getByRole('slider', {name: 'Seek playback'});
    try {
      await expect.poll(async () => Number(await seek.inputValue())).toBeGreaterThan(1);
    } catch (error) {
      const transport = await page.locator('.transport').ariaSnapshot();
      const pixels = await canvas.evaluate(el => [el.width, el.height]);
      throw new Error(`Playback stopped at ${await seek.inputValue()}s. Canvas ${pixels.join('×')}.\n${transport}`, {cause: error});
    }
    // The dock stays reachable while its sound bar is hidden. Playback and the
    // WebGL canvas survive hiding, rotating the viewport, and showing it again.
    const sceneSurface = await canvas.elementHandle();
    const positionBeforeHide = Number(await seek.inputValue());
    const hide = page.getByRole('button', {name: 'Hide sound bar'});
    if (isMobile) await hide.tap();
    else await hide.press('Space');
    await expect(page.locator('#sound-bar')).toBeHidden();
    const show = page.getByRole('button', {name: 'Show sound bar'});
    if (!isMobile) await expect(show).toBeFocused();
    await expect(show).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByRole('link', {name: 'Back to ' + collection})).toBeInViewport();
    await expect.poll(() => page.locator('.seek').inputValue().then(Number)).toBeGreaterThan(positionBeforeHide + 1);
    if (isMobile) {
      const {width, height} = page.viewportSize();
      await page.setViewportSize({width: height, height: width});
      await expect(show).toBeInViewport({ratio: 1});
      await expect(page.locator('#sound-bar')).toBeHidden();
      await page.setViewportSize({width, height});
    }
    if (isMobile) await show.tap();
    else await show.press('Enter');
    await expect(seek).toBeVisible();
    expect(await canvas.evaluate((el, original) => el === original, sceneSurface)).toBe(true);
    if (id === 'MX001') {
      const surface = await canvas.elementHandle();
      const position = Number(await seek.inputValue());
      await openOptions(page);
      await page.getByRole('button', {name: 'View artwork'}).click();
      const dialog = page.getByRole('dialog');
      await dialog.getByRole('button', {name: 'Disc', exact: true}).click();
      // The native modal makes the player inert, but its audio and artist scene stay mounted.
      await expect.poll(() => page.locator('.seek').inputValue().then(Number)).toBeGreaterThan(position + 1);
      await dialog.getByRole('button', {name: 'Close'}).click();
      expect(await canvas.evaluate((el, original) => el === original, surface)).toBe(true);
      await expect(page.getByRole('button', {name: 'Pause', exact: true})).toBeVisible();
      await page.getByRole('button', {name: 'Still art', exact: true}).click();
      await expect(canvas).toHaveCount(0);
      await expect(page.locator('.still-cover')).toBeVisible();
      await openOptions(page);
      await page.getByRole('button', {name: 'Scene', exact: true}).click();
      await expect(page.locator('.listening-scene')).toHaveAttribute('data-scene-state', 'ready', {timeout: 40000});
      await expect(page.getByRole('button', {name: 'Pause', exact: true})).toBeVisible();
    }
    if (id === 'MX029') {
      const background = page.locator('.listening-scene video');
      await expect.poll(() => background.evaluate(video => video.videoWidth > 0 && video.currentTime > 0), {timeout: 30000}).toBe(true);
      // The detached video texture is distinct from the visible background video.
      await expect.poll(() => page.evaluate(() => window.roomSceneVideos.length >= 2 &&
        window.roomSceneVideos.every(video => video.videoWidth > 0 && video.currentTime > 0)), {timeout: 30000}).toBe(true);
    }
    await expect(page.locator('.listening-scene')).toHaveAttribute('data-scene-state', 'ready');
    await page.getByRole('link', {name: 'Back to ' + collection}).click();
    await expect(canvas).toHaveCount(0);
    await expect(sleeve).toBeFocused();
    expect(errors).toEqual([]);
  });
}
