const {test, expect} = require('@playwright/test');
const {createHash} = require('node:crypto');
const button = (page, name) => page.getByRole('button', {name, exact: true});
const rows = (page) => page.getByRole('list', {name: 'Fragment triggers'}).getByRole('listitem');

async function maker(page) {
  await page.setViewportSize({width: 390, height: 844});
  await page.addInitScript(() => sessionStorage.setItem('room-labs-session', 'open'));
  await page.goto('/labs/#audio-experiments');
  await button(page, 'Open Memory & fragments ↗').click();
}

test('capture a stereo hit, compare, move and change its treatment without changing the source samples', async ({
  page,
  request,
}) => {
  await maker(page);
  const record = button(page, 'Record'),
    capture = button(page, 'Capture fragment'),
    trigger = button(page, 'Trigger fragment');
  for (const control of [record, capture, trigger]) await expect(control).toBeInViewport({ratio: 1, timeout: 3000});
  await page.screenshot({path: 'artifacts/audio-memory/take-maker/' + test.info().project.name + '-390.png'});
  await record.click();
  await expect(capture).toBeEnabled();
  await capture.press('Enter');
  await expect(trigger).toBeEnabled();
  await trigger.press('Enter');
  await expect(rows(page)).toHaveCount(1);
  const proof = rows(page).getByLabel('Capture source');
  const identity = await proof.textContent();
  await button(page, 'Hear original').click();
  await button(page, 'Hear take').click();
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect(record).toBeEnabled();
  await rows(page).getByLabel('Start (seconds)').fill('0.125');
  await button(rows(page), 'Move').press('Enter');
  await rows(page).getByLabel('Treatment').selectOption('dissolve');
  await expect(rows(page)).toContainText('Trigger 0:00.125');
  await expect(proof).toHaveText(identity);
  const preparation = page.waitForResponse((r) => r.url().endsWith('/v1/preparations') && r.status() === 201);
  await button(page, 'Prepare take').click();
  const saved = await (await preparation).json();
  const g = saved.recipe.gestures[0];
  expect(g.treatment).toBe('dissolve');
  expect(g.startFrame).toBe(6000);
  const range = {...saved.recipe.passage, startFrame: g.fragmentRef.startFrame, endFrame: g.fragmentRef.endFrame};
  const pcm = await (await request.get('/v1/passage?' + new URLSearchParams(range))).body();
  expect(createHash('sha256').update(pcm).digest('hex')).toBe(g.fragmentRef.sha256);
  expect(identity).toContain(g.fragmentRef.sha256);
  await button(rows(page), 'Remove').press('Enter');
  await expect(rows(page)).toHaveCount(0);
  await button(page, 'Discard fragment').click();
  await expect(trigger).toBeDisabled();
});

test('public rendered audio survives corrupt material and retry opens the verified inherited trigger', async ({
  page,
  request,
}) => {
  const catalog = await (await request.get('/v1/catalog')).json();
  const source = catalog.sources[0],
    passage = {sourceId: source.id, revision: source.revision, ...source.curatedRange};
  const startFrame = passage.startFrame,
    endFrame = startFrame + 12000;
  const pcm = await (
    await request.get('/v1/passage?' + new URLSearchParams({...passage, startFrame, endFrame}))
  ).body();
  const sha256 = createHash('sha256').update(pcm).digest('hex');
  const fragmentRef = {
    ...passage,
    startFrame,
    endFrame,
    frameCount: 12000,
    sampleRate: 48000,
    channels: 2,
    format: 's16le',
    sha256,
  };
  const recipe = {
    schema: 1,
    rendererVersion: 1,
    experiment: 'audio-memory',
    parentId: null,
    passage,
    gestures: [
      {
        id: 'hit',
        fragmentRef,
        startFrame: 48000,
        endFrame: 96000,
        treatment: 'repeat',
        density: 3,
        level: 0.8,
        seedVersion: 1,
      },
    ],
  };
  const prep = await (await request.post('/v1/preparations', {data: recipe})).json();
  const saved = await (
    await request.post('/v1/takes', {data: {preparationId: prep.preparationId, requestId: crypto.randomUUID()}})
  ).json();
  const url = '**/v1/takes/' + saved.id + '/fragments/' + sha256;
  const corrupt = Buffer.from(pcm);
  corrupt[5] ^= 1;
  await page.route(url, (r) => r.fulfill({contentType: 'application/octet-stream', body: corrupt}));
  await page.goto('/takes/?id=' + saved.id);
  await expect(page.getByRole('heading', {name: 'Memory & fragments'})).toBeVisible({timeout: 3000});
  await button(page, 'Play take').click();
  await expect(button(page, 'Pause')).toBeEnabled();
  await expect(page.getByRole('alert')).toContainText(sha256.slice(0, 12));
  await expect(button(page, 'Make a variation')).toBeDisabled();
  await page.unroute(url);
  await button(page, 'Retry material').click();
  await button(page, 'Make a variation').click();
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page).getByLabel('Capture source')).toContainText(sha256);
});

