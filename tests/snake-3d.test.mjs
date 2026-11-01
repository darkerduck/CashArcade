import test from 'node:test';
import assert from 'node:assert/strict';
import { SnakeGame, LEVELS, DIRECTIONS, key, equal, add } from '../snake/engine.mjs';
import { finishLevel, stepInput } from './snake-replay-helper.mjs';

const at = (x, y = 0, z = 1) => ({ x, y, z });
const running = (level = 0) => { const g = new SnakeGame(level); g.start(); return g; };

test('all twelve authored levels are completed by full moving-snake replays without any powers', () => {
    let score = 0; const stats = [];
    for (let index = 0; index < LEVELS.length; index++) {
        const game = new SnakeGame(index, score), { actions, events } = finishLevel(game);
        assert.equal(game.state, index === 11 ? 'won' : 'level-clear', `level ${index + 1}: ${game.reason}`);
        assert.equal(events.filter(e => e.type === 'power').length, 0);
        assert.ok(game.collected >= game.level.quota); assert.ok(equal(game.snake[0], game.level.exit));
        const replay = running(index); replay.score = replay.startScore = score;
        for (const action of actions) { stepInput(replay, action); assert.ok(SnakeGame.valid(replay.snapshot())); }
        assert.deepEqual(replay.snapshot(), game.snapshot());
        stats.push(`${index + 1}:${actions.length} moves/${game.time / 1000}s`); score = game.score;
    }
    assert.equal(score, LEVELS.reduce((n, l) => n + l.quota * 10, 0));
    console.log('12-level deterministic input replay:', stats.join(', '));
});

test('six-axis input rejects immediate reverse and duplicate auto-repeat, with a two-turn buffer', () => {
    const g = running(); assert.equal(g.input('left'), false); assert.equal(g.input('right'), false);
    assert.equal(g.input('rise'), true); assert.equal(g.input('dive'), false);
    assert.equal(g.input('back'), true); assert.equal(g.input('left'), false);
    g.advance(250); assert.deepEqual(g.snake[0], at(3, 1));
    g.advance(250); assert.deepEqual(g.snake[0], at(3, 1, 2));
    for (const name of ['left', 'dive', 'forward', 'right']) stepInput(g, name);
    assert.equal(g.state, 'running'); assert.deepEqual(g.snake[0], at(3));
});

test('six closed outer faces and solid terrain kill; a shield does not prevent wall/self collision', () => {
    for (const [name, position] of [['right', at(9)], ['left', at(0)], ['rise', at(3, 2)], ['dive', at(3)], ['forward', at(3, 0, 0)], ['back', at(3, 0, 9)]]) {
        const g = running(); g.snake[0] = position; g.direction = DIRECTIONS[name]; g.effects.shield = true;
        g.move(); assert.equal(g.state, 'failed'); assert.equal(g.reason, 'wall');
    }
    const g = running(); g.snake = [at(2, 1, 2), at(3, 1, 2), at(3, 1, 3), at(2, 1, 3), at(1, 1, 3)]; g.effects.shield = true;
    g.move(); assert.equal(g.reason, 'self');
    const wall = running(2), p = wall.level.walls[0]; wall.snake[0] = add(p, DIRECTIONS.left); wall.move(); assert.equal(wall.reason, 'wall');
});

test('food and dessert score once, grow one/two segments and never use the old speed progression', () => {
    const g = running(); g.food = at(4); stepInput(g, 'right');
    assert.equal(g.score, 10); assert.equal(g.snake.length, 5); assert.equal(g.collected, 1);
    g.food = at(8); g.dessert = at(5); const e = stepInput(g, 'right');
    assert.equal(g.score, 30); assert.equal(g.snake.length, 6); assert.equal(g.growth, 1);
    assert.equal(e.filter(x => x.type === 'eat' && x.kind === 'dessert').length, 1);
    stepInput(g, 'right'); assert.equal(g.snake.length, 7); assert.equal(g.growth, 0); assert.equal(g.delay(), 250);
});

test('dessert schedules 20/30/40 seconds, early eating does not respawn, and paused time freezes', () => {
    const g = running(1); g.time = 19990; g.advance(10); assert.ok(g.dessert); const p = g.dessert;
    g.eat('dessert', p); g.updateTimers(); assert.equal(g.dessert, null);
    g.time = 39990; g.advance(10); assert.ok(g.dessert); g.pause(); const snapshot = g.snapshot(); g.advance(50000); assert.deepEqual(g.snapshot(), snapshot);
    g.start(); g.time = 49990; g.advance(10); assert.equal(g.dessert, null);
    const fresh = new SnakeGame(1); assert.equal(fresh.time, 0); assert.equal(fresh.dessert, null);
});

test('bombs relocate once at each 30s boundary, avoid all objects and six neighboring next cells', () => {
    const g = running(11);
    for (const time of [30000, 60000, 90000]) {
        const old = g.bombs.map(key); g.time = time; g.updateTimers();
        const excluded = g.safeExclusion(g.peek()).map(key);
        assert.equal(new Set(g.bombs.map(key)).size, 3);
        g.bombs.forEach(p => { assert.ok(!excluded.includes(key(p))); assert.ok(!old.includes(key(p))); assert.ok(!g.snake.some(s => equal(p, s))); });
        const saved = g.bombs.map(key); g.updateTimers(); assert.deepEqual(g.bombs.map(key), saved);
    }
    g.time = 500000; g.drain(); g.updateTimers(); assert.equal(g.drain().filter(e => e.type === 'bomb-shift').length, 1);
    g.bombs = []; g.bombsRetired = true; g.time += 30000; g.updateTimers(); assert.deepEqual(g.bombs, []);
});

