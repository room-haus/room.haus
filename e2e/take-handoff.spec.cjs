const {test: base, expect} = require('@playwright/test');
const {createHash} = require('node:crypto');
const path = require('node:path');

// Read-only scenarios can share one immutable take per worker. Creating it
// afresh for each page would exhaust the local service's anonymous write limit.
const test = base.extend({
  savedParent: [async ({playwright}, use, workerInfo) => {
    const request = await playwright.request.newContext({baseURL: workerInfo.project.use.baseURL});
    try {
      await use(await seed(request));
    } finally {
      await request.dispose();
    }
  }, {scope: 'worker'}],
});

const {button, compare, review, fresh, checkAudio, prepare, publish, manifest} = require('./helpers/take-handoff.cjs');
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');

async function maker(page) {
  await page.goto('/labs/#audio-experiments');
  await page.getByLabel('Username').fill('admin');
  await page.getByLabel('Password').fill('BigSmall');
  await page.getByRole('button', {name: /Enter labs/}).click();
  await button(page, 'Open Space & echoes ↗').click();
  await page.getByLabel('Timeline position (seconds)').fill('1');
  await button(page, 'Add throw').click();
}
test('a cold listener compares a saved take, moves the throw and forwards a distinct immutable child', async ({
  browser,
  baseURL,
  request,
  playwright,
}, info) => {
  const options = info.project.use;
  // Forward from a desktop Chromium maker to a separate mobile WebKit
  // engine. Other projects cover the same-profile round trip.
  const desktop = info.project.name === 'mobile-webkit' ? await playwright.chromium.launch() : null;
  const sender = await fresh(desktop ?? browser, baseURL, desktop ? {} : options);
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
  await desktop?.close();

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
  for (const [mode, key, other] of [['Original', 'Enter', 'Take'], ['Take', 'Space', 'Original']]) {
    const choice = button(saved, mode);
    await choice.focus();
    await expect(choice).toBeFocused();
    const before = Number(await seek.inputValue());
    await page.keyboard.press(key);
    await expect(choice).toHaveAttribute('aria-pressed', 'true');
    await expect(button(saved, other)).toHaveAttribute('aria-pressed', 'false');
    expect(Number(await seek.inputValue())).toBeGreaterThanOrEqual(before);
    await expect.poll(async () => Number(await seek.inputValue())).toBeGreaterThan(before);
    // Both references keep their original scheduled start on the same transport.
    expect(await page.evaluate(() => window.scheduled.length)).toBe(2);
  }
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
    const received = {};
    for (const mode of ['dry', 'take']) {
      const response = await request.get(new URL(savedManifest[mode].url, url).href);
      expect(response.ok()).toBe(true);
      const bytes = await response.body();
      expect(digest(bytes)).toBe(preview[mode].sha256);
      received[mode] = bytes;
    }
    if (original.recipe.passage.revision.startsWith('fixture-v1-')) {
      // Transients occur every half second. The edited send must move the
      // first returned sample with its hit, preserving all earlier dry PCM.
      const firstChangedByte = received.take.findIndex((value, i) => value !== received.dry[i]);
      expect(Math.floor(firstChangedByte / 4)).toBe(start + original.recipe.gestures[0].settings.delayFrames);
    }
    await button(compare(opened), 'Play take').click();
    await checkAudio(opened, preview);
    await cold.close();
  }
  expect(childPreview.dry.sha256).toBe(prepared.dry.sha256);
  expect(childPreview.take.sha256).not.toBe(prepared.take.sha256);
  console.log('Verified immutable handoff', parent.href, child.href);
});

async function seed(request, range) {
  const {sources} = await (await request.get('/v1/catalog')).json(),
    source = sources[0];
  const settings = {delayFrames: 9696, feedback: 0.168, wetLevel: 0.5, stereoWidth: 0};
  const parent = {
    schema: 1,
    experiment: 'audio-space',
    rendererVersion: 1,
    parentId: null,
    initialSettings: settings,
    passage: {sourceId: source.id, revision: source.revision, ...(range ?? source.curatedRange)},
    gestures: [{id: 'third', startFrame: 48000, endFrame: 60000, settings}],
  };
  const preparation = await request.post('/v1/preparations', {data: parent});
  await expect(preparation).toBeOK();
  const prepared = await preparation.json();
  const published = await request.post('/v1/takes', {
    data: {preparationId: prepared.preparationId, requestId: require('node:crypto').randomUUID()},
  });
  await expect(published).toBeOK();
  return published.json();
}

