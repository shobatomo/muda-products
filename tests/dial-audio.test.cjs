/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS Node test runner and VM fixture. */
// This suite exercises the audio lifecycle independently of browser autoplay policy.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const source = ts.transpileModule(fs.readFileSync('src/lib/dial-audio.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;

function setup({ resumeFails = false, fetchFails = false, contextFails = false } = {}) {
 const nodes = [];
 const contexts = [];
 const transitions = [];
 class Node {
  connect() {} disconnect() { this.disconnected = true; }
  start() { this.started = true; } stop() { this.stopped = true; }
  addEventListener() {}
 }
 class BufferSource extends Node {}
 class Oscillator extends Node {
  frequency = { setValueAtTime() {}, exponentialRampToValueAtTime() {} };
 }
 class Context {
  state = 'suspended'; currentTime = 1; destination = {};
  constructor() { if (contextFails) throw new Error('blocked'); contexts.push(this); }
  resume() { transitions.push('resume'); if (resumeFails) return Promise.reject(new Error('blocked')); this.state = 'running'; return Promise.resolve(); }
  suspend() { this.state = 'suspended'; return Promise.resolve(); }
  close() { this.state = 'closed'; return Promise.resolve(); }
  decodeAudioData() { return Promise.resolve({ decoded: true }); }
  createGain() { return { gain: { value: 1, setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, disconnect() {} }; }
  createBufferSource() { const node = new BufferSource(); nodes.push(node); return node; }
  createOscillator() { const node = new Oscillator(); nodes.push(node); return node; }
 }
 const navigator = { audioSession: { type: 'auto' } };
 const document = { hidden: false };
 const sandbox = { exports: {}, navigator, document, AudioContext: Context, AudioBufferSourceNode: BufferSource, OscillatorNode: Oscillator, AbortController, fetch: () => { transitions.push('fetch'); return fetchFails ? Promise.reject(new Error('offline')) : Promise.resolve({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(1)) }); } };
 vm.runInNewContext(source, sandbox);
 return { audio: sandbox.exports.prepareDialAudio(), nodes, contexts, transitions, navigator, document };
}
const flush = () => new Promise(resolve => setImmediate(resolve));

test('open gesture resumes before fetch and opts only into ambient audio', () => {
 const s = setup();
 assert.deepEqual(s.transitions, ['resume', 'fetch']);
 assert.equal(s.navigator.audioSession.type, 'ambient');
 assert.equal(s.nodes.length, 0, 'Opening the modal itself makes no sound');
 s.audio.dispose();
 assert.equal(s.navigator.audioSession.type, 'auto', 'Modal session setting does not leak into the HERO');
});
test('playing is bounded; pause and close stop nodes with no queued playback', async () => {
 const s = setup(); await flush();
 s.audio.play(20); assert.equal(s.nodes.length, 4);
 s.audio.pause(); assert.ok(s.nodes.every(node => node.stopped));
 s.audio.play(3); assert.equal(s.nodes.length, 4);
 s.audio.resume(); assert.equal(s.nodes.length, 4);
 s.audio.play(); assert.equal(s.nodes.length, 5);
 s.audio.dispose(); assert.ok(s.nodes.every(node => node.stopped));
 assert.equal(s.contexts[0].state, 'closed');
 s.audio.resume(); s.audio.play(); assert.equal(s.nodes.length, 5);
});
test('hidden documents never play or resume', () => {
 const s = setup(); s.document.hidden = true;
 s.audio.play(); s.audio.resume(); assert.equal(s.nodes.length, 0);
 assert.equal(s.transitions.filter(value => value === 'resume').length, 1);
 s.audio.dispose();
});
test('audio creation, resume and fetch failures are nonfatal', async () => {
 for (const option of [{ contextFails: true }, { resumeFails: true }, { fetchFails: true }]) {
  const s = setup(option); await flush();
  assert.doesNotThrow(() => { s.audio.resume(); s.audio.play(); s.audio.dispose(); });
  await flush();
 }
});
test('closing during decoding cannot revive sound', async () => {
 const s = setup(); s.audio.dispose(); await flush();
 s.audio.play(); assert.equal(s.nodes.length, 0); assert.equal(s.contexts[0].state, 'closed');
});
