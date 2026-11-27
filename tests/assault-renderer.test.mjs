import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function fixture(reduced = false, withFx = false) {
    const ops = [], state = {}, ctx = new Proxy(state, { get: (obj, name) => name in obj ? obj[name] : (...args) => {
        ops.push([name, ...args]); for (const n of args) if (typeof n === 'number') assert.ok(Number.isFinite(n), name);
        if (String(name).startsWith('create')) return { addColorStop() {} };
    }, set: (obj, name, value) => { obj[name] = value; ops.push([name, value]); return true; } });
    const scope = vm.createContext({ matchMedia: () => ({ matches: reduced, addEventListener() {} }), devicePixelRatio: 3 });
    if (withFx) vm.runInContext(readFileSync(new URL('../arcade-fx.js', import.meta.url), 'utf8'), scope);
    for (const file of ['engine', 'renderer']) vm.runInContext(readFileSync(new URL(`../assault/${file}.js`, import.meta.url), 'utf8'), scope);
    const canvas = { getContext: () => ctx }, renderer = new scope.NeonAssaultRenderer(canvas);
    return { renderer, canvas, ops, scope };
}

test('three stages and all boss phases render in both themes, keep physics intact and balance canvas saves', () => {
    const { renderer: r, canvas, ops, scope } = fixture();
    for (const level of [1, 2, 3]) {
        const g = new scope.NeonAssault.Game({ ...scope.NeonAssault.fresh(), level }); g.spawnBoss(); g.boss.age = 3; g.boss.y = 145;
        g.spawn('scout', 100, 300); g.spawn('fighter', 240, 400); g.spawn('gunship', 400, 300); g.drop('laser', 270, 500); g.wings = 2;
        g.bullets.push({ x: 220, y: 370, r: 5 });
        for (const phase of ['armor', 'core', 'rage']) {
            g.boss.phase = phase; g.boss.rage = phase === 'rage'; if (phase !== 'armor') g.boss.nodes.forEach(n => n.hp = 0);
            g.boss.sweep = { x: 180, age: phase === 'rage' ? 1.4 : .5, width: 48 };
            const before = JSON.stringify(g); for (const theme of ['dark', 'light']) r.draw(g, theme); assert.equal(JSON.stringify(g), before);
        }
    }
    assert.equal(canvas.width, 1080); assert.equal(canvas.height, 1560);
    assert.equal(ops.filter(o => o[0] === 'save').length, ops.filter(o => o[0] === 'restore').length);
});

test('particles/rings are capped and expire; reduced motion skips debris and camera shake', () => {
    for (const reduced of [false, true]) {
        const { renderer: r } = fixture(reduced);
        for (let i = 0; i < 100; i++) r.consume([{ type: 'bossDown', x: 270, y: 150 }, { type: 'part', x: 200, y: 150 }]);
        assert.ok(r.particles.length <= 300); assert.ok(r.rings.length <= 32); assert.ok(r.labels.length <= 8); assert.ok(r.wrecks.length <= 12);
        if (reduced) { assert.equal(r.particles.length, 0); assert.equal(r.shake, 0); }
        r.update(3); assert.equal(r.particles.length, 0); assert.equal(r.rings.length, 0); assert.equal(r.labels.length, 0); assert.equal(r.wrecks.length, 0);
    }
});

test('original 8-bit scores have distinct motifs, stable notes and rising boss tempos', () => {
    const scope = vm.createContext({}); vm.runInContext(readFileSync(new URL('../assault/music.js', import.meta.url), 'utf8'), scope);
    const score = scope.NeonAssaultScore, motifs = new Set();
    for (let level = 1; level <= 3; level++) {
        const p = score.profile(level, 0); motifs.add(JSON.stringify(p.melody));
        let last = p.bpm;
        for (const phase of ['armor', 'core', 'rage']) { const b = score.profile(level, phase); assert.ok(b.bpm > last); last = b.bpm; }
        const voices = new Set();
        for (let step = 0; step < 128; step++) for (const e of score.notesForStep(p, step)) {
            voices.add(e.voice); assert.ok(Number.isFinite(e.note) && e.length > 0 && e.level > 0 && e.level <= 1);
        }
        assert.deepEqual([...voices].sort(), ['arp', 'bass', 'hat', 'kick', 'lead', 'snare']);
    }
    assert.equal(motifs.size, 3);
});

test('arcade FX: kills pop their score, enemies warp in and bank, and the boss kill freezes then slows time', () => {
    const { renderer: r, ops, scope } = fixture(false, true), g = new scope.NeonAssault.Game(scope.NeonAssault.fresh());
    const e = g.spawn('fighter', 200, 200); e.age = .05;
    r.consume([{ type: 'explode', x: 100, y: 100, size: 30, points: 250 }, { type: 'shoot', x: 270, y: 800 }]);
    assert.equal(r.fx.stats().popups, 1); assert.equal(r.timeScale(), 0); assert.ok(r.muzzle > 0);
    r.draw(g); assert.ok(ops.some(o => o[0] === 'scale'), 'young enemies warp in');
    r.consume([{ type: 'bossDown', x: 270, y: 150 }]); assert.equal(r.fx.stats().banner, 'TARGET DESTROYED');
    for (let i = 0; i < 3; i++) r.update(.1); assert.ok(r.timeScale() > 0 && r.timeScale() < 1, 'slow motion after the freeze');
    for (let i = 0; i < 60; i++) r.update(.1); assert.equal(r.timeScale(), 1); assert.equal(r.fx.busy, false);
    r.draw(g); assert.equal(ops.filter(o => o[0] === 'save').length, ops.filter(o => o[0] === 'restore').length);
});
