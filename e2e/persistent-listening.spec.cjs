const {test, expect} = require('@playwright/test');
const {openOptions} = require('./options.cjs');

const mix = '/mixes/MX001/';
const release = '/releases/ROOM001-AMAL-DANCECONCEPT/';
const play = (scope) => scope.getByRole('button', {name: 'Play', exact: true});
const pause = (scope) => scope.getByRole('button', {name: 'Pause', exact: true});
const close = (scope) => scope.getByRole('button', {name: 'Close player'});
const mini = (page) => page.getByRole('region', {name: 'Listening player'});
const seek = (page) => page.getByRole('slider', {name: 'Seek playback'});

// Route each stream to a real WAV so clock progress, seeks and media events run
// in the browser. Only attachment and deliberately held play attempts are controlled.
const samples = 30 * 8000;
const wav = Buffer.alloc(44 + samples, 128);
wav.write('RIFF', 0);
wav.writeUInt32LE(36 + samples, 4);
wav.write('WAVEfmt ', 8);
wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(1, 20);
wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(8000, 24);
wav.writeUInt32LE(8000, 28);
wav.writeUInt16LE(1, 32);
wav.writeUInt16LE(8, 34);
wav.write('data', 36);
wav.writeUInt32LE(samples, 40);

test.beforeEach(async ({page}) => {
  await page.addInitScript((fixture) => {
    const NativeAudio = window.Audio;
    const source = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'src');
    window.roomTestAudio = [];
    window.roomPlayAttempts = [];
    window.Audio = function () {
      const media = new NativeAudio();
      const item = {media};
      window.roomTestAudio.push(item);
      media.canPlayType = () => 'probably';
      Object.defineProperty(media, 'src', {
        get() { return source.get.call(this); },
        set(value) {
          item.url = value;
          source.set.call(this, fixture);
        },
      });
      const play = media.play.bind(media);
      media.play = () => {
        if (window.roomRejectNextPlay) {
          window.roomRejectNextPlay = false;
          return Promise.reject(new DOMException('Play requires a gesture.', 'NotAllowedError'));
        }
        if (!window.roomHoldPlay) return play();
        return new Promise((resolve) => {
          window.roomPlayAttempts.push(() => resolve(media.getAttribute('src') ? play() : undefined));
        });
      };
      return media;
    };
  }, 'data:audio/wav;base64,' + wav.toString('base64'));
});

async function mediaState(page) {
  return page.evaluate(() => window.roomTestAudio.map(({media, url}) => ({
    url, paused: media.paused, attached: media.hasAttribute('src'), time: media.currentTime,
  })));
}

async function confirmPlaying(page, index = 0) {
  await expect.poll(async () => (await mediaState(page))[index]?.time || 0).toBeGreaterThan(0.25);
}

async function leave(page, section = 'mixes') {
  await page.getByRole('link', {name: 'Back to ' + section}).click();
  await expect(page.getByRole('searchbox')).toBeVisible();
}

async function visitStatic(page, name) {
  await page.getByRole('link', {name: 'ROOM home'}).click();
  await page.getByRole('link', {name, exact: true}).click();
  await expect(page.getByRole('heading', {name: name === 'F/W 2026' ? /^F\/W 2026/ : name})).toBeInViewport();
}

async function tabTo(page, target, browserName) {
  // macOS WebKit uses Option+Tab when standard Tab skips links and buttons.
  const keys = browserName === 'webkit' ? ['Tab', 'Alt+Tab'] : ['Tab'];
  for (const key of keys) {
    for (let step = 0; step < 16; step++) {
      await page.keyboard.press(key);
      if (await target.evaluate(element => element === document.activeElement)) return key;
    }
  }
  throw new Error('Player control was unreachable with Tab');
}

test('the same media clock advances across the archive and static panels', async ({page}) => {
  await page.goto(mix);
  await expect(play(page)).toBeVisible();
  expect(await mediaState(page)).toEqual([]);
  await play(page).click();
  await confirmPlaying(page);
  const opening = (await mediaState(page))[0].time;
  await leave(page);
  await expect(mini(page).getByRole('link', {name: /MX001/})).toBeVisible();
  await expect.poll(async () => (await mediaState(page))[0].time).toBeGreaterThan(opening + 0.25);
  await page.getByRole('link', {name: 'ROOM home'}).click();
  await expect(mini(page)).toBeVisible();
  await page.getByRole('link', {name: 'Collective', exact: true}).click();
  await expect(mini(page)).toBeVisible();
  await expect(page.locator('#root')).toHaveAttribute('inert', '');
  expect(await mini(page).evaluate(element => element.closest('[inert]'))).toBeNull();
  const arrival = (await mediaState(page))[0].time;
  await expect.poll(async () => (await mediaState(page))[0].time).toBeGreaterThan(arrival + 0.25);
  await visitStatic(page, 'F/W 2026');
  await expect(mini(page)).toBeVisible();
  expect(await mediaState(page)).toHaveLength(1);
});

