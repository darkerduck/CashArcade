import test from 'node:test';
import assert from 'node:assert/strict';
import '../asteroids/data.js';
import '../asteroids/storage.js';
import '../asteroids/engine.js';
import '../asteroids/input.js';
import '../asteroids/music.js';

const { Game, STEP, delta, distance, contact, MAX_SPEED } = globalThis.NeonAsteroids;
const { fresh, validate, create } = globalThis.NeonAsteroidsStorage;
const { levels, limits } = globalThis.NeonAsteroidsData;
const make = (level = 1, rest = {}) => new Game({ ...fresh(8331), level, ...rest });
function advance(game, seconds, action = {}) {
    for (let i = 0; i < Math.round(seconds / STEP); i++) game.update(STEP, action);
}

test('rotation leaves the velocity intact and opposite thrust slows it down without passive drag', () => {
    const game = make(), p = game.player;
    advance(game, 0.66, { thrust: true });
    const vx = p.vx, vy = p.vy;
    advance(game, 103 * STEP, { right: true });
    assert.equal(p.vx, vx);
    assert.equal(p.vy, vy);
    const speed = Math.hypot(p.vx, p.vy);
    advance(game, 0.35, { thrust: true });
    assert.ok(Math.hypot(p.vx, p.vy) < speed / 2);
    p.vx = 900;
    game.update(STEP, {});
    assert.ok(Math.hypot(p.vx, p.vy) <= MAX_SPEED + 1e-9);
    assert.equal(game.shots, 0);
});

test('corners wrap and a high-speed sweep detects the first contact across the seam', () => {
    const game = make();
    Object.assign(game.player, { x: 719.5, y: .5, vx: 180, vy: -180 });
    game.update(STEP);
    assert.ok(Math.abs(game.player.x - 1) < 1e-9);
    assert.ok(Math.abs(game.player.y - 719) < 1e-9);
    assert.equal(delta(719, 1), 2);
    assert.ok(distance({ x: 718, y: 718 }, { x: 2, y: 2 }) < 6);
    assert.ok(contact({ px: 714, py: 3, x: 5, y: 3 }, { x: 0, y: 3 }, 1) < 1);
    assert.equal(contact({ px: 714, py: 3, x: 5, y: 3 }, { x: 360, y: 3 }, 1), Infinity);
});

test('laser crosses the seam and each target is damaged once per piercing projectile', () => {
    const game = make(1, { weapon: 'laser', laser: 3 });
    const a = game.addEnemy('large', 4, 360, { vx: 0, vy: 0 });
    const b = game.addEnemy('large', 35, 360, { vx: 0, vy: 0 });
    Object.assign(game.player, { x: 683, y: 360, vx: 0, vy: 0, angle: 0 });
    game.update(STEP, { fire: true });
    advance(game, .11);
    assert.equal(a.hp, 1);
    assert.equal(b.hp, 1);
    assert.equal(game.projectiles[0].struck.size, 2);
});

test('large rock yields precisely two medium rocks, inherits velocity and scores once', () => {
    const game = make();
    const rock = game.addEnemy('large', 25, 25, { vx: 110, vy: 0, angle: 0 });
    game.destroy(rock);
    game.destroy(rock);
    const medium = game.enemies.filter(unit => !unit.dead);
    assert.equal(game.score, 80);
    assert.equal(medium.length, 2);
    assert.ok(medium.every(unit => unit.type === 'medium' && unit.vx > 80 && unit.grace > 0));
    assert.ok(medium[0].vy * medium[1].vy < 0);
    game.destroy(medium[0]);
    assert.equal(game.enemies.filter(unit => unit.type === 'small').length, 2);
});

