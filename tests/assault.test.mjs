import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const scope = vm.createContext({});
vm.runInContext(readFileSync(new URL('../assault/engine.js', import.meta.url), 'utf8'), scope);
const { Game, fresh, valid, W, H } = scope.NeonAssault;
const advance = (g, seconds, input = {}) => { for (let i = 0; i < Math.ceil(seconds * 120); i++) g.update(1 / 120, input); };

test('movement normalizes diagonal input, clamps the playfield, and pointer travel never teleports', () => {
    const a = new Game(), b = new Game(); advance(a, .3, { dx: 1 }); advance(b, .3, { dx: 1, dy: -1 });
    assert.ok(Math.abs(Math.hypot(b.player.x - W / 2, b.player.y - (H - 108)) - (a.player.x - W / 2)) < .001);
    const old = b.player.x; b.update(1 / 120, { x: W, y: 300 }); assert.ok(b.player.x - old < 6);
    advance(a, 1, { dx: 1, dy: 1 }); assert.ok(a.player.x <= W - 22); assert.ok(a.player.y <= H - 28);
    const slow = new Game(); advance(slow, .3, { dx: 1, focus: true }); assert.ok(slow.player.x - W / 2 < 50);
});

test('autofire, spread, piercing laser and two escort drones have distinct effective fire patterns', () => {
    const g = new Game(); g.fire(); assert.equal(g.shots.length, 2);
    g.pickup('spread'); g.shots = []; g.fire(); assert.equal(g.shots.length, 7); assert.ok(g.shots.some(s => s.vx < -100));
    g.pickup('laser'); const a = g.spawn('gunship', 270, 200), b = g.spawn('gunship', 270, 400);
    g.fire(); assert.ok(a.hp < a.maxHp && b.hp < b.maxHp); assert.equal(g.beams.length, 1);
    for (let i = 0; i < 5; i++) g.pickup('wing'); assert.equal(g.wings, 2);
    g.shots = []; advance(g, .1); assert.equal(g.shots.filter(s => s.wing).length, 2);
    assert.equal(g.power, 3);
});

test('swept friendly and hostile projectiles hit once; invulnerability prevents multi-hit bursts', () => {
    const g = new Game(); const e = g.spawn('scout', 270, 400, { speed: 0, sway: 0 });
    g.shots.push({ x: 270, y: 470, vx: 0, vy: -12000, damage: 100, r: 3 }); g.update(1 / 120);
    assert.equal(e.dead, true); assert.equal(g.kills, 1);
    g.player.invulnerable = 0; const y = g.player.y;
    for (let i = 0; i < 8; i++) g.bullets.push({ x: g.player.x, y: y - 50, vx: 0, vy: 12000, r: 5 });
    g.update(1 / 120); assert.equal(g.hp, 4); assert.equal(g.drain().filter(e => e.type === 'hurt').length, 1);
    g.hp = 1; g.player.invulnerable = 0; g.hurt(); assert.equal(g.state, 'lost');
    const time = g.time; advance(g, 1); assert.equal(g.time, time); assert.equal(g.bomb(), false);
});

test('all supply items collect once, respect caps, expire and cannot be collected while paused', () => {
    const g = new Game(); g.hp = 3;
    for (const type of ['spread', 'laser', 'wing', 'repair', 'bomb']) g.drop(type, g.player.x, g.player.y);
    g.update(1 / 120); assert.equal(g.items.length, 0); assert.equal(g.hp, 4); assert.equal(g.bombs, 3);
    assert.equal(g.score, 500); assert.equal(g.drain().filter(e => e.type === 'pickup').length, 5);
    g.update(1 / 120); assert.equal(g.score, 500);
    g.drop('repair', 20, H + 40); g.update(1 / 120); assert.equal(g.items.length, 0);
    g.state = 'paused'; const before = JSON.stringify(g); g.pickup('wing'); g.update(.1); assert.equal(JSON.stringify(g), before);
});

test('bomb consumes one charge, clears bullets and obeys cooldown; armored core remains protected', () => {
    const g = new Game(); g.spawnBoss(); g.boss.age = 3;
    const hp = g.boss.hp; g.bullet(100, 100, 1); g.spawn('fighter', 100, 150);
    assert.equal(g.bomb(), true); assert.equal(g.bombs, 1); assert.equal(g.bullets.length, 0); assert.equal(g.boss.hp, hp);
    assert.equal(g.bomb(), false); assert.equal(g.bombs, 1);
    g.bombCooldown = 0; g.bomb(); assert.equal(g.bombs, 0); assert.equal(g.bomb(), false);
});

