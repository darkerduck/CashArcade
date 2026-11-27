import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const read = name => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
function scope(extra = {}) {
    const s = vm.createContext({ performance: { now: () => 0 }, ...extra });
    for (const file of ['arcade-fx.js', 'cogfront/data.js', 'cogfront/engine.js', 'cogfront/art.js', 'cogfront/renderer.js']) vm.runInContext(read(file), s);
    return s;
}
function canvas() {
    let depth = 0, calls = 0;
    const gradient = { addColorStop() {} };
    const ctx = new Proxy({}, { get(target, key) {
        if (key in target) return target[key];
        return (...args) => {
            calls++; for (const a of args) if (typeof a === 'number') assert.ok(Number.isFinite(a), `${String(key)} finite`);
            if (key === 'save') depth++; if (key === 'restore') depth--;
            // Real canvases throw on negative radii; fail here too.
            if (key === 'arc') assert.ok(args[2] >= 0, `arc radius ${args[2]}`);
            if (key === 'ellipse') assert.ok(args[2] >= 0 && args[3] >= 0, `ellipse radii ${args[2]},${args[3]}`);
            if (String(key).startsWith('create')) return gradient;
        };
    }, set(target, key, value) { if (typeof value === 'number') assert.ok(Number.isFinite(value), `${String(key)} finite`); target[key] = value; return true; } });
    return { width: 960, height: 540, getContext: () => ctx, get depth() { return depth; }, get calls() { return calls; } };
}
const snapshot = g => JSON.stringify(g, (k, v) => (k === 'random' || k === 'stats' ? undefined : v));

test('every stage, combat state and boss renders with finite values, balanced state and no game mutation', () => {
    const s = scope(), { Game } = s.Cogfront, { Renderer } = s.CogfrontRenderer;
    for (let stage = 1; stage <= 8; stage++) {
        const g = new Game({ stage, seed: stage, unlocked: 8 }), cv = canvas(), r = new Renderer(cv);
        g.steam = 999; for (const k of ['sword', 'lancer', 'musket', 'shield', 'mechanic']) g.deploy(k);
        for (let i = 0; i < 360; i++) { if (i % 15 === 0) g.attack(); if (i === 100) g.skill('burst'); if (i === 200) g.skill('charge'); g.update(1 / 60, { move: 1 }); r.consume(g.drain(), g); }
        if (g.stageData.boss) { g.hero.x = g.stageData.bossAt - 450; g.hero.inv = 99; for (let i = 0; i < 400; i++) { g.update(1 / 60, {}); r.consume(g.drain(), g); } assert.ok(g.boss); }
        g.hero.meter = 100; g.skill('overdrive'); g.update(1 / 60, {}); r.consume(g.drain(), g);
        for (const reducedMotion of [false, true]) {
            const before = snapshot(g); r.render(g, { dt: 1 / 60, reducedMotion }); assert.equal(snapshot(g), before);
            assert.equal(cv.depth, 0, `stage ${stage} save/restore balanced`);
        }
        g.damage(g.hero, 1e6, 0, 'test'); g.update(1 / 60, {}); r.consume(g.drain(), g); r.render(g, { dt: 1 / 60 });
        assert.equal(cv.depth, 0); assert.ok(cv.calls > 400);
    }
});

test('art slots are opt-in: nothing loads without a file list, and listed files load once', () => {
    const plain = scope(); assert.equal(plain.CogfrontArt.load(), 0);
    const loaded = [];
    class Image { set src(v) { loaded.push(v); } }
    const s = scope({ Image, CogfrontArtFiles: ['hero-idle.png', 'train.png', 'bg-works-far.png'] });
    assert.equal(s.CogfrontArt.load('./art/'), 3); assert.equal(s.CogfrontArt.load('./art/'), 0);
    assert.deepEqual(loaded.sort(), ['./art/bg-works-far.png', './art/hero-idle.png', './art/train.png']);
    const slots = s.CogfrontArt.SLOTS;
    assert.equal(slots['hero.run'].frames, 8); assert.equal(slots['boss-airship.idle'].w, 768);
    assert.ok(Object.keys(slots).length >= 70);
});
