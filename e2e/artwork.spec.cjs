const {openOptions} = require('./options.cjs');
const {test, expect} = require('@playwright/test');
const base = process.env.ROOM_TEST_ORIGIN || 'http://127.0.0.1:4173';

async function activate(page, control, isMobile) {
  if (isMobile) return control.tap();
  for (let i = 0; i < 32; i++) {
    if (await control.evaluate((el) => el === document.activeElement)) return page.keyboard.press('Enter');
    await page.keyboard.press('Tab');
  }
  throw Error('Could not tab to ' + (await control.textContent()));
}

test('browse titled mixes, inspect both artworks and return to the filtered wall', async ({page, isMobile}) => {
  await page.goto(base + '/mixes/?q=Music+for+Rain');
  const sleeve = page.getByRole('link', {name: /MX009 Sami Music for Rain/});
  await activate(page, sleeve, isMobile);
  await activate(page, page.locator('.player-options > summary'), isMobile);
  const trigger = page.getByRole('button', {name: 'View artwork'});
  await activate(page, trigger, isMobile);
  const dialog = page.getByRole('dialog', {name: 'Sami artwork'});
  await expect(dialog.getByRole('img', {name: /MX009 sleeve/})).toBeVisible();
  await activate(page, dialog.getByRole('button', {name: 'Disc', exact: true}), isMobile);
  const disc = dialog.getByRole('img', {name: /MX009 disc label/});
  await expect.poll(() => disc.evaluate((img) => img.naturalWidth)).toBe(2048);
  await expect(dialog.getByRole('link', {name: /full-size disc/})).toHaveAttribute('href', /cd_template_MX009/);
  if (isMobile) await dialog.getByRole('button', {name: 'Close'}).tap();
  else await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
  await activate(page, page.getByRole('link', {name: /Next mix MX010 · Harry/}), isMobile);
  await page.getByRole('button', {name: 'Play', exact:true}).waitFor();
  await openOptions(page);
  await expect(page.getByRole('heading', {name: 'Harry', exact: true})).toBeVisible();
  await expect(page.getByRole('button', {name: 'Play', exact: true})).toBeVisible();
  await activate(page, page.getByRole('link', {name: 'Back to mixes'}), isMobile);
  await expect(sleeve).toBeFocused();
  await expect(page.getByRole('searchbox')).toHaveValue('Music for Rain');
});

test('early mix controls fit a small phone in portrait and landscape', async ({page}) => {
  await page.setViewportSize({width: 320, height: 568});
  await page.goto(base + '/mixes/MX003/');
  for (const [width, height] of [
    [320, 568],
    [568, 320],
  ]) {
    await page.setViewportSize({width, height});
    const options = page.locator('.player-options > summary');
    const stage = await page.locator('.listening-stage').boundingBox();
    expect(stage).toEqual({x:0, y:0, width, height});
    await expect(options).toBeInViewport({ratio: 1});
    await expect(page.getByRole('slider')).toBeInViewport({ratio: 1});
    await expect(page.getByRole('button', {name:'View artwork'})).toHaveCount(0);
    await expect(page.getByRole('button', {name:'Scene',exact:true})).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await options.press('Enter');
    await expect(page.getByRole('button',{name:'Still art',exact:true})).toHaveAttribute('aria-pressed','true');
    await page.getByRole('button',{name:'Still art',exact:true}).click();
    await expect(options).toBeFocused();
    await openOptions(page);
    const trigger = page.getByRole('button', {name: 'View artwork'});
    await trigger.click();
    for (const name of ['Sleeve', 'Disc', 'Close']) {
      const button = page.getByRole('dialog').getByRole('button', {name, exact: true});
      await expect(button).toBeInViewport({ratio: 1});
      await button.click();
    }
    await options.press('Escape');
  }
});

test('the scene back button opens the archive from a direct link', async ({page}) => {
  await page.goto(base + '/mixes/MX003/');
  const back = page.getByRole('link', {name: 'Back to mixes'});
  await expect(back).toBeInViewport({ratio: 1});
  await expect(page.locator('.player-options')).not.toHaveAttribute('open', '');
  await back.press('Enter');
  await expect(page.getByRole('searchbox')).toBeVisible();
  await expect(page).toHaveURL(base + '/mixes/');
});