test('static panel keyboard controls pause, resume and close while keeping a checkpoint', async ({page, browserName}) => {
  await page.goto(mix + '?t=8');
  await play(page).click();
  await expect.poll(async () => (await mediaState(page))[0]?.time || 0).toBeGreaterThan(8);
  await leave(page);
  await visitStatic(page, 'Collective');
  const player = mini(page);
  await expect(pause(player)).toBeVisible();
  const tab = await tabTo(page, pause(player), browserName);
  await page.keyboard.press('Space');
  await expect(play(player)).toBeFocused();
  expect((await mediaState(page))[0].paused).toBe(true);
  const pausedAt = (await mediaState(page))[0].time;
  await page.keyboard.press('Enter');
  await expect(pause(player)).toBeFocused();
  await expect.poll(async () => (await mediaState(page))[0].time).toBeGreaterThan(pausedAt + 0.25);
  await page.keyboard.press(tab);
  await expect(close(player)).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(player).toHaveCount(0);
  expect((await mediaState(page))[0]).toMatchObject({paused: true, attached: false});
  await expect(page.getByRole('heading', {name: 'Collective'})).toBeFocused();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('room.listening.v1.MX001')));
  expect(saved.seconds).toBeGreaterThanOrEqual(8);
});

test('returning to the same record via the player and history retains audio and time', async ({page}) => {
  await page.goto(mix + '?t=8');
  await play(page).click();
  await expect.poll(async () => (await mediaState(page))[0]?.time || 0).toBeGreaterThan(8);
  await leave(page);
  const search = page.getByRole('searchbox');
  await search.fill('MX029');
  await expect(page.locator('#record-MX001')).toHaveCount(0);
  await expect(mini(page)).toBeVisible();
  await mini(page).getByRole('link', {name: /MX001/}).click();
  await expect(page).toHaveURL(/\/mixes\/MX001\/$/);
  await expect(mini(page)).toHaveCount(0);
  await expect(pause(page)).toBeVisible();
  expect(Number(await seek(page).inputValue())).toBeGreaterThanOrEqual(8);
  await page.goBack();
  await expect(search).toHaveValue('MX029');
  const mixes = page.getByRole('navigation', {name: 'Record collections'}).getByRole('link', {name: /^MIXES/});
  await expect(mixes).toBeFocused();
  await expect(mini(page)).toBeVisible();
  await page.goForward();
  await expect(pause(page)).toBeVisible();
  expect(await mediaState(page)).toHaveLength(1);
});

test('switching records replaces playing media and keeps a paused selection paused', async ({page}) => {
  await page.goto(mix);
  await play(page).click();
  await confirmPlaying(page);
  await leave(page);
  await page.locator('#record-MX029').click();
  await confirmPlaying(page, 1);
  const [previous, current] = await mediaState(page);
  expect(previous).toMatchObject({paused: true, attached: false});
  expect(current).toMatchObject({url: expect.stringContaining('MX029.m3u8'), paused: false});
  await pause(page).click();
  await leave(page);
  await page.locator('#record-MX001').click();
  await expect(play(page)).toBeVisible();
  expect(await mediaState(page)).toHaveLength(2);
  expect((await mediaState(page))[1]).toMatchObject({paused: true, attached: false});
});

test('switching away from a pending stream cannot revive it', async ({page}) => {
  await page.goto(mix);
  await page.evaluate(() => { window.roomHoldPlay = true; });
  await play(page).click();
  await leave(page);
  await expect(mini(page).getByRole('status')).toContainText('Loading audio');
  await page.locator('#record-MX029').click();
  await expect.poll(() => page.evaluate(() => window.roomPlayAttempts.length)).toBe(2);
  await page.evaluate(() => {
    window.roomHoldPlay = false;
    window.roomPlayAttempts.forEach(complete => complete());
  });
  await confirmPlaying(page, 1);
  const [previous, current] = await mediaState(page);
  expect(previous).toMatchObject({paused: true, attached: false});
  expect(current).toMatchObject({url: expect.stringContaining('MX029.m3u8'), paused: false});
});

test('closing a pending stream prevents a delayed start', async ({page}) => {
  await page.goto(mix);
  await page.evaluate(() => { window.roomHoldPlay = true; });
  await play(page).click();
  await leave(page);
  await expect(mini(page).getByRole('status')).toContainText('Loading audio');
  await page.setViewportSize({width: 320, height: 568});
  await page.evaluate(() => { document.documentElement.style.fontSize = '150%'; });
  const slider = seek(mini(page));
  await expect(slider).toBeDisabled();
  const range = await slider.boundingBox();
  expect(range.y + range.height).toBeLessThanOrEqual((await mini(page).getByRole('link').boundingBox()).y);
  await close(mini(page)).click();
  await expect(mini(page)).toHaveCount(0);
  await page.evaluate(() => window.roomPlayAttempts.forEach(complete => complete()));
  expect((await mediaState(page))[0]).toMatchObject({paused: true, attached: false, time: 0});
});

