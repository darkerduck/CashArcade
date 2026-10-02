import test from 'node:test';
import assert from 'node:assert/strict';
import { Tutorial, TUTORIAL_KEY, LESSONS, shouldOfferTutorial, canEnterTutorial } from '../snake/tutorial.mjs';
import { SnakeGame, LEVELS, equal } from '../snake/engine.mjs';
import { Campaign, CampaignStore, freshRecord, validRecord, SAVE_KEY, PAID_KEY, BEST_KEY, PUBLISHABLE_KEY } from '../snake/storage.mjs';
import { playEvents } from '../snake/audio-events.mjs';

function storage() {
    const data = new Map();
    return { data, writes: [], fail: false, getItem(k) { if (this.fail) throw Error('blocked'); return data.get(k) ?? null; },
        setItem(k, v) { if (this.fail) throw Error('blocked'); this.writes.push(k); data.set(k, v); }, removeItem: k => data.delete(k) };
}
function playLesson(t) {
    const lesson = t.current, index = t.lesson;
    if (lesson.kind === 'reverse') { assert.equal(t.input('dive'), true); assert.equal(t.lesson, index + 1); return; }
    if (lesson.kind === 'observe') {
        assert.equal(t.startObservation(), true); assert.equal(t.resumeObservation(), false);
        t.observe([8, 12, 10]); assert.equal(t.observe([9, 12, 10]), true); assert.equal(t.resumeObservation(), true); return;
    }
    assert.equal(t.input(lesson.direction), true); assert.equal(t.begin(), true);
    const before = t.game.steps; const route = [];
    for (let n = 0; n < 1000 && t.lesson === index; n++) {
        t.advance(10);
        if (route.at(-1)?.steps !== t.game.steps) route.push({ steps: t.game.steps, head: { ...t.game.snake[0] } });
        assert.notEqual(t.game.state, 'failed', `lesson ${index}: ${t.game.reason}`);
    }
    assert.equal(t.lesson, index + 1); assert.ok(route.length > 0); assert.ok(index === LESSONS.length - 1 || t.game.steps > before);
    return route;
}

test('all guided goals complete through real six-axis moves, rejected reversal, changed camera and exit', () => {
    const local = storage(), t = new Tutorial(local), sounds = [];
    assert.equal(t.game.mode, 'tutorial'); assert.equal(t.game.delay(), 400); assert.equal(LEVELS.length, 12);
    assert.deepEqual([t.game.level.width, t.game.level.depth, t.game.level.height], [10, 10, 3]);
    const paths = [];
    while (!t.completed) {
        const index = t.lesson, route = playLesson(t); if (route) paths.push({ index, route });
        playEvents(t.drain(), { play: n => sounds.push(n) }, { duck() {}, pause() {} });
        assert.equal(t.game.state, 'ready');
    }
    assert.equal(t.lesson, LESSONS.length); assert.equal(sounds.filter(n => n === 'food').length, 10);
    assert.equal(t.game.tutorialPractice, true); assert.equal(t.game.snake.length, 4);
    assert.equal(t.game.exitOpen(), false); assert.equal(t.game.state, 'ready');
    assert.ok(paths.some(p => p.route.some(s => s.head.y === 2)));
    assert.equal(t.begin(), true); t.advance(1200); assert.equal(t.game.score, 10); assert.ok(t.game.food);
    assert.deepEqual([...new Set(local.writes)], [TUTORIAL_KEY]);
});

test('checkpoint stops exactly on each target, rejects skipping and needs a real camera change', () => {
    const t = new Tutorial(storage()); assert.equal(t.input('rise'), false); assert.equal(t.lesson, 0);
    t.begin(); t.advance(10000); assert.equal(t.lesson, 1); assert.ok(equal(t.game.snake[0], LESSONS[0].target));
    assert.equal(t.game.time, 1200); assert.equal(t.game.state, 'ready');
    while (t.current.kind !== 'observe') playLesson(t);
    assert.equal(t.prepareStart(), false); t.startObservation(); t.observe([0, 1, 2]);
    t.observe([0, 1, 2]); assert.equal(t.resumeObservation(), false);
    assert.equal(t.observe([0, 1, 2.2]), true); assert.equal(t.resumeObservation(), true);
});

test('free practice still dies on a real wall, remains practice after retry, and never spawns advanced hazards', () => {
    const t = new Tutorial(storage()); while (!t.completed) playLesson(t);
    t.begin(); t.advance(10000); assert.equal(t.game.state, 'failed'); assert.equal(t.game.reason, 'wall');
    assert.equal(t.game.time, 2800); assert.equal(t.lesson, LESSONS.length); assert.equal(t.game.dessert, null);
    assert.equal(t.game.power, null); assert.deepEqual(t.game.bombs, []); t.retry();
    assert.equal(t.game.state, 'ready'); assert.equal(t.game.tutorialPractice, true); assert.equal(t.game.score, 0);
});

