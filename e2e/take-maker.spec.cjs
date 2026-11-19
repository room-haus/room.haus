const {test, expect} = require('@playwright/test');
const path = require('node:path');

// Offline UI fixture at the HTTP boundary. Playback uses the real worklet,
// passing dry PCM through the same transport as the local MX029 catalog.
const rate = 48000;
const curatedRange = {startFrame: 100800610, endFrame: 101184610};
const source = {id: 'MX029', revision: 'e2e-pulse', totalFrames: 177025220, sampleRate: rate, channels: 2,
  curatedRange, denseRange: {startFrame: 43200261, endFrame: 43584261},
  peaks: [{framesPerPeak: rate, values: [[-3000, 9000, -5000, 12000]]}]};
async function setup(page) {
  await page.addInitScript(() => sessionStorage.setItem('room-labs-session', 'open'));
  await page.route('**/v1/catalog', route => route.fulfill({json: {sources: [source], limits: {maxPassageFrames: 1440000, maxGestures: 24}}}));
  await page.route('**/v1/passage?**', route => {
    const query = new URL(route.request().url()).searchParams;
    const frames = Number(query.get('endFrame')) - Number(query.get('startFrame'));
    const pcm = Buffer.alloc(frames * 4);
    for (let i = 0; i < frames; i++) {
      const v = Math.round(12000 * Math.sin(i * .05) * Math.exp(-(i % 24000) / 1200));
      pcm.writeInt16LE(v, i * 4);
      pcm.writeInt16LE(v, i * 4 + 2);
    }
    return route.fulfill({contentType: 'application/octet-stream', body: pcm});
  });
  await page.setViewportSize({width: 390, height: 844});
  await page.goto('/labs/#audio-experiments');
  await page.getByRole('button', {name: 'Open Space & echoes ↗'}).click();
}
const button = (page, name) => page.getByRole('button', {name, exact: true});
test('record on the phone, overdub, compare and edit the timeline by keyboard', async ({page}, info) => {
  await setup(page);
  const play = button(page, 'Play passage'), record = button(page, 'Record'), echo = button(page, 'Echo');
  for (const control of [play, record, echo]) await expect(control).toBeInViewport({ratio: 1, timeout: 5000});
  await page.screenshot({path: path.join('artifacts/audio-space/take-maker', info.project.name + '-390.png')});
  await play.click();
  await expect(button(page, 'Stop')).toBeEnabled();
  await button(page, 'Stop').click();
  await record.click();
  await expect(echo).toBeEnabled();
  await echo.focus();
  await page.keyboard.down('Space');
  await page.keyboard.down('Space');
  await expect(page.locator('.take-editor > .take-body > [role=status]')).toContainText('Sending');
  await page.keyboard.up('Space');
  await expect(page.locator('.take-editor > .take-body > [role=status]')).toContainText('tail');
  await button(page, 'Stop').click();
  const throws = page.getByRole('list', {name: 'Echo throws'}).getByRole('listitem');
  await expect(throws).toHaveCount(1);
  await record.click();
  await expect(echo).toBeEnabled();
  await page.waitForTimeout(1200);
  await echo.dispatchEvent('pointerdown', {pointerId: 7, pointerType: 'touch', isPrimary: true, button: 0});
  await expect(page.locator('.take-editor > .take-body > [role=status]')).toContainText('Sending');
  await echo.dispatchEvent('pointercancel', {pointerId: 7, pointerType: 'touch'});
  await expect(page.locator('.take-editor > .take-body > [role=status]')).toContainText('tail');
  await button(page, 'Stop').click();
  await expect(throws).toHaveCount(2);
  await play.click();
  await button(page, 'Hear original').click();
  await button(page, 'Hear take').click();
  await button(page, 'Stop').click();
  await expect(throws).toHaveCount(2);
  await page.getByLabel('Timeline position (seconds)').fill('4');
  await button(page, 'Add throw').press('Enter');
  await expect(throws).toHaveCount(3);
  const row = throws.last();
  await row.getByLabel('Start (seconds)').fill('5');
  await row.getByRole('button', {name: 'Move', exact:true}).press('Enter');
  await expect(row).toContainText('0:05.000');
  await row.getByRole('button', {name: 'Remove'}).press('Enter');
  await expect(throws).toHaveCount(2);
});

test('a live echo reaches the audio output, release on blur and clock interruption preserve earlier edits', async ({page}) => {
  await page.addInitScript(() => {
    const Native = window.AudioWorkletNode;
    window.__observedNodes = [];
    window.AudioWorkletNode = class extends Native {
      constructor(context, name, options) {
        super(context, name, options);
        if (name !== 'room-space-take-v1') return;
        const analyser = context.createAnalyser();
        analyser.fftSize = 512;
        this.connect(analyser);
        const state = {context, tailPeak: 0, start: options.processorOptions.startContextFrame / context.sampleRate};
        window.__observedNodes.push(state);
        const samples = new Float32Array(analyser.fftSize);
        const timer = setInterval(() => {
          if (context.state === 'closed') {clearInterval(timer); return;}
          const t = context.currentTime - state.start;
          // The fixture's fourth dry hit starts at 1.5 s. Measure its delayed copy
          // between hits, where the dry signal has decayed below .0002 full scale.
          if (t < 1.715 || t > 1.775) return;
          analyser.getFloatTimeDomainData(samples);
          state.tailPeak = Math.max(state.tailPeak, ...samples.map(Math.abs));
        }, 5);
      }
    };
  });
  await setup(page);
  await button(page, 'Add throw').click();
  await button(page, 'Record').click();
  const pad = button(page, 'Echo');
  await expect(pad).toBeEnabled();
  await page.waitForFunction(() => {
    const s = window.__observedNodes[0]; return s && s.context.currentTime > s.start + .65;
  });
  await pad.focus(); await page.keyboard.down('Space');
  await expect(page.locator('.take-editor > .take-body > [role=status]')).toContainText('Sending');
  await expect.poll(() => page.evaluate(() => window.__observedNodes[0].tailPeak)).toBeGreaterThan(.005);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await page.keyboard.up('Space');
  await expect(page.locator('.take-editor > .take-body > [role=status]')).toContainText('tail');
  await page.evaluate(() => window.__observedNodes[0].context.suspend());
  await expect(page.getByRole('alert')).toContainText('interrupted');
  await expect(page.getByRole('list', {name: 'Echo throws'}).getByRole('listitem')).toHaveCount(1);
  await button(page, 'Play passage').click();
  await expect(button(page, 'Hear original')).toBeEnabled();
  await button(page, 'Back to Labs').click();
  await expect.poll(() => page.evaluate(() => window.__observedNodes.map(s => s.context.state))).toEqual(['closed', 'closed']);
});

