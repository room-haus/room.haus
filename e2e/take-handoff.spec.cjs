const {test, expect} = require('@playwright/test');
const {createHash} = require('node:crypto');
const path = require('node:path');

const button = (page, name) => page.getByRole('button', {name, exact: true});
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const link = (page) => page.getByRole('link', {name: 'Open shared take'});
const compare = (page) => page.getByRole('region', {name: 'Saved performance'});
const review = (page) => page.getByRole('region', {name: 'Prepared performance'});

// Observe the actual AudioBuffers scheduled by the page, after PCM decoding.
// The audio graph and the service are real. Restrict the run to local resources.
async function fresh(browser, baseURL, options) {
  const context = await browser.newContext({...options, baseURL});
  await context.route('**/*', (route) =>
    new URL(route.request().url()).origin === new URL(baseURL).origin ? route.continue() : route.abort(),
  );
  await context.addInitScript(() => {
    window.scheduled = [];
    const native = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (when, offset, ...rest) {
      const buffer = this.buffer;
      const mode = document.querySelector('[aria-label="Saved performance"] [aria-pressed=true]')?.textContent;
      const entry = {when, offset, mode, frames: buffer.length, context: this.context, hash: null};
      window.scheduled.push(entry);
      queueMicrotask(async () => {
        const bytes = new DataView(new ArrayBuffer(buffer.length * 4));
        for (let ch = 0; ch < 2; ch++) {
          const samples = buffer.getChannelData(ch);
          for (let i = 0; i < samples.length; i++) bytes.setInt16(i * 4 + ch * 2, Math.round(samples[i] * 32768), true);
        }
        const hash = await crypto.subtle.digest('SHA-256', bytes.buffer);
        entry.hash = Array.from(new Uint8Array(hash), (n) => n.toString(16).padStart(2, '0')).join('');
      });
      return native.call(this, when, offset, ...rest);
    };
  });
  return context;
}
async function maker(page) {
  await page.goto('/labs/#audio-experiments');
  await page.getByLabel('Username').fill('admin');
  await page.getByLabel('Password').fill('BigSmall');
  await page.getByRole('button', {name: /Enter labs/}).click();
  await button(page, 'Open Space & echoes ↗').click();
  await page.getByLabel('Timeline position (seconds)').fill('1');
  await button(page, 'Add throw').click();
}
async function checkAudio(page, reference) {
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.scheduled
          .slice(-2)
          .map((e) => e.hash)
          .sort(),
      ),
    )
    .toEqual([reference.take.sha256, reference.dry.sha256].sort());
  const aligned = await page.evaluate(() => {
    const [a, b] = window.scheduled.slice(-2);
    return a.when === b.when && a.offset === b.offset && a.context === b.context && a.frames === b.frames;
  });
  expect(aligned).toBe(true);
}
async function prepare(page) {
  const response = page.waitForResponse((r) => r.url().endsWith('/v1/preparations') && r.status() === 201);
  await button(page, 'Prepare take').click();
  const prepared = await (await response).json();
  await expect(button(page, 'Publish take')).toBeDisabled();
  await button(review(page), 'Play take').click();
  await checkAudio(page, prepared);
  await expect(button(page, 'Publish take')).toBeEnabled();
  return prepared;
}
async function publish(page) {
  await button(page, 'Publish take').click();
  await expect(link(page)).toBeVisible();
  return new URL(await link(page).getAttribute('href'), page.url());
}
async function manifest(request, url) {
  const res = await request.get(new URL('/v1/takes/' + url.searchParams.get('id'), url).href);
  expect(res.ok()).toBe(true);
  return res.json();
}