test('death/retry preserves completed goals; R-style repeat and reloading never restart the whole tutorial', () => {
    const local = storage(), t = new Tutorial(local); playLesson(t); playLesson(t);
    t.begin(); t.game.fail('wall', t.game.peek()); t.save();
    const reload = new Tutorial(local); assert.equal(reload.lesson, 2); assert.equal(reload.game.state, 'failed');
    for (let i = 0; i < 5; i++) reload.retry();
    assert.equal(reload.lesson, 2); assert.equal(reload.game.snake.length, 4); assert.equal(reload.game.state, 'ready');
    while (!reload.completed) playLesson(reload);
    reload.game.fail('self', reload.game.peek()); reload.retry(); assert.equal(reload.completed, true); assert.equal(reload.game.tutorialPractice, true);
    reload.restartLessons(); assert.equal(reload.lesson, 0); assert.equal(reload.completed, false);
});

test('playing reload restores exact snake paused, timers stop, and unsupported storage only loses persistence', () => {
    const local = storage(), t = new Tutorial(local); t.begin(); t.advance(700); t.save();
    const before = t.game.snapshot(), r = new Tutorial(local);
    assert.equal(r.game.state, 'paused'); assert.deepEqual(r.game.snake, before.snake); assert.equal(r.game.time, before.time);
    r.advance(30000); assert.equal(r.game.time, before.time); assert.equal(r.lesson, 0);
    const broken = storage(); broken.fail = true; const offline = new Tutorial(broken); playLesson(offline);
    offline.retry(); assert.equal(offline.lesson, 1); assert.equal(offline.persistent, false);
    assert.equal(offline.game.bombs.length, 0); assert.equal(offline.game.dessert, null); assert.equal(offline.game.power, null);
});

test('tutorial and older campaign snapshots are separated without shifting twelve level indexes', () => {
    const old = new SnakeGame(11, 300).snapshot(); delete old.mode; delete old.tutorialExitOpen; delete old.tutorialPractice;
    assert.equal(SnakeGame.valid(old), true); assert.equal(SnakeGame.restore(old).mode, 'campaign');
    assert.equal(SnakeGame.restore(old).level.name, '霓虹核心');
    const record = freshRecord(); record.game = SnakeGame.tutorial().snapshot(); assert.equal(validRecord(record), false);
    const local = storage(), store = new CampaignStore(local, storage()); assert.throws(() => store.write(record));
    assert.equal(local.getItem(SAVE_KEY), null);
});

test('completion/skip keeps first formal campaign free; replaying tutorials does not grant another free campaign', async () => {
    for (const complete of [false, true]) {
        const local = storage(), session = storage(); let calls = 0;
        const gate = { unlock: async commit => { calls++; await commit(); return true; } };
        const campaign = new Campaign(new CampaignStore(local, session), gate), t = new Tutorial(local);
        assert.equal(shouldOfferTutorial(campaign, t), true);
        if (complete) while (!t.completed) playLesson(t); else t.leave();
        assert.equal(shouldOfferTutorial(campaign, new Tutorial(local)), false);
        assert.equal(campaign.record.played, false); assert.equal(await campaign.request(), true); campaign.begin(); assert.equal(calls, 0);
        campaign.game.fail('wall', campaign.game.peek()); campaign.save();
        const formal = local.getItem(SAVE_KEY), best = local.getItem(BEST_KEY), retry = new Tutorial(local);
        retry.restartLessons(); playLesson(retry); retry.retry(); retry.leave();
        assert.equal(local.getItem(SAVE_KEY), formal); assert.equal(local.getItem(BEST_KEY), best);
        assert.equal(await campaign.request('retry'), true); assert.equal(calls, 1);
    }
});

test('pending/paid-ready/legacy SDK state survives tutorial; unsafe settlement prevents switching', () => {
    for (const replay of ['pending', 'paid-ready', 'open']) {
        const local = storage(), r = freshRecord(); r.played = true; r.replay = replay; r.intent = replay === 'pending' ? 'retry' : null;
        r.game = new SnakeGame(4, 210).snapshot(); const session = storage(), store = new CampaignStore(local, session); store.write(r);
        local.setItem(`cashlink.arcade.v1.${PUBLISHABLE_KEY}`, 'opaque-original-order');
        if (replay === 'paid-ready') session.setItem(PAID_KEY, JSON.stringify({ ...r, paidSerial: 1 }));
        const original = local.getItem(SAVE_KEY), backup = session.getItem(PAID_KEY), t = new Tutorial(local);
        playLesson(t); t.retry(); t.leave();
        assert.equal(local.getItem(SAVE_KEY), original); assert.equal(session.getItem(PAID_KEY), backup);
        assert.equal(local.getItem(`cashlink.arcade.v1.${PUBLISHABLE_KEY}`), 'opaque-original-order');
    }
    const options = { busy: false, countdown: 0, gate: { busy: false }, campaign: { busy: false, consumed: null } };
    assert.equal(canEnterTutorial(options), true);
    for (const changed of [{ busy: true }, { countdown: 1 }, { gate: { busy: true } }, { campaign: { consumed: {} } }]) assert.equal(canEnterTutorial({ ...options, ...changed }), false);
});