test('the selected release track stays visible in the compact player', async ({page}) => {
  await page.goto(release);
  await openOptions(page);
  await page.getByRole('button', {name: /^Tracklist/}).click();
  await page.getByRole('button', {name: /GEORGIA AVE/}).click();
  await play(page).click();
  await confirmPlaying(page);
  await leave(page, 'releases');
  await expect(mini(page).getByRole('link', {name: /ROOM001.*GEORGIA AVE/})).toBeVisible();
  await mini(page).getByRole('link', {name: /ROOM001/}).click();
  await openOptions(page);
  await expect(page.locator('.track-meta')).toContainText('GEORGIA AVE');
  expect(await mediaState(page)).toHaveLength(1);
});

test('a same-record timestamp history entry seeks the retained audio without replacing it', async ({page}) => {
  await page.goto(mix + '?t=9');
  await play(page).click();
  await expect.poll(async () => (await mediaState(page))[0]?.time || 0).toBeGreaterThan(9);
  await leave(page);
  await expect(mini(page)).toBeVisible();
  await mini(page).getByRole('link', {name: /MX001/}).click();
  // Simulate an in-app history destination from a bookmarked timestamp.
  await page.evaluate((path) => {
    history.pushState(null, '', path + '?t=18');
    dispatchEvent(new PopStateEvent('popstate'));
  }, mix);
  await expect.poll(async () => (await mediaState(page))[0].time).toBeGreaterThan(18);
  expect(await mediaState(page)).toHaveLength(1);
});

test('an out-of-range timestamp restarts the retained audio at the beginning', async ({page}) => {
  await page.goto(mix + '?t=15');
  await play(page).click();
  await expect.poll(async () => (await mediaState(page))[0]?.time || 0).toBeGreaterThan(15);
  await page.evaluate((path) => {
    history.pushState(null, '', path + '?t=999');
    dispatchEvent(new PopStateEvent('popstate'));
  }, mix);
  await expect.poll(async () => (await mediaState(page))[0].time).toBeLessThan(5);
  await confirmPlaying(page);
  expect(await mediaState(page)).toEqual([expect.objectContaining({paused: false})]);
});

test('a same-release history link applies its selected track and timestamp', async ({page}) => {
  await page.goto(release);
  await play(page).click();
  await confirmPlaying(page);
  await leave(page, 'releases');
  await page.evaluate((path) => {
    history.pushState(null, '', path + '?track=2&t=17');
    dispatchEvent(new PopStateEvent('popstate'));
  }, release);
  await expect.poll(async () => (await mediaState(page))[1]?.time || 0).toBeGreaterThan(17);
  const [previous, current] = await mediaState(page);
  expect(previous).toMatchObject({paused: true, attached: false});
  expect(current).toMatchObject({url: expect.stringContaining('georgia-ave.m3u8'), paused: false});
});

test('an invalid release history link restores the first track and opening time', async ({page}) => {
  await page.goto(release + '?track=999&t=-1');
  await openOptions(page);
  await expect(page.locator('.track-meta')).toContainText('990S');
  await leave(page, 'releases');
  await page.locator('#record-ROOM001').click();
  await openOptions(page);
  await page.getByRole('button', {name: /^Tracklist/}).click();
  await page.getByRole('button', {name: /GEORGIA AVE/}).click();
  await play(page).click();
  await confirmPlaying(page);

  await page.goBack();
  await expect(page.getByRole('searchbox')).toBeVisible();
  await page.goBack();
  await openOptions(page);
  await expect(page.locator('.track-meta')).toContainText('990S');
  await confirmPlaying(page, 1);
  const [previous, current] = await mediaState(page);
  expect(previous).toMatchObject({paused: true, attached: false});
  expect(current).toMatchObject({url: expect.stringContaining('990s.m3u8'), paused: false});
  expect(current.time).toBeLessThan(5);
});

test('the scene leaves the DOM and reconnects to the same media on return', async ({page}) => {
  await page.emulateMedia({reducedMotion: 'no-preference'});
  await page.goto(mix);
  await play(page).click();
  await confirmPlaying(page);
  const scene = page.locator('.listening-scene');
  await expect(scene).toHaveAttribute('data-scene-state', 'ready', {timeout: 30000});
  const canvas = await scene.locator('canvas').elementHandle();
  await leave(page);
  await expect(scene).toHaveCount(0);
  await expect(mini(page)).toBeVisible();
  expect(await canvas.evaluate(element => element.isConnected)).toBe(false);
  await mini(page).getByRole('link', {name: /MX001/}).click();
  await expect(scene).toHaveAttribute('data-scene-state', 'ready', {timeout: 30000});
  await expect(pause(page)).toBeVisible();
  expect(await mediaState(page)).toHaveLength(1);
  expect(await canvas.evaluate(element => element === document.querySelector('.listening-scene canvas'))).toBe(false);
});

