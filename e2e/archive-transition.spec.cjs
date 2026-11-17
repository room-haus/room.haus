const {test, expect} = require('@playwright/test');

test('history can reverse a live slide without dropping either screen or resetting the loop', async ({page}) => {
  await page.emulateMedia({reducedMotion: 'no-preference'});
  await page.goto('/');
  await page.getByRole('button', {name: 'Pause rotation'}).click();
  const archive = page.getByRole('link', {name: 'S/S 2017-2019'});
  const home = page.getByRole('link', {name: 'ROOM home'});
  const canvas = await page.locator('.study-model').elementHandle();
  const sleeve = await page.locator('#record-MX001').elementHandle();

  // Reverse while both pages are on screen. Sample the actual painted panel edges.
  const frames = await page.evaluate(() => new Promise(resolve => {
    const splash = document.querySelector('.entrance--study');
    const catalogue = document.querySelector('#root');
    const frames = [];
    let reversed = false;
    function sample() {
      const left = splash.getBoundingClientRect();
      const right = catalogue.getBoundingClientRect();
      if (right.left > 1 && right.left < innerWidth - 1) {
        frames.push({
          gap: Math.abs(left.right - right.left),
          visible: [splash, catalogue].every(panel => getComputedStyle(panel).visibility === 'visible'),
        });
        if (!reversed && right.left < innerWidth * .8) {
          reversed = true;
          history.back();
        }
      }
      if (reversed && location.pathname === '/' && right.left >= innerWidth - 1) resolve(frames);
      else requestAnimationFrame(sample);
    }
    document.querySelector('.entrance-nav a[href="/mixes/"]').click();
    requestAnimationFrame(sample);
  }));
  expect(frames.length).toBeGreaterThan(1);
  expect(frames.filter(frame => !frame.visible || frame.gap >= 1.5)).toEqual([]);

  await page.goForward();
  await expect(home).toBeVisible();
  await home.click();
  await expect(archive).toBeVisible();
  await expect(page.getByRole('button', {name: 'Rotate loop'})).toBeVisible();
  expect(await canvas.evaluate(node => node === document.querySelector('.study-model'))).toBe(true);
  expect(await sleeve.evaluate(node => node === document.querySelector('#record-MX001'))).toBe(true);
});

test('a direct archive visit supports reduced motion, return, and filtered history', async ({page}) => {
  await page.emulateMedia({reducedMotion: 'reduce'});
  await page.goto('/mixes/?q=Eddy');
  const search = page.getByRole('searchbox');
  await expect(search).toHaveValue('Eddy');
  await page.getByRole('link', {name: 'ROOM home'}).click();
  await expect(page.getByRole('navigation', {name: 'ROOM sections'})).toBeVisible();
  expect(await page.locator('#root').evaluate(panel => panel.getAnimations().length)).toBe(0);
  await page.goBack();
  await expect(search).toHaveValue('Eddy');
  await expect(page.getByRole('link', {name: 'MX001 Eddy Bauer'})).toBeVisible();
  await page.getByRole('link', {name: 'ROOM home'}).click();
  await page.getByRole('link', {name: 'S/S 2017-2019'}).click();
  await expect(search).toHaveValue('');
});

test('every section shares one document and retains its interactions through history', async ({page}) => {
  await page.emulateMedia({reducedMotion: 'no-preference'});
  const documents = [];
  page.on('request', request => {
    if (request.resourceType() === 'document') documents.push(request.url());
  });
  await page.goto('/');
  const season = page.locator('[data-room-panel=season]');
  const collective = page.locator('[data-room-panel=collective]');
  await page.getByRole('link', {name: 'F/W 2026', exact: true}).click();
  await expect(season).not.toHaveAttribute('inert');
  await page.getByRole('link', {name: 'Releases', exact: true}).click();
  await expect(page).toHaveURL(new RegExp('fw-2026/releases/$'));
  await expect(page.getByRole('link', {name: 'Releases', exact: true})).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('button', {name: 'Play bruh sound effect'})).toBeVisible();
  await page.getByRole('link', {name: 'ROOM home', exact: true}).click();
  await page.getByRole('link', {name: 'Collective', exact: true}).click();
  await expect(collective).not.toHaveAttribute('inert');
  await expect(page.getByRole('button', {name: /Pixelate portrait/})).toHaveCount(4);
  await page.goBack();
  await expect(page.getByRole('heading', {name: 'ROOM', exact: true})).toBeVisible();
  await page.goBack();
  await expect(season).not.toHaveAttribute('inert');
  await expect(page.getByRole('link', {name: 'Releases', exact: true})).toHaveAttribute('aria-current', 'page');
  await page.goBack();
  await expect(page.getByRole('link', {name: 'Mixes', exact: true})).toHaveAttribute('aria-current', 'page');
  await page.getByRole('link', {name: 'ROOM home', exact: true}).click();
  await expect(page.getByRole('heading', {name: 'ROOM', exact: true})).toBeVisible();
  expect(documents).toHaveLength(1);
});
