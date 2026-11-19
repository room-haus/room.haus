const {test, expect, devices} = require('@playwright/test');
const {execFileSync} = require('node:child_process');
const {button, compareSavedAudio, fresh, prepare, publish, manifest} = require('./helpers/take-handoff.cjs');

async function perform(page, realSource) {
  await page.goto('/labs/#audio-experiments');
  await page.getByLabel('Username').fill('admin');
  await page.getByLabel('Password').fill('BigSmall');
  await page.getByRole('button', {name: /Enter labs/}).click();
  await button(page, 'Open Memory & fragments ↗').click();
  if (realSource) {
    await page.locator('summary').filter({hasText: 'Choose passage'}).click();
    await page.getByLabel('Start at mix time').fill('34:57');
    await button(page, 'Set start').click();
    await button(page, 'Load passage').click();
    await expect(page.getByText('IN 34:57.000', {exact: true})).toBeVisible();
  }
  await page.getByText('Capture and trigger settings', {exact: true}).click();
  const length = page.getByRole('slider', {name: 'Capture length'});
  await length.press('ArrowRight');
  await length.press('ArrowRight');
  await expect(length).toHaveValue('1');
  await page.getByLabel('Timeline position (seconds)').fill('1.8');
  await button(page, 'Record').click();
  const capture = button(page, 'Capture fragment');
  await capture.focus();
  // Observe the maker's actual pre-publication bytes at the capture hash
  // boundary. Copy the view immediately, then let Web Crypto hash it normally.
  await page.evaluate(() => {
    const digest = crypto.subtle.digest.bind(crypto.subtle);
    crypto.subtle.digest = (algorithm, input) => {
      if (algorithm === 'SHA-256' && input.byteLength === 48000 * 4) {
        const bytes = new Uint8Array(input.buffer ?? input, input.byteOffset ?? 0, input.byteLength);
        window.capturedPCM = bytes.slice();
        crypto.subtle.digest = digest;
      }
      return digest(algorithm, input);
    };
  });
  // Both sources cross a one-second/ten-second chunk edge at passage t=3s.
  await page.waitForFunction(
    () => Number(document.querySelector('[aria-label="Audition position"]').value) >= 3.43 * 48000,
  );
  await capture.press('Enter');
  await button(page, 'Trigger fragment').press('Enter');
  await expect(page.getByRole('list', {name: 'Fragment triggers'}).getByRole('listitem')).toHaveCount(1);
  await button(page, 'Stop').click();
}

async function playSaved(context, url, record) {
  const page = await context.newPage();
  await page.goto(url.href);
  await expect(page.getByRole('heading', {name: 'Memory & fragments'})).toBeVisible();
  expect(await page.evaluate(() => localStorage.length + sessionStorage.length)).toBe(0);
  await compareSavedAudio(page, record);
  return page;
}

test('a second device moves and dissolves the same cross-chunk capture and forwards the verified samples', async ({
  playwright,
  browser,
  request,
  baseURL,
}, info) => {
  const {sources} = await (await request.get('/v1/catalog')).json();
  const real = !sources[0].revision.startsWith('fixture-v1-');
  const isWebKit = info.project.name === 'mobile-webkit';
  // Each project is the maker and ultimate listener. The editor receives the
  // original on a different engine in a new anonymous context.
  const other = await (isWebKit ? playwright.chromium : playwright.webkit).launch();
  try {
    const creator = await fresh(browser, baseURL, info.project.use);
    const maker = await creator.newPage();
    await perform(maker, real);
    const raw = await maker.evaluate(() =>
      window.capturedPCM ? btoa(Array.from(window.capturedPCM, (value) => String.fromCharCode(value)).join('')) : '',
    );
    const retained = Buffer.from(raw, 'base64');
    expect(retained.length).toBe(48000 * 4);
    const preview = await prepare(maker);
    const parent = await publish(maker);
    const original = await manifest(request, parent);
    expect(original.take.sha256).toBe(preview.take.sha256);
    const g = original.recipe.gestures[0];
    const boundary = original.recipe.passage.startFrame + 3 * 48000;
    expect(g.fragmentRef.startFrame).toBeLessThan(boundary);
    expect(g.fragmentRef.endFrame).toBeGreaterThan(boundary);
    expect(g.fragmentRef.frameCount).toBe(48000);
    const publishedPCM = await request.get(original.fragments[0].url);
    expect(publishedPCM.ok()).toBe(true);
    expect(retained.equals(await publishedPCM.body())).toBe(true);
    await creator.close();

    const editor = await fresh(other, baseURL, isWebKit ? {} : devices['iPhone 13']);
    const page = await playSaved(editor, parent, original);
    await button(page, 'Make a variation').click();
    const row = page.getByRole('list', {name: 'Fragment triggers'}).getByRole('listitem');
    await expect(row.getByLabel('Capture source')).toContainText(g.fragmentRef.sha256);
    await row.getByLabel('Start (seconds)').fill('5.5');
    await button(row, 'Move').click();
    await row.getByLabel('Treatment').selectOption('dissolve');
    const changed = await prepare(page);
    // Lose the first reply after the real publication. The editor must recover
    // its exact child ID and keep the verified capture available on retry.
    let firstID;
    await page.route(
      '**/v1/takes',
      async (route) => {
        firstID = (await (await route.fetch()).json()).id;
        await route.abort('failed');
      },
      {times: 1},
    );
    await button(page, 'Publish take').click();
    await expect(page.getByRole('alert')).toBeVisible();
    const child = await publish(page);
    expect(child.searchParams.get('id')).toBe(firstID);
    await editor.close();

    for (const [url, prepared] of [
      [parent, preview],
      [child, changed],
    ]) {
      const cold = await fresh(browser, baseURL, info.project.use);
      const saved = await manifest(request, url);
      if (url === parent) expect(saved).toEqual(original);
      expect(saved.take.sha256).toBe(prepared.take.sha256);
      await playSaved(cold, url, saved);
      await cold.close();
    }
    const proof = JSON.parse(
      execFileSync(process.execPath, ['scripts/check-fragment-handoff.mjs', parent.href, child.href], {
        encoding: 'utf8',
      }),
    );
    expect(proof.child.startFrame).toBe(264000);
    expect(proof.fragment.sha256).toBe(g.fragmentRef.sha256);
    console.log('Memory handoff', info.project.name, parent.href, child.href, JSON.stringify(proof));
  } finally {
    await other.close();
  }
});
