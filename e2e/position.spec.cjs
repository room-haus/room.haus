const {openOptions} = require('./options.cjs');
const {test, expect} = require('@playwright/test');

const base = process.env.ROOM_TEST_ORIGIN || 'http://127.0.0.1:4173';
const mix = '/mixes/MX001/';
const release = '/releases/ROOM001-AMAL-DANCECONCEPT/';

// Exercise the browser's real media clock and metadata events with a 30-second WAV.
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
  await page.addInitScript(
    (fixture) => {
      const NativeAudio = window.Audio;
      window.attachedStreams = [];
      window.Audio = function () {
        const media = new NativeAudio();
        media.canPlayType = () => 'probably';
        const src = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'src');
        Object.defineProperty(media, 'src', {
          get() {
            return src.get.call(this);
          },
          set(value) {
            window.attachedStreams.push(value);
            src.set.call(this, fixture);
          },
        });
        return media;
      };
    },
    'data:audio/wav;base64,' + wav.toString('base64'),
  );
});

const play = (page) => page.getByRole('button', {name: 'Play', exact: true});
const seek = (page) => page.getByRole('slider', {name: 'Seek playback'});
async function seekTo(page, seconds) {
  const slider = seek(page);
  await slider.press('Home');
  for (let i = 0; i < seconds; i++) await slider.press('ArrowRight');
  await expect(slider).toHaveValue(String(seconds));
}

async function playAt(page, seconds) {
  await expect(play(page)).toBeVisible();
  expect(await page.evaluate(() => window.attachedStreams)).toEqual([]);
  await play(page).click();
  await expect(seek(page)).toBeEnabled();
  await expect.poll(async () => Math.floor(Number(await seek(page).inputValue()))).toBeGreaterThanOrEqual(seconds);
  expect(Number(await seek(page).inputValue())).toBeLessThan(seconds + 3);
  await page.getByRole('button', {name: 'Pause', exact: true}).click();
}

test('a mix resumes after refresh and can start over before playing', async ({page}) => {
  await page.goto(base + mix + '?t=11');
  await expect(page.getByText('Shared at 0:11')).toBeVisible();
  await playAt(page, 11);
  await seekTo(page, 18);
  await page.reload();
  await expect(page.getByText('Resume at 0:18')).toBeVisible();
  await playAt(page, 18);
  await page.reload();
  await page.getByRole('button', {name: 'Start over'}).press('Enter');
  await expect(play(page)).toBeFocused();
  await openOptions(page);
  await expect(page.locator('.clock span').first()).toHaveText('0:00');
  await page.reload();
  await playAt(page, 0);
});

test('a copied link selects the exact release track and overrides local progress', async ({page, isMobile}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: async (url) => {
          window.copied = url;
        },
      },
    });
  });
  await page.goto(base + release);
  await play(page).waitFor();
  await openOptions(page);
  await page.getByRole('button', {name: /^Tracklist/}).click();
  await page.getByRole('button', {name: /GEORGIA AVE/}).click();
  await playAt(page, 0);
  await seekTo(page, 17);
  await openOptions(page);
  const share = page.getByRole('button', {name: /Share/});
  if (isMobile) await share.tap();
  else {
    for (let i = 0; i < 16 && !(await share.evaluate(el => el === document.activeElement)); i++) await page.keyboard.press('Tab');
    await expect(share).toBeFocused();
    await share.press('Enter');
  }
  await expect(page.getByText(/Link copied/)).toBeVisible();
  const link = new URL(await page.evaluate(() => window.copied));
  expect(link.pathname).toBe(release);
  expect(link.searchParams.get('track')).toBe('georgia-ave');
  expect(link.searchParams.get('t')).toBe('17');
  await page.reload();
  await expect(page.getByText('Resume at 0:17')).toBeVisible();
  await expect(page.locator('.track-meta')).toContainText('GEORGIA AVE');
  await playAt(page, 17);
  await seekTo(page, 3);
  await page.goto(link.href);
  await expect(page.getByText('Shared at 0:17')).toBeVisible();
  await expect(page.locator('.track-meta')).toContainText('GEORGIA AVE');
  await playAt(page, 17);
  expect(await page.evaluate(() => window.attachedStreams[0])).toMatch(/georgia-ave/i);
});

test('invalid links, blocked storage and clipboard still allow playback and manual copying', async ({page}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new Error('Unavailable');
      },
    });
    Object.defineProperty(navigator, 'clipboard', {value: {writeText: () => Promise.reject(new Error('Unavailable'))}});
  });
  await page.goto(base + release + '?track=999&t=-1');
  await expect(page.locator('.track-meta')).toContainText('990S');
  await playAt(page, 0);
  await seekTo(page, 5);
  await openOptions(page);
  await page.getByRole('button', {name: /Share/}).click();
  const field = page.getByRole('textbox', {name: 'Listening link'});
  await expect(field).toBeFocused();
  const link = new URL(await field.inputValue());
  expect(link.searchParams.get('track')).toBe('990s');
  expect(link.searchParams.get('t')).toBe('5');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await field.press('Escape');
  await expect(page.getByRole('button', {name: /Share/})).toBeFocused();
});