test('a held throw closes at the exact out point and a failed range change retains the draft', async ({page}) => {
  await setup(page);
  await page.getByText('Choose passage', {exact: false}).first().click();
  await page.getByLabel('In frame', {exact:true}).fill('0');
  await page.getByLabel('Out frame', {exact:true}).fill('72000');
  await button(page, 'Load passage').click();
  await expect(page.getByText('OUT 0:01.500')).toBeVisible();
  await button(page, 'Record').click();
  const pad = button(page, 'Echo');
  await expect(pad).toBeEnabled();
  await pad.focus(); await page.keyboard.down('Space');
  await expect(page.locator('.take-editor > .take-body > [role=status]')).toContainText('Sending');
  await expect(page.locator('.take-editor > .take-body > [role=status]')).toHaveText('Ready to play');
  await page.keyboard.up('Space');
  const throws = page.getByRole('list', {name: 'Echo throws'}).getByRole('listitem');
  await expect(throws).toHaveCount(1);
  await expect(throws).toContainText('– 0:01.500');
  await page.locator('summary').filter({hasText:'Choose passage'}).click();
  await button(page, 'Dense range').click();
  await button(page, 'Load passage').click();
  await page.route('**/v1/passage?**', route => route.fulfill({status:503,body:'Unavailable'}));
  await button(page, 'Start new draft').click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(throws).toHaveCount(1);
  await expect(button(page, 'Record')).toBeEnabled();
  await page.addStyleTag({content:'html { font-size: 200% !important }'});
  expect(await page.evaluate(() => document.querySelector('dialog').scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test('a newer range wins over a pending PCM read', async ({page}) => {
  await setup(page);
  await expect(button(page,'Play passage')).toBeEnabled();
  await page.locator('summary').filter({hasText:'Choose passage'}).click();
  const requests = [];
  await page.route('**/v1/passage?**', route => {
    requests.push(route);
  });
  await button(page, 'Dense range').click();
  await button(page, 'Load passage').click();
  await expect.poll(() => requests.length).toBe(1);
  await page.getByLabel('In frame', {exact:true}).fill('0');
  await page.getByLabel('Out frame', {exact:true}).fill('48000');
  await button(page, 'Load passage').click();
  await expect.poll(() => requests.length).toBe(2);
  await requests[1].fulfill({contentType:'application/octet-stream',body:Buffer.alloc(rate*4)});
  await expect(page.getByText('OUT 0:01.000')).toBeVisible();
  await requests[0].fulfill({contentType:'application/octet-stream',body:Buffer.alloc(rate*8*4)}).catch(() => {});
  await expect(button(page,'Play passage')).toBeEnabled();
  await expect(page.getByText('OUT 0:01.000')).toBeVisible();
});

test('drag a throw to a later hit and choose a distant excerpt by mix time', async ({page}) => {
  await setup(page);
  await expect(button(page,'Play passage')).toBeEnabled();
  await page.getByLabel('Timeline position (seconds)').fill('2');
  await button(page,'Add throw').click();
  const handle = page.getByRole('slider',{name:'Move throw 1'});
  const wave = page.getByRole('group',{name:'Selected passage waveform'});
  await wave.scrollIntoViewIfNeeded();
  const handleBox = await handle.boundingBox(), waveBox = await wave.boundingBox();
  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(handleBox.x + handleBox.width / 2 + waveBox.width / 4,handleBox.y + handleBox.height / 2,{steps:8});
  await page.mouse.up();
  const start = await page.getByLabel('Start (seconds)',{exact:true}).inputValue();
  expect(Number(start)).toBeCloseTo(4,1);
  await page.locator('summary').filter({hasText:'Choose passage'}).click();
  await page.getByLabel('Start at mix time').fill('12:34.500');
  await button(page,'Set start').click();
  await button(page,'Load passage').click();
  await button(page,'Start new draft').click();
  await expect(page.getByText('IN 12:34.500')).toBeVisible();
  await expect(page.getByText('OUT 12:42.500')).toBeVisible();
});

test('switch between the maker and the continuous study with the same draft', async ({page}) => {
  await setup(page);
  await button(page,'Add throw').click();
  await button(page,'Play passage').click();
  await button(page,'Open continuous delay and reverb study').click();
  await expect(page.getByRole('combobox',{name:'Listening source'})).toBeVisible();
  await expect(button(page,'Back to echo take')).toBeVisible({timeout:3000});
  await button(page,'Back to echo take').click();
  await expect(button(page,'Play passage')).toBeEnabled();
  await expect(page.getByRole('list',{name:'Echo throws'}).getByRole('listitem')).toHaveCount(1);
});