for (const level of [1, 2, 3]) test(`boss ${level}: armor, exposed core, overload and teardown each happen once`, () => {
    const g = new Game({ ...fresh(), level }); g.spawnBoss(); const b = g.boss; b.age = 3; b.y = 145;
    assert.equal(b.nodes.length, level === 3 ? 4 : 2); g.damageCore(999); assert.equal(b.hp, b.maxHp);
    for (const n of b.nodes) { g.damageNode(n, 999); g.damageNode(n, 999); }
    assert.equal(b.phase, 'core'); g.damageCore(b.maxHp * .6); assert.equal(b.phase, 'rage');
    g.damageCore(999); g.damageCore(999); assert.equal(g.state, 'clearing'); assert.equal(g.bullets.length, 0);
    advance(g, 3); assert.equal(g.state, level === 3 ? 'won' : 'stageClear');
    const events = g.drain(); assert.equal(events.filter(e => e.type === 'part').length, b.nodes.length);
    assert.equal(events.filter(e => e.type === 'phase').length, 2); assert.equal(events.filter(e => e.type === 'bossDown').length, 1);
    const score = g.score; advance(g, 1); assert.equal(g.score, score);
    if (level < 3) { assert.ok(valid(g.nextCheckpoint())); assert.equal(g.nextCheckpoint().level, level + 1); }
    else assert.equal(g.nextCheckpoint(), null);
});

test('late bosses lock the telegraph lane, allow escape and only damage during the active beam', () => {
    const g = new Game({ ...fresh(), level: 2 }); g.spawnBoss(); const b = g.boss; b.age = 4; b.y = 145; b.fire = 10;
    b.sweep = { x: g.player.x, age: 0, width: 48 }; g.player.invulnerable = 0;
    advance(g, 1.1); assert.equal(g.hp, 5); advance(g, .4, { dx: 1 }); assert.equal(g.hp, 5);
    b.sweep = { x: g.player.x, age: 1.3, width: 48 }; g.update(1 / 120); assert.equal(g.hp, 4);
});

test('stage retry restores score and equipment; checkpoint rejects corrupt and out-of-range values', () => {
    const cp = { ...fresh(), level: 2, score: 2500, hp: 3, weapon: 'laser', power: 3, wings: 2 };
    const g = new Game(cp); g.score += 100; g.hp--; const retry = new Game(g.checkpoint);
    assert.equal(retry.score, 2500); assert.equal(retry.hp, 3); assert.equal(retry.weapon, 'laser');
    for (const change of [{ level: 4 }, { hp: 0 }, { score: NaN }, { power: 4 }, { bombs: -1 }, { weapon: 'constructor' }, { wings: 3 }]) assert.equal(valid({ ...cp, ...change }), false);
    assert.equal(valid(null), false); assert.throws(() => new Game({}));
});

test('three complete timelines, supplies and actual autofire reach all endings with bounded entities', () => {
    let cp = { ...fresh(), weapon: 'laser', power: 3, wings: 2 };
    for (let level = 1; level <= 3; level++) {
        const g = new Game(cp); let bossAt = 0;
        // Invulnerable fixture isolates timeline/collision completeness, not player difficulty.
        for (let i = 0; i < 120 * 240 && ['running', 'clearing'].includes(g.state); i++) {
            g.player.invulnerable = 1;
            const b = g.boss, n = b?.nodes.find(n => n.hp > 0);
            if (b && !bossAt) bossAt = g.time;
            g.update(1 / 120, { x: b ? b.x + (n?.offset || 0) : 270 + Math.sin(g.time * .8) * 130, y: 630 }); g.drain();
            assert.ok(g.enemies.length <= 55 && g.shots.length <= 180 && g.bullets.length <= 240 && g.items.length <= 12);
            for (const entity of [...g.enemies, ...g.bullets]) assert.ok(Number.isFinite(entity.x) && Number.isFinite(entity.y));
        }
        assert.equal(g.state, level === 3 ? 'won' : 'stageClear', `stage ${level}`);
        assert.ok(Math.abs(bossAt - g.config.duration) < .03); assert.ok(g.supplies >= 5); assert.ok(g.kills > 30);
        if (level < 3) cp = g.nextCheckpoint();
    }
});
