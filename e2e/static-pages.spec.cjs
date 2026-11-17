const {test, expect} = require('@playwright/test');

test.describe('archive without JavaScript', () => {
  test.use({javaScriptEnabled: false});

  test('browse a mix and a release using the published HTML', async ({page, baseURL}) => {
    await page.goto(new URL('/', baseURL || 'http://127.0.0.1:4173').href);
    await page.getByRole('link', {name: 'MX001 Eddy Bauer'}).click();
    await expect(page.getByRole('heading', {name: 'Eddy Bauer'})).toBeVisible();
    await expect(page.getByRole('img', {name: /MX001 cover/})).toBeVisible();
    await expect(page.getByRole('link', {name: 'Listen on SoundCloud'})).toHaveAttribute(
      'href',
      /room-mx001-eddy-bauer/,
    );
    await page.getByRole('link', {name: 'Back to mixes'}).click();
    await page.getByRole('link', {name: /^Releases/i}).click();
    await page.getByRole('link', {name: /ROOM001 Amal Dance Concept/}).click();
    await expect(page.getByText('Dance Concept', {exact: true})).toBeVisible();
    await expect(page.getByRole('heading', {name: 'Amal'})).toBeVisible();
    await expect(page.getByRole('img', {name: /ROOM001 cover/})).toBeVisible();
    await expect(page.getByRole('link', {name: 'Listen on Bandcamp'})).toHaveAttribute('href', /dance-concept-room001/);
    await page.locator('summary').click();
    await expect(page.getByRole('list', {name: 'Tracklist'}).getByRole('listitem')).toHaveText([
      '990S',
      'GEORGIA AVE',
      '574S',
      'DTS',
      'FREE JUDO',
      'FREE JUDO (UNCUT)',
    ]);
  });
});

test('record HTML remains usable while the player loads and hands off to one interactive view', async ({
  page,
  baseURL,
}) => {
  let releaseChunk;
  const waitForChunk = new Promise((resolve) => {
    releaseChunk = resolve;
  });
  await page.route(/\/assets\/player\.[\da-f]+\.js$/, async (route) => {
    await waitForChunk;
    await route.continue();
  });
  await page.goto(new URL('/mixes/MX001/', baseURL || 'http://127.0.0.1:4173').href, {waitUntil: 'domcontentloaded'});
  try {
    await expect(page.getByRole('heading', {name: 'Eddy Bauer'})).toBeVisible();
    await expect(page.getByRole('link', {name: 'Listen on SoundCloud'})).toBeVisible();
  } finally {
    releaseChunk();
  }
  await expect(page.getByRole('button', {name: 'Play', exact: true})).toBeVisible();
  await expect(page.getByRole('heading', {name: 'Eddy Bauer'})).toHaveCount(1);
  await expect(page.locator('.static-record')).toHaveCount(0);
});
