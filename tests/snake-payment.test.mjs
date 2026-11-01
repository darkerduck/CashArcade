import test from 'node:test';
import assert from 'node:assert/strict';
import { Campaign, CampaignStore, SAVE_KEY, PAID_KEY, PUBLISHABLE_KEY } from '../snake/storage.mjs';
import { ReplayGate, checkoutURL } from '../snake/payment.mjs';
import { SnakeGame } from '../snake/engine.mjs';
import { readFileSync } from 'node:fs';

function storage() {
    const data = new Map();
    return { fail: false, removeFails: false, getItem: k => data.get(k) ?? null,
        setItem(k, v) { if (this.fail) throw Error('quota'); data.set(k, v); },
        removeItem(k) { if (this.removeFails) throw Error('blocked'); data.delete(k); } };
}
async function harness({ local = storage(), session = storage(), origin = 'https://darkerduck.github.io', purpose = '再來一局', offline = false } = {}) {
    const events = new Map(), attempts = [], statuses = [], links = [], sdk = {
        on: (name, cb) => events.set(name, cb),
        handshake: async () => { if (sdk.offline) throw Error('offline'); return { origin, unlock_description: purpose }; },
        unlock: () => new Promise((resolve, reject) => attempts.push({ resolve, reject })),
        cancel: () => attempts.at(-1)?.reject({ code: 'cancelled' }), offline,
    };
    const gate = new ReplayGate({ factory: async key => { assert.equal(key, PUBLISHABLE_KEY); return sdk; }, status: s => statuses.push(s), checkout: s => links.push(s) });
    await gate.initialize();
    const store = new CampaignStore(local, session), campaign = new Campaign(store, gate);
    return { local, session, gate, campaign, attempts, statuses, events, links, sdk, store };
}
async function played(h) { assert.equal(await h.campaign.request(), true); assert.equal(h.campaign.begin(), true); h.campaign.game.advance(500); }
const failed = h => { h.campaign.game.fail('wall', h.campaign.game.peek()); h.campaign.save(); };

test('first campaign, pause/resume, exact-round reload and normal next sector are free', async () => {
    const h = await harness({ offline: true }); await played(h); h.campaign.game.pause(); h.campaign.save();
    const old = h.campaign.game.snapshot(); assert.equal(await h.campaign.request(), true); h.campaign.begin();
    h.campaign.game.pause(); h.campaign.save();
    const reload = await harness(h); assert.equal(reload.campaign.game.state, 'paused'); assert.deepEqual(reload.campaign.game.snake, old.snake);
    await reload.campaign.request(); reload.campaign.begin();
    reload.campaign.game.state = 'level-clear'; reload.campaign.game.score = 60; reload.campaign.save();
    assert.equal(await reload.campaign.request('next'), true); reload.campaign.begin();
    assert.equal(reload.campaign.game.levelIndex, 1); assert.equal(reload.campaign.game.startScore, 60); assert.equal(reload.campaign.game.snake.length, 4);
    assert.equal(h.attempts.length + reload.attempts.length, 0);
});

test('failure retry/new/primary reload and active retry all share one consumed-only gate', async () => {
    for (const intent of ['retry', 'new', 'continue']) {
        const h = await harness(); await played(h); failed(h);
        const request = h.campaign.request(intent); assert.equal(h.attempts.length, 1); assert.equal(h.campaign.record.replay, 'pending');
        assert.equal(await h.campaign.request('new'), false); assert.equal(await h.campaign.request('retry'), false);
        assert.equal(h.campaign.begin(), false); h.attempts[0].resolve({ credit_status: 'available' });
        assert.equal(await request, false); assert.equal(h.campaign.game.state, 'failed');
        const again = h.campaign.request('continue'); h.attempts[1].resolve({ credit_status: 'consumed' }); assert.equal(await again, true);
        assert.equal(h.campaign.record.replay, 'paid-ready'); assert.equal(h.campaign.game.time, 0);
        h.campaign.begin(); assert.equal(h.campaign.game.state, 'running'); assert.equal(h.attempts.length, 2);
    }
    const active = await harness(); await played(active); const req = active.campaign.request('retry');
    assert.equal(active.campaign.game.state, 'paused'); active.attempts[0].resolve({ credit_status: 'consumed' }); assert.equal(await req, true);
});

