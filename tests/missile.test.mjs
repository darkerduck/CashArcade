import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const scope = vm.createContext({});
vm.runInContext(readFileSync(new URL('../missile/engine.js', import.meta.url), 'utf8'), scope);
const { Game, fresh, valid, upgrade, LEVELS } = scope.NeonDefense;
const game = (level = 1) => new Game({ ...fresh(), level, seed: 12345 });
const advance = (g, seconds) => { for (let t = 0; t < seconds; t += .025) g.update(.025); };

test('nearest ready turret fires once with cooldown; unsuccessful shots are silent', () => {
    const g = game(); assert.equal(g.fire(100, 200), true); assert.equal(g.shots[0].x, 70);
    g.fire(100, 200); assert.equal(g.shots[1].x, 480);
    g.fire(100, 200); assert.equal(g.shots[2].x, 890);
    assert.equal(g.fire(100, 200), false); assert.equal(g.shots.length, 3);
    assert.equal(g.drain().filter(e => e.type === 'launch').length, 3);
    advance(g, .7); assert.equal(g.fire(100, 200), true);
});
test('armor takes only one hit from a single blast and then chains once', () => {
    const g = game(); const e = g.spawn('armored', 400, 300); e.speed = 0;
    g.explode(400, 300); advance(g, .4); assert.equal(e.hp, 1);
    g.explode(400, 300); advance(g, .1); assert.equal(e.hp, 0);
    assert.equal(g.kills, 1); assert.equal(g.drain().filter(e => e.type === 'chain').length, 1);
});
test('all five pickups apply, refresh instead of multiply and are collected once', () => {
    const g = game(); g.items.push({ type: 'rapid', x: 400, y: 300, life: 8 });
    g.explode(400, 300); advance(g, .2);
    assert.equal(g.drain().filter(e => e.type === 'pickup').length, 1);
    g.pickup('rapid'); assert.equal(g.effects.rapid, 10);
    g.pickup('wide'); assert.equal(g.effects.wide, 10);
    g.pickup('slow'); assert.equal(g.effects.slow, 8);
    g.pickup('shield'); g.pickup('shield'); assert.ok(g.cities.every(c => c.shield === true));
    const enemy = g.spawn('normal', 200, 300); g.pickup('emp'); assert.equal(enemy.dead, true);
    g.state = 'paused'; const time = g.time; g.update(.05); assert.equal(g.time, time); assert.equal(g.effects.slow, 8);
});
test('city shield absorbs one hit; destroyed cities cause failure without bonus', () => {
    const g = game(); const city = g.cities[0]; city.shield = true;
    g.hitCity({ target: city.x }); assert.equal(city.hp, 3); assert.equal(city.shield, false);
    g.hitCity({ target: city.x }); assert.equal(city.hp, 2);
    g.cities.forEach(c => c.hp = 0); g.update(.01); assert.equal(g.state, 'lost'); assert.equal(g.score, 0);
});
test('checkpoint retries restore score/cities/upgrades; upgrade is not applied twice', () => {
    const g = game(); g.score = 700; g.cities[0].hp = 0; g.cities[1].hp = 1;
    const retry = new Game(g.checkpoint); assert.equal(retry.score, 0); assert.equal(retry.cities[0].hp, 3);
    g.state = 'upgrade'; const c = g.nextCheckpoint(); assert.ok(valid(c));
    const next = upgrade(c, 'repair'); assert.equal(next.level, 2); assert.equal(next.cities[0].hp, 1); assert.equal(next.cities[1].hp, 2);
    assert.equal(upgrade(next, 'repair'), null); assert.equal(next.score, 700);
    assert.equal(upgrade(c, 'radius').radius, 72); assert.ok(upgrade(c, 'reload').reload < .65);
    assert.equal(valid({ ...c, score: Infinity }), false); assert.equal(valid({ ...c, level: 99 }), false);
});
test('boss shields protect core, armor IDs deduplicate, rage starts once and EMP cannot kill boss', () => {
    const g = game(10); const b = g.boss;
    const hit = (x, key) => { const blast = { x, y: b.y, r: 30, hit: new Set() }; g.hitBoss(blast); g.hitBoss(blast); return blast.hit.has(key); };
    hit(b.x, 'core'); assert.equal(b.hp, 24);
    for (let i = 0; i < 6; i++) { assert.ok(hit(b.x - 95, 'node0')); assert.ok(hit(b.x + 95, 'node1')); }
    assert.equal(b.nodes[0], 0); assert.equal(b.nodes[1], 0);
    g.pickup('emp'); assert.equal(b.hp, 24);
    for (let i = 0; i < 12; i++) hit(b.x, 'core');
    assert.equal(b.hp, 12); assert.equal(b.rage, true);
    for (let i = 0; i < 12; i++) hit(b.x, 'core');
    assert.equal(b.dead, true); assert.equal(g.spawned, g.config.count);
});
test('ten full simulations clear waves, deliver both drops and preserve progress through all upgrades', () => {
    let checkpoint = { ...fresh(), seed: 42 }; const names = new Set();
    for (let level = 1; level <= 10; level++) {
        const g = new Game(checkpoint); names.add(g.config.name);
        // Deterministic perfect-defense fixture exercises actual spawn/movement/collision and transition clocks.
        for (let step = 0; step < 12000 && g.state === 'running'; step++) {
            for (const e of g.enemies) if (!e.dead) g.explode(e.x, e.y, 34);
            if (g.boss && !g.boss.dead && step % 10 === 0) {
                const b = g.boss; g.explode(b.x - 95, b.y, 40); g.explode(b.x + 95, b.y, 40); g.explode(b.x, b.y, 40);
            }
            g.update(.025); g.drain();
        }
        assert.equal(g.state, level === 10 ? 'won' : 'upgrade', `level ${level}`);
        assert.equal(g.drops, 2); assert.ok(g.cities.some(c => c.hp));
        assert.ok(g.blasts.length <= 180);
        if (level < 10) { checkpoint = upgrade(g.nextCheckpoint(), level % 2 ? 'radius' : 'reload'); assert.ok(valid(checkpoint)); }
    }
    assert.equal(names.size, 10); assert.equal(LEVELS[0].count, 18); assert.equal(LEVELS[8].count, 82);
});
test('split missiles branch, cruisers drop missiles, and untouched stages can be lost', () => {
    const g = game(7); g.spawn('split', 400, 290); g.update(.025);
    assert.ok(g.enemies.filter(e => e.type === 'normal').length >= 3);
    const cruiser = g.spawn('cruiser'); cruiser.dropAt = 0; g.update(.025);
    assert.ok(g.enemies.some(e => e.type === 'normal' && e.y < 180));
    const idle = game(9); advance(idle, 150); assert.equal(idle.state, 'lost');
});
