import test from 'node:test';
import assert from 'node:assert/strict';
import { replay } from './aurora-replays.mjs';
import '../aurora/input.js';
import '../aurora/storage.js';
import '../aurora/music.js';

const { Game, STEP, LIMITS, contact } = AuroraSprint;
const { levels, roadAt, tunnelAt, ROAD_HALF, LANES } = AuroraRoutes;
function step(game, seconds, input) {
    for (let i = 0; i < Math.round(seconds / STEP); i++) game.update(STEP, input);
}
function isolated(level = 1) {
    const game = new Game(level);
    game.objects = [];
    game.cursor = game.level.traffic.length;
    return game;
}
const fixture = (type, z, x = 0, speed = 0) => ({ type, z, x, age: 0, px: x, pz: z, speed });

test('all nine courses are winnable through the regular steering, braking and nitro interface', () => {
    let passes = 0;
    for (const route of levels) {
        const { game, events } = replay(route.id);
        assert.equal(game.mode, 'won', route.name);
        assert.equal(game.distance, route.length);
        assert.ok(game.time < route.limit);
        assert.ok(game.passes > 7 && events.boost > 0 && events.tunnel >= 1, route.name);
        assert.equal(events.won, 1);
        passes += game.passes;
    }
    assert.ok(passes > 180);
});

test('a normal route runs forward continuously instead of looping, with exact timeout and inert results', () => {
    const game = isolated();
    step(game, 1, { nitro: true });
    assert.equal(game.time, 0);
    game.start(); game.distance = 800; game.speed = 11;
    game.time = game.level.limit - .03; game.timeLeft = .03;
    game.update(.05, {});
    assert.equal(game.mode, 'lost');
    assert.equal(game.time, game.level.limit);
    assert.ok(game.distance > 800);
    const last = game.distance;
    game.update(.05, { nitro: true });
    assert.equal(game.distance, last);
    assert.equal(game.drain().filter(e => e.type === 'lost').length, 1);
});

test('finish within the last integration slice wins and counts only the traveled fraction', () => {
    const game = isolated();
    game.start(); game.speed = 45; game.distance = game.level.length - .19;
    game.time = game.level.limit - .005; game.timeLeft = .005;
    game.update(.05, {});
    assert.equal(game.mode, 'won');
    assert.ok(game.time < game.level.limit);
    assert.ok(game.timeLeft > 0);
    assert.equal(game.distance, game.level.length);
});

test('smooth continuous steering, automatic acceleration, independent nitro and brake priority', () => {
    const cruise = isolated(), boosted = isolated();
    cruise.start(); boosted.start();
    step(cruise, 2, {});
    step(boosted, 2, {});
    step(cruise, .6, { steer: .25 });
    step(boosted, .6, { steer: .25, nitro: true });
    assert.ok(cruise.x > 0 && cruise.x < ROAD_HALF);
    assert.ok(boosted.x > cruise.x);
    assert.equal(cruise.nitro, .42);
    assert.ok(boosted.nitro < .25 && boosted.speed > LIMITS.cruise);
    const charge = boosted.nitro, speed = boosted.speed;
    step(boosted, .3, { brake: true, nitro: true });
    assert.equal(boosted.nitro, charge);
    assert.equal(boosted.boosting, false);
    assert.ok(boosted.speed < speed);
});

test('swept contact detects crossing car, truck and barrier without false positive one lane over', () => {
    for (const type of ['car', 'truck', 'barrier']) {
        const target = fixture(type, 30);
        assert.ok(contact(0, 15, 0, 45, target) < 1);
        assert.equal(contact(LANES[0], 15, LANES[0], 45, target), Infinity);
        assert.equal(contact(0, 0, 0, 8, target), Infinity);
    }
});

test('impact slows the car without deducting time or forcing an early failure', () => {
    const game = isolated();
    game.start();
    game.distance = 100; game.speed = 60; game.objects.push(fixture('barrier', 103.4), fixture('car', 103.8));
    step(game, .15, { nitro: true });
    assert.equal(game.hits, 1);
    assert.ok(game.speed < 20);
    assert.equal(game.mode, 'running');
    assert.ok(Math.abs(game.timeLeft - (game.level.limit - .15)) < 1e-9);
    assert.equal(game.passes, 0);
});

test('only complete non-colliding overtakes reward nitro once; road cells cap charge at one', () => {
    const game = isolated();
    game.start(); game.speed = 48;
    game.objects.push(fixture('car', 12, 4.2, 12), fixture('cell', 39));
    step(game, .34, {});
    assert.equal(game.passes, 0);
    step(game, .23, {});
    assert.equal(game.passes, 1);
    assert.ok(game.nitro > .5);
    game.nitro = .92;
    step(game, .6, {});
    assert.equal(game.nitro, 1);
    assert.equal(game.drain().filter(e => e.type === 'pass').length, 1);
    assert.equal(game.passes, 1);
});

