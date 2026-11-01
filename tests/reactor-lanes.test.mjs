import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { Game, STEP, BALL_R, H, closest } = require('../reactor/engine.js');
function fixture(start) {
    const g = new Game().start(); g.balls = []; g._saveUntil = 0; g.takeEvents();
    const ball = g._ball(...start), contacts = [];
    const segment = g._segment;
    g._segment = function(b, s, surface) {
        if (surface && b === ball) {
            const p = closest(b.x, b.y, s.ax, s.ay, s.bx, s.by);
            if (Math.hypot(b.x - p.x, b.y - p.y) < BALL_R + s.r) contacts.push({ side: surface.side, time: this.time });
        }
        return segment.call(this, b, s, surface);
    };
    return { g, ball, contacts };
}
function run(f, seconds, input = () => ({})) {
    for (let i = 0; i < seconds / STEP && f.g.balls.includes(f.ball); i++) f.g.update(STEP, input(i));
}

test('both reported slingshot pockets feed their inlane flippers instead of trapping a ball', () => {
    for (const [start, side] of [
        [[82, 650, 0, 100], 'left'], [[84, 695, 0, 0], 'left'], [[80, 695, 0, 0], 'left'],
        [[496, 650, 0, 100], 'right'], [[494, 695, 0, 0], 'right'],
    ]) {
        const f = fixture(start); run(f, 5);
        assert.ok(f.contacts.some(c => c.side === side && c.time < 1.1), `${start}: ${side} inlane missed its flipper`);
        assert.ok(!f.g.balls.includes(f.ball), `${start}: trapped at ${f.ball.x},${f.ball.y}`);
        assert.equal(f.g.ballsRemaining, 2);
    }
});
test('the left outlane drains without any flipper contact across 756 speed and control combinations', () => {
    const positions = [[43, 610], [45, 610], [46.5, 610], [45, 700], [47, 700], [49, 700], [46.5, 717], [48, 717], [49.5, 717]];
    const controls = [() => ({}), () => ({ left: true }), i => ({ left: i % 12 < 6 })];
    for (const [x, y] of positions) for (const vx of [-1900, -600, -200, 0, 200, 600, 1900]) for (const vy of [0, 100, 600, 1900]) for (const input of controls) {
        const f = fixture([x, y, vx, vy]); run(f, 2, input);
        const label = `${x},${y},${vx},${vy}`;
        assert.ok(!f.g.balls.includes(f.ball), `${label}: did not drain`);
        assert.ok(f.ball.y > H + 25, `${label}: must drain naturally through the bottom`);
        assert.equal(f.contacts.length, 0, `${label}: outlane touched a flipper`);
        assert.equal(f.g.ballsRemaining, 2);
        assert.equal(f.g.events.filter(e => e.type === 'drain').length, 1);
    }
});
test('guide joins have no low-speed pocket around either resting flipper pivot', () => {
    for (const x of [151, 158, 164, 170, 173.75, 176, 177, 180, 190, 200, 375, 385, 395, 400, 401, 402, 407, 414, 420, 428]) {
        for (const y of [770, 778, 785, 786.26, 790, 799, 805, 814, 825, 840]) for (const vx of [-10, 0, 10]) {
            const f = fixture([x, y, vx, 0]); run(f, 8);
            assert.ok(!f.g.balls.includes(f.ball), `${x},${y},${vx}: resting pivot trapped ball at ${f.ball.x},${f.ball.y}`);
        }
    }
});
test('the right corner stays clear beside the protected shooter boundary', () => {
    for (const x of [494, 496, 498, 500, 504, 508, 512.9, 513]) for (const y of [610, 650, 685, 695, 704, 710, 720, 735]) for (const vx of [-10, 0, 10]) {
        const f = fixture([x, y, vx, 100]); run(f, 10);
        assert.ok(!f.g.balls.includes(f.ball), `${x},${y},${vx}: corner trapped ball`);
        assert.ok(f.ball.x <= 513.001, 'the shooter one-way boundary remains intact');
    }
});
test('a deliberate raised-flipper cradle releases when the player lets go', () => {
    const f = fixture([82, 650, 0, 100]); run(f, 3, () => ({ left: true }));
    run(f, 5); assert.ok(!f.g.balls.includes(f.ball));
});
test('nudge releases an exact balance on the rounded separator tip', () => {
    const f = fixture([59, 550, 0, 100]); run(f, 5);
    assert.ok(Math.abs(f.ball.x - 59) < .01 && Math.abs(f.ball.y - 560) < 1);
    assert.equal(f.g.nudge(), true); run(f, 1);
    assert.ok(Math.abs(f.ball.x - 59) > 20); assert.ok(f.ball.y > 600);
});
