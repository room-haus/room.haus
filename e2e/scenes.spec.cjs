const {test, expect} = require('@playwright/test');

test.use({reducedMotion: 'no-preference'});
for (const [id, collection] of [['MX001', 'mixes'], ['MX029', 'mixes'], ['ROOM001', 'releases']]) {
  test(id + ' renders its animated CD, plays, and returns to its cover', async ({page, isMobile}) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:4173/' + collection + '/');
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
    await expect.poll(async () => Number(await page.getByRole('slider', {name: 'Seek playback'}).inputValue())).toBeGreaterThan(1);
    if (id === 'MX029') {
      const background = page.locator('.listening-scene video');
      await expect.poll(() => background.evaluate(video => video.videoWidth > 0 && video.currentTime > 0), {timeout: 30000}).toBe(true);
    }
    await expect(page.locator('.listening-scene')).toHaveAttribute('data-scene-state', 'ready');
    await page.getByRole('link', {name: 'Back to ' + collection}).click();
    await expect(canvas).toHaveCount(0);
    await expect(sleeve).toBeFocused();
    expect(errors).toEqual([]);
  });
}
