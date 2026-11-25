/* eslint-disable @typescript-eslint/no-require-imports -- Node test runner */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');
const context = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/key-feel.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, context);
const { RED_KEY_FEEL: feel, redKeyDepth } = context.exports;
test('Red stroke matches the approved 10.5 mm visual travel', () => assert.equal(feel.travel, .0105));
test('Initial contact is shallow; drag is continuous and linear', () => {
 assert.equal(redKeyDepth(0, 400), feel.initialDepth);
 const a = redKeyDepth(10, 400), b = redKeyDepth(20, 400), c = redKeyDepth(30, 400);
 assert.ok(Math.abs((b - a) - (c - b)) < 1e-10);
});
test('Full press needs less than 65px on desktop and mobile', () => {
 for (const size of [240, 390, 600, 1600]) assert.equal(redKeyDepth(64, size), 1);
});
test('Reverse dragging and excessive input are clamped', () => {
 assert.equal(redKeyDepth(-1000, 390), 0);
 assert.equal(redKeyDepth(1000, 390), 1);
});

const { mapKeySwitchDepth } = context.exports;
test('Red mapping preserves the original response for every sampled drag', () => {
 for (let px = -15; px <= 85; px++) {
  const depth = redKeyDepth(px, 390);
  assert.equal(mapKeySwitchDepth('red', depth, true).depth, depth);
 }
});
test('Brown creates continuous resistance before catching up to red', () => {
 const brown = t => mapKeySwitchDepth('brown', t, false).depth;
 assert.ok(brown(.45) < .39);
 assert.ok(brown(.45) - brown(.35) < .1);
 assert.ok(brown(.75) - brown(.65) > .1);
 let prev = 0;
 for (let i = 1; i <= 1000; i++) {
  const d = brown(i / 1000);
  assert.ok(d > prev && d - prev < .002);
  prev = d;
 }
});
test('Blue snaps down at the trigger and snaps back at a separate reset point', () => {
 const map = (t, latched = false) => mapKeySwitchDepth('blue', t, latched);
 const before = map(.529), after = map(.53, before.latched);
 assert.equal(before.latched, false);
 assert.equal(after.latched, true);
 assert.ok(after.depth - before.depth > .18);
 assert.equal(map(.45, true).latched, true);
 assert.equal(map(.45, false).latched, false);
 assert.equal(map(.36, true).latched, false);
 assert.ok(map(.361, true).depth - map(.36, true).depth > .18);
});
test('Every profile stays within the existing visual stroke', () => {
 for (const axis of ['red', 'blue', 'brown']) {
  assert.equal(mapKeySwitchDepth(axis, -1, true).depth, 0);
  assert.equal(mapKeySwitchDepth(axis, 2, false).depth, 1);
  for (const latched of [false, true]) {
   for (let i = 0; i <= 100; i++) {
    const { depth } = mapKeySwitchDepth(axis, i / 100, latched);
    assert.ok(depth >= 0 && depth <= 1);
   }
  }
 }
});
