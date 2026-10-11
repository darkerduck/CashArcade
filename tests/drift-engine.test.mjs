import test from 'node:test';
import assert from 'node:assert/strict';
import '../drift/engine.js';

const { Game, TRACKS, W, H, SESSION_SECONDS, nearestPoint, pointAt, wrapAngle, clamp } = globalThis.NeonDrift;
const STEP = 1 / 60;
const advance = (game, seconds, input = {}) => {
    for (let i = 0; i < Math.ceil(seconds / STEP); i++) game.update(STEP, typeof input === 'function' ? input(game, i) : input);
};

// This is a virtual driver, not a physics shortcut: it only presses the same
// steer/handbrake controls as the browser. Its recordings are replayed unchanged.
function drive(game, drift = false, backwards = false) {
    const near = nearestPoint(game.car.x, game.car.y, game.track);
    const target = pointAt(near.progress + (backwards ? -75 : 75) / game.track.length, game.track);
    const error = wrapAngle(Math.atan2(target.y - game.car.y, target.x - game.car.x) - game.car.angle);
    return { steer: clamp(error * 2.7, -1, 1), drift };
}
const summary = game => JSON.stringify({ car: game.car, time: game.time, score: game.score,
    laps: game.laps, bestLap: game.bestLap, progress: game.progress, checkpoint: game.checkpoint });

