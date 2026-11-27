import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import '../arcade-fx.js';
const { Game } = createRequire(import.meta.url)('../pulse/engine.js');

function load() {
    const calls = [], ctx = new Proxy({}, { get: (t, k) => k in t ? t[k] : (...args) => {
        for (const a of args) if (typeof a === 'number') assert.ok(Number.isFinite(a), String(k));
        calls.push(k); if (String(k).startsWith('create')) return { addColorStop() {} };
    }, set: (t, k, v) => { t[k] = v; return true; } });
    const scope = vm.createContext({ CashArcadeFX: globalThis.CashArcadeFX, devicePixelRatio: 2 });
    vm.runInContext(readFileSync(new URL('../pulse/renderer.js', import.meta.url), 'utf8'), scope);
    const canvas = { clientWidth: 400, width: 0, height: 0, getContext: () => ctx };
    return { calls, canvas, renderer: new scope.PulseRenderer.Renderer(canvas) };
}

test('hits light the lane and burst, gates flash, combo milestones pop, and misses tint the lane without freezing time', () => {
    const { renderer, calls } = load(), game = new Game(0, 'normal');
    game.start(); game.combo = 25;
    renderer.event({ type: 'judgement', result: 'perfect', lane: 1 }, game);
    assert.equal(renderer.glowLane[1], 1); assert.ok(renderer.fx.stats().particles > 0); assert.equal(renderer.fx.stats().popups, 1);
    renderer.event({ type: 'gate' }, game); renderer.event({ type: 'judgement', result: 'miss', lane: 0 }, game);
    assert.equal(renderer.miss[0], 1); assert.equal(renderer.fx.timeScale(), 1, 'rhythm timing is never frozen');
    for (const time of [-1, .5, 3.25]) renderer.render(game, { time });
    renderer.render(game, { time: 2, reducedMotion: true });
    assert.equal(calls.filter(k => k === 'save').length, calls.filter(k => k === 'restore').length);
    assert.ok(renderer.busy);
    renderer.event({ type: 'finish' }, game); assert.equal(renderer.fx.stats().banner, 'TRACK COMPLETE');
});