test('a refused handoff exposes Retry and can still play the new recording', async ({page}) => {
  await page.goto(mix);
  await play(page).click();
  await confirmPlaying(page);
  await leave(page);
  await page.evaluate(() => { window.roomRejectNextPlay = true; });
  await page.locator('#record-MX029').click();
  await expect(page.getByText('Press play again to start the stream.')).toBeVisible();
  await leave(page);
  const player = mini(page);
  const status = player.getByRole('status');
  await expect(status).toContainText('Press play again');
  await expect(seek(player)).toBeDisabled();
  await page.setViewportSize({width: 320, height: 568});
  await page.evaluate(() => { document.documentElement.style.fontSize = '150%'; });
  const track = await player.getByText('Settle Another Day').boundingBox();
  const range = await seek(player).boundingBox();
  expect(range.y + range.height).toBeLessThanOrEqual(track.y);
  expect(track.y + track.height).toBeLessThanOrEqual((await status.boundingBox()).y);
  await player.getByRole('button', {name: 'Retry', exact: true}).click();
  await confirmPlaying(page, 2);
  expect((await mediaState(page))[1]).toMatchObject({paused: true, attached: false});
});

test('the compact waveform seeks with pointer or touch and keyboard while paused', async ({page, isMobile, browserName}) => {
  await page.goto(mix);
  await play(page).click();
  await confirmPlaying(page);
  await leave(page);
  await visitStatic(page, 'Collective');
  const player = mini(page);
  const slider = seek(player);
  await expect(slider).toBeEnabled();
  await expect(player.getByText('0:30', {exact: true})).toBeVisible();

  // Reduced motion keeps the seek range available as the media clock advances.
  const clock = (await mediaState(page))[0].time;
  await expect.poll(async () => (await mediaState(page))[0].time).toBeGreaterThan(clock + 0.25);
  const canvas = player.locator('.wave-seek canvas');
  expect(await canvas.evaluate(element => {
    const pixels = element.getContext('2d').getImageData(0, 0, element.width, element.height).data;
    return pixels.some(value => value !== 0);
  })).toBe(false);

  await pause(player).click();
  const box = await slider.boundingBox();
  expect(box.height).toBeGreaterThanOrEqual(44);
  const position = {x: Math.round(box.width * 2 / 3), y: Math.round(box.height / 2)};
  if (isMobile) await slider.tap({position});
  else await slider.click({position});
  await expect.poll(async () => (await mediaState(page))[0].time).toBeGreaterThan(18);
  expect((await mediaState(page))[0]).toMatchObject({paused: true});
  expect((await mediaState(page))[0].time).toBeLessThan(22);

  await page.getByRole('heading', {name: 'Collective'}).focus();
  await tabTo(page, slider, browserName);
  const target = Number(await slider.inputValue()) + 1;
  await page.keyboard.press('ArrowRight');
  await expect(slider).toHaveValue(String(target));
  await expect.poll(async () => (await mediaState(page))[0].time).toBe(target);
  await expect(slider).toHaveAttribute('aria-valuetext', `0:${target} of 0:30`);
  await expect(player.getByText(`0:${target}`, {exact: true})).toBeVisible();

  await player.getByRole('link', {name: /MX001/}).click();
  await expect(seek(page)).toHaveValue(String(target));
  expect(await mediaState(page)).toEqual([expect.objectContaining({time: target, paused: true})]);
});

test('the compact controls fit a narrow viewport and leave the splash links clear', async ({page}) => {
  await page.setViewportSize({width: 320, height: 568});
  await page.goto(mix);
  await play(page).click();
  await confirmPlaying(page);
  await leave(page);
  await page.getByRole('link', {name: 'ROOM home'}).click();
  await page.evaluate(() => { document.documentElement.style.fontSize = '150%'; });
  const player = mini(page);
  await expect(player).toBeInViewport();
  for (const control of [seek(player), player.getByRole('link'), pause(player), close(player)]) {
    const box = await control.boundingBox();
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(320);
  }
  await page.getByRole('button', {name: 'Rotate loop'}).click({trial: true});
  const collective = page.getByRole('link', {name: 'Collective', exact: true});
  await collective.scrollIntoViewIfNeeded();
  expect((await collective.boundingBox()).y + (await collective.boundingBox()).height)
    .toBeLessThanOrEqual((await player.boundingBox()).y);
  await collective.click();
  await expect(close(player)).toBeInViewport();
});