test('three immutable, distinct smooth closed tracks fit the world and expose render metadata', () => {
    assert.equal(TRACKS.length, 3);
    assert.equal(new Set(TRACKS.map(track => track.id)).size, 3);
    assert.equal(new Set(TRACKS.map(track => track.length)).size, 3);
    assert.ok(Object.isFrozen(TRACKS));
    for (const track of TRACKS) {
        assert.ok(track.name && track.zone && /^#[0-9a-f]{6}$/i.test(track.color));
        assert.ok(track.points.length >= 160);
        assert.equal(track.checkpoints.length, 8);
        assert.equal(track.width, 114);
        assert.ok(track.length > 1800 && track.length < 2600);
        for (const p of track.points) {
            assert.ok(p.x > track.width / 2 && p.x < W - track.width / 2);
            assert.ok(p.y > track.width / 2 && p.y < H - track.width / 2);
        }
        const first = track.segments[0], last = track.segments.at(-1);
        assert.ok(Math.abs(wrapAngle(first.angle - last.angle)) < .08, 'smooth start-line tangent');
        assert.ok(Math.hypot(last.x + last.dx - first.x, last.y + last.dy - first.y) < 1e-8);
        assert.equal(pointAt(1, track).x, pointAt(0, track).x);
        assert.ok(Math.abs(pointAt(-.25, track).x - pointAt(.75, track).x) < 1e-8);
    }
});

test('nearestPoint projects centerline samples and returns normalized tangent and normal', () => {
    for (const track of TRACKS) for (let i = 0; i < 40; i++) {
        const expected = pointAt(i / 40, track), actual = nearestPoint(expected.x, expected.y, track);
        assert.ok(actual.distance < 1e-7);
        assert.ok(Math.abs(wrapAngle((actual.progress - expected.progress) * Math.PI * 2)) < 1e-7);
        assert.ok(Math.abs(Math.hypot(actual.nx, actual.ny) - 1) < 1e-10);
        assert.ok(actual.index >= 0 && actual.index < track.points.length);
    }
    assert.equal(nearestPoint(NaN, 0, TRACKS[0]).distance, Infinity);
});

test('ready state is inert, track selection is bounded, and restart resets the race', () => {
    assert.equal(new Game(-10).track, TRACKS[0]);
    assert.equal(new Game(99).track, TRACKS[2]);
    assert.equal(new Game(NaN).track, TRACKS[0]);
    const game = new Game(1);
    assert.equal(game.state, 'ready');
    assert.equal(game.bestLap, null);
    advance(game, 1, { steer: 1, drift: true });
    assert.equal(game.time, 0);
    assert.equal(game.car.speed, 0);
    game.start(); advance(game, 2, drive);
    assert.ok(game.car.speed > 200);
    game.start();
    assert.equal(game.timeLeft, SESSION_SECONDS);
    assert.equal(game.score, 0);
    assert.equal(game.laps, 0);
    assert.equal(game.state, 'running');
    assert.equal(game.car.x, game.track.start.x);
    assert.equal(game.events.length, 1);
});

for (let index = 0; index < TRACKS.length; index++) {
    test(`track ${index + 1}: input-only race completes two valid laps and exact deterministic replay`, () => {
        const game = new Game(index).start(), recording = [];
        let maxDistance = 0;
        while (game.time < 35 && game.laps < 2) {
            const input = drive(game);
            recording.push(input);
            game.update(STEP, input);
            maxDistance = Math.max(maxDistance, nearestPoint(game.car.x, game.car.y, game.track).distance);
        }
        assert.equal(game.laps, 2);
        assert.ok(game.bestLap > 5 && game.bestLap < 15);
        assert.ok(game.lapTime < .1);
        assert.ok(game.score >= 2000);
        assert.ok(maxDistance < game.track.width / 2, `driver stays on road, max ${maxDistance}`);
        const laps = game.events.filter(event => event.type === 'lap');
        assert.equal(laps.length, 2);
        assert.equal(game.bestLap, Math.min(...laps.map(event => event.lapTime)));
        assert.equal(game.events.filter(event => event.type === 'checkpoint').length, 14);
        const replay = new Game(index).start();
        for (const input of recording) replay.update(STEP, input);
        assert.equal(summary(replay), summary(game));
    });
}

test('held handbrake earns drift score and combo, then release spends charge on acceleration once', () => {
    const game = new Game().start();
    advance(game, 6.5, (g, i) => drive(g, i > 48));
    assert.ok(game.charge > .8);
    assert.ok(game.maxCombo >= 2);
    assert.ok(game.score > 100);
    assert.equal(game.offroad, false);
    const driftSpeed = game.car.speed, score = game.score;
    game.update(STEP, drive(game));
    assert.ok(game.boost > .7);
    assert.equal(game.charge, 0);
    assert.ok(game.score > score);
    assert.equal(game.events.filter(event => event.type === 'boost').length, 1);
    advance(game, .5, drive);
    assert.ok(game.car.speed > driftSpeed + 100);
    advance(game, 3, drive);
    assert.equal(game.boost, 0);
    assert.equal(game.events.filter(event => event.type === 'boost').length, 1);
});

test('straight handbrake holds and tiny taps do not farm boost or drift score', () => {
    const game = new Game().start();
    advance(game, .8, { steer: 0, drift: true });
    assert.equal(game.charge, 0);
    assert.equal(game.score, 0);
    game.update(STEP, { steer: .3, drift: true });
    game.update(STEP, { steer: 0, drift: false });
    assert.equal(game.boost, 0);
    assert.equal(game.events.filter(event => event.type === 'boost').length, 0);
});

test('rail contact breaks boost and remains contained under sustained outward input', () => {
    const game = new Game().start();
    advance(game, 30, { steer: 0 });
    assert.ok(nearestPoint(game.car.x, game.car.y, game.track).distance <= game.track.width / 2 - 18.5 + .01);
    assert.ok(Object.values(game.car).every(Number.isFinite));
    assert.equal(game.laps, 0);
    assert.equal(game.offroad, false);
    assert.ok(game.health < 100);
    assert.equal(game.boost, 0);
});

test('reverse driving cannot complete laps on any track', () => {
    for (let index = 0; index < TRACKS.length; index++) {
        const game = new Game(index).start();
        advance(game, 35, g => drive(g, false, true));
        assert.equal(game.laps, 0);
        assert.equal(game.bestLap, null);
        assert.equal(game.events.filter(event => event.type === 'lap').length, 0);
    }
});

test('infield shortcut driving and teleporting across ordered checkpoints never award laps', () => {
    const game = new Game().start();
    let targetProgress = .5;
    advance(game, 40, g => {
        let target = pointAt(targetProgress, g.track);
        if (Math.hypot(g.car.x - target.x, g.car.y - target.y) < 45) {
            targetProgress = targetProgress === .5 ? 0 : .5;
            target = pointAt(targetProgress, g.track);
        }
        return { steer: clamp(wrapAngle(Math.atan2(target.y - g.car.y, target.x - g.car.x) - g.car.angle) * 3, -1, 1) };
    });
    assert.equal(game.laps, 0);
    assert.equal(game.bestLap, null);

    const teleported = new Game().start();
    for (let lap = 0; lap < 3; lap++) for (let gate = 1; gate <= 8; gate++) {
        const point = pointAt(gate / 8 + .002, teleported.track);
        Object.assign(teleported.car, { x: point.x, y: point.y, angle: point.angle });
        advance(teleported, .1);
    }
    assert.equal(teleported.laps, 0);
    assert.equal(teleported.bestLap, null);
});

test('pause freezes time, car and charge; resume and finished states obey lifecycle', () => {
    const game = new Game().start();
    advance(game, 2, drive);
    game.pause();
    const before = JSON.stringify(game);
    advance(game, 1, { steer: 1, drift: true });
    assert.equal(JSON.stringify(game), before);
    game.resume(); game.update(STEP, drive(game));
    assert.ok(game.time > 2);
    assert.equal(game.state, 'running');
});

test('sessions end exactly at 90 seconds, emit finish once, and are inert afterwards', () => {
    const game = new Game().start();
    for (let i = 0; i < 900; i++) game.update(.1, drive(game));
    assert.equal(game.time, 90);
    assert.equal(game.timeLeft, 0);
    assert.equal(game.state, 'finished');
    assert.equal(game.events.filter(event => event.type === 'finish').length, 1);
    const before = summary(game);
    advance(game, 5, { steer: -1, drift: true });
    game.pause().resume();
    assert.equal(summary(game), before);
    assert.equal(game.state, 'finished');
    assert.equal(game.events.filter(event => event.type === 'finish').length, 1);
});

test('malformed delta and input cannot create NaNs; oversized frames are bounded and substepped', () => {
    const game = new Game().start(), before = summary(game);
    for (const dt of [0, -1, NaN, Infinity, -Infinity, '1', null, undefined]) game.update(dt, { steer: 1, drift: true });
    assert.equal(summary(game), before);
    const a = new Game().start(), b = new Game().start();
    a.update(10000, { steer: 2 }); b.update(.1, { steer: 1 });
    assert.equal(summary(a), summary(b));
    assert.ok(a.time <= .1 + 1e-10);
    for (const input of [null, undefined, 1, { steer: NaN }, { steer: Infinity }, { steer: 'left', drift: 'yes' }]) game.update(STEP, input);
    assert.ok(Object.values(game.car).every(Number.isFinite));
    assert.equal(game.charge, 0);
});

test('events are bounded and drain consumes each event exactly once', () => {
    const game = new Game().start();
    for (let i = 0; i < 1000; i++) game.emit('test');
    assert.equal(game.events.length, 128);
    assert.equal(game.drain().length, 128);
    assert.equal(game.events.length, 0);
    assert.equal(game.drain().length, 0);
});