test('black-hole core defeats shield and invulnerability, absorbs debris without scoring, and exterior is escapable', () => {
    const game = make(5, { shield: true }), well = game.fields[0];
    Object.assign(game.player, { x: well.x + 81, y: well.y, vx: -20, angle: 0 });
    const initial = distance(game.player, well);
    advance(game, 1.6, { thrust: true });
    assert.equal(game.mode, 'running');
    assert.ok(distance(game.player, well) > initial + 25);
    const debris = game.addEnemy('large', well.x, well.y);
    game.update(STEP);
    assert.equal(debris.dead, true);
    assert.equal(game.score, 0);
    assert.equal(game.loot.length, 0);
    Object.assign(game.player, { x: well.x + well.core + 5, y: well.y, invulnerable: 1 });
    game.update(STEP);
    assert.equal(game.mode, 'lost');
    assert.equal(game.failure, 'hole');
});

test('ordinary gravity bends shots and the shield blocks a single ordinary collision', () => {
    const game = make(4, { shield: true }), well = game.fields[0];
    Object.assign(game.player, { x: well.x + 73, y: well.y, angle: Math.PI / 2 });
    game.update(STEP, { fire: true });
    assert.ok(game.player.vx < 0);
    assert.ok(game.projectiles[0].vx < 0);
    game.hurt();
    game.hurt();
    assert.equal(game.player.hull, 3);
    assert.equal(game.player.shield, false);
    advance(game, 1.02);
    game.hurt();
    assert.equal(game.player.hull, 2);
});

test('weapon ranks persist through swapping, capped pickups score, checkpoint retry rolls back gear and score', () => {
    const game = make(2, { weapon: 'laser', laser: 2, score: 210 });
    for (const item of ['spread', 'spread', 'laser', 'laser', 'escort', 'escort', 'escort', 'repair']) game.collect(item);
    assert.equal(game.player.weapon, 'laser');
    assert.equal(game.player.laser, 3);
    assert.equal(game.player.spread, 2);
    assert.equal(game.player.escorts, 2);
    assert.equal(game.score, 660);
    game.retry();
    assert.equal(game.score, 210);
    assert.equal(game.player.spread, 0);
    assert.equal(game.player.laser, 2);
    assert.equal(game.player.escorts, 0);
});

test('same seed replays warning positions and unsafe deployment is deferred', () => {
    const a = make(2), b = make(2);
    advance(a, 1.1);
    advance(b, 1.1);
    assert.deepEqual(a.warnings, b.warnings);
    assert.ok(distance(a.player, a.warnings[0]) >= 180);
    const warning = a.warnings[0];
    Object.assign(a.player, { x: warning.x, y: warning.y });
    advance(a, 1.3);
    assert.ok(a.warnings.includes(warning));
    assert.ok(warning.ttl > 0);
    a.retry();
    advance(a, 1.1);
    assert.deepEqual(a.warnings, b.warnings);
});

test('three boss encounters attack, gated parts unlock, and final overload clears the field', () => {
    for (const level of [3, 6, 9]) {
        const game = make(level);
        advance(game, 3);
        const boss = game.boss;
        assert.ok(boss);
        assert.ok(game.locked(boss.core));
        if (level === 9) assert.ok(game.locked(boss.parts.find(part => part.role === 'weapon')));
        advance(game, 3);
        assert.ok(game.projectiles.some(bullet => bullet.hostile));
        for (const part of boss.parts) {
            assert.ok(!game.locked(part));
            game.destroy(part);
        }
        assert.ok(!game.locked(boss.core));
        if (level === 9) {
            boss.core.hp = 1;
            game.update(STEP);
            assert.ok(game.overload);
        }
        game.destroy(boss.core);
        assert.equal(game.mode, level === 9 ? 'won' : 'clear');
        assert.equal(game.projectiles.length, 0);
        assert.equal(game.enemies.length, 0);
    }
});

