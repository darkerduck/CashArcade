import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url), { Game } = require('../gravity/engine.js'), { Renderer } = require('../gravity/renderer.js');
function canvas(width, height) {
    let calls = 0; const gradient = { addColorStop() {} };
    const ctx = new Proxy({}, { get(target, key) {
        if (key === 'createLinearGradient') return () => gradient;
        if (!(key in target)) return (...args) => { calls++; for (const a of args) if (typeof a === 'number') assert.ok(Number.isFinite(a), `${String(key)} finite`); };
        return target[key];
    }, set(target, key, value) { target[key] = value; return true; } });
    return { width: 0, height: 0, getContext: () => ctx, getBoundingClientRect: () => ({ width, height }), get calls() { return calls; } };
}
test('renderer draws every route/theme at desktop and mobile sizes without touching game rules', () => {
    for (let i = 0; i < 10; i++) for (const theme of ['dark', 'light']) for (const mobile of [false, true]) {
        const game = new Game(i); game.start(); game.flip(); game.update(.2); const before = JSON.stringify(game);
        const target = canvas(mobile ? 360 : 1000, mobile ? 300 : 600), renderer = new Renderer(target);
        renderer.render(game, { theme, reducedMotion: mobile }); assert.ok(target.calls > 200); assert.equal(JSON.stringify(game), before);
        assert.equal(renderer.width, mobile ? 720 : 1000); assert.equal(target.height, 600);
    }
});
test('effects expire, frame dimensions stay bounded, and all terminal states render', () => {
    const game = new Game(9), target = canvas(390, 300), renderer = new Renderer(target);
    renderer.event({ type: 'shard', x: 300, y: 100 }, 0); game.time = 1; renderer.render(game); assert.equal(renderer.effects.length, 0);
    for (const state of ['ready', 'running', 'paused', 'lost', 'delivered']) { game.state = state; game.player.x = 4800; renderer.render(game, { reducedMotion: true }); }
    assert.ok(renderer.width >= 600 && renderer.width <= 1100);
});