test('select either trigger and reuse its capture after leaving the maker for the live study', async ({page}) => {
  await maker(page);
  await button(page, 'Record').click();
  const capture = button(page, 'Capture fragment'),
    perform = button(page, 'Trigger fragment');
  await capture.click();
  await perform.click();
  await expect(rows(page)).toHaveCount(1);
  await capture.click();
  await perform.click();
  await expect(rows(page)).toHaveCount(2);
  await button(page, 'Stop').click();
  const first = rows(page).first(),
    second = rows(page).last();
  await expect(button(second, 'Select trigger 2')).toHaveAttribute('aria-pressed', 'true', {timeout: 2000});
  await button(first, 'Select trigger 1').press('Enter');
  await expect(button(first, 'Select trigger 1')).toHaveAttribute('aria-pressed', 'true');
  await button(first, 'Use this capture').press('Enter');
  const expected = await first.getByLabel('Capture source').textContent();
  await button(page, 'Open live fragment study').click();
  await button(page, 'Back to fragment take').press('Enter');
  await expect(button(page, 'Open live fragment study')).toBeFocused();
  await expect(rows(page)).toHaveCount(2);
  await expect(page.getByLabel('Retained fragment').getByLabel('Capture source')).toHaveText(expected);
  await button(rows(page).first(), 'Select trigger 1').press('Enter');
  await button(rows(page).first(), 'Remove').press('Enter');
  await expect(button(rows(page).first(), 'Select trigger 1')).toBeFocused();
  await expect(page.getByLabel('Retained fragment').getByLabel('Capture source')).toHaveText(expected);
});

test('the static phone launcher exposes the original fragment study by keyboard', async ({page}) => {
  const server = require('node:child_process').spawn(process.execPath, ['scripts/serve.mjs'], {
    env: {...process.env, PORT: '0', ROOM_TAKE_FIXTURE: '0', ROOM_TAKE_SOURCE_DIR: ''},
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  try {
    const [line] = await require('node:events').once(server.stdout, 'data');
    const origin = String(line).trim().split(' ').at(-1);
    await page.setViewportSize({width: 390, height: 844});
    await page.addInitScript(() => sessionStorage.setItem('room-labs-session', 'open'));
    await page.goto(origin + '/labs/#audio-experiments');
    const catalog = page.waitForResponse((r) => r.url().endsWith('/v1/catalog'));
    await button(page, 'Open Memory & fragments ↗').click();
    expect((await catalog).status()).toBe(404);
    const study = button(page, 'Open live fragment study');
    await expect(study).toBeInViewport({ratio: 1});
    await study.focus();
    await page.keyboard.press('Enter');
    await expect(button(page, 'Play source')).toBeVisible();
    await button(page, 'Back to Labs').click();
    await expect(button(page, 'Open Memory & fragments ↗')).toBeFocused();
  } finally {
    server.kill();
  }
});

test('a silent capture can retry and stopping during the next digest preserves the retained capture', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const native = crypto.subtle.digest.bind(crypto.subtle);
    crypto.subtle.digest = async (...args) => {
      if (window.holdHash)
        await new Promise((resolve) => {
          window.releaseHash = resolve;
        });
      return native(...args);
    };
  });
  await page.route('**/v1/passage?**', async (route) => {
    const real = await route.fetch(),
      pcm = Buffer.from(await real.body());
    pcm.fill(0, 0, 48000 * 4 * 2);
    await route.fulfill({response: real, body: pcm});
  });
  await maker(page);
  await button(page, 'Record').click();
  await button(page, 'Capture fragment').click();
  await expect(page.getByRole('alert')).toContainText('silent');
  await expect(page.getByLabel('Audition position')).toHaveAttribute('aria-valuetext', /0:0[3-7]/);
  await button(page, 'Retry capture').click();
  const retained = page.getByLabel('Retained fragment');
  await expect(retained).toBeVisible();
  const previous = await retained.textContent();
  await page.evaluate(() => {
    window.holdHash = true;
  });
  await button(page, 'Capture fragment').click();
  await expect(page.locator('article.take-editor').getByRole('status')).toContainText('Reading recent audio');
  await button(page, 'Stop').click();
  await page.evaluate(() => {
    window.holdHash = false;
    window.releaseHash();
  });
  await expect(retained).toHaveText(previous);
  await expect(rows(page)).toHaveCount(0);
  await button(page, 'Discard fragment').click();
  await expect(retained).toHaveCount(0);
});

test('a share link appears after independent public material verification and an idempotent retry', async ({page}) => {
  await maker(page);
  await button(page, 'Record').click();
  await button(page, 'Capture fragment').click();
  await button(page, 'Trigger fragment').click();
  await expect(rows(page)).toHaveCount(1);
  await button(page, 'Stop').click();
  await button(page, 'Prepare take').click();
  await button(page.getByRole('region', {name: 'Prepared performance'}), 'Play take').click();
  const pattern = '**/v1/takes/*/fragments/*';
  await page.route(pattern, (r) => r.fulfill({status: 503, body: 'Unavailable'}));
  const reads = [];
  page.on('response', async (r) => {
    if (r.request().method() === 'POST' && r.url().endsWith('/v1/takes') && r.ok()) reads.push((await r.json()).id);
  });
  await button(page, 'Publish take').click();
  await expect(page.getByRole('alert')).toContainText('Editing capture');
  await expect(page.getByRole('link', {name: 'Open shared take'})).toHaveCount(0);
  await page.unroute(pattern);
  await button(page, 'Publish take').click();
  await expect(page.getByRole('link', {name: 'Open shared take'})).toBeVisible();
  expect(reads).toHaveLength(2);
  expect(reads[1]).toBe(reads[0]);
});