test('a cold listener compares a saved take, moves the throw and forwards a distinct immutable child', async ({
  browser,
  baseURL,
  request,
}, info) => {
  const options = info.project.use;
  const sender = await fresh(browser, baseURL, options);
  const makerPage = await sender.newPage();
  await maker(makerPage);
  const prepared = await prepare(makerPage);
  const parent = await publish(makerPage);
  expect(parent.origin).toBe(new URL(baseURL).origin);
  const original = await manifest(request, parent);
  expect(original.parentId).toBe(null);
  expect(original.recipe.gestures[0].startFrame).toBe(48000);
  expect(original.take.sha256).toBe(prepared.take.sha256);
  await sender.close();

  const receiver = await fresh(browser, baseURL, options);
  const page = await receiver.newPage();
  await page.goto(parent.href);
  await expect(page.getByRole('heading', {name: 'Space & echoes'})).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.length + localStorage.length)).toBe(0);
  const saved = compare(page);
  await button(saved, 'Play take').click();
  await checkAudio(page, original);
  const seek = saved.getByRole('slider', {name: 'Playback position'});
  await expect.poll(async () => Number(await seek.inputValue())).toBeGreaterThan(1000);
  const prev = Number(await seek.inputValue());
  await button(saved, 'Original').click();
  await expect(button(saved, 'Original')).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(async () => Number(await seek.inputValue())).toBeGreaterThan(prev);
  await button(saved, 'Take').click();
  expect(await page.evaluate(() => window.scheduled.length)).toBe(2);
  await button(saved, 'Pause').click();
  await seek.evaluate((input) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, '57840');
    input.dispatchEvent(new Event('input', {bubbles: true}));
    input.dispatchEvent(new Event('change', {bubbles: true}));
  }); // after the send, just inside the first repeat of the third fixture hit
  await button(saved, 'Play take').click();
  await checkAudio(page, original);
  await expect.poll(() => page.evaluate(() => window.scheduled.at(-1).offset)).toBe(57840 / 48000);
  await page.screenshot({
    path: path.join(
      'artifacts/audio-space/take-handoff',
      (original.recipe.passage.revision.startsWith('fixture-v1-') ? 'fixture-' : 'mx029-') +
        info.project.name +
        '-listener.png',
    ),
  });
  const beforeVariation = await page.evaluate(() => window.scheduled.length);
  await button(page, 'Make a variation').click();
  await expect.poll(() => page.evaluate(() => window.scheduled.length)).toBe(beforeVariation + 2);
  expect(await page.evaluate(() => window.scheduled.at(-1).offset)).toBe(0);
  await expect(page.getByRole('list', {name: 'Echo throws'})).toContainText('0:01.000');
  await checkAudio(page, original);
  await page.getByLabel('Start (seconds)').focus();
  await page.evaluate(() => (document.documentElement.style.fontSize = '200%'));
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(
    true,
  );
  await page.evaluate(() => document.documentElement.style.removeProperty('font-size'));
  await page.getByLabel('Start (seconds)').fill('1.5');
  await button(page, 'Move').click();
  const childPreview = await prepare(page);
  // Simulate losing the first reply AFTER the real server committed it.
  let firstCommit;
  await page.route(
    '**/v1/takes',
    async (route) => {
      firstCommit = await (await route.fetch()).json();
      await route.abort('failed');
    },
    {times: 1},
  );
  await button(page, 'Publish take').click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('list', {name: 'Echo throws'})).toContainText('0:01.500');
  const child = await publish(page);
  expect(child.searchParams.get('id')).toBe(firstCommit.id);
  expect(child.href).not.toBe(parent.href);
  await receiver.close();

  for (const [url, preview, start] of [
    [parent, prepared, 48000],
    [child, childPreview, 72000],
  ]) {
    const cold = await fresh(browser, baseURL, options);
    const opened = await cold.newPage();
    await opened.goto(url.href);
    await expect(button(compare(opened), 'Play take')).toBeEnabled();
    const savedManifest = await manifest(request, url);
    expect(savedManifest.parentId).toBe(start === 48000 ? null : original.id);
    expect(savedManifest.recipe.passage).toEqual(original.recipe.passage);
    expect(savedManifest.recipe.gestures[0]).toEqual({
      ...original.recipe.gestures[0],
      startFrame: start,
      endFrame: start + 12000,
    });
    for (const mode of ['dry', 'take']) {
      const response = await request.get(new URL(savedManifest[mode].url, url).href);
      expect(response.ok()).toBe(true);
      const bytes = await response.body();
      expect(digest(bytes)).toBe(preview[mode].sha256);
    }
    await button(compare(opened), 'Play take').click();
    await checkAudio(opened, preview);
    await cold.close();
  }
  expect(childPreview.dry.sha256).toBe(prepared.dry.sha256);
  expect(childPreview.take.sha256).not.toBe(prepared.take.sha256);
  console.log('Verified immutable handoff', parent.href, child.href);
});

async function seed(request) {
  const {sources} = await (await request.get('/v1/catalog')).json(),
    source = sources[0];
  const settings = {delayFrames: 9696, feedback: 0.168, wetLevel: 0.5, stereoWidth: 0};
  const parent = {
    schema: 1,
    experiment: 'audio-space',
    rendererVersion: 1,
    parentId: null,
    initialSettings: settings,
    passage: {sourceId: source.id, revision: source.revision, ...source.curatedRange},
    gestures: [{id: 'third', startFrame: 48000, endFrame: 60000, settings}],
  };
  const prepared = await (await request.post('/v1/preparations', {data: parent})).json();
  return (
    await request.post('/v1/takes', {
      data: {preparationId: prepared.preparationId, requestId: require('node:crypto').randomUUID()},
    })
  ).json();
}

