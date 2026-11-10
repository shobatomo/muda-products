/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS standalone Node test runner. */
// Usage: node tests/catalog-browser.cjs <playwright-core directory> <Chrome executable> [base URL]
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { chromium } = require(path.resolve(process.argv[2]));
const base = process.argv[4] || 'http://127.0.0.1:3017';
const output = path.resolve('tmp/gallery-implementation');
fs.mkdirSync(output, { recursive: true });
const report = { base, checks: [], network: {}, errors: [] };
function passed(name) { report.checks.push(name); console.log('PASS', name); }
function hash(buffer) { return crypto.createHash('sha256').update(buffer).digest('hex'); }

(async () => {
 const browser = await chromium.launch({ headless: true, executablePath: process.argv[3], args: ['--enable-unsafe-swiftshader'] });
 try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  await context.addInitScript(() => {
   window.__audio = { contexts: [], resumes: [], plays: [] };
   const Native = window.AudioContext;
   window.AudioContext = class extends Native {
    constructor(...args) { super(...args); window.__audio.contexts.push(this); }
    resume() { window.__audio.resumes.push(performance.now()); return super.resume(); }
    createBufferSource() {
     const source = super.createBufferSource(); const start = source.start.bind(source);
     source.start = (...args) => { window.__audio.plays.push(performance.now()); return start(...args); }; return source;
    }
    createOscillator() {
     const source = super.createOscillator(); const start = source.start.bind(source);
     source.start = (...args) => { window.__audio.plays.push(performance.now()); return start(...args); }; return source;
    }
   };
  });
  const page = await context.newPage();
  page.on('pageerror', error => report.errors.push(error.message));
  let requests = [];
  page.on('request', request => { if (/\.(glb|wav)(\?|$)/i.test(request.url())) requests.push(request.url()); });
  await page.goto(base + '/products');
  await page.getByRole('heading', { name: 'COLLECTION', exact: true }).waitFor();
  await page.waitForTimeout(1200);
  assert.equal(requests.length, 0);
  assert.equal(await page.locator('canvas').count(), 0);
  assert.equal(await page.locator('main li').count(), 2);
  assert.equal(await page.getByText('表示価格・仕様は仮です。販売はしていません。', { exact: true }).count(), 1);
  assert.equal(await page.getByText(/CART|カート|レビュー|カチカチ/).count(), 0);
  for (const img of await page.locator('main img').all()) assert.ok(await img.evaluate(el => el.complete && el.naturalWidth > 0));
  report.network.collection = [...requests];
  await page.screenshot({ path: path.join(output, 'collection-desktop.png'), fullPage: true });
  passed('Collection: two static images/names, no GLB/audio/canvas, notice once');
  // Hovering and prefetching details must not start model loads either.
  await page.locator('a[href="/products/dial"]').hover();
  await page.waitForTimeout(700);
  assert.equal(requests.length, 0);
  passed('Detail link hover/prefetch does not load GLB');
  for (const slug of ['dial', 'key']) {
   requests = [];
   await page.goto(base + '/products/' + slug);
   await page.getByRole('button', { name: '触ってみる' }).waitFor();
   await page.waitForTimeout(900);
   assert.equal(requests.length, 0);
   assert.equal(await page.locator('canvas').count(), 0);
   assert.equal(await page.evaluate(() => window.__audio.contexts.length), 0);
   report.network[slug + 'BeforeOpen'] = [...requests];
   await page.screenshot({ path: path.join(output, slug + '-detail-desktop.png'), fullPage: true });
   passed(slug + ' detail: static only before open');
   await page.getByRole('button', { name: '触ってみる' }).click();
   const dialog = page.getByRole('dialog');
   await dialog.waitFor();
   await dialog.locator('canvas').waitFor();
   await page.waitForTimeout(2500);
   assert.ok(requests.some(url => url.includes(slug === 'dial' ? 'muda-dial-optimized.glb' : 'muda-key-v1.0.glb')));
   assert.ok(!requests.some(url => url.includes(slug === 'dial' ? 'muda-key' : 'muda-dial')));
   report.network[slug + 'AfterOpen'] = [...requests];
   assert.equal(await page.getByRole('button', { name: '3D ビューを閉じる' }).evaluate(el => el === document.activeElement), true);
   await page.keyboard.press('Shift+Tab');
   assert.equal(await dialog.evaluate(el => el.contains(document.activeElement)), true);
   await page.keyboard.press('Tab');
   assert.equal(await dialog.evaluate(el => el.contains(document.activeElement)), true);
   await page.screenshot({ path: path.join(output, slug + '-modal-desktop.png') });
   const viewer = dialog.getByRole('group');
   await viewer.focus();
   const before = hash(await dialog.locator('canvas').screenshot());
   for (let index = 0; index < 8; index++) await page.keyboard.press('ArrowRight');
   await page.waitForTimeout(500);
   assert.notEqual(hash(await dialog.locator('canvas').screenshot()), before);
   passed(slug + ' modal: selected GLB only, focus trap, keyboard rotates model');
   if (slug === 'dial') {
    assert.ok(await page.evaluate(() => window.__audio.resumes.length > 0));
    assert.ok(await page.evaluate(() => window.__audio.resumes[0] <= performance.getEntriesByType('resource').find(entry => entry.name.includes('muda-dial-optimized.glb')).startTime));
    assert.ok(await page.evaluate(() => window.__audio.plays.length > 0));
    const box = await dialog.locator('canvas').boundingBox();
    const playedBefore = await page.evaluate(() => window.__audio.plays.length);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height * .57);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * .65, box.y + box.height * .57, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(400);
    assert.ok(await page.evaluate(count => window.__audio.plays.length > count, playedBefore));
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await page.waitForTimeout(150);
    assert.ok(await page.evaluate(() => window.__audio.contexts.every(context => context.state === 'suspended')));
    const pausedPlays = await page.evaluate(() => window.__audio.plays.length);
    await page.waitForTimeout(250);
    assert.equal(await page.evaluate(() => window.__audio.plays.length), pausedPlays);
    passed('DIAL: pointer drag and ratchet audio; blur suspends audio without queued sounds');
   } else {
    assert.equal(await page.evaluate(() => window.__audio.contexts.length), 0);
    assert.ok(await dialog.getByText(/v1.0 モデル \/ 音は未実装/).isVisible());
    assert.equal(await dialog.getByRole('button').count(), 1);
    passed('KEY: current work-in-progress model, no invented options/audio');
   }
   await page.keyboard.press('Escape');
   await dialog.waitFor({ state: 'detached' });
   assert.equal(await page.getByRole('button', { name: '触ってみる' }).evaluate(el => el === document.activeElement), true);
   assert.equal(await page.evaluate(() => document.body.style.position), '');
   assert.ok(await page.evaluate(() => window.__audio.contexts.every(context => context.state === 'closed')));
   passed(slug + ': Escape restores focus/body scroll, audio closes');
   await page.getByRole('button', { name: '触ってみる' }).click();
   await page.getByRole('dialog').locator('canvas').waitFor();
   await page.getByRole('button', { name: '3D ビューを閉じる' }).click();
   await page.getByRole('dialog').waitFor({ state: 'detached' });
   assert.ok(await page.evaluate(() => window.__audio.contexts.every(context => context.state === 'closed')));
   passed(slug + ': repeated open/close releases resources');
  }

  await page.goto(base + '/products');
  await page.locator('a[href="/products/dial"]').click();
  await page.getByRole('button', { name: '触ってみる' }).click();
  await page.getByRole('dialog').locator('canvas').waitFor();
  await page.goBack();
  await page.getByRole('heading', { name: 'COLLECTION', exact: true }).waitFor();
  assert.equal(await page.getByRole('dialog').count(), 0);
  assert.equal(await page.evaluate(() => document.body.style.position), '');
  assert.ok(await page.evaluate(() => window.__audio.contexts.every(context => context.state === 'closed')));
  passed('Browser Back during modal removes canvas, releases audio and body lock');

  // Mobile viewport and touch gestures are emulated Chromium, not an iPhone hardware test.
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const mp = await mobile.newPage();
  mp.on('pageerror', error => report.errors.push(error.message));
  for (const route of ['products', 'products/dial', 'products/key']) {
   await mp.goto(base + '/' + route);
   await mp.locator('main img').first().waitFor();
   await mp.waitForTimeout(500);
   assert.ok(await mp.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
   await mp.screenshot({ path: path.join(output, route.replaceAll('/', '-') + '-mobile.png'), fullPage: true });
   if (route !== 'products') {
    await mp.evaluate(() => window.scrollTo({ top: 120, behavior: 'instant' }));
    const scroll = await mp.evaluate(() => window.scrollY);
    await mp.getByRole('button', { name: '触ってみる' }).tap();
    await mp.getByRole('dialog').locator('canvas').waitFor();
    await mp.waitForTimeout(1800);
    await mp.screenshot({ path: path.join(output, route.split('/')[1] + '-modal-mobile.png') });
    if (route.endsWith('/dial')) {
     const canvas = mp.getByRole('dialog').locator('canvas');
     const beforeTouch = hash(await canvas.screenshot());
     const box = await canvas.boundingBox();
     const cdp = await mobile.newCDPSession(mp);
     const x = box.x + box.width / 2; const y = box.y + box.height * .55;
     await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
     for (let step = 1; step <= 5; step++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + step * 10, y }] });
     await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
     await mp.waitForTimeout(400);
     assert.notEqual(hash(await canvas.screenshot()), beforeTouch);
     await cdp.detach();
     passed('Emulated mobile touch drag rotates DIAL');
    }
    await mp.getByRole('button', { name: '3D ビューを閉じる' }).tap();
    await mp.waitForTimeout(100);
    assert.equal(await mp.evaluate(() => window.scrollY), scroll);
   }
  }
  passed('Mobile 390×844: no horizontal overflow; both modals open/close and restore scroll');
  await mobile.close();

  const failure = await browser.newContext();
  const fp = await failure.newPage();
  await fp.addInitScript(() => { window.AudioContext = class { constructor() { throw new Error('Simulated unavailable audio'); } }; });
  await fp.goto(base + '/products/dial');
  await fp.getByRole('button', { name: '触ってみる' }).click();
  await fp.getByRole('dialog').locator('canvas').waitFor();
  await fp.waitForTimeout(1200);
  assert.equal(await fp.getByRole('dialog').getByRole('alert').count(), 0);
  await fp.getByRole('button', { name: '3D ビューを閉じる' }).click();
  passed('Audio creation failure still opens/closes the viewer');
  await fp.route('**/models/muda-key-v1.0.glb', route => route.abort());
  await fp.goto(base + '/products/key');
  await fp.getByRole('button', { name: '触ってみる' }).click();
  await fp.getByRole('alert').filter({ hasText: '3D を表示できませんでした' }).waitFor();
  await fp.getByRole('button', { name: '3D ビューを閉じる' }).click();
  passed('Model network failure shows a recoverable error with working close');
  const response = await fp.goto(base + '/products/unknown');
  assert.equal(response.status(), 404);
  passed('Unknown product returns 404');
  await failure.close();
  assert.deepEqual(report.errors, []);
  passed('No uncaught page errors on normal desktop/mobile flows');
  await context.close();
 } finally {
  fs.writeFileSync(path.join(output, 'browser-report.json'), JSON.stringify(report, null, 2));
  await browser.close();
 }
})().catch(error => { console.error(error); process.exitCode = 1; });
