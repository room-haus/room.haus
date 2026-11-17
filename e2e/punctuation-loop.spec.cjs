const {test, expect} = require('@playwright/test');

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