test('a corrupt reference fails closed, then a future edit version remains playable', async ({page, request}) => {
  const parent = await seed(request);
  const pattern = '**/v1/takes/' + parent.id;
  await page.route(pattern, async (route) => {
    const manifest = await (await route.fetch()).json();
    manifest.take.sha256 = '0'.repeat(64);
    await route.fulfill({json: manifest});
  });
  await page.goto('/takes/?id=' + parent.id);
  await expect(page.getByRole('alert')).toContainText('audio');
  await expect(button(page, 'Play take')).toHaveCount(0);
  await page.unroute(pattern);
  await page.route(pattern, async (route) => {
    const manifest = await (await route.fetch()).json();
    manifest.recipe.rendererVersion++;
    await route.fulfill({json: manifest});
  });
  await button(page, 'Retry take').click();
  await button(compare(page), 'Play take').click();
  await expect(button(compare(page), 'Pause')).toBeEnabled();
  await expect(page.getByText(/version.*editing/i)).toBeVisible();
  await expect(button(page, 'Make a variation')).toHaveCount(0);
});
test('editing during preparation invalidates the review, and source failure leaves the parent playable', async ({
  page,
  request,
}) => {
  const parent = await seed(request);
  await page.route('**/v1/catalog', (route) => route.abort(), {times: 1});
  await page.goto('/takes/?id=' + parent.id);
  await button(page, 'Make a variation').click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(button(compare(page), 'Pause')).toBeEnabled();
  await button(page, 'Retry variation').click();
  await expect(page.getByLabel('Start (seconds)')).toBeEnabled();
  let release, ready;
  const held = new Promise((r) => {
      release = r;
    }),
    pending = new Promise((r) => {
      ready = r;
    });
  await page.route(
    '**/v1/preparations',
    async (route) => {
      const result = await route.fetch();
      ready();
      await held;
      await route.fulfill({response: result});
    },
    {times: 1},
  );
  await button(page, 'Prepare take').click();
  await pending;
  await page.getByLabel('Start (seconds)').fill('1.5');
  await button(page, 'Move').click();
  release();
  await expect(button(page, 'Prepare take')).toBeEnabled();
  await expect(review(page)).toHaveCount(0);
  await expect(button(page, 'Publish take')).toHaveCount(0);
});

test('keyboard seeking keeps the running clock and outputs the saved echo tail at the new position', async ({
  browser,
  baseURL,
  request,
}, info) => {
  const revision = (await (await request.get('/v1/catalog')).json()).sources[0].revision;
  test.skip(!revision.startsWith('fixture-v1-'), 'The signal thresholds measure the explicit two-transient fixture.');
  const parent = await seed(request);
  const ctx = await fresh(browser, baseURL, info.project.use);
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    const connect = AudioNode.prototype.connect;
    const analysers = new WeakMap();
    window.measuredTail = {Take: 0, Original: 0};
    AudioNode.prototype.connect = function (to, ...rest) {
      if (this instanceof GainNode && to === this.context.destination) {
        let meter = analysers.get(this.context);
        if (!meter) {
          const context = this.context;
          meter = context.createAnalyser();
          meter.fftSize = 1024;
          analysers.set(context, meter);
          const samples = new Float32Array(meter.fftSize);
          const timer = setInterval(() => {
            if (context.state === 'closed') {
              clearInterval(timer);
              return;
            }
            const scheduled = window.scheduled.at(-1);
            if (!scheduled || scheduled.context !== context || scheduled.offset !== 1.35) return;
            const elapsed = context.currentTime - scheduled.when;
            if (elapsed < 0.055 || elapsed > 0.115) return;
            meter.getFloatTimeDomainData(samples);
            const mode = scheduled.mode;
            window.measuredTail[mode] = Math.max(window.measuredTail[mode], ...samples.map(Math.abs));
            window.measuredMode = mode;
          }, 4);
        }
        connect.call(this, meter);
      }
      return connect.call(this, to, ...rest);
    };
  });
  await page.goto('/takes/?id=' + parent.id);
  const saved = compare(page),
    seek = saved.getByRole('slider', {name: 'Playback position'});
  await expect(seek).toBeEnabled();
  await seek.focus();
  await page.keyboard.press('ArrowRight');
  expect(Number(await seek.inputValue())).toBe(12000);
  await button(saved, 'Play take').click();
  const seekTail = () =>
    seek.evaluate((input) => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, '64800');
      input.dispatchEvent(new Event('input', {bubbles: true}));
      input.dispatchEvent(new Event('change', {bubbles: true}));
    });
  await seekTail();
  await expect.poll(() => page.evaluate(() => window.measuredTail.Take)).toBeGreaterThan(0.001);
  await button(saved, 'Original').click();
  await seekTail();
  await expect.poll(() => page.evaluate(() => window.measuredMode)).toBe('Original');
  expect(await page.evaluate(() => window.measuredTail.Original)).toBeLessThan(0.0006);
  expect(await page.evaluate(() => new Set(window.scheduled.map((s) => s.context)).size)).toBe(1);
  await ctx.close();
});
