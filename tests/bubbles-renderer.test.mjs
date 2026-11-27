import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import '../bubbles/levels.js';
import '../bubbles/engine.js';
import '../arcade-fx.js';

function fakeCanvas(calls) {
    const ctx = new Proxy({}, { get: (t, k) => k in t ? t[k] : (...args) => {
        for (const a of args) if (typeof a === 'number') assert.ok(Number.isFinite(a), String(k));
        calls.push(k); if (String(k).startsWith('create')) return { addColorStop() {} };
    }, set: (t, k, v) => { t[k] = v; return true; } });
    return { width: 404, height: 565, getContext: () => ctx };
}
function load(dpr = 2) {
    globalThis.devicePixelRatio = dpr;
    const calls = [], scope = vm.createContext({ Lightbubble: globalThis.Lightbubble, LightbubbleLevels: globalThis.LightbubbleLevels,
        CashArcadeFX: globalThis.CashArcadeFX, devicePixelRatio: dpr, document: { createElement: () => fakeCanvas([]) } });
    vm.runInContext(readFileSync(new URL('../bubbles/renderer.js', import.meta.url), 'utf8'), scope);
    const canvas = fakeCanvas(calls);
    return { calls, canvas, renderer: new scope.LightbubbleRenderer.Renderer(canvas) };
}
const pop = { type: 'pop', combo: 2, bubbles: Array.from({ length: 8 }, (_, i) => ({ r: 0, c: i, type: 'A', hp: 1, x: 40 + i * 36, y: 70 })) };

test('chains pop outward one by one, then burst, shake and cheer before settling', () => {
    const { renderer, calls, canvas } = load(), game = new Lightbubble.Game(1);
    renderer.consume([{ type: 'launch' }, pop]);
    assert.equal(renderer.pops.length, 8); assert.equal(renderer.parts.length, 0);
    assert.ok(renderer.cheer > 0); assert.ok(renderer.busy); assert.equal(renderer.fx.stats().popups, 1);
    renderer.update(.2); const early = renderer.pops.length;
    assert.ok(early > 0 && early < 8, 'pops are staggered');
    for (let i = 0; i < 8; i++) { renderer.update(1 / 30); renderer.draw(game, { angle: .4 }); }
    assert.equal(renderer.pops.length, 0); assert.ok(renderer.parts.length > 0);
    assert.equal(canvas.width, 808); assert.equal(canvas.height, 1130);
    assert.equal(calls.filter(k => k === 'save').length, calls.filter(k => k === 'restore').length);
    for (let i = 0; i < 120; i++) renderer.update(1 / 30);
    assert.equal(renderer.busy, false);
});

test('reduced motion pops instantly and freezes the mascot; descend and loss still read clearly', () => {
    const { renderer, calls } = load(1), game = new Lightbubble.Game(1);
    renderer.reduced = true; renderer.consume([pop]);
    assert.equal(renderer.pops.length, 0); assert.equal(renderer.rings.length, 8);
    for (let i = 0; i < 60; i++) renderer.update(1 / 20); renderer.draw(game); const start = calls.length; renderer.draw(game); const frame = calls.slice(start);
    renderer.update(3); renderer.draw(game);
    assert.deepEqual(calls.slice(start + frame.length), frame, 'a static frame draws the same operations');
    const live = load().renderer; live.consume([{ type: 'descend' }, { type: 'lost' }]);
    assert.ok(live.offset < 0); assert.ok(live.fx.stats().trauma > 0);
    live.reset(); assert.equal(live.busy, false);
});