test('the live monitor changes between the performed waveform and dry waveform without dropping the trigger', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const Native = window.AudioWorkletNode;
    window.AudioWorkletNode = class extends Native {
      constructor(context, name, options) {
        super(context, name, options);
        if (name !== 'room-memory-take-v1') return;
        const merger = context.createChannelMerger(3);
        const probe = context.createScriptProcessor(512, 3, 1);
        merger.connect(probe);
        probe.connect(context.destination);
        window.trace = {take: 0, original: 0};
        probe.onaudioprocess = ({inputBuffer}) => {
          const dry = inputBuffer.getChannelData(0),
            take = inputBuffer.getChannelData(1),
            heard = inputBuffer.getChannelData(2);
          for (let i = 0; i < heard.length; i++) {
            if (Math.abs(take[i] - dry[i]) < 0.002) continue;
            if (Math.abs(heard[i] - take[i]) < 0.00001) window.trace.take++;
            if (Math.abs(heard[i] - dry[i]) < 0.00001) window.trace.original++;
          }
        };
        this.merger = merger;
      }
      connect(destination, output = 0, input = 0) {
        const connection = super.connect(destination, output, input);
        if (this.merger) {
          const reference = this.context.createChannelSplitter(2),
            monitor = this.context.createChannelSplitter(2);
          super.connect(reference, output, 0);
          reference.connect(this.merger, 0, output);
          destination.connect(monitor);
          monitor.connect(this.merger, 0, 2);
        }
        return connection;
      }
    };
  });
  await maker(page);
  await page.locator('summary').filter({hasText: 'Capture and trigger settings'}).click();
  await page.getByLabel('Trigger duration', {exact: true}).fill('6');
  await page.getByLabel('Density', {exact: true}).fill('8');
  await button(page, 'Record').click();
  await button(page, 'Capture fragment').click();
  await button(page, 'Trigger fragment').click();
  await expect.poll(() => page.evaluate(() => window.trace.take), {timeout: 3500}).toBeGreaterThan(20);
  await button(page, 'Hear original').click();
  await expect.poll(() => page.evaluate(() => window.trace.original), {timeout: 3500}).toBeGreaterThan(20);
  const before = await page.evaluate(() => window.trace.take);
  await button(page, 'Hear take').click();
  await expect.poll(() => page.evaluate(() => window.trace.take), {timeout: 3500}).toBeGreaterThan(before + 20);
  await button(page, 'Stop').click();
  await expect(rows(page)).toHaveCount(1);
});

test('touch cancellation releases the running Memory voice and keeps the recorded trigger', async ({page}) => {
  await maker(page);
  await button(page, 'Record').click();
  await button(page, 'Capture fragment').click();
  await button(page, 'Trigger fragment').click();
  await expect(rows(page)).toHaveCount(1);
  await button(page, 'Trigger fragment').dispatchEvent('pointercancel', {pointerId: 10, pointerType: 'touch'});
  await expect(button(page, 'Record')).toBeEnabled({timeout: 1200});
  await expect(rows(page)).toHaveCount(1);
});

test('place a retained capture at an exact time and select its trigger from the waveform', async ({page}) => {
  await maker(page);
  await button(page, 'Record').click();
  await button(page, 'Capture fragment').click();
  await button(page, 'Trigger fragment').click();
  await expect(rows(page)).toHaveCount(1);
  await button(page, 'Stop').click();
  await page.getByLabel('Timeline position (seconds)').fill('4.5');
  await expect(button(page, 'Add trigger')).toBeEnabled({timeout: 1500});
  await button(page, 'Add trigger').press('Enter');
  await expect(rows(page).last()).toContainText('Trigger 0:04.500');
  const firstHandle = page.getByRole('slider', {name: 'Move trigger 1'});
  await firstHandle.focus();
  await page.keyboard.press('ArrowRight');
  await expect(button(rows(page).first(), 'Select trigger 1')).toHaveAttribute('aria-pressed', 'true');
});

test('enlarged phone text preserves each playhead time and wraps the controls', async ({page}) => {
  await maker(page);
  await button(page, 'Record').waitFor();
  await page.addStyleTag({content: 'html {font-size:200%!important}'});
  const layout = await page.locator('.take-meter span').evaluateAll((spans) =>
    spans.map((span) => {
      const range = document.createRange();
      range.selectNodeContents(span);
      return new Set([...range.getClientRects()].map((rect) => rect.y)).size;
    }),
  );
  expect(layout).toEqual([1, 1]);
  const record = await button(page, 'Record').boundingBox(),
    capture = await button(page, 'Capture fragment').boundingBox();
  expect(capture.y).toBeGreaterThan(record.y);
});
