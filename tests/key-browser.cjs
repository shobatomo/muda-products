/* eslint-disable @typescript-eslint/no-require-imports -- Standalone browser regression runner. */
// node tests/key-browser.cjs <playwright-core directory> <Chrome executable> [base URL] [output directory]
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(path.resolve(process.argv[2]));
const sharp = require('sharp');
const base = process.argv[4] || 'http://127.0.0.1:3031';
const output = path.resolve(process.argv[5] || 'tmp/key-v1-integration');
const report = { base, checks: [], errors: [], requests: [] };
fs.mkdirSync(output, { recursive: true });
function pass(message) { report.checks.push(message); console.log('PASS', message); }
async function pixels(image) { return sharp(image).removeAlpha().raw().toBuffer({ resolveWithObject: true }); }
async function difference(a, b) {
 const pa = await pixels(a), pb = await pixels(b);
 assert.equal(pa.data.length, pb.data.length);
 let changed = 0;
 for (let i = 0; i < pa.data.length; i += 3) {
  if (Math.max(...[0, 1, 2].map(k => Math.abs(pa.data[i + k] - pb.data[i + k]))) > 8) changed++;
 }
 return changed / (pa.data.length / 3);
}
async function capPoint(canvas) {
 const { data, info } = await pixels(await canvas.screenshot());
 const silhouette = [];
 for (let y = 4; y < info.height - 4; y++) for (let x = 4; x < info.width - 4; x++) {
  const i = (y * info.width + x) * 3;
  if (Math.min(data[i], data[i + 1], data[i + 2]) < 235) silhouette.push({x, y});
 }
 assert.ok(silhouette.length > 1000, 'The textured v1.0 model is rendered');
 const minY = silhouette.reduce((v, p) => Math.min(v, p.y), info.height);
 const maxY = silhouette.reduce((v, p) => Math.max(v, p.y), 0);
 if (!(minY > 10 && maxY < info.height - 10)) await canvas.screenshot({path: path.join(output, 'framing-failure.png')});
 assert.ok(minY > 10 && maxY < info.height - 10, 'The complete model fits inside the canvas: ' + [minY, maxY, info.height].join(', '));
 // The cap's dark logo is above the housing seam, independent of screen size.
 const points = silhouette.filter(({x, y}) => y < minY + (maxY - minY) * 0.35 && data[(y * info.width + x) * 3] < 150);
 assert.ok(points.length > 20, 'The original logo texture is visible on the cap');
 const mean = points.reduce((p, q) => ({x: p.x + q.x / points.length, y: p.y + q.y / points.length}), {x: 0, y: 0});
 const point = points.reduce((a, b) => Math.hypot(a.x - mean.x, a.y - mean.y) < Math.hypot(b.x - mean.x, b.y - mean.y) ? a : b);
 const box = await canvas.boundingBox();
 return {x: box.x + point.x * box.width / info.width, y: box.y + point.y * box.height / info.height};
}
async function ready(page) {
 const canvas = page.locator('canvas');
 await canvas.waitFor();
 await page.getByText('KEY を読み込み中…', { exact: true }).waitFor({ state: 'detached' });
 await page.waitForTimeout(1200);
 await capPoint(canvas);
 return canvas;
}

