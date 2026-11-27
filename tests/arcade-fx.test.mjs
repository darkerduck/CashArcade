import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../arcade-fx.js', import.meta.url), 'utf8');
function load(globals = {}) { const scope = vm.createContext({ ...globals }); vm.runInContext(source, scope); return scope.CashArcadeFX; }
function seeded(seed = 7) { return () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }; }
function recorder() {
    const calls = [];
    return { calls, ctx: new Proxy({}, { get: (target, key) => key in target ? target[key] : (...args) => { for (const a of args) if (typeof a === 'number') assert.ok(Number.isFinite(a), String(key)); calls.push(key); }, set: (t, k, v) => { t[k] = v; return true; } }) };
}

test('shake decays by time, not frames, and never exceeds its cap', () => {
    const FX = load();
    const a = FX.createFx({ maxShake: 10 }), b = FX.createFx({ maxShake: 10 });
    a.shake(5); b.shake(5);
    assert.equal(a.stats().trauma, 1, 'trauma is clamped to 1');
    for (let i = 0; i < 30; i++) a.update(1 / 60);
    for (let i = 0; i < 15; i++) b.update(1 / 30);
    assert.ok(Math.abs(a.stats().trauma - b.stats().trauma) < 1e-9, '60 fps and 30 fps decay equally');
    for (let i = 0; i < 200; i++) { a.update(.004); const o = a.offset(); assert.ok(Math.hypot(o.x, o.y) <= 10 * Math.SQRT2 + 1e-9); }
    for (let i = 0; i < 120; i++) a.update(1 / 60);
    assert.deepEqual({ ...a.offset() }, { x: 0, y: 0 });
});

test('hit-stop freezes simulation time, slow motion scales it, and both expire', () => {
    const fx = load().createFx();
    assert.equal(fx.timeScale(), 1);
    fx.hitStop(.06); assert.equal(fx.timeScale(), 0);
    fx.hitStop(9); assert.equal(fx.stats().stop, .25, 'hit-stop is bounded');
    fx.update(.1); fx.update(.1); fx.update(.06); assert.equal(fx.timeScale(), 1);
    fx.slowMotion(.4, .3); assert.equal(fx.timeScale(), .3);
    for (let i = 0; i < 4; i++) fx.update(.1); assert.equal(fx.timeScale(), .3, 'steps are clamped to 0.1 s');
    fx.update(.05); assert.equal(fx.timeScale(), 1);
});

test('particles freeze during hit-stop, expire later, and are capped', () => {
    const fx = load().createFx({ maxParticles: 50, random: seeded() });
    fx.burst(100, 100, { count: 10, speed: 200 });
    const before = JSON.stringify(fx.stats());
    fx.hitStop(.05); fx.update(.04);
    assert.equal(fx.stats().particles, 10, 'frozen particles stay alive');
    for (let i = 0; i < 80; i++) fx.update(1 / 60);
    assert.equal(fx.stats().particles, 0);
    for (let i = 0; i < 20; i++) fx.burst(0, 0, { kind: i % 2 ? 'shard' : 'spark', count: 12 });
    assert.equal(fx.stats().particles, 50);
    fx.burst(0, 0, { kind: 'ring', count: 99 }); assert.equal(fx.stats().particles, 50);
    for (let i = 0; i < 40; i++) fx.popup(0, 0, i);
    assert.equal(fx.stats().popups, 24);
    assert.ok(before.length > 0);
});

test('reduced motion disables shake, hit-stop and slow motion and thins particles', () => {
    const fx = load().createFx({ reduced: true, random: seeded() });
    fx.shake(1); fx.hitStop(.1); fx.slowMotion(1);
    assert.equal(fx.timeScale(), 1); assert.deepEqual({ ...fx.offset() }, { x: 0, y: 0 });
    fx.burst(0, 0, { count: 20 }); assert.equal(fx.stats().particles, 5);
    const live = load().createFx(); live.shake(1); live.setReduced(true); assert.equal(live.stats().trauma, 0);
});

test('draw renders every effect kind with finite values and restores context state', () => {
    const fx = load().createFx({ random: seeded() }), { ctx, calls } = recorder();
    for (const kind of ['spark', 'shard', 'ring', 'smoke']) fx.burst(50, 60, { kind, count: 3 });
    fx.popup(40, 40, '+100'); fx.flash('#fff', .3); fx.banner('WAVE 02', 'POWER WORKS');
    fx.update(.05); fx.shake(.5); fx.update(.01); fx.apply(ctx); fx.draw(ctx, 720, 720);
    for (const key of ['save', 'restore', 'arc', 'lineTo', 'fillText', 'strokeText', 'fillRect']) assert.ok(calls.includes(key), key);
    assert.equal(calls.filter(k => k === 'save').length, calls.filter(k => k === 'restore').length);
    assert.equal(fx.busy, true);
    for (let i = 0; i < 120; i++) fx.update(1 / 30);
    assert.equal(fx.busy, false); assert.equal(fx.stats().banner, null);
});

test('fitCanvas caps the pixel ratio and only resizes when needed; crt is a no-op without DOM', () => {
    const FX = load({ devicePixelRatio: 3 }), canvas = { width: 0, height: 0 };
    assert.equal(FX.fitCanvas(canvas, 720, 450), 2); assert.equal(canvas.width, 1440); assert.equal(canvas.height, 900);
    const plain = load(); assert.equal(plain.fitCanvas(canvas, 100, 50), 1); assert.equal(canvas.width, 100);
    assert.doesNotThrow(() => plain.crt(recorder().ctx, 100, 100));
    assert.ok(Math.abs(FX.easing.outBack(1) - 1) < 1e-9); assert.equal(FX.easing.outCubic(0), 0); assert.equal(FX.easing.inOutSine(1), 1);
});
