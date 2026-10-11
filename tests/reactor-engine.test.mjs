import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { Game, STEP, BALL_R, MAX_SPEED, BUMPERS, CORE, WALLS, flipperEnd } = require('../reactor/engine.js');
const advance = (g, seconds, input = {}) => { for (let i = 0; i < Math.round(seconds / STEP); i++) g.update(STEP, typeof input === 'function' ? input(i) : input); };
const bare = () => { const g = new Game().start(); g.balls = []; g._saveUntil = 0; g.takeEvents(); return g; };
const summary = g => JSON.stringify({ time: g.time, balls: g.balls, score: g.score, energy: g.energy, mission: g.missionIndex, events: g.events, flippers: g.flippers });

test('ready state is inert and start serves exactly one ball with three lives', () => {
    const g = new Game(); g.update(1); assert.equal(g.time, 0); assert.equal(g.state, 'ready');
    assert.equal(g.balls.length, 1); assert.ok(g.staged); assert.equal(g.ballsRemaining, 3);
    g.start(); advance(g, 2); assert.equal(g.staged.y, 828); assert.equal(g.score, 0); assert.equal(g.ballSave, 0);
});
test('plunger charge builds while held and releases with strength-dependent speed', () => {
    const a = new Game().start(), b = new Game().start(); a.launch(0); b.launch(1);
    assert.ok(b.balls[0].vy < a.balls[0].vy); assert.equal(b.ballSave, 9); assert.equal(b.launch(), false);
    const c = new Game().start(); advance(c, .5, { plunger: true }); assert.ok(c.plungerCharge > .45 && c.plungerCharge < .5);
    c.update(STEP, {}); assert.equal(c.staged, undefined); assert.ok(c.balls[0].vy < -1400);
    const paused = new Game(); assert.equal(paused.launch(1), false);
});
test('all launch strengths enter the playfield through the actual shooter-lane geometry', () => {
    for (const strength of [0, .5, 1]) {
        const g = new Game().start(); g.launch(strength); let entered = false;
        for (let i = 0; i < 300; i++) { g.update(STEP); entered ||= g.balls.some(b => b.inField && b.x < 510); }
        assert.ok(entered, `strength ${strength}`); assert.ok(g.balls.every(b => b.x > 15 && b.x < 580));
    }
});
test('every launch strength clears the outlet and never returns to the shooter lane', () => {
    for (let percent = 0; percent <= 100; percent++) {
        const g = new Game().start(); g.launch(percent / 100); const ball = g.balls[0]; let entered = false;
        for (let i = 0; i < 1440 && g.balls.includes(ball); i++) {
            g.update(STEP); entered ||= ball.inField;
            if (entered && ball.y >= 22 && ball.y <= 897) assert.ok(ball.x <= 513.001, `strength ${percent}% returned at ${g.time}: (${ball.x}, ${ball.y})`);
        }
        assert.ok(entered, `strength ${percent}% never cleared the outlet`);
    }
});
test('field balls cannot enter any part of the outlet, including its ceiling and divider join', () => {
    for (const y of [48.02, 67, 80, 100, 145, 149, 162, 213.99, 220, 225, 232, 400, 875]) {
        for (const vx of [100, MAX_SPEED, MAX_SPEED * 30]) {
            const g = bare(), ball = g._ball(500, y, vx, 0); ball.inField = true;
            for (let i = 0; i < 60; i++) {
                g.update(STEP);
                assert.ok(ball.x <= 513.001, `outlet y=${y}, vx=${vx}, x=${ball.x}`);
                for (const value of [ball.x, ball.y, ball.vx, ball.vy]) assert.ok(Number.isFinite(value));
            }
        }
    }
    const g = bare(), ball = g._ball(512.99, 145, MAX_SPEED, 0); g.update(STEP);
    assert.ok(ball.vx < 0, 'an incoming shot reflects off the gate');
});
test('high-speed outgoing balls cross the outlet without receiving a gate impulse', () => {
    for (const y of [100, 145, 200]) {
        const g = bare(), ball = g._ball(530, y, -MAX_SPEED, 0); ball.inField = false;
        g.update(STEP); g.update(STEP);
        assert.ok(ball.inField); assert.ok(ball.x < 513); assert.ok(ball.vx < -1800);
        assert.ok(ball.vy > 0 && ball.vy < 14, 'outgoing velocity changed only with normal gravity');
        assert.equal(g.score, 0); assert.ok(!g.events.some(e => e.type === 'wall'));
    }
});
test('outlet corner rebounds and glancing shots remain on the field side', () => {
    for (const [x, y, vx, vy] of [[505, 52, 900, -1500], [510, 74, 800, -1700], [512.999, 145, 1, -1900], [513, 220, 1900, -5], [506, 227, 1300, -1300]]) {
        const g = bare(), ball = g._ball(x, y, vx, vy); ball.inField = true;
        for (let i = 0; i < 300; i++) { g.update(STEP); if (ball.y <= 897) assert.ok(ball.x <= 513.001, `corner shot crossed at (${ball.x}, ${ball.y})`); }
    }
});
test('overload balls are protected immediately while an independent staged ball can still launch', () => {
    const g = new Game().start(); const staged = g.staged; g._charge(100);
    const active = g.balls.filter(b => !b.staged); assert.equal(active.length, 2);
    assert.ok(active.every(b => b.inField)); assert.equal(staged.inField, false);
    active.forEach((b, i) => { b.x = 500; b.y = 110 + i * 25; b.vx = MAX_SPEED; b.vy = 0; });
    assert.ok(g.launch(.25)); assert.equal(staged.inField, false);
    for (let i = 0; i < 180; i++) { g.update(STEP); for (const b of g.balls) if (b.inField && b.y <= 897) assert.ok(b.x <= 513.001); }
    assert.ok(staged.inField, 'the staged ball cleared its own open exit during multiball');
});
test('ball-ball separation at the outlet cannot push a field ball across the one-way boundary', () => {
    const g = bare(), a = g._ball(512.8, 145), b = g._ball(496, 145, MAX_SPEED);
    a.inField = b.inField = true;
    for (let i = 0; i < 30; i++) { g.update(STEP); assert.ok(a.x <= 513.001); assert.ok(b.x <= 513.001); }
});
test('save, next reserve and restart each give the new ball its own open launch exit', () => {
    const g = new Game().start();
    for (const mode of ['save', 'reserve', 'restart']) {
        g.launch(.25); advance(g, 1); assert.ok(g.balls[0].inField);
        if (mode === 'restart') g.restart();
        else { g._saveUntil = mode === 'save' ? g.time + 1 : 0; g.balls[0].y = 980; g.update(STEP); }
        const ball = g.staged; assert.ok(ball); assert.equal(ball.inField, false);
        assert.ok(g.launch(.75)); advance(g, 1); assert.ok(ball.inField); assert.ok(ball.x <= 513.001);
    }
});
test('120 Hz fixed stepping is identical across 30, 60 and 120 fps partitions', () => {
    const results = [];
    for (const fps of [30, 60, 120]) {
        const g = new Game().start(); g.launch(.7);
        for (let frame = 0; frame < fps * 6; frame++) g.update(1 / fps, { left: true, right: true });
        results.push(summary(g));
    }
    assert.equal(results[0], results[1]); assert.equal(results[1], results[2]);
});
test('invalid elapsed values are ignored and a long stalled frame is capped', () => {
    const g = new Game().start(); const before = summary(g);
    for (const dt of [-1, NaN, Infinity, 0]) g.update(dt); assert.equal(summary(g), before);
    g.update(99); assert.ok(g.time <= .251); assert.ok(g.time > .24);
});
test('fast balls cannot tunnel through a thin vertical rail', () => {
    const g = bare(), b = g._ball(489, 540, MAX_SPEED * 30, 0);
    advance(g, .05); assert.ok(b.x <= 513.1); assert.ok(b.vx < 0); assert.ok(Number.isFinite(b.y));
});
test('maximum-speed horizontal shots hit bumpers instead of tunneling', () => {
    const g = bare(), target = BUMPERS[0], b = g._ball(target.x - 55, target.y, MAX_SPEED, 0);
    advance(g, 2 * STEP); assert.ok(g.events.some(e => e.type === 'bumper' && e.index === 0));
    assert.ok(b.vx < 0); assert.ok(b.x < target.x); assert.ok(g.score >= 175);
});
test('high-speed top impact and angled sling contact stay bounded', () => {
    const g = bare(), b = g._ball(285, 60, 0, -MAX_SPEED); advance(g, .033);
    assert.ok(b.y >= 48 - .1); assert.ok(b.vy > 0);
    const h = bare(), ball = h._ball(155, 664, -1700, 100); advance(h, .06);
    assert.ok(h.events.some(e => e.type === 'sling')); assert.ok(ball.x > 70);
});
test('bumper response uses a cooldown so a contact cannot score every substep', () => {
    const g = bare(), target = BUMPERS[0], b = g._ball(target.x, target.y - target.r - BALL_R + 1, 0, 100);
    g._bumper(b, target, 0); const score = g.score;
    for (let i = 0; i < 20; i++) { b.y = target.y - target.r; g._bumper(b, target, 0); }
    assert.equal(g.score, score); assert.equal(g.events.filter(e => e.type === 'bumper').length, 1);
    g.time += .19; b.y = target.y - target.r; g._bumper(b, target, 0); assert.ok(g.score > score);
});
test('flipper timing produces a stronger shot than holding a raised bat', () => {
    for (const side of ['left', 'right']) {
        const outcomes = {};
        for (const mode of ['rise', 'hold', 'rest']) {
            const g = bare(), f = g.flippers.find(f => f.side === side); if (mode === 'hold') f.angle = f.active;
            const end = flipperEnd(f), b = g._ball(f.x + (end.x - f.x) * .77, f.y + (end.y - f.y) * .77 - 21, 0, 260);
            advance(g, 10 * STEP, { [side]: mode !== 'rest' });
            outcomes[mode] = { vy: b.vy, events: g.events.filter(e => e.type === 'flipper').length };
        }
        assert.ok(outcomes.rise.vy < -900); assert.ok(outcomes.hold.vy > outcomes.rise.vy + 500);
        assert.equal(outcomes.rise.events, 1); assert.equal(outcomes.hold.events, 0); assert.equal(outcomes.rest.events, 0);
    }
});
test('moving flipper tips do not pass through an initially stationary ball', () => {
    for (const side of ['left', 'right']) {
        const g = bare(), f = g.flippers.find(f => f.side === side), p = flipperEnd(f);
        const b = g._ball(f.x + (p.x - f.x) * .9, f.y + (p.y - f.y) * .9 - 18, 0, 0);
        advance(g, .075, { [side]: true }); assert.ok(b.vy < -400); assert.ok(g.events.some(e => e.type === 'flipper'));
        assert.ok(Math.hypot(b.vx, b.vy) <= MAX_SPEED + .1);
    }
});
test('released bats return smoothly and do not create rising-tip impulses', () => {
    const g = bare(), f = g.flippers[0]; f.angle = f.active; const p = flipperEnd(f);
    g._ball(p.x - 20, p.y + 17, 0, 0); advance(g, .15);
    assert.equal(f.angle, f.rest); assert.equal(g.events.filter(e => e.type === 'flipper').length, 0);
});
test('mission one requires all three different bumpers, then rails and core follow in order', () => {
    const g = new Game().start(); g._mission('rail', 0); assert.equal(g.missionProgress, 0);
    g._mission('bumper', 0); g._mission('bumper', 0); assert.equal(g.missionProgress, 1);
    g._mission('bumper', 1); g._mission('bumper', 2); assert.equal(g.missionIndex, 1); assert.equal(g.missions, 1);
    g._mission('core', 0); assert.equal(g.missionProgress, 0);
    g._mission('rail', 0); g._mission('rail', 1); assert.equal(g.missionIndex, 2);
    for (let i = 0; i < 3; i++) g._mission('core', 0);
    assert.equal(g.missionCycle, 1); assert.equal(g.missions, 3); assert.equal(g.missionIndex, 0);
    assert.equal(g.ballsRemaining, 4); assert.deepEqual(g.litBumpers, [false, false, false]); assert.equal(g.energy, 0); assert.equal(g.overload, 22);
});
test('full mission cycles award extra balls up to five, never unlimited reserves', () => {
    const g = new Game().start();
    for (let n = 0; n < 5; n++) { for (let i = 0; i < 3; i++) g._mission('bumper', i); for (let i = 0; i < 2; i++) g._mission('rail', i); for (let i = 0; i < 3; i++) g._mission('core', 0); }
    assert.equal(g.ballsRemaining, 5); assert.equal(g.missions, 15);
});
test('rail traversal scores once per pass cooldown and sends the ball upward', () => {
    const g = bare(), b = g._ball(85, 260, 0, 200); g.update(STEP);
    assert.equal(g.railHits[0], 1); assert.ok(b.vy < -750); assert.equal(g.energy, 18); assert.equal(g.score, 650);
    b.x = 85; b.y = 260; g.update(STEP); assert.equal(g.railHits[0], 1);
});
test('energy threshold starts one three-ball overload and ignores further charge during overload', () => {
    const g = new Game().start(); g.launch(.5); g._charge(99); assert.equal(g.balls.length, 1);
    g._charge(1); assert.equal(g.balls.length, 3); assert.equal(g.overload, 22); assert.equal(g.multiplier, 3); assert.equal(g.energy, 0);
    assert.equal(new Set(g.balls.map(b => b.id)).size, 3); assert.equal(g.overloads, 1);
    g._charge(1000); assert.equal(g.overloads, 1); assert.equal(g.balls.length, 3); assert.ok(g.ballSave >= 8);
});
test('overload scoring grants a 5,400 point core jackpot and expires on simulated time', () => {
    const g = bare(); g._ball(300, 100); g._charge(100); const before = g.score;
    const b = g.balls[0]; b.x = CORE.x; b.y = CORE.y - CORE.r - BALL_R + 1; g._bumper(b, CORE, 0, true);
    assert.equal(g.score - before, 5400);
    g.balls.forEach(b => { b.staged = true; }); advance(g, 22.1);
    assert.equal(g.overload, 0); assert.equal(g.multiplier, 1); assert.ok(g.events.some(e => e.type === 'overloadEnd'));
});
test('two simultaneous drains in multiball consume no reserve while one ball survives', () => {
    const g = bare(); g._ball(280, 980); g._ball(300, 980); g._ball(291, 100, 0, 0); g.update(STEP);
    assert.equal(g.balls.length, 1); assert.equal(g.ballsRemaining, 3);
    g.balls[0].y = 980; g.update(STEP); assert.equal(g.ballsRemaining, 2); assert.ok(g.staged);
    advance(g, 1); assert.equal(g.ballsRemaining, 2);
});
test('ball save returns the last ball without consuming a reserve or extending the timer', () => {
    const g = new Game().start(); g.launch(); g.balls[0].y = 980; g.update(STEP);
    assert.equal(g.ballsRemaining, 3); assert.ok(g.staged); assert.ok(g.events.some(e => e.type === 'save'));
    const until = g._saveUntil; advance(g, .5); g.launch(); assert.equal(g._saveUntil, until);
    g._saveUntil = 0; g.balls[0].y = 980; g.update(STEP); assert.equal(g.ballsRemaining, 2);
});
test('three unprotected final-ball drains end the game exactly once', () => {
    const g = new Game().start();
    for (let i = 0; i < 3; i++) { g.launch(); g._saveUntil = 0; g.balls[0].y = 980; g.update(STEP); }
    assert.equal(g.state, 'over'); assert.equal(g.ballsRemaining, 0); assert.equal(g.balls.length, 0);
    advance(g, 1); assert.equal(g.events.filter(e => e.type === 'gameover').length, 1);
});
test('pause freezes the entire simulation and cancels a charged launch', () => {
    const g = new Game().start(); advance(g, .4, { plunger: true, left: true }); g.pause();
    const before = summary(g); advance(g, 4, { right: true }); assert.equal(summary(g), before); assert.equal(g.plungerCharge, 0);
    g.resume(); g.update(STEP); assert.ok(g.staged); assert.equal(g._plungerHeld, false);
});
test('restart clears all round data, ball identities, missions, overload, and input', () => {
    const g = new Game().start(); g.launch(); g._charge(100); g._mission('bumper', 1); advance(g, .5, { left: true }); g.restart();
    assert.equal(g.state, 'running'); assert.equal(g.score, 0); assert.equal(g.time, 0); assert.equal(g.overload, 0);
    assert.equal(g.ballsRemaining, 3); assert.equal(g.balls.length, 1); assert.equal(g.balls[0].id, 1); assert.ok(g.staged);
    assert.equal(g.missions, 0); assert.equal(g.energy, 0); assert.equal(g.flippers[0].angle, g.flippers[0].rest);
});
test('long deterministic play keeps finite bounded physics and capped event storage', () => {
    const g = new Game().start(); let seed = 31;
    for (let i = 0; i < 14400; i++) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        if (g.state === 'over') g.restart(); if (g.staged) g.launch((seed % 100) / 100);
        g.update(STEP, { left: (i % 37) < 7, right: (i % 43) < 8 });
        for (const b of g.balls) { for (const key of ['x', 'y', 'vx', 'vy']) assert.ok(Number.isFinite(b[key]), key); assert.ok(Math.hypot(b.vx, b.vy) <= MAX_SPEED + .01); }
        assert.ok(g.balls.length <= 3); assert.ok(g.events.length <= 200); assert.ok(g.score >= 0); assert.ok(g.ballsRemaining <= 5);
    }
});
test('table data is immutable and all geometry is non-degenerate', () => {
    assert.ok(Object.isFrozen(WALLS)); assert.ok(Object.isFrozen(BUMPERS));
    for (const s of WALLS) { assert.ok(Math.hypot(s.bx - s.ax, s.by - s.ay) > 0); assert.ok(Object.isFrozen(s)); }
});


test('a completed mission sequence guarantees overload even without incidental collision energy', () => {
    const g = new Game().start();
    for (let i=0;i<3;i++) g._mission('bumper',i);
    for (let i=0;i<2;i++) g._mission('rail',i);
    for (let i=0;i<3;i++) g._mission('core',0);
    assert.equal(g.missionCycle,1); assert.equal(g.overload,22); assert.equal(g.balls.length,3); assert.equal(g.multiplier,3);
});