test('all nine levels serialize next checkpoints, and loss returns to the identical start', () => {
    let checkpoint = fresh(1312);
    for (let n = 1; n <= levels.length; n++) {
        const game = new Game(checkpoint);
        game.lose('damage');
        game.retry();
        assert.deepEqual(game.checkpoint(), checkpoint);
        if (game.data.boss) {
            game.deployBoss();
            game.boss.parts.forEach(part => game.destroy(part));
            game.destroy(game.boss.core);
        } else {
            game.group = game.data.groups.length;
            game.update(STEP);
        }
        const next = game.nextCheckpoint();
        if (n === 9) { assert.equal(next, null); assert.equal(game.mode, 'won'); }
        else { assert.equal(next.level, n + 1); checkpoint = validate(next); assert.ok(checkpoint); }
    }
});

test('finite world budgets protect bullets and effects remain separate from scoring', () => {
    const game = make();
    for (let i = 0; i < 300; i++) game.addProjectile(game.player, 0, { speed: 500, hostile: true });
    assert.equal(game.projectiles.length, limits.hostile);
    for (let i = 0; i < 500; i++) game.emit('test');
    assert.equal(game.drain().length, limits.events);
    assert.equal(game.drain().length, 0);
    assert.equal(game.score, 0);
});

test('checkpoint storage survives reload and safely rejects corrupt, invalid and silent persistence', () => {
    const data = new Map(), storage = { getItem: key => data.get(key) ?? null,
        setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) };
    const store = create(() => storage), save = { ...fresh(19), level: 8, shield: true };
    assert.equal(store.save(save), true);
    assert.deepEqual(create(() => storage).load(), save);
    assert.equal(store.save({ ...save, weapon: 'laser', laser: 0 }), false);
    assert.equal(store.finishTutorial(), true);
    assert.equal(store.tutorialSeen(), true);
    const saveKey = [...data.keys()].find(key => key.includes('checkpoint'));
    data.set(saveKey, '{}');
    assert.equal(store.load(), null);
    assert.equal(store.clear(), true);
    const silent = create(() => ({ ...storage, setItem() {} }));
    assert.equal(silent.save(save), false);
    assert.equal(silent.unavailable, true);
});

function target(action) {
    const node = new EventTarget();
    node.dataset = { action };
    return node;
}
const send = (node, type, values) => node.dispatchEvent(Object.assign(new Event(type, { cancelable: true }), values));
test('keyboard aliases and three simultaneous touch holds release by source and clear on pause', () => {
    const root = target(), buttons = ['left', 'right', 'thrust', 'fire'].map(target);
    const input = StarshardInput.create({ root, buttons, active: () => true, wake() {}, pause() {}, retry() {} });
    send(root, 'keydown', { key: 'w' });
    send(root, 'keydown', { key: 'ArrowUp' });
    send(root, 'keyup', { key: 'w' });
    assert.equal(input.value().thrust, true);
    for (const [i, button] of [buttons[0], buttons[2], buttons[3]].entries()) send(button, 'pointerdown', { pointerId: i, button: 0 });
    assert.deepEqual(input.value(), { left: true, right: false, thrust: true, fire: true });
    send(buttons[3], 'pointercancel', { pointerId: 2 });
    assert.equal(input.value().fire, false);
    input.clear();
    assert.deepEqual(input.value(), { left: false, right: false, thrust: false, fire: false });
});

test('six original scores expose complete playable phrases and overload increases shared scheduler intensity', () => {
    const themes = [1, 3, 4, 6, 7, 9].map(n => StarshardScore.profile(n));
    assert.equal(new Set(themes.map(profile => profile.name)).size, 6);
    for (const profile of themes) {
        const lead = Array.from({ length: 128 }, (_, tick) => StarshardScore.notesForStep(profile, tick))
            .flat().filter(note => note.voice === 'lead');
        assert.equal(lead.length, 48);
        assert.ok(new Set(lead.map(note => note.note)).size >= 8);
    }
    assert.ok(StarshardScore.profile(9, 'overload').intensity > themes.at(-1).intensity);
});
