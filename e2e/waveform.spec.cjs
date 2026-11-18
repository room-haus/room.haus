const {test, expect} = require('@playwright/test');

// Only count traces that extend away from the center line. Two different
// traces establish that the canvas is responding to the playing recording.
async function trace(canvas) {
  return canvas.evaluate(el => {
    const data = el.getContext('2d').getImageData(0, 0, el.width, Math.floor(el.height * 0.46)).data;
    let hash = 0;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] > 32) hash = (Math.imul(hash, 31) + i) >>> 0;
    }
    return hash;
  });
}

test('the main waveform reacts to the music and seeks with Options closed', async ({page, isMobile}) => {
  await page.goto((process.env.ROOM_TEST_ORIGIN || 'http://127.0.0.1:4173') + '/mixes/MX029/?t=30');
  // Start from still art, then enable motion without changing the visual mode.
  await expect(page.getByRole('button', {name: 'Play', exact: true})).toBeVisible();
  await page.emulateMedia({reducedMotion: 'no-preference'});
  const play = page.getByRole('button', {name: 'Play', exact: true});
  if (isMobile) await play.tap();
  else await play.press('Space');
  const seek = page.getByRole('slider', {name: 'Seek playback'});
  const scope = page.locator('.wave-seek canvas');
  await expect(scope).toBeInViewport({ratio: 1});
  await expect(page.locator('.player-options')).not.toHaveAttribute('open', '');
  await expect.poll(() => trace(scope)).toBeGreaterThan(0);
  const initial = await trace(scope);
  await expect.poll(async () => {
    const value = await trace(scope);
    return value !== 0 && value !== initial;
  }).toBe(true);
  const pause = page.getByRole('button', {name: 'Pause', exact: true});
  if (isMobile) await pause.tap();
  else await pause.press('Space');
  await expect(play).toBeVisible();
  const before = Number(await seek.inputValue());
  if (isMobile) {
    const {width, height} = await scope.boundingBox();
    await seek.tap({position: {x: Math.round(width / 2), y: Math.round(height / 2)}});
    const duration = Number(await seek.getAttribute('max'));
    expect(Math.abs(Number(await seek.inputValue()) / duration - 0.5)).toBeLessThan(0.02);
  } else {
    await seek.press('ArrowRight');
    await expect(seek).toHaveValue(String(before + 1));
  }
  const target = Number(await seek.inputValue());
  await play.click();
  await expect.poll(async () => Number(await seek.inputValue())).toBeGreaterThan(target + 1);
  await expect.poll(() => trace(scope)).toBeGreaterThan(0);
});

test('the compact waveform reacts to the recording and holds still when paused', async ({page}) => {
  await page.goto((process.env.ROOM_TEST_ORIGIN || 'http://127.0.0.1:4173') + '/mixes/MX029/?t=30');
  const play = page.getByRole('button', {name: 'Play', exact: true});
  await expect(play).toBeVisible();
  await page.emulateMedia({reducedMotion: 'no-preference'});
  await play.click();
  const pause = page.getByRole('button', {name: 'Pause', exact: true});
  await expect(pause).toBeVisible();
  await page.getByRole('link', {name: 'Back to mixes'}).click();
  const compact = page.getByRole('region', {name: 'Listening player'});
  const scope = compact.locator('.wave-seek canvas');
  await expect(scope).toBeInViewport({ratio: 1});
  await expect.poll(() => trace(scope)).toBeGreaterThan(0);
  const initial = await trace(scope);
  await expect.poll(async () => {
    const value = await trace(scope);
    return value !== 0 && value !== initial;
  }).toBe(true);
  await compact.getByRole('button', {name: 'Pause', exact: true}).click();
  await expect(compact.getByRole('button', {name: 'Play', exact: true})).toBeVisible();
  const paused = await trace(scope);
  // Give the render loop several opportunities to draw another frame.
  await page.evaluate(() => new Promise(resolve => {
    requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  }));
  expect(await trace(scope)).toBe(paused);
});
