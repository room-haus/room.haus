const {test, expect} = require('@playwright/test');

test('starting over clears the opening position while retaining the ready WebGL scene', async ({page, baseURL}) => {
  await page.emulateMedia({reducedMotion: 'no-preference'});
  await page.addInitScript(() => {
    window.roomContexts = [];
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      const context = getContext.call(this, type, ...args);
      if (/webgl/.test(type) && context) window.roomContexts.push(context);
      return context;
    };
  });
  await page.goto(new URL('/mixes/MX001/?t=11', baseURL || 'http://127.0.0.1:4173').href);
  await expect(page.locator('.listening-scene')).toHaveAttribute('data-scene-state', 'ready', {timeout: 30000});
  const canvas = await page.locator('.listening-scene canvas').elementHandle();
  const contexts = await page.evaluate(() => window.roomContexts.length);
  expect(contexts).toBeGreaterThan(0);
  await page.getByRole('button', {name: 'Start over'}).click();
  await expect(page.getByText('Shared at 0:11')).toHaveCount(0);
  await expect(page.getByRole('button', {name: 'Start over'})).toHaveCount(0);
  await expect(page.getByRole('button', {name: 'Play', exact: true})).toBeFocused();
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  expect(await canvas.evaluate(node => node === document.querySelector('.listening-scene canvas'))).toBe(true);
  expect(await page.evaluate(() => window.roomContexts.length)).toBe(contexts);
  await expect(page.locator('.listening-scene')).toHaveAttribute('data-scene-state', 'ready');
  expect(await page.evaluate(() => localStorage.getItem('room.listening.v1.MX001'))).toBeNull();
  expect(new URL(page.url()).searchParams.has('t')).toBe(false);
  await page.getByRole('button', {name: 'Play', exact: true}).click();
  const seek = page.getByRole('slider', {name: 'Seek playback'});
  await expect.poll(async () => Number(await seek.inputValue())).toBeGreaterThan(0);
  expect(Number(await seek.inputValue())).toBeLessThan(5);
  expect(await canvas.evaluate(node => node === document.querySelector('.listening-scene canvas'))).toBe(true);
});
