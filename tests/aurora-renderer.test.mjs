import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import '../aurora/levels.js';
import '../aurora/engine.js';
import '../arcade-fx.js';

function fakeCanvas(calls) {
    const ctx = new Proxy({}, { get: (t, k) => k in t ? t[k] : (...args) => {
        for (const a of args) if (typeof a === 'number') assert.ok(Number.isFinite(a), String(k));
        calls.push(k); if (String(k).startsWith('create')) return { addColorStop() {} };
    }, set: (t, k, v) => { t[k] = v; return true; } });
    return { width: 720, height: 450, getContext: () => ctx };
}
function load() {
    globalThis.devicePixelRatio = 2;
    const calls = [], scope = vm.createContext({ ...globalThis, AuroraRoutes: globalThis.AuroraRoutes, CashArcadeFX: globalThis.CashArcadeFX,
        document: { createElement: () => fakeCanvas([]) } });
    vm.runInContext(readFileSync(new URL('../aurora/renderer.js', import.meta.url), 'utf8'), scope);
    const canvas = fakeCanvas(calls);
    return { calls, canvas, renderer: new scope.AuroraRenderer.Renderer(canvas) };
}

test('crashes freeze and shake, passes and boosts pop feedback, and frames stay finite and balanced at HiDPI', () => {
    const { renderer, calls, canvas } = load(), game = new globalThis.AuroraSprint.Game(1);
    game.speed = 66; game.boosting = true;
    renderer.event({ type: 'hit' }, game); assert.equal(renderer.timeScale(), 0); assert.ok(renderer.busy);
    renderer.event({ type: 'pass', close: true }, game); renderer.event({ type: 'cell' }, game); renderer.event({ type: 'boost' }, game);
    assert.ok(renderer.fx.stats().popups >= 3); assert.equal(renderer.kick, 1);
    for (const theme of ['dark', 'light']) renderer.draw(game, { theme });
    assert.equal(canvas.width, 1440); assert.equal(canvas.height, 900);
    assert.ok(calls.includes('scale'), 'nitro pushes the camera');
    assert.equal(calls.filter(k => k === 'save').length, calls.filter(k => k === 'restore').length);
    for (let i = 0; i < 80; i++) renderer.fx.update(1 / 20);
    renderer.kick = 0; assert.equal(renderer.busy, false); assert.equal(renderer.timeScale(), 1);
});
