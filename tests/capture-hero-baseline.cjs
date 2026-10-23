/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS standalone browser baseline capture. */
// Usage: node tests/capture-hero-baseline.cjs <playwright-core directory> <Chrome executable> <baseline URL>
const { chromium } = require(require('node:path').resolve(process.argv[2]));
const fs = require('node:fs');
const path = require('node:path');
const output = path.resolve('tmp/gallery-implementation');
fs.mkdirSync(output, { recursive: true });
(async () => {
 const browser = await chromium.launch({ headless: true, executablePath: process.argv[3], args: ['--enable-unsafe-swiftshader'] });
 const snapshots = {};
 try {
  for (const [name, viewport] of [['desktop', { width: 1440, height: 1000 }], ['mobile', { width: 390, height: 844 }]]) {
   const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
   const errors = []; page.on('pageerror', error => errors.push(error.message));
   await page.goto(process.argv[4]);
   await page.locator('.intro-content[data-loaded="true"]').waitFor({ timeout: 60000 });
   await page.waitForTimeout(1700);
   const hero = page.locator('.intro-content > section');
   const structure = await hero.evaluate(el => Array.from(el.querySelectorAll('*')).filter(node => node.tagName !== 'CANVAS').map(node => {
    const s = getComputedStyle(node), r = node.getBoundingClientRect();
    return { tag: node.tagName, className: node.className, text: node.children.length ? null : node.textContent, rect: [r.x, r.y, r.width, r.height], style: [s.fontSize, s.color, s.backgroundColor, s.padding, s.margin, s.display, s.gap, s.gridTemplateColumns] };
   }));
   snapshots[name] = { structure, errors };
   await hero.screenshot({ path: path.join(output, 'hero-before-' + name + '.png') });
   await hero.screenshot({ path: path.join(output, 'hero-before-masked-' + name + '.png'), mask: [hero.locator('canvas')] });
   console.log(name, JSON.stringify({ errors, elements: structure.length }));
   await page.close();
  }
  fs.writeFileSync(path.join(output, 'hero-baseline.json'), JSON.stringify(snapshots, null, 2));
 } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