test('a corrupt reference fails closed, then a future edit version remains playable', async ({page, savedParent: parent}) => {
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
  savedParent: parent,
}) => {
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
  savedParent: parent,
}, info) => {
  const revision = (await (await request.get('/v1/catalog')).json()).sources[0].revision;
  test.skip(!revision.startsWith('fixture-v1-'), 'The signal thresholds measure the explicit two-transient fixture.');
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

test('current write limits govern variation while saved playback remains available', async ({page, savedParent: parent}) => {
  const pattern = '**/v1/takes/' + parent.id;
  await page.route(pattern, async route => {
    const manifest = await (await route.fetch()).json();
    await route.fulfill({json: {...manifest, editable: false}});
  });
  await page.goto('/takes/?id=' + parent.id);
  await button(compare(page), 'Play take').click();
  await expect(button(compare(page), 'Pause')).toBeEnabled();
  await expect(button(page, 'Make a variation')).toHaveCount(0);
  await page.unroute(pattern);
  await page.reload();
  await button(page, 'Make a variation').click();
  await expect(page.getByText('1 of 24 throws')).toBeVisible();
});

test('a missing private preparation keeps the draft and requires a fresh audition', async ({browser, baseURL}, info) => {
  const context = await fresh(browser, baseURL, info.project.use);
  try {
    const page = await context.newPage();
    await maker(page);
    const first = await prepare(page);
    // Exercise the real service response for an unbound ID that no longer has a manifest.
    await page.route('**/v1/takes', async route => {
      const body = route.request().postDataJSON();
      const response = await route.fetch({postData: {...body, preparationId: 'f'.repeat(32)}});
      await route.fulfill({response});
    }, {times: 1});
    await button(page, 'Publish take').click();
    await expect(page.getByRole('alert')).toContainText('Your draft is still here');
    await expect(button(page, 'Publish take')).toHaveCount(0);
    const next = await prepare(page);
    expect(next.preparationId).not.toBe(first.preparationId);
    expect(next.recipe).toEqual(first.recipe);
    expect(next.take.sha256).toBe(first.take.sha256);
    await publish(page);
  } finally {
    await context.close();
  }
});

// Golden samples and full Original digests come from a separate, continuous
// decode of the pinned playlist, applying the version-one common gain of 0.5.
// These cases run with ROOM_TAKE_SOURCE_DIR and require no master in CI.
const realPassages = [
  {name: 'frame zero', start: 0, dryHash: 'fe6250ff8896a2b708a5baae2e0527f1456b343257fd59cb232a02e2efa69323',
    samples: [[0, 0, 0], [383999, 387, -1019]]},
  {name: 'a non-curated HLS boundary', start: 58944000, dryHash: 'ee8d49618a92995a0e9e85b807bbf54067c0d8625b9c56e6c4b396d7a2bb69f8',
    samples: [[0, -83, -1289], [96356, -10293, -9872], [96357, -10326, -10360], [383999, -7194, -6534]]},
  {name: 'the final MX029 frame', start: 176641220, dryHash: '2186d7732752a656c8dd8b880f7904543072cf576da0a19b58a63e84ed485657',
    samples: [[0, -2162, -7632], [383999, 0, 0]]},
];

for (const {name, start, dryHash, samples} of realPassages) {
  test('published audio matches the continuous MX029 master at ' + name, async ({browser, baseURL, request}, info) => {
    const {sources} = await (await request.get('/v1/catalog')).json();
    test.skip(sources[0].revision.startsWith('fixture-v1-'), 'Requires the pinned MX029 source.');
    expect(sources[0].revision).toBe(require('../scripts/fixtures/mx029-take-source.json').canonicalSha256);
    const range = {startFrame: start, endFrame: start + 384000};
    const parent = await seed(request, range);
    const url = new URL('/takes/?id=' + parent.id, baseURL);
    const saved = await manifest(request, url);
    expect(saved.recipe.passage).toMatchObject(range);
    const dry = await (await request.get(new URL(saved.dry.url, url).href)).body();
    expect(digest(dry)).toBe(dryHash);
    for (const [frame, left, right] of samples) {
      expect([dry.readInt16LE(frame * 4), dry.readInt16LE(frame * 4 + 2)]).toEqual([left, right]);
    }
    const context = await fresh(browser, baseURL, info.project.use);
    try {
      const page = await context.newPage();
      await page.goto(url.href);
      await button(compare(page), 'Play take').click();
      await checkAudio(page, saved);
      expect(await page.evaluate(() => window.scheduled.slice(-2).map(entry => entry.frames))).toEqual([384000, 384000]);
    } finally {
      await context.close();
    }
  });
}
