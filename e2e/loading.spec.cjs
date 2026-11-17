const {test, expect} = require('@playwright/test');
const {openOptions} = require('./options.cjs');
const base = 'http://127.0.0.1:4173';

// Keep requests pending until the test has inspected the interface, independent of machine speed.
async function hold(page, pattern) {
  let finish;
  const gate = new Promise((resolve) => {
    finish = resolve;
  });
  await page.route(pattern, async (route) => {
    if (await gate) await route.continue();
    else await route.abort();
  });
  return finish;
}

test('opening a recording keeps its sleeve and a way back while the player downloads', async ({page}) => {
  const finish = await hold(page, /\/assets\/player\.[\da-f]+\.js$/);
  await page.goto(base + '/mixes/?q=MX001');
  await page.locator('#record-MX001').click();
  const pending = page.getByRole('status').filter({hasText: 'Opening MX001'});
  try {
    await expect(pending).toBeVisible();
    await expect(page.locator('.still-cover')).toBeVisible();
    await expect(page.getByRole('link', {name: 'Back to mixes'})).toBeInViewport();
    expect(
      await pending.locator('.loading-label').evaluate((el) => getComputedStyle(el, '::before').animationName),
    ).toBe('none');
  } finally {
    finish(true);
  }
  await expect(page.getByRole('button', {name: 'Play', exact: true})).toBeVisible();
  await expect(pending).toHaveCount(0);
});

test('an explicit scene request shows progress and recovers to still art on failure', async ({page}) => {
  const finish = await hold(page, /\/assets\/scene-engine\.[\da-f]+\.js$/);
  await page.goto(base + '/mixes/MX001/');
  await page.getByRole('button', {name: 'Play', exact: true}).waitFor();
  await page.emulateMedia({reducedMotion: 'no-preference'});
  await openOptions(page);
  await page.getByRole('button', {name: 'Scene', exact: true}).click();
  const pending = page.getByRole('status').filter({hasText: 'Loading scene'});
  try {
    await expect(page.locator('.listening-scene')).toHaveAttribute('data-scene-state', 'loading');
    await expect(pending).toBeVisible();
    expect(
      await pending.locator('.loading-label').evaluate((el) => getComputedStyle(el, '::before').animationName),
    ).toBe('room-turn');
    await expect(page.getByRole('button', {name: 'Play', exact: true})).toBeEnabled();
  } finally {
    finish(false);
  }
  await expect(page.getByText('Scene unavailable. Showing artwork.')).toBeVisible();
  await expect(pending).toHaveCount(0);
  await expect(page.locator('.still-cover')).toBeVisible();
});

test('artwork stays the same size while a slow disc loads and can switch back', async ({page}) => {
  const finish = await hold(page, /\/assets\/cd_template_MX009\.[\da-f]+\.png$/);
  await page.goto(base + '/mixes/MX009/', {waitUntil: 'domcontentloaded'});
  await page.getByRole('button', {name: 'Play', exact: true}).waitFor();
  await openOptions(page);
  await page.getByRole('button', {name: 'View artwork'}).click();
  const dialog = page.getByRole('dialog');
  const frame = dialog.locator('.artwork-image');
  await expect(frame).toHaveAttribute('data-state', 'ready');
  const before = await frame.boundingBox();
  await dialog.getByRole('button', {name: 'Disc', exact: true}).click();
  try {
    await expect(dialog.getByRole('status')).toHaveText('Loading disc label…');
    expect(await frame.boundingBox()).toEqual(before);
    await dialog.getByRole('button', {name: 'Sleeve', exact: true}).click();
    await expect(frame).toHaveAttribute('data-state', 'ready');
    await dialog.getByRole('button', {name: 'Disc', exact: true}).click();
  } finally {
    finish(true);
  }
  await expect(frame).toHaveAttribute('data-state', 'ready');
  await expect(dialog.getByRole('status')).toHaveCount(0);
  expect(await frame.boundingBox()).toEqual(before);
});

test('audio startup can be paused while the stream player is still downloading', async ({page}) => {
  // Exercise the HLS.js path, where the chunk request can be held even on native HLS browsers.
  await page.addInitScript(() => {
    const probe = HTMLMediaElement.prototype.canPlayType;
    HTMLMediaElement.prototype.canPlayType = function (type) {
      return type === 'application/vnd.apple.mpegurl' ? '' : probe.call(this, type);
    };
  });
  const finish = await hold(page, /\/assets\/hls\.[\da-f]+\.js$/);
  await page.goto(base + '/mixes/MX001/');
  const play = page.getByRole('button', {name: 'Play', exact: true});
  await play.click();
  const pending = page.getByRole('status').filter({hasText: 'Loading audio'});
  try {
    await expect(pending).toBeVisible();
    await page.getByRole('button', {name: 'Pause', exact: true}).click();
    await expect(pending).toHaveCount(0);
    await expect(play).toBeEnabled();
  } finally {
    finish(true);
  }
});