(async () => {
 const browser = await chromium.launch({ headless: true, executablePath: process.argv[3], args: ['--enable-unsafe-swiftshader'] });
 try {
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  const page = await desktop.newPage();
  page.on('pageerror', e => report.errors.push(e.message));
  page.on('request', r => { if (/\.(glb|wav)(\?|$)/i.test(r.url())) report.requests.push(r.url()); });
  await page.goto(base + '/products/key');
  await page.getByRole('button', { name: '触ってみる' }).waitFor();
  await page.waitForTimeout(500);
  assert.equal(await page.locator('canvas').count(), 0);
  assert.equal(report.requests.length, 0);
  assert.ok(await page.locator('main img').evaluate(el => el.complete && el.naturalWidth > 0));
  await page.screenshot({ path: path.join(output, 'key-detail-desktop.png'), fullPage: true });
  pass('KEY detail loads the new static image without loading a model or audio');
  await page.getByRole('button', { name: '触ってみる' }).click();
  const canvas = await ready(page);
  assert.deepEqual(report.requests.map(url => new URL(url).pathname), ['/models/muda-key-v1.0.glb']);
  const response = await page.request.get(base + '/models/muda-key-v1.0.glb');
  const bytes = await response.body();
  const gltf = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
  assert.equal(bytes.length, 1320132);
  assert.deepEqual(gltf.nodes.map(n => n.name).sort(), ['KEY-push-handle', 'housing_bottom', 'housing_bottom_base', 'housing_top', 'key_cap', 'stem_head']);
  const handle = gltf.nodes.find(n => n.name === 'KEY-push-handle');
  assert.deepEqual(handle.children.map(index => gltf.nodes[index].name).sort(), ['key_cap', 'stem_head']);
  assert.equal(gltf.meshes.length, 5);
  assert.equal(gltf.materials.length, 5);
  assert.equal(gltf.images.length, 1);
  assert.equal(gltf.textures.length, 2);
  assert.ok(gltf.images.every(image => image.bufferView !== undefined && !image.uri));
  assert.equal(require('node:crypto').createHash('sha256').update(bytes).digest('hex'), '38aee518f0ff5866816d1bf802b66eb17a38eb597c2a725f8bb25d3d0f68e5f8');
  pass('Exact supplied v1.0 GLB: five meshes, cap/stem parent, five materials and two textures sharing one embedded image');
  const rest = await canvas.screenshot();
  await page.screenshot({ path: path.join(output, 'key-modal-desktop-rest.png') });
  const point = await capPoint(canvas);
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.mouse.move(point.x, point.y + 160, { steps: 12 });
  await page.waitForTimeout(700);
  const pressed = await canvas.screenshot();
  assert.ok(await difference(rest, pressed) > 0.002, 'Dragging the cap and stem changes the rendered model');
  await page.screenshot({ path: path.join(output, 'key-modal-desktop-pressed.png') });
  await page.mouse.up();
  await page.waitForTimeout(1000);
  assert.ok(await difference(rest, await canvas.screenshot()) < 0.0001, 'Release restores the key and leaves camera unchanged');
  pass('Desktop drag depresses the cap and stem, release returns exactly, camera stays fixed');

  for (let repeat = 0; repeat < 3; repeat++) {
   await page.mouse.move(point.x, point.y);
   await page.mouse.down();
   await page.waitForTimeout(220);
   assert.ok(await difference(rest, await canvas.screenshot()) > 0.0005, 'A click visibly depresses the cap');
   await page.mouse.up();
   await page.waitForTimeout(700);
  }
  assert.ok(await difference(rest, await canvas.screenshot()) < 0.0001);
  pass('Repeated clicks depress and return the cap without accumulating movement');
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.mouse.move(2, 2, {steps: 5});
  await page.mouse.up();
  await page.waitForTimeout(900);
  assert.ok(await difference(rest, await canvas.screenshot()) < 0.0001);
  pass('Release outside the canvas restores the key and camera controls');
  const viewer = page.getByRole('group', { name: 'KEY 赤軸モデルの3D操作' });
  await viewer.focus();
  for (const key of ['Space', 'Enter']) {
   await page.keyboard.down(key);
   await page.waitForTimeout(600);
   assert.ok(await difference(rest, await canvas.screenshot()) > 0.002);
   await page.keyboard.up(key);
   await page.waitForTimeout(900);
   assert.ok(await difference(rest, await canvas.screenshot()) < 0.0001);
  }
  pass('Space and Enter press/release the same cap and stem');
  await page.keyboard.down('Space');
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: '3D ビューを閉じる' }).focus();
  await page.keyboard.up('Space');
  await page.waitForTimeout(900);
  assert.ok(await difference(rest, await canvas.screenshot()) < 0.0001);
  pass('Keyboard focus loss releases the key');

  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.mouse.move(point.x, point.y + 140, { steps: 6 });
  await page.waitForTimeout(500);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await page.mouse.up();
  await page.waitForTimeout(900);
  assert.ok(await difference(rest, await canvas.screenshot()) < 0.0001);
  pass('Window blur cancels an active pointer press and restores the key');

  await viewer.focus();
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(700);
  assert.ok(await difference(rest, await canvas.screenshot()) > 0.01);
  await page.keyboard.press('Escape');
  await page.getByRole('dialog').waitFor({ state: 'detached' });
  assert.ok(await page.getByRole('button', { name: '触ってみる' }).evaluate(el => el === document.activeElement));
  await page.getByRole('button', { name: '触ってみる' }).click();
  await ready(page);
  assert.ok(await difference(rest, await page.locator('canvas').screenshot()) < 0.0001);
  pass('Arrow keys orbit; modal close/reopen restores initial camera and resting key');
  await page.getByRole('button', { name: '3D ビューを閉じる' }).click();
  await page.goto(base + '/key');
  await ready(page);
  await page.screenshot({ path: path.join(output, 'key-direct-desktop.png'), fullPage: true });
  pass('Standalone /key route uses the same current interactive model');

  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const mp = await mobile.newPage();
  mp.on('pageerror', e => report.errors.push(e.message));
  await mp.goto(base + '/products/key');
  await mp.getByRole('button', { name: '触ってみる' }).tap();
  const mc = await ready(mp);
  assert.ok(await mp.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  const mobileRest = await mc.screenshot();
  await mp.screenshot({ path: path.join(output, 'key-modal-mobile-rest.png') });
  const touch = await capPoint(mc);
  const cdp = await mobile.newCDPSession(mp);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [touch] });
  for (let step = 1; step <= 8; step++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: touch.x, y: touch.y + step * 16 }] });
  await mp.waitForTimeout(700);
  assert.ok(await difference(mobileRest, await mc.screenshot()) > 0.002);
  await mp.screenshot({ path: path.join(output, 'key-modal-mobile-pressed.png') });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await mp.waitForTimeout(1000);
  assert.ok(await difference(mobileRest, await mc.screenshot()) < 0.0001);
  pass('Emulated mobile touch drag presses/releases, without camera drift or horizontal overflow');
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [touch] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: touch.x, y: touch.y + 100 }] });
  await mp.waitForTimeout(400);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
  await mp.waitForTimeout(1000);
  assert.ok(await difference(mobileRest, await mc.screenshot()) < 0.0001);
  pass('Mobile touch cancellation releases the cap and stem');
  const box = await mc.boundingBox();
  const touchY = box.y + box.height * 0.15;
  const midX = box.x + box.width * 0.5;
  await cdp.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{x: midX - 30, y: touchY, id: 0}, {x: midX + 30, y: touchY, id: 1}]});
  for (let step = 1; step <= 5; step++) await cdp.send('Input.dispatchTouchEvent', {type: 'touchMove', touchPoints: [{x: midX - 30 - step * 8, y: touchY, id: 0}, {x: midX + 30 + step * 8, y: touchY, id: 1}]});
  await cdp.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
  await mp.waitForTimeout(700);
  assert.ok(await difference(mobileRest, await mc.screenshot()) > 0.01);
  pass('Two-finger pinch on the surrounding background zooms the mobile model');
  await cdp.detach();
  await mp.getByRole('button', { name: '3D ビューを閉じる' }).tap();
  assert.equal(await mp.locator('canvas').count(), 0);
  assert.equal(await mp.evaluate(() => document.body.style.position), '');
  pass('Mobile modal closes and restores page scrolling');
  assert.deepEqual(report.errors, []);
  pass('No uncaught browser errors in desktop or emulated mobile flows');
  await mobile.close();
  await desktop.close();
 } finally {
  fs.writeFileSync(path.join(output, 'key-browser-report.json'), JSON.stringify(report, null, 2));
  await browser.close();
 }
})().catch(error => { console.error(error); process.exitCode = 1; });
