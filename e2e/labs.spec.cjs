const {test, expect} = require('@playwright/test');
const url = 'http://127.0.0.1:4173/labs';

async function login(page) {
  await page.goto(url);
  await page.getByLabel('Username').fill('admin');
  await page.getByLabel('Password', {exact: true}).fill('BigSmall');
  await page.getByRole('button', {name: 'Enter labs'}).click();
  await expect(page.getByRole('heading', {name: 'Kinetic type'})).toBeVisible();
}

test('login rejects incorrect credentials, retains the session, and signs out', async ({page}) => {
  await page.goto(url);
  await page.getByLabel('Username').fill('admin');
  await page.getByLabel('Password', {exact: true}).fill('wrong');
  await page.getByRole('button', {name: 'Enter labs'}).click();
  await expect(page.getByRole('alert')).toHaveText('Incorrect username or password.');
  await page.getByLabel('Password', {exact: true}).fill('BigSmall');
  await page.getByRole('button', {name: 'Enter labs'}).click();
  await expect(page.getByRole('heading', {name: 'Kinetic type'})).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', {name: 'Kinetic type'})).toBeVisible();
  await page.getByRole('button', {name: 'Sign out'}).click();
  await expect(page.getByLabel('Username')).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Username')).toBeVisible();
});

test('all six studies render, controls work, and settings survive switching', async ({page}) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await login(page);
  await expect(page.locator('.labs-stage')).toHaveAttribute('data-state', 'ready');
  await expect(page.getByRole('button', {name: 'Play motion'})).toBeVisible();
  await page.getByRole('slider', {name: 'Intensity'}).fill('1.6');
  await expect(page.getByText('1.60', {exact: true})).toBeVisible();
  for (const title of ['Elastic grid', 'Disc orbit', 'Folded matter', 'Particle field', 'Light sculpture', 'Kinetic type']) {
    await page.getByRole('button', {name: new RegExp(title + '$')}).click();
    await expect(page.getByRole('heading', {name: title})).toBeVisible();
    await expect(page.locator('.labs-stage')).toHaveAttribute('data-state', 'ready');
  }
  await expect(page.getByRole('slider', {name: 'Intensity'})).toHaveValue('1.6');
  await page.getByRole('button', {name: 'Play motion'}).click();
  await expect(page.getByRole('button', {name: 'Pause motion'})).toBeVisible();
  await page.getByRole('button', {name: 'Reset study'}).click();
  await expect(page.getByRole('slider', {name: 'Intensity'})).toHaveValue('1');
  await page.getByRole('button', {name: 'Vermilion'}).click();
  await expect(page.getByRole('button', {name: 'Vermilion'})).toHaveAttribute('aria-pressed', 'true');
  const download = page.waitForEvent('download');
  await page.getByRole('button', {name: 'Save image'}).click();
  expect((await download).suggestedFilename()).toBe('room-labs-kinetic-type.png');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test('WebGL failure leaves navigation and a useful recovery state', async ({page}) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type, ...args) {
      return type.includes('webgl') ? null : original.call(this, type, ...args);
    };
  });
  await login(page);
  await expect(page.getByRole('alert')).toContainText('3D is unavailable');
  await page.getByRole('button', {name: /Elastic grid$/}).click();
  await expect(page.getByRole('heading', {name: 'Elastic grid'})).toBeVisible();
  await page.getByRole('button', {name: 'Sign out'}).click();
  await expect(page.getByLabel('Username')).toBeVisible();
});

test('wheel zoom stays inside the canvas without scrolling the page', async ({page}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Desktop wheel interaction');
  await page.setViewportSize({width: 1440, height: 900});
  await login(page);
  await expect(page.locator('.labs-stage')).toHaveAttribute('data-state', 'ready');
  const canvas = page.locator('.labs-stage canvas');
  const before = await canvas.screenshot();
  const bounds = await canvas.boundingBox();
  const scroll = await page.evaluate(() => scrollY);
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.wheel(0, 300);
  await expect.poll(async () => (await canvas.screenshot()).equals(before)).toBe(false);
  expect(await page.evaluate(() => scrollY)).toBe(scroll);
});

test('categories group the 3D studies and retain the selected study and settings', async ({page}) => {
  await login(page);
  const categories = page.getByRole('navigation', {name: 'Experiment categories'});
  await expect(categories.getByRole('button')).toHaveCount(4);
  await page.getByRole('button', {name: /Folded matter$/}).click();
  await page.getByRole('slider', {name: 'Intensity'}).fill('1.6');
  for (const [title, hash] of [['Experiences', 'experiences'], ['Interactives', 'interactives'], ['Audio experiments', 'audio-experiments']]) {
    await categories.getByRole('button', {name: title, exact: true}).click();
    await expect(page.getByRole('heading', {name: title, exact: true})).toBeVisible();
    await expect(page.getByRole('heading', {name: title === 'Experiences' ? 'The Underlevel' : 'No experiments yet.'})).toBeVisible();
    if (title === 'Experiences') await expect(page.getByRole('button', {name: 'Open The Underlevel ↗'})).toBeVisible();
    await expect(page.locator('.labs-stage')).toHaveCount(0);
    await expect(page).toHaveURL(new RegExp('#' + hash + '$'));
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.reload();
  await expect(page.getByRole('heading', {name: 'Audio experiments', exact: true})).toBeVisible();
  await expect(categories.getByRole('button', {name: 'Audio experiments', exact: true})).toBeInViewport();
  await categories.getByRole('button', {name: '3D animations', exact: true}).click();
  await expect(page.getByRole('heading', {name: 'Kinetic type'})).toBeVisible();
  await page.getByRole('button', {name: /Folded matter$/}).click();
  await page.getByRole('slider', {name: 'Intensity'}).fill('1.6');
  await categories.getByRole('button', {name: 'Experiences', exact: true}).click();
  await categories.getByRole('button', {name: '3D animations', exact: true}).click();
  await expect(page.getByRole('heading', {name: 'Folded matter'})).toBeVisible();
  await expect(page.getByRole('slider', {name: 'Intensity'})).toHaveValue('1.6');
  await page.goto(url + '#folded-matter');
  await expect(page.getByRole('heading', {name: 'Folded matter'})).toBeVisible();
  await expect(page.getByRole('button', {name: /Folded matter$/})).toBeInViewport();
});
