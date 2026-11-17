const {test, expect} = require('@playwright/test');

test('the 3D loop rotates, pauses in place, and resumes', async ({page, baseURL}) => {
  await page.emulateMedia({reducedMotion: 'no-preference'});
  await page.goto(new URL('/', baseURL || 'http://127.0.0.1:4173').href);
  const canvas = page.locator('.study-model');
  const pause = page.getByRole('button', {name: 'Pause rotation'});
  await expect(pause).toBeVisible();
  const frame = () => canvas.screenshot();
  const moving = await frame();
  await expect.poll(async () => (await frame()).equals(moving)).toBe(false);
  await pause.click();
  await page.mouse.move(0, 0);
  const stopped = await frame();
  expect((await frame()).equals(stopped)).toBe(true);
  await page.getByRole('button', {name: 'Rotate loop'}).click();
  await page.mouse.move(0, 0);
  await expect.poll(async () => (await frame()).equals(stopped)).toBe(false);
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
