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
