const {test, expect} = require('@playwright/test');
const base = process.env.ROOM_TEST_ORIGIN || 'http://127.0.0.1:4173';

async function tabTo(page, target) {
  for (let i = 0; i < 32; i++) {
    if (await target.evaluate((el) => el === document.activeElement)) return;
    await page.keyboard.press('Tab');
  }
  throw Error('Control could not be reached with Tab: ' + (await target.textContent()));
}
async function checkClock(page) {
  await expect(page.getByRole('button', {name: 'Pause', exact: true})).toBeVisible();
  const seek = page.getByRole('slider', {name: 'Seek playback'});
  await expect.poll(async () => Number(await seek.inputValue())).toBeGreaterThan(1);
  return seek;
}
for (const id of ['MX001', 'MX029']) {
  test(id + ' opens from a filtered cover wall and supports play, pause, seek and return', async ({page, isMobile}) => {
    const fetched = [];
    page.on('request', (req) => fetched.push(req.url()));
    await page.goto(base + '/mixes/');
    const search = page.getByRole('searchbox');
    if (isMobile) {
      await search.tap();
      await search.fill(id);
    } else {
      await tabTo(page, search);
      await page.keyboard.type(id);
    }
    const sleeve = page.getByRole('link', {name: new RegExp(id)});
    await expect(sleeve).toHaveCount(1);
    if (isMobile)
      await expect
        .poll(() =>
          page.locator('.cover-wall').evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length),
        )
        .toBe(2);
    expect(
      fetched.some((u) => /\/models\/|\/worklets\/|\.m3u8|\/assets\/(babylon|scene-engine|player|hls)\./.test(u)),
    ).toBe(false);
    if (isMobile) await sleeve.tap();
    else {
      await tabTo(page, sleeve);
      await page.keyboard.press('Enter');
    }
    const play = page.getByRole('button', {name: 'Play', exact: true});
    if (isMobile) await play.tap();
    else {
      await tabTo(page, play);
      await page.keyboard.press('Space');
    }
    const seek = await checkClock(page);
    if (isMobile) await page.getByRole('button', {name: 'Pause', exact: true}).tap();
    else await page.keyboard.press('Space');
    await expect(play).toBeVisible();
    const before = Number(await seek.inputValue());
    if (isMobile) {
      const rect = await seek.boundingBox();
      await seek.tap({position: {x: Math.round(rect.width / 3), y: Math.round(rect.height / 2)}});
    } else {
      await tabTo(page, seek);
      await page.keyboard.press('ArrowRight');
    }
    await expect.poll(async () => Number(await seek.inputValue())).toBeGreaterThan(before);
    await page.getByRole('link', {name: /Back to mixes/}).click();
    await expect(search).toHaveValue(id);
    await expect(sleeve).toBeFocused();
  });
}
test('ROOM001 plays and switches to the selected release track', async ({page, isMobile}) => {
  await page.goto(base + '/releases/ROOM001-AMAL-DANCECONCEPT');
  const play = page.getByRole('button', {name: 'Play', exact: true});
  if (isMobile) await play.tap();
  else await play.click();
  await checkClock(page);
  const tracks = page.getByRole('button', {name: /^Tracklist/});
  await tracks.click();
  const next = page.getByRole('button', {name: /GEORGIA AVE/});
  if (isMobile) await next.tap();
  else {
    await tabTo(page, next);
    await page.keyboard.press('Enter');
  }
  await expect(tracks).toBeFocused();
  await expect(page.locator('.track-meta')).toContainText('GEORGIA AVE');
  if (isMobile) await play.tap();
  else await play.click();
  await checkClock(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('failed mix can retry without leaving its cover or transport', async ({page, browserName}) => {
  // Native WebKit can fetch HLS outside Playwright's network interception.
  // Give its first audio element a real missing playlist, then restore the setter for Retry.
  if (browserName === 'webkit') {
    await page.addInitScript(() => {
      const prototype = HTMLMediaElement.prototype;
      const src = Object.getOwnPropertyDescriptor(prototype, 'src');
      Object.defineProperty(prototype, 'src', {
        ...src,
        set(value) {
          if (this.tagName === 'AUDIO' && /\.m3u8(?:$|[?#])/.test(value)) {
            Object.defineProperty(prototype, 'src', src);
            src.set.call(this, new URL('/missing-playlist.m3u8', location.origin).href);
          } else {
            src.set.call(this, value);
          }
        },
      });
    });
  }
  const manifest = process.env.ROOM_MX029_AUDIO_URL || '**/MX029/MX029.m3u8';
  await page.route(manifest, (route) => route.fulfill({status: 404, body: 'Missing'}));
  await page.goto(base + '/mixes/?mx=MX029');
  await page.getByRole('button', {name: 'Play', exact: true}).click();
  const retry = page.getByRole('button', {name: 'Retry', exact: true});
  await expect(retry).toBeVisible();
  await expect(page.getByRole('link', {name: /Listen on SoundCloud/})).toBeVisible();
  await page.unroute(manifest);
  await retry.click();
  await checkClock(page);
});

if (process.env.ROOM_MX029_AUDIO_URL) {
  test('portable MX029 plays through a seek into its final segment', async ({page}) => {
    await page.goto(base + '/mixes/MX029/');
    await Promise.all([
      page.waitForRequest(request => request.url() === process.env.ROOM_MX029_AUDIO_URL),
      page.getByRole('button', {name: 'Play', exact: true}).click(),
    ]);
    const seek = await checkClock(page);
    const duration = Number(await seek.getAttribute('max'));
    expect(duration).toBeGreaterThan(3600);
    await seek.focus();
    await page.keyboard.press('End');
    for (let i = 0; i < 8; i++) await page.keyboard.press('ArrowLeft');
    const position = Number(await seek.inputValue());
    expect(position).toBeGreaterThan(duration - 12);
    await expect.poll(async () => Number(await seek.inputValue())).toBeGreaterThan(position + 1);
  });
}