test('traffic indicators precede a continuous lane change and seeded traffic is repeatable', () => {
    const game = isolated(6);
    const obj = { ...fixture('truck', 25, LANES[0], 23), lane: 0, change: { delay: 2, lane: 1 } };
    game.moveObject(obj, 1.2);
    assert.equal(obj.signal, 1);
    assert.equal(obj.x, LANES[0]);
    game.moveObject(obj, 1.4);
    assert.ok(obj.x > LANES[0] && obj.x < LANES[1]);
    game.moveObject(obj, 1);
    assert.equal(obj.signal, 0);
    assert.equal(obj.x, LANES[1]);
    assert.deepEqual(new Game(6).objects, new Game(6).objects);
});

test('road shape is continuous and tunnel lamps are tied to distance traveled', () => {
    for (const route of levels) {
        for (const [entry, exit] of route.tunnels) {
            assert.equal(tunnelAt(route, entry - .1), false);
            assert.equal(tunnelAt(route, entry), true);
            assert.equal(tunnelAt(route, exit + .1), false);
            const a = roadAt(route, entry - .1), b = roadAt(route, entry + .1);
            assert.ok(Math.abs(a.x - b.x) < 2);
        }
    }
    const fast = isolated(9), slow = isolated(9);
    for (const game of [fast, slow]) { game.start(); game.distance = game.level.tunnels[0][0]; game.speed = 49; }
    step(fast, .95, { nitro: true });
    step(slow, .95, { brake: true });
    assert.ok(fast.inTunnel && slow.inTunnel);
    assert.ok(Math.floor(fast.distance / 15) > Math.floor(slow.distance / 15));
});

test('saved records preserve top results, gate selection and recover from blocked storage', () => {
    const mem = new Map(), storage = { getItem: k => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
    const create = AuroraStorage.create, store = create(() => storage);
    assert.equal(store.select(2), false);
    assert.equal(store.finish(2, 70000, 800, 12), false);
    assert.ok(store.finish(1, 64000, 980, 11));
    assert.ok(store.finish(1, 66000, 1470, 21));
    assert.ok(store.select(2));
    const loaded = create(() => storage);
    assert.deepEqual(loaded.state.best[1], { ms: 64000, score: 1470, passes: 21 });
    assert.equal(loaded.state.selected, 2);
    const denied = create(() => { throw new Error('denied'); });
    assert.ok(denied.finish(1, 69000, 700, 10));
    assert.equal(denied.state.unlocked, 2);
    assert.equal(denied.unavailable, true);
});

test('two simultaneous touch sources steer and accelerate; cancel and clear release only intended holds', () => {
    function button(action) { const el = new EventTarget(); el.dataset = { drive: action }; return el; }
    const buttons = ['left', 'right', 'brake', 'nitro'].map(button), root = new EventTarget();
    const input = AuroraInput.create({ buttons, root, enabled: () => true, wake() {} });
    function send(target, type, props) {
        target.dispatchEvent(Object.assign(new Event(type, { cancelable: true }), props));
    }
    send(buttons[0], 'pointerdown', { pointerId: 1, button: 0 });
    send(buttons[3], 'pointerdown', { pointerId: 2, button: 0 });
    assert.deepEqual(input.value(), { steer: -1, brake: false, nitro: true });
    send(buttons[0], 'pointercancel', { pointerId: 1 });
    assert.deepEqual(input.value(), { steer: 0, brake: false, nitro: true });
    send(root, 'keydown', { key: 'd', code: 'KeyD' });
    assert.equal(input.value().steer, 1);
    input.clear();
    assert.deepEqual(input.value(), { steer: 0, brake: false, nitro: false });
});

test('three distinct eight-bar tunes and the final arrangement use the shared score interface', () => {
    const music = [1, 4, 7].map(id => AuroraScore.profile(id));
    assert.equal(new Set(music.map(score => score.bpm)).size, 3);
    for (const score of music) {
        const notes = Array.from({ length: 128 }, (_, i) => AuroraScore.notesForStep(score, i)).flat();
        assert.equal(notes.filter(note => note.voice === 'lead').length, 48);
        assert.ok(notes.every(note => Number.isFinite(note.note)));
    }
    assert.ok(AuroraScore.profile(9, 'final').intensity > music[2].intensity);
});