test('bomb kills without points; shield absorbs one, gives one second immunity, and does not stack', () => {
    const g = running(2); g.bombs = [at(4)]; stepInput(g, 'right'); assert.equal(g.reason, 'bomb'); assert.equal(g.score, 0);
    const h = running(2); h.bombs = [at(4), at(5)]; h.collectPower('shield', at(3)); h.collectPower('shield', at(3));
    let e = stepInput(h, 'right'); assert.equal(h.effects.shield, false); assert.equal(e.filter(e => e.type === 'shield-hit').length, 1);
    e = stepInput(h, 'right'); assert.equal(h.state, 'running'); assert.equal(e.filter(e => e.type === 'shield-hit').length, 0);
    assert.equal(h.bombs.length, 0);
});

test('power timing, refresh, shrink minimum, magnetic line of sight and EMP suppression', () => {
    const g = running(8); g.time = 5000; g.updateTimers(); assert.equal(g.power.kind, 'emp');
    g.time = 15000; g.updateTimers(); assert.equal(g.power, null); g.time = 25000; g.updateTimers(); assert.ok(g.power);
    g.collectPower('slow', g.snake[0]); assert.equal(g.delay(), g.level.delay / .65);
    g.time += 1000; g.collectPower('slow', g.snake[0]); assert.equal(g.effects.slow, 34000);
    g.snake = Array.from({ length: 9 }, (_, x) => at(x, 0, 0)); g.collectPower('shrink', g.snake[0]); assert.equal(g.snake.length, 5);
    g.collectPower('shrink', g.snake[0]); assert.equal(g.snake.length, 4);
    g.collectPower('emp', g.snake[0]); assert.deepEqual(g.bombs, []); assert.ok(g.gates.every(x => !x.active));
    g.time = 40000; g.updateTimers(); assert.deepEqual(g.bombs, []);
    const m = running(); m.food = at(6); m.collectPower('magnet', m.snake[0]);
    const e = stepInput(m, 'right'); assert.equal(m.score, 10); assert.equal(e.filter(x => x.type === 'eat' && x.magnetic).length, 1);
    const blocked = running(); blocked.food = at(6); blocked.walls.add(key(at(5))); blocked.collectPower('magnet', at(3)); stepInput(blocked, 'right'); assert.equal(blocked.score, 0);
    const high = running(); high.food = at(4, 1); high.collectPower('magnet', at(3)); stepInput(high, 'right'); assert.equal(high.score, 0);
});

test('laser warns before activation, defers under snake, and stops during EMP', () => {
    const g = running(7), p = g.level.gates[0].cells[0];
    g.time = 2990; g.updateTimers(); assert.equal(g.gates[0].warning, false);
    g.time = 3000; g.updateTimers(); assert.equal(g.gates[0].warning, true);
    g.snake[3] = p; g.time = 4000; g.updateTimers(); assert.equal(g.gates[0].active, false);
    g.snake[3] = at(0); g.updateTimers(); assert.equal(g.gates[0].active, true);
    g.collectPower('emp', at(3)); g.updateTimers(); assert.equal(g.gates[0].active, false);
});

test('active laser collision is lethal unless shielded, and effect deadlines freeze while paused', () => {
    const make = () => {
        const g = running(7), p = g.level.gates[0].cells[0];
        g.snake = [1, 2, 3, 4].map(n => ({ ...p, x: p.x - n }));
        g.gates[0].active = true; return g;
    };
    const hit = make(); hit.move(); assert.equal(hit.state, 'failed'); assert.equal(hit.reason, 'laser');
    const safe = make(); safe.effects.shield = true; safe.move();
    assert.equal(safe.state, 'running'); assert.equal(safe.effects.shield, false);
    assert.equal(safe.drain().filter(e => e.type === 'shield-hit').length, 1);
    const clock = running(5); clock.collectPower('slow', clock.snake[0]); clock.collectPower('magnet', clock.snake[0]);
    clock.pause(); const frozen = clock.snapshot(); clock.advance(90000); assert.deepEqual(clock.snapshot(), frozen);
    clock.time = 8000; assert.equal(clock.delay(), clock.level.delay);
    clock.time = 10000; clock.food = at(6); clock.start(); stepInput(clock, 'right'); assert.equal(clock.score, 0);
});

test('portal preserves direction, transports once per step, and tests exit against the body', () => {
    const g = running(6), { a, b } = g.level.portals[0];
    g.snake = [1, 2, 3, 4].map(n => ({ ...a, x: a.x - n })); // Isolated portal collision fixture.
    const previous = structuredClone(g.snake); g.move();
    assert.deepEqual(g.snake[0], b); assert.deepEqual(g.snake[1], previous[0]); assert.deepEqual(g.direction, DIRECTIONS.right);
    assert.equal(g.drain().filter(e => e.type === 'portal').length, 1);
    const blocked = running(6); blocked.snake = [{ ...a, x: a.x - 1 }, b, at(1, 1), at(0, 1)]; blocked.move(); assert.equal(blocked.reason, 'self');
});

test('snapshot resumes the exact round paused without score/reset/side-effect replay', () => {
    const g = running(5); stepInput(g, 'right'); g.advance(37); g.input('rise');
    const snapshot = g.snapshot(), h = SnakeGame.restore(snapshot);
    assert.equal(h.state, 'paused'); assert.deepEqual(h.drain(), []); assert.deepEqual(h.snake, g.snake);
    h.start(); assert.deepEqual(h.snapshot(), snapshot);
    h.advance(400); g.advance(400); assert.deepEqual(h.snapshot(), g.snapshot());
    assert.equal(SnakeGame.valid({ ...snapshot, snake: [{ x: -1, y: 0, z: 0 }] }), false);
});
