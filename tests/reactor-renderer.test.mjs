import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url), API = require('../reactor/engine.js');
const source = readFileSync(new URL('../reactor/renderer.js', import.meta.url), 'utf8');
function harness(reduced = false) {
    const calls = [], numeric = new Set(['arc', 'fillRect', 'clearRect', 'moveTo', 'lineTo', 'translate', 'rotate', 'createLinearGradient', 'createRadialGradient']);
    function canvas() {
        const ctx = new Proxy({}, { get: (target, prop) => prop in target ? target[prop] : (...args) => {
            if (numeric.has(prop)) for (const arg of args) if (typeof arg === 'number') assert.ok(Number.isFinite(arg), `${prop}(${args})`);
            calls.push([prop, ...args]);
            if (prop === 'createLinearGradient' || prop === 'createRadialGradient') return { addColorStop() {} };
        }, set: (t, k, v) => { t[k] = v; return true; } });
        return { width: 600, height: 920, getContext: () => ctx };
    }
    const ctx = { ReactorPinball: API, document: { createElement: canvas }, matchMedia: () => ({ matches: reduced }) };
    vm.createContext(ctx); vm.runInContext(source, ctx);
    return { renderer: new ctx.ReactorPinballRenderer.Renderer(canvas()), calls };
}
test('renderer draws ready, running, pause, overload, multiball and light theme with finite coordinates', () => {
    const { renderer, calls } = harness(), g = new API.Game(); renderer.draw(g, 0);
    g.start(); g.launch(.8); for (let i = 0; i < 120; i++) { g.update(API.STEP, { left: i % 20 < 5 }); renderer.consume(g.takeEvents()); renderer.draw(g, API.STEP); }
    g._charge(100); renderer.consume(g.takeEvents()); renderer.draw(g, 1 / 60); g.pause(); renderer.draw(g, 1 / 60, 'light');
    assert.ok(calls.some(c => c[0] === 'fillText' && String(c[1]).includes('OVERLOAD')));
    assert.ok(calls.filter(c => c[0] === 'arc').length > 100); assert.ok(renderer.cache);
});
test('static playfield is cached and rebuilt only for a new theme', () => {
    const { renderer } = harness(), g = new API.Game(); renderer.draw(g, 0, 'dark'); const cache = renderer.cache;
    renderer.draw(g, 0, 'dark'); assert.equal(renderer.cache, cache);
    renderer.draw(g, 0, 'light'); assert.notEqual(renderer.cache, cache);
});
test('rendering does not change physics, scores, mission progress or ball identities', () => {
    const { renderer } = harness(), g = new API.Game().start(); g.launch(.8); g.update(.1);
    const before = JSON.stringify(g); for (let i = 0; i < 10; i++) renderer.draw(g, 1 / 60);
    assert.equal(JSON.stringify(g), before);
});
test('effects are bounded, expire while playing and freeze while paused', () => {
    const { renderer } = harness(), g = new API.Game().start();
    const events = Array.from({ length: 100 }, (_, i) => ({ type: 'overload', x: 290, y: 400, time: i }));
    renderer.consume(events); assert.ok(renderer.particles.length <= 140); assert.ok(renderer.pulses.length <= 20);
    g.pause(); const life = renderer.particles[0].life; renderer.draw(g, 1 / 30); assert.equal(renderer.particles[0].life, life);
    g.resume(); for (let i = 0; i < 50; i++) renderer.draw(g, 1 / 30);
    assert.equal(renderer.particles.length, 0); assert.equal(renderer.pulses.length, 0);
});
test('reduced motion suppresses particle showers and reset removes obsolete ball trails', () => {
    const { renderer } = harness(true), g = new API.Game().start();
    renderer.consume([{ type: 'overload', x: 290, y: 400 }]); assert.equal(renderer.particles.length, 0);
    renderer.draw(g, 1 / 60); assert.equal(renderer.trails.size, 1);
    g.balls = []; renderer.draw(g, 1 / 60); assert.equal(renderer.trails.size, 0);
    renderer.reset(); assert.equal(renderer.pulses.length, 0); assert.equal(renderer.labels.length, 0);
});
