import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { Game, STEP, NUDGE, MAX_SPEED, CORE, RAILS } = require('../reactor/engine.js');
const advance = (g, seconds, input = {}) => { for (let i = 0; i < Math.round(seconds / STEP); i++) g.update(STEP, input); };
const bare = () => { const g = new Game().start(); g.balls = []; g._saveUntil = 0; g.takeEvents(); return g; };
function tilt(g) {
    const ball = g.balls.find(b => !b.staged);
    for (let i = 0; i < 3; i++) {
        if (i) advance(g, NUDGE.cooldown);
        Object.assign(ball, { x: 291, y: 120, vx: 0, vy: 0 });
        assert.equal(g.nudge(), i < 2);
    }
    assert.ok(g.tilted); return ball;
}

test('nudge is available only for active field balls while running', () => {
    const g = new Game(); assert.equal(g.nudge(), false); g.start(); assert.equal(g.canNudge, false);
    assert.equal(g.nudge(), false); assert.equal(g.nudgeHeat, 0);
    g.launch(1); advance(g, .1); assert.equal(g.canNudge, false, 'a shot still in its chute is not nudged');
    advance(g, .9); assert.equal(g.canNudge, true);
    g.pause(); assert.equal(g.nudge(), false); g.resume(); assert.equal(g.nudge(), true);
});
test('nudge gives a bounded inward/upward impulse to all eligible balls without points or position teleportation', () => {
    const g = bare(), left = g._ball(100, 500, 10, 300), right = g._ball(480, 500, -10, 300), middle = g._ball(291, 100, 0, 170);
    assert.equal(g.nudge(), true);
    assert.deepEqual([left.x, left.y, left.vx, left.vy], [100, 500, 115, 130]);
    assert.deepEqual([right.x, right.y, right.vx, right.vy], [480, 500, -115, 130]);
    assert.deepEqual([middle.vx, middle.vy], [0, 0]);
    assert.equal(g.score, 0); assert.equal(g.energy, 0); assert.equal(g.ballsRemaining, 3);
    assert.equal(g.events.filter(e => e.type === 'nudge').length, 1);
    const fast = bare(), b = fast._ball(200, 150, MAX_SPEED, -MAX_SPEED); fast.nudge();
    assert.ok(Math.hypot(b.vx, b.vy) <= MAX_SPEED + .001);
});
test('staged and still-outgoing balls are unaffected by another ball being nudged', () => {
    const g = bare(); g._ball(200, 150);
    const staged = g._ball(552, 828, 0, 0, true), outgoing = g._ball(552, 400, 0, -1300); outgoing.inField = false;
    const before = [JSON.stringify(staged), JSON.stringify(outgoing)]; g.nudge();
    assert.deepEqual([JSON.stringify(staged), JSON.stringify(outgoing)], before);
});
test('cooldown rejects spam without adding heat, then expires on fixed simulated time', () => {
    const g = bare(); g._ball(291, 120); assert.equal(g.nudge(), true);
    for (let i = 0; i < 100; i++) assert.equal(g.nudge(), false);
    assert.equal(g.nudgeHeat, 1); assert.equal(g.nudgeCooldown, NUDGE.cooldown);
    advance(g, NUDGE.cooldown - STEP); assert.equal(g.nudge(), false);
    g.update(STEP); assert.equal(g.nudge(), true); assert.ok(g.nudgeHeat < 2);
});
test('pause freezes heat and cooldown; a deliberate wait cools the table', () => {
    const g = bare(); g._ball(291, 120); g.nudge(); advance(g, .2); g.pause();
    const before = [g.nudgeHeat, g.nudgeCooldown]; advance(g, 5);
    assert.deepEqual([g.nudgeHeat, g.nudgeCooldown], before);
    g.resume(); advance(g, .8); assert.ok(g.nudgeHeat < before[0]); assert.equal(g.nudgeCooldown, 0);
});
test('three rapid nudges tilt once and disable powered mechanisms without creating another kick', () => {
    const g = bare(); g._ball(291, 120); g._saveUntil = 20;
    const ball = tilt(g), score = g.score, progress = g.missionProgress, energy = g.energy;
    assert.deepEqual([ball.vx, ball.vy], [0, 0], 'tilt attempt does not apply the rescue impulse');
    assert.equal(g.ballSave, 0); assert.equal(g.canNudge, false); assert.equal(g.nudge(), false);
    assert.equal(g.events.filter(e => e.type === 'tilt').length, 1);
    assert.equal(g._award(500, 200, 200, 'test'), 0); g._charge(100); g._mission('bumper', 0);
    assert.equal(g.score, score); assert.equal(g.energy, energy); assert.equal(g.missionProgress, progress);
    Object.assign(ball, { x: RAILS[0].x, y: RAILS[0].y, vx: 0, vy: 100 }); g._rail(ball, RAILS[0], 0);
    assert.equal(ball.vy, 100); assert.equal(g.railHits[0], 0);
    Object.assign(ball, { x: CORE.x, y: CORE.y - CORE.r - 8, vx: 0, vy: 0 }); g._bumper(ball, CORE, 0, true);
    assert.equal(ball.vy, 0); assert.equal(g.score, score);
    advance(g, .2, { left: true, right: true });
    assert.ok(g.flippers.every(f => f.angle === f.rest && !f.rising));
});
test('tilt lasts through multiball until the final drain, then the new reserve is normal', () => {
    const g = bare(); g._ball(291, 120); tilt(g); g._ball(210, 100); g._ball(350, 100);
    g.balls[0].y = 980; g.update(STEP); assert.equal(g.balls.length, 2); assert.ok(g.tilted); assert.equal(g.ballsRemaining, 3);
    g.balls.forEach(b => { b.y = 980; }); g.update(STEP);
    assert.equal(g.ballsRemaining, 2); assert.ok(g.staged); assert.equal(g.tilted, false); assert.equal(g.nudgeHeat, 0);
    assert.equal(g.launch(1), true); advance(g, 1); assert.equal(g.canNudge, true);
});
test('restart and save reset nudge state; held flippers recover only after tilt has cleared', () => {
    const g = bare(); g._ball(291, 120); tilt(g); g.restart();
    assert.equal(g.tilted, false); assert.equal(g.nudgeHeat, 0); assert.equal(g.nudgeCooldown, 0); assert.ok(g.staged);
    g.launch(); advance(g, 1); g.nudge(); g.balls.forEach(b => { b.y = 980; }); g.update(STEP);
    assert.ok(g.staged); assert.equal(g.ballsRemaining, 3); assert.equal(g.nudgeHeat, 0);
    advance(g, .2, { left: true }); assert.equal(g.flippers[0].angle, g.flippers[0].active);
});
test('a tilted ball balanced on a bumper is collected after ten simulated seconds, with pause frozen', () => {
    const g = bare(); g._ball(291, 120); const ball = tilt(g);
    Object.assign(ball, { x: 291, y: 350, vx: 0, vy: 0 });
    advance(g, 9); assert.ok(g.balls.includes(ball)); assert.ok(g.tiltRemaining > .99 && g.tiltRemaining < 1.01);
    g.pause(); const remaining = g.tiltRemaining; advance(g, 30); assert.equal(g.tiltRemaining, remaining);
    g.resume(); advance(g, 1.1);
    assert.ok(!g.balls.includes(ball)); assert.equal(g.ballsRemaining, 2); assert.ok(g.staged);
    assert.equal(g.events.filter(e => e.type === 'drain').length, 1); assert.equal(g.tiltRemaining, 0);
    const next = g.staged; g.launch(1); advance(g, .5);
    assert.ok(g.balls.includes(next)); assert.equal(g.ballsRemaining, 2, 'the expired deadline cannot take the next ball');
});
test('tilt timeout collects all remaining multiball balls through one reserve-accounting path', () => {
    for (const lastReserve of [false, true]) {
        const g = bare(); g._ball(291, 120); const ball = tilt(g);
        Object.assign(ball, { x: 291, y: 350, vx: 0, vy: 0 });
        g._ball(212, 180, 0, 0); g._ball(371, 180, 0, 0); if (lastReserve) g.ballsRemaining = 1;
        advance(g, NUDGE.tiltDrainAfter + .1);
        assert.equal(g.events.filter(e => e.type === 'drain').length, 3);
        assert.equal(g.ballsRemaining, lastReserve ? 0 : 2);
        assert.equal(g.state, lastReserve ? 'over' : 'running');
        assert.equal(g.events.filter(e => e.type === 'gameover').length, lastReserve ? 1 : 0);
        advance(g, 12); assert.equal(g.events.filter(e => e.type === 'drain').length, 3);
    }
});
test('tilt timeout includes outgoing balls but preserves an independently staged ball', () => {
    const g = bare(); g._ball(291, 120); const ball = tilt(g);
    Object.assign(ball, { x: 552, y: 828, vx: 0, vy: 0, inField: false });
    const staged = g._ball(552, 828, 0, 0, true);
    advance(g, NUDGE.tiltDrainAfter + .1, { plunger: true });
    assert.deepEqual(g.balls, [staged]); assert.equal(g.ballsRemaining, 3); assert.equal(g.tilted, false);
    assert.equal(g.launch(1), true); assert.equal(staged.staged, false);
});
