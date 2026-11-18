const {test, expect} = require('@playwright/test');
const origin = process.env.ROOM_PREVIEW_ORIGIN || process.env.ROOM_TEST_ORIGIN || 'http://127.0.0.1:4173';

test('haunted portraits stay hidden until activated and toggle with a tap or keyboard', async ({page, isMobile}) => {
  await page.goto(origin + '/collective/');
  const portraits = page.getByRole('button', {name: /^Reveal haunted portrait of/});
  await expect(portraits).toHaveCount(4);
  for (const portrait of await portraits.all()) {
    const pixels = portrait.locator('img.pixel-print').first();
    await expect(pixels).toHaveJSProperty('naturalWidth', 64);
    await expect(pixels).toHaveAttribute('src', /-demonic-pixels\./);
    await expect(pixels).toHaveCSS('opacity', '0');
    await expect(portrait.locator('img').first()).toHaveJSProperty('naturalWidth', 720);
  }
  const portrait = portraits.first();
  const pixels = portrait.locator('img.pixel-print').first();
  if (isMobile) await portrait.tap();
  else {
    await portrait.focus();
    await page.keyboard.press('Enter');
  }
  await expect(portrait).toHaveAttribute('aria-pressed', 'true');
  await expect(pixels).toHaveCSS('opacity', '1');
  if (isMobile) await portrait.tap();
  else await page.keyboard.press('Space');
  await expect(portrait).toHaveAttribute('aria-pressed', 'false');
  await expect(pixels).toHaveCSS('opacity', '0');
});

test('hover reveals only a moving pixel patch and restores the normal portrait on exit', async ({page, isMobile}) => {
  test.skip(isMobile, 'Hover requires a mouse');
  await page.emulateMedia({reducedMotion: 'no-preference'});
  await page.goto(origin + '/collective/');
  const portrait = page.getByRole('button', {name: /^Reveal haunted portrait of/}).first();
  const pixels = portrait.locator('img.pixel-print').first();
  await portrait.hover({position: {x: 80, y: 140}});
  await expect(pixels).toHaveCSS('opacity', '1');
  await expect(pixels).toHaveCSS('image-rendering', 'pixelated');
  await expect(pixels).toHaveCSS('clip-path', /^circle\(/);
  const firstPatch = await pixels.evaluate(node => getComputedStyle(node).clipPath);
  await portrait.hover({position: {x: 150, y: 190}});
  await expect.poll(() => pixels.evaluate(node => getComputedStyle(node).clipPath)).not.toBe(firstPatch);
  await expect(portrait.locator('canvas')).toHaveJSProperty('width', 64);
  await page.mouse.move(0, 0);
  await expect(pixels).toHaveCSS('opacity', '0');
  await expect(portrait.locator('canvas')).toHaveCSS('opacity', '0');
});