test('popup, cancellation and network uncertainty retain the original intent across reload', async () => {
    for (const code of ['popup_blocked', 'cancelled', 'network_error']) {
        const h = await harness(); await played(h); h.campaign.game = new SnakeGame(4, 320); h.campaign.game.start();
        const request = h.campaign.request('retry');
        h.attempts[0].reject({ code, checkoutUrl: 'https://linkincash.cc/arcade/checkout/12345678-abcd#secret=test-only' });
        assert.equal(await request, false); assert.equal(h.campaign.record.intent, 'retry');
        const reload = await harness(h); assert.equal(reload.attempts.length, 0);
        assert.equal(reload.campaign.record.replay, 'pending'); assert.equal(reload.campaign.begin(), false);
        const resume = reload.campaign.request('new'); // Switching a button cannot change the pending order's intent.
        assert.equal(reload.campaign.record.intent, 'retry'); reload.attempts[0].resolve({ credit_status: 'consumed' }); assert.equal(await resume, true);
        assert.equal(reload.campaign.game.levelIndex, 4); assert.equal(reload.campaign.game.score, 320);
        if (code === 'popup_blocked') assert.match(h.links.at(-1), /#secret=test-only$/);
    }
});

test('payment-in-progress reload remains gated, paid-ready reload never calls unlock again', async () => {
    const h = await harness(); await played(h); failed(h); const pending = h.campaign.request('retry');
    const reloadedPending = await harness(h); assert.equal(reloadedPending.campaign.record.replay, 'pending'); assert.equal(reloadedPending.attempts.length, 0);
    h.attempts[0].resolve({ credit_status: 'consumed' }); await pending;
    const ready = await harness(h); assert.equal(ready.campaign.record.replay, 'paid-ready'); await ready.campaign.request('retry'); ready.campaign.begin();
    assert.equal(ready.attempts.length, 0); ready.campaign.game.advance(333); ready.campaign.save();
    const playing = await harness(h); assert.equal(playing.campaign.game.time, 330); assert.equal(playing.campaign.game.state, 'paused');
    await playing.campaign.request(); playing.campaign.begin(); assert.equal(playing.attempts.length, 0);
});

test('storage failure before unlock prevents payment; after consumed credit recovers locally without another unlock', async () => {
    const h = await harness(); await played(h); failed(h); h.local.fail = true;
    await assert.rejects(() => h.campaign.request('retry')); assert.equal(h.attempts.length, 0); h.local.fail = false;
    const request = h.campaign.request('retry'); h.local.fail = true;
    h.attempts[0].resolve({ credit_status: 'consumed' }); assert.equal(await request, false);
    assert.ok(h.session.getItem(PAID_KEY)); assert.ok(h.campaign.consumed);
    h.local.fail = false; const restored = await harness(h); assert.equal(restored.campaign.record.replay, 'paid-ready');
    await restored.campaign.request(); restored.campaign.begin(); assert.equal(restored.attempts.length, 0);
    assert.equal(h.session.getItem(PAID_KEY), null);
});

test('consumed credit remains recoverable in memory even if both stores fail after settlement', async () => {
    const h = await harness(); await played(h); const request = h.campaign.request('retry'); h.local.fail = h.session.fail = true;
    h.attempts[0].resolve({ credit_status: 'consumed' }); assert.equal(await request, false); assert.ok(h.campaign.consumed);
    h.local.fail = h.session.fail = false; assert.equal(await h.campaign.request('retry'), true); assert.equal(h.attempts.length, 1);
});

test('a stale session receipt cannot rewind a round after successful durable commit and later progress', async () => {
    const h = await harness(); await played(h); h.session.removeFails = true;
    const request = h.campaign.request('retry'); h.attempts[0].resolve({ credit_status: 'consumed' }); await request; h.campaign.begin();
    h.campaign.game.advance(500); h.campaign.save(); assert.ok(h.session.getItem(PAID_KEY));
    const reload = await harness(h); assert.equal(reload.campaign.game.time, 500); assert.equal(reload.campaign.record.replay, 'open');
});

test('wrong origin/purpose and maintenance fail closed; reconnect asks for a fresh click', async () => {
    for (const options of [{ origin: 'https://evil.example' }, { purpose: 'wrong' }, { offline: true }]) {
        const h = await harness(options); await played(h); failed(h); assert.equal(await h.campaign.request('retry'), false); assert.equal(h.attempts.length, 0);
    }
    const h = await harness({ offline: true }); await played(h); failed(h); h.sdk.offline = false;
    assert.equal(await h.campaign.request('retry'), false); assert.equal(h.attempts.length, 0); assert.equal(h.gate.ready, true);
    const req = h.campaign.request('retry'); h.gate.cancel(); assert.equal(await req, false);
});

test('only verified checkout links retain the fragment; foreign origins/query credentials are rejected', () => {
    const allowed = 'https://linkincash.cc/arcade/checkout/aabbcc-123#order=test'; assert.equal(checkoutURL(allowed), allowed);
    for (const url of ['javascript:alert(1)', 'https://evil.example/arcade/checkout/abc#secret', 'https://linkincash.cc.evil.test/arcade/checkout/a', 'https://linkincash.cc/arcade/checkout/a?secret=bad', 'https://name@linkincash.cc/arcade/checkout/a', 'http://linkincash.cc/arcade/checkout/a', 'https://linkincash.cc/docs/arcade-api']) assert.equal(checkoutURL(url), null);
});

test('service/rate-limit Retry-After blocks rapid retries without creating a replacement', async () => {
    let now = 0, calls = 0;
    const gate = new ReplayGate({ now: () => now, factory: async () => ({ on() {},
        handshake: async () => ({ origin: 'https://darkerduck.github.io', unlock_description: '再來一局' }),
        unlock: async () => { calls++; throw { code: 'rate_limited', retryAfter: 7 }; },
    }) });
    await gate.initialize(); assert.equal(await gate.unlock(() => assert.fail()), false); assert.equal(calls, 1);
    now = 6999; await gate.unlock(() => assert.fail()); assert.equal(calls, 1);
    now = 7000; await gate.unlock(() => assert.fail()); assert.equal(calls, 2);
});

test('existing Snake registration wording is preserved without weakening arbitrary purpose checks', async () => {
    const h = await harness({ purpose: '死亡或勝利後解鎖下一局遊戲' });
    assert.equal(h.gate.ready, true); assert.match(h.statuses.at(-1), /登記用途：死亡或勝利後解鎖下一局遊戲/);
});

test('legacy SDK order is preserved; corrupt checkpoint cannot become a free replacement', async () => {
    const local = storage(); local.setItem(`cashlink.arcade.v1.${PUBLISHABLE_KEY}`, 'opaque-sdk-state');
    const h = await harness({ local }); assert.equal(h.campaign.record.replay, 'pending'); assert.equal(h.attempts.length, 0);
    local.setItem(SAVE_KEY, '{invalid'); await assert.rejects(() => harness({ local }));
});

test('all UI restart controls are wired to the one coordinator; no SDK startup before WebGL is ready', () => {
    const source = readFileSync(new URL('../snake/game.js', import.meta.url), 'utf8');
    assert.match(source, /restart-button'\)\.addEventListener\('click', \(\) => requestRound\('retry'\)\)/);
    assert.match(source, /k === 'r'\) requestRound\('retry'\)/);
    assert.match(source, /requestRound\('new'\)/);
    assert.equal((source.match(/campaign\.request\(/g) || []).length, 1);
    assert.ok(source.indexOf('await renderer.ready()') < source.indexOf('gate.initialize()'));
    assert.ok(!source.includes('arcade.unlock('));
});
