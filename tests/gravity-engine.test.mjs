import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { Game, LEVELS, STEP, FLOOR, CEILING, RADIUS, HIT_RADIUS, circleRect, platformAt, laserState } = require('../gravity/engine.js');
function replay(index, offset = 0) {
    const game = new Game(index); game.start(); let cursor = 0;
    while (game.state === 'running' && game.time < 40) {
        if (game.player.x >= game.level.route[cursor] + offset) { assert.equal(game.flip(), true); cursor++; }
        game.update(STEP);
    }
    return game;
}
test('ten distinct crafted routes have bounded dimensions, three shards, and immutable data', () => {
    assert.equal(LEVELS.length, 10); assert.equal(new Set(LEVELS.map(l => l.id)).size, 10);
    for (const level of LEVELS) {
        assert.equal(level.shards.length, 3); assert.ok(level.goal > 10 && level.goal < 25); assert.ok(Object.isFrozen(level));
        for (const item of [...level.spikes, ...level.platforms, ...level.lasers]) assert.ok(item.x > 200 && item.x + item.w < level.length - 120);
    }
    assert.ok(LEVELS.some(l => l.platforms.length > 2)); assert.ok(LEVELS.some(l => l.lasers.length > 3));
});
for (let index = 0; index < 10; index++) test(`route ${index + 1} replays to delivery with all shards and the time-goal star`, () => {
    const game = replay(index); assert.equal(game.state, 'delivered', `${game.deathReason} at ${game.player.x}`);
    assert.equal(game.stars, 3); assert.equal(game.collected.length, 3); assert.ok(game.time <= game.level.goal);
    assert.equal(game.progress, 1); assert.equal(game.drain().filter(e => e.type === 'delivery').length, 1);
});
test('every route tolerates 8px early/late flip timing without collision', () => {
    for (let i = 0; i < 10; i++) for (const offset of [-8, 8]) assert.equal(replay(i, offset).state, 'delivered', `route ${i + 1}, offset ${offset}`);
});
test('no-input run encounters a real obstacle rather than completing automatically', () => {
    for (let i = 0; i < 10; i++) { const game = new Game(i); game.start(); for (let j = 0; j < 1000 && game.state === 'running'; j++) game.update(STEP); assert.equal(game.state, 'lost'); assert.equal(game.deathReason, 'spikes'); }
});
test('one press changes gravity once, detaches, and respects input cooldown', () => {
    const game = new Game(); assert.equal(game.flip(), false); game.start(); assert.equal(game.flip(), true);
    assert.equal(game.player.gravity, -1); assert.equal(game.flips, 1); assert.equal(game.player.grounded, false); assert.equal(game.flip(), false);
    game.update(.12); assert.equal(game.flip(), true); assert.equal(game.player.gravity, 1); assert.equal(game.flips, 2);
});
test('gravity clamps to safe floor/ceiling and uses a smaller fair hurtbox', () => {
    const game = new Game(); game.start(); game.flip(); for (let j = 0; j < 150; j++) game.update(STEP);
    assert.equal(game.player.y, CEILING + RADIUS); assert.equal(game.player.vy, 0); assert.equal(game.player.grounded, true);
    assert.ok(HIT_RADIUS < RADIUS); const rect = { x: 100, y: 100, w: 50, h: 50 };
    assert.equal(circleRect(91, 120, HIT_RADIUS, rect), false); assert.equal(circleRect(92, 120, HIT_RADIUS, rect), true);
});
test('fixed stepping produces identical physics across frame chunk sizes', () => {
    const a = new Game(1), b = new Game(1); a.start(); b.start(); a.flip(); b.flip();
    for (let i = 0; i < 60; i++) a.update(1 / 60); for (let i = 0; i < 30; i++) b.update(1 / 30);
    assert.deepEqual(a.player, b.player); assert.equal(a.time, b.time); assert.deepEqual(a.collected, b.collected);
});
test('pause freezes timers, mechanisms, boost, and player; resume cannot duplicate start', () => {
    const game = new Game(3); game.start(); game.flip(); game.update(.2); game.boost = .7; assert.equal(game.pause(), true);
    const before = { player: { ...game.player }, time: game.time, boost: game.boost }; game.update(10); assert.equal(game.flip(), false);
    assert.deepEqual(game.player, before.player); assert.equal(game.time, before.time); assert.equal(game.boost, before.boost);
    assert.equal(game.start(), false); assert.equal(game.resume(), true); assert.equal(game.resume(), false); game.update(STEP); assert.ok(game.time > before.time);
});
test('retry resets timing patterns, parcel, collections, deaths and all input state', () => {
    const game = replay(4); game.restart(); const fresh = new Game(4); fresh.start();
    assert.deepEqual(game.player, fresh.player); assert.equal(game.state, fresh.state); assert.equal(game.time, 0); assert.equal(game.flips, 0);
    assert.equal(game.boost, 0); assert.deepEqual(game.collected, []); assert.equal(game.stars, 0); assert.equal(game.deathReason, '');
    assert.deepEqual(game.drain(), fresh.drain());
});
test('moving platforms can be landed on, carry vertically, and release on flip', () => {
    const game = new Game(); const p = { x: 50, y: 400, w: 700, h: 18, amplitude: 45, period: 4, phase: 0 };
    game.level = { ...game.level, spikes: [], lasers: [], shards: [], platforms: [p] }; game.start();
    game.player.y = 300; game.player.vy = 300;
    for (let i = 0; i < 60; i++) game.update(STEP);
    assert.equal(game.player.platform, 0); assert.equal(game.player.grounded, true);
    assert.ok(Math.abs(game.player.y + RADIUS - platformAt(p, game.time).y) < .0001);
    const y = game.player.y; game.update(.2); assert.notEqual(game.player.y, y); assert.equal(game.player.platform, 0);
    assert.equal(game.flip(), true); assert.equal(game.player.platform, -1); game.update(.1); assert.equal(game.player.gravity, -1);
});
test('platform sides are passable, not invisible fatal walls', () => {
    const game = new Game(); game.level = { ...game.level, spikes: [], lasers: [], shards: [], platforms: [{ x: 101, y: 510, w: 200, h: 18, amplitude: 0, period: 4, phase: 0 }] };
    game.start(); game.update(.2); assert.equal(game.state, 'running'); assert.ok(game.player.x > 130);
});
test('lasers telegraph warnings; only their active segment is lethal', () => {
    const item = { x: 110, y: CEILING, w: 10, h: FLOOR - CEILING, phase: 0, period: 3, on: 1, warning: .4 };
    assert.equal(laserState(item, .4), 'active'); assert.equal(laserState(item, 1), 'off'); assert.equal(laserState(item, 2.7), 'warning'); assert.equal(laserState(item, 3), 'active');
    const make = phase => { const g = new Game(); g.level = { ...g.level, spikes: [], lasers: [{ ...item, phase }] }; g.start(); return g; };
    const active = make(0); active.update(.1); assert.equal(active.state, 'lost'); assert.equal(active.deathReason, 'laser');
    for (const phase of [1.5, 2.65]) { const game = make(phase); game.update(.1); assert.equal(game.state, 'running'); }
});
test('boost pickups are optional and cannot be collected twice', () => {
    const game = new Game(); game.level = { ...game.level, spikes: [], lasers: [], shards: [{ x: 105, y: FLOOR - RADIUS }] }; game.start(); game.update(STEP);
    assert.deepEqual(game.collected, [0]); assert.ok(game.boost > 0); const x = game.player.x; game.update(STEP);
    assert.ok(game.player.x - x > game.level.speed * STEP); assert.equal(game.drain().filter(e => e.type === 'shard').length, 1);
    const optional = new Game(); optional.level = { ...optional.level, spikes: [], lasers: [], shards: [{ x: 200, y: 100 }], length: 450, goal: .01 }; optional.start();
    while (optional.state === 'running') optional.update(STEP); assert.equal(optional.state, 'delivered'); assert.equal(optional.stars, 1);
});
test('invalid/large frame deltas cannot poison simulation or skip an entire route', () => {
    const game = new Game(); game.start(); for (const dt of [NaN, Infinity, -1, 0]) game.update(dt); assert.equal(game.time, 0);
    game.update(1000); assert.ok(game.time <= .251); assert.ok(Number.isFinite(game.player.x));
    assert.equal(new Game(NaN).levelIndex, 0); assert.equal(new Game(500).levelIndex, 9);
});
