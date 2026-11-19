const {expect} = require('@playwright/test');
const button = (page, name) => page.getByRole('button', {name, exact: true});
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
    const outputs = new WeakMap();
    const connect = AudioNode.prototype.connect;
    AudioNode.prototype.connect = function (target, ...args) {
      const result = connect.call(this, target, ...args);
      outputs.set(this, target);
      return result;
    };
    const native = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (when, offset, ...rest) {
      const buffer = this.buffer;
      const mode = document.querySelector('[aria-label="Saved performance"] [aria-pressed=true]')?.textContent;
      const bus = outputs.get(this);
      const entry = {
        when,
        offset,
        mode,
        frames: buffer.length,
        context: this.context,
        hash: null,
        bus,
        output: outputs.get(bus),
      };
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

async function compareSavedAudio(page, record) {
  const transport = compare(page);
  await button(transport, 'Play take').click();
  await checkAudio(page, record);
  const position = transport.getByRole('slider', {name: 'Playback position'});
  for (const mode of ['Original', 'Take']) {
    const before = Number(await position.inputValue());
    await button(transport, mode).click();
    await expect(button(transport, mode)).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(async () => Number(await position.inputValue())).toBeGreaterThan(before);
    expect(await page.evaluate(() => window.scheduled.length)).toBe(2);
    await expect
      .poll(() =>
        page.evaluate(() =>
          window.scheduled
            .map((entry) => [entry.hash, entry.bus?.gain.value, entry.output === entry.context.destination])
            .sort(),
        ),
      )
      .toEqual(
        [
          [record.dry.sha256, Number(mode === 'Original'), true],
          [record.take.sha256, Number(mode === 'Take'), true],
        ].sort(),
      );
  }
}

module.exports = {compareSavedAudio, button, compare, review, fresh, checkAudio, prepare, publish, manifest};
