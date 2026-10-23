/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS standalone Node regression runner. */
// Usage: node tests/top-navigation.cjs <playwright-core directory> <Chrome executable> [base URL]
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { chromium } = require(path.resolve(process.argv[2]));
const base = process.argv[4] || 'http://127.0.0.1:3020';
const output = path.resolve('tmp/gallery-implementation');
const baseline = JSON.parse(fs.readFileSync(path.join(output, 'hero-baseline.json'), 'utf8'));
const report = { base, checks: [], errors: [], network: {} };
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function passed(name) { report.checks.push(name); console.log('PASS', name); }

(async () => {
 const browser = await chromium.launch({ headless: true, executablePath: process.argv[3], args: ['--enable-unsafe-swiftshader'] });
 try {
  for (const [name, viewport] of [['desktop', { width: 1440, height: 1000 }], ['mobile', { width: 390, height: 844 }]]) {
   const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
   page.on('pageerror', error => report.errors.push(error.message));
   const models = [];
   page.on('request', request => { if (/\.glb(\?|$)/i.test(request.url())) models.push(request.url()); });
   await page.goto(base + '/');
   await page.locator('.intro-content[data-loaded="true"]').waitFor({ timeout: 45000 });
   await page.waitForTimeout(1700);
   const hero = page.locator('.intro-content > section');
   const collection = page.locator('#collection');
   const structure = await hero.evaluate(el => Array.from(el.querySelectorAll('*')).filter(node => node.tagName !== 'CANVAS').map(node => {
    const s = getComputedStyle(node), r = node.getBoundingClientRect();
    return { tag: node.tagName, className: node.className, text: node.children.length ? null : node.textContent, rect: [r.x, r.y, r.width, r.height], style: [s.fontSize, s.color, s.backgroundColor, s.padding, s.margin, s.display, s.gap, s.gridTemplateColumns] };
   }));
   assert.deepEqual(structure, baseline[name].structure);
   await hero.screenshot({ path: path.join(output, 'hero-after-' + name + '.png') });
   const masked = await hero.screenshot({ path: path.join(output, 'hero-after-masked-' + name + '.png'), mask: [hero.locator('canvas')] });
   assert.equal(hash(masked), hash(fs.readFileSync(path.join(output, 'hero-before-masked-' + name + '.png'))));
   passed(name + ': HERO DOM/layout/styles and pixels outside the animated canvas unchanged');
   assert.equal(await page.locator('h1').count(), 1);
   assert.equal(await collection.getByRole('heading', { level: 2, name: 'COLLECTION' }).count(), 1);
   assert.equal(await collection.locator('li').count(), 2);
   assert.equal(await collection.locator('canvas').count(), 0);
   for (const img of await collection.locator('img').all()) assert.ok(await img.evaluate(el => el.complete && el.naturalWidth > 0));
   for (const card of await collection.locator('li').all()) assert.match((await card.innerText()).trim(), /^(DIAL|KEY)$/);
   const heroBox = await hero.boundingBox(), collectionBox = await collection.boundingBox();
   assert.ok(Math.abs(collectionBox.y - heroBox.y - heroBox.height) < 1);
   assert.ok(!models.some(url => url.includes('muda-key')));
   assert.equal(models.filter(url => url.includes('muda-dial-optimized.glb')).length, 1, 'Only the protected HERO loads its GLB');
   await page.screenshot({ path: path.join(output, 'top-with-collection-' + name + '.png'), fullPage: true });
   passed(name + ': image/name collection follows HERO; one h1; no collection canvas or extra model fetch');
   await page.getByRole('link', { name: /EXPLORE COLLECTION/ }).click();
   await page.waitForFunction(() => Math.abs(document.getElementById('collection').getBoundingClientRect().top) < 2);
   assert.ok(page.url().endsWith('/#collection'));
   await collection.screenshot({ path: path.join(output, 'top-collection-' + name + '.png') });
   report.network[name + 'BeforeDetail'] = [...models];
   passed(name + ': existing HERO collection anchor reaches the new section');
   for (const slug of ['dial', 'key']) {
    await collection.locator('a[href="/products/' + slug + '"]').click();
    await page.waitForURL(base + '/products/' + slug);
    await page.getByRole('button', { name: '触ってみる' }).waitFor();
    assert.equal(await page.locator('canvas').count(), 0);
    await page.getByRole('button', { name: '触ってみる' }).click();
    await page.getByRole('dialog').locator('canvas').waitFor();
    await page.waitForTimeout(1200);
    assert.equal(await page.getByRole('dialog').getByRole('alert').count(), 0);
    await page.keyboard.press('Escape');
    await page.getByRole('dialog').waitFor({ state: 'detached' });
    assert.equal(await page.getByRole('button', { name: '触ってみる' }).evaluate(el => el === document.activeElement), true);
    await page.goBack();
    await page.locator('#collection').waitFor();
    await page.locator('.intro-content[data-loaded="true"]').waitFor({ timeout: 45000 });
    await page.waitForTimeout(1700);
    passed(name + ': TOP → ' + slug + ' detail → modal → close → browser Back works');
   }
   report.network[name + 'AfterNavigation'] = [...models];
   await page.close();
  }
  assert.deepEqual(report.errors, []);
  passed('No uncaught browser errors in TOP navigation flows');
 } finally {
  fs.writeFileSync(path.join(output, 'top-navigation-report.json'), JSON.stringify(report, null, 2));
  await browser.close();
 }
})().catch(error => { console.error(error); process.exitCode = 1; });
