import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const flush = () => new Promise(resolve => setImmediate(resolve));
function harness(storage = new Map(), options = {}) {
    const elements = new Map(), events = new Map(), audio = [], attempts = [], sdkEvents = new Map();
    const session = options.session || new Map();
    let frame, now = 0, latest;
    const element = id => {
        if (!elements.has(id)) {
            const listeners = new Map();
            elements.set(id, { hidden: false, disabled: false, textContent: '', dataset: {},
                addEventListener: (type, fn) => listeners.set(type, fn),
                fire(type, event = {}) { if (type === 'click' && this.disabled) return; return listeners.get(type)?.(event); },
                removeAttribute(name) { delete this[name]; },
                focus() {}, setPointerCapture() {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 960, height: 720 }),
            });
        }
        return elements.get(id);
    };
    const choices = ['radius', 'reload', 'repair'].map(id => { const e = element(id); e.dataset.upgrade = id; return e; });
    const scope = vm.createContext({
        document: { hidden: false, documentElement: { dataset: {} }, getElementById: element,
            querySelectorAll: () => choices, addEventListener: (type, fn) => events.set(type, fn) },
        localStorage: { getItem: key => storage.get(key) ?? null,
            setItem: (key, value) => { if (options.failWrites) throw new Error('Storage blocked'); storage.set(key, value); },
            removeItem: key => storage.delete(key) },
        sessionStorage: { getItem: key => session.get(key) ?? null,
            setItem: (key, value) => session.set(key, value), removeItem: key => session.delete(key) },
        CashArcadeAudio: { create: () => ({ play: name => audio.push(name), resume() {}, isMuted: () => false }) },
        CashLinkArcade: { create: ({ publishableKey }) => {
            assert.equal(publishableKey, 'clgame_ODUJZzp6UAAZFIWqreRHWOGQuQHhuwj6ESOzo9UYWX5V14Z8');
            return { on: (name, fn) => sdkEvents.set(name, fn),
                handshake: async () => {
                    if (options.failHandshake) throw new Error('offline');
                    return { origin: options.origin || 'https://darkerduck.github.io', unlock_description: options.purpose || '再來一局' };
                },
                unlock: () => new Promise((resolve, reject) => attempts.push({ resolve, reject })),
                cancel: () => attempts.at(-1)?.reject({ code: 'cancelled' }) };
        } }, URL,
        NeonDefenseRenderer: class { draw(game) { latest = game; } event() {} },
        performance: { now: () => now }, requestAnimationFrame: fn => { frame = fn; },
        HTMLButtonElement: class {}, confirm: () => true,
        addEventListener: (type, fn) => events.set(type, fn),
    });
    scope.window = scope;
    for (const file of ['engine.js', 'payment-gate.js', 'game.js']) vm.runInContext(readFileSync(new URL(`../missile/${file}`, import.meta.url), 'utf8'), scope);
    function tick(count = 1) { for (let i = 0; i < count; i++) { now += 25; frame(now); } }
    tick();
    return { storage, session, audio, attempts, sdkEvents, element, scope, tick, get game() { return latest; },
        record: () => JSON.parse(storage.get('casharcade-missile-checkpoint') || 'null'),
        setFailWrites: value => { options.failWrites = value; },
        connect: () => { options.failHandshake = false; },
        click: id => element(id).fire('click'),
        key: (key, code = key, repeat = false) => events.get('keydown')({ key, code, repeat, target: {}, preventDefault() {} }),
        keyUp: (key, code = key) => events.get('keyup')({ key, code }),
        blur: () => events.get('blur')(),
    };
}
test('each Space or touch press launches once; holding and repeat events do not launch', () => {
    const h = harness(); assert.equal(h.audio.length, 0); h.click('start'); h.tick();
    h.key(' ', 'Space'); assert.equal(h.audio.filter(n => n === 'defenseLaunch').length, 0);
    h.tick(30); assert.equal(h.audio.filter(n => n === 'defenseLaunch').length, 1);
    h.key(' ', 'Space', true); h.key(' ', 'Space'); h.tick();
    assert.equal(h.audio.filter(n => n === 'defenseLaunch').length, 1);
    h.keyUp(' ', 'Space'); h.key(' ', 'Space'); h.tick();
    assert.equal(h.audio.filter(n => n === 'defenseLaunch').length, 2);
    const canvas = h.element('game-canvas');
    const touch = { pointerType: 'touch', pointerId: 1, clientX: 100, clientY: 200, preventDefault() {} };
    canvas.fire('pointerdown', touch); canvas.fire('pointerdown', touch);
    canvas.fire('pointermove', { clientX: 200, clientY: 250 }); h.tick(30);
    assert.equal(h.audio.filter(n => n === 'defenseLaunch').length, 3);
    canvas.fire('pointerup', { pointerId: 1 }); canvas.fire('pointerdown', touch); h.tick();
    assert.equal(h.audio.filter(n => n === 'defenseLaunch').length, 4);
    canvas.fire('pointerup', { pointerId: 1 });
    const elapsed = h.game.time, count = h.audio.length;
    h.blur(); h.tick(80); assert.equal(h.game.time, elapsed); assert.equal(h.audio.length, count);
    h.click('start'); h.tick(); assert.ok(h.game.time > elapsed);
    h.tick(30); assert.equal(h.audio.filter(n => n === 'defenseLaunch').length, 4);
    h.game.score = 500; h.key('r'); h.tick(); assert.equal(h.game.score, 0); assert.ok(h.game.time < .1);
});
test('pointer clicks use the nearest ready turret and never queue a shot', () => {
    const h = harness(); h.click('start'); h.tick();
    const canvas = h.element('game-canvas');
    const press = pointerId => {
        canvas.fire('pointerdown', { pointerType: 'mouse', button: 0, pointerId, clientX: 100, clientY: 200, preventDefault() {} });
        canvas.fire('pointerup', { pointerId });
    };
    press(1); assert.equal(h.game.shots.at(-1).x, 70);
    press(2); assert.equal(h.game.shots.at(-1).x, 480);
    press(3); assert.equal(h.game.shots.at(-1).x, 890);
    press(4); assert.equal(h.game.shots.length, 3);
    h.tick(30); assert.equal(h.audio.filter(n => n === 'defenseLaunch').length, 3);
    h.tick(30); assert.equal(h.audio.filter(n => n === 'defenseLaunch').length, 3);
    press(5); assert.equal(h.game.shots.at(-1).x, 70);
});
test('upgrade choice commits once, reload restores stage start, and victory clears checkpoint', () => {
    const h = harness(); h.click('start'); h.tick();
    h.game.state = 'upgrade'; h.game.score = 1200; h.tick();
    assert.equal(JSON.parse(h.storage.get('casharcade-missile-checkpoint')).checkpoint.phase, 'upgrade');
    const restored = harness(h.storage); restored.click('start'); restored.click('radius'); restored.click('radius'); restored.tick();
    const saved = JSON.parse(h.storage.get('casharcade-missile-checkpoint'));
    assert.equal(saved.checkpoint.level, 2); assert.equal(saved.checkpoint.radius, 72); assert.equal(saved.checkpoint.score, 1200);
    const next = harness(h.storage); next.click('start'); next.tick(); assert.equal(next.game.level, 2); assert.equal(next.game.score, 1200);
    next.game.state = 'won'; next.tick(); assert.equal(h.storage.has('casharcade-missile-checkpoint'), false);
});

function lose(h, score = 250) {
    h.game.score = score;
    h.game.cities.forEach(city => { city.hp = 0; });
    h.game.state = 'lost'; h.tick();
    assert.equal(h.record().replay.state, 'lost');
}

test('active retry, new campaign, victory replay and pause/resume remain free', async () => {
    const h = harness(); await flush(); h.click('start'); h.tick();
    h.key('r'); h.tick(); assert.equal(h.attempts.length, 0);
    h.click('pause'); h.click('start'); assert.equal(h.attempts.length, 0);
    h.click('new'); h.tick(); assert.equal(h.attempts.length, 0);
    h.game.state = 'won'; h.tick(); h.click('start'); h.tick();
    assert.equal(h.attempts.length, 0); assert.equal(h.game.level, 1);
});

test('failed-stage start, retry button, R and new campaign share one consumed-credit gate', async () => {
    const h = harness(); await flush(); h.click('start'); h.tick(); lose(h, 950);
    const original = h.game;
    const lostTime = h.game.time;
    h.click('start'); h.click('retry'); h.key('r'); h.click('new'); h.click('payment-retry');
    assert.equal(h.attempts.length, 1); assert.equal(h.record().replay.state, 'payment-pending');
    assert.equal(h.record().replay.intent, 'retry'); assert.equal(h.game, original);
    h.tick(20); assert.equal(h.game.time, lostTime);
    h.sdkEvents.get('unlocked')({ credit_status: 'consumed' }); h.tick();
    assert.equal(h.game, original); // An event is not authorization.
    h.attempts[0].resolve({ credit_status: 'consumed' }); await flush(); h.tick();
    assert.notEqual(h.game, original); assert.equal(h.game.score, 0);
    assert.equal(h.record().replay.state, 'paid-ready'); assert.equal(h.attempts.length, 1);
    lose(h, 120); h.key('r'); assert.equal(h.attempts.length, 2);
    h.attempts[1].reject({ code: 'cancelled' }); await flush();
});

test('failed handshake requires a fresh gesture before opening payment', async () => {
    const h = harness(new Map(), { failHandshake: true }); await flush();
    h.click('start'); h.tick(); lose(h); h.connect();
    h.click('retry'); await flush(); assert.equal(h.attempts.length, 0);
    h.click('payment-retry'); assert.equal(h.attempts.length, 1);
    h.attempts[0].reject({ code: 'cancelled' }); await flush();
});

test('new campaign after defeat stays the chosen intent through cancellation and reload', async () => {
    const h = harness(); await flush(); h.click('start'); h.tick(); lose(h);
    h.click('new'); assert.equal(h.record().replay.intent, 'new');
    h.attempts[0].reject({ code: 'cancelled' }); await flush();
    const restored = harness(h.storage); await flush();
    assert.equal(restored.record().replay.state, 'payment-pending');
    assert.equal(restored.attempts.length, 0); // Reload must not automatically unlock.
    restored.click('retry'); assert.equal(restored.attempts.length, 1);
    assert.equal(restored.record().replay.intent, 'new');
    restored.attempts[0].resolve({ credit_status: 'consumed' }); await flush(); restored.tick();
    assert.equal(restored.game.level, 1); assert.equal(restored.record().replay.state, 'paid-ready');
    const paidReload = harness(h.storage); await flush(); paidReload.click('start'); paidReload.tick();
    assert.equal(paidReload.attempts.length, 0); assert.equal(paidReload.game.level, 1);
});

test('loss remains locked on reload while active stage reload continues for free', async () => {
    const h = harness(); await flush(); h.click('start'); h.tick();
    const active = harness(h.storage); await flush(); active.click('start'); active.tick();
    assert.equal(active.attempts.length, 0);
    lose(h, 410);
    const lost = harness(h.storage); await flush(); lost.tick();
    assert.equal(lost.game.score, 410); assert.ok(lost.game.cities.every(city => city.hp === 0));
    lost.click('start'); assert.equal(lost.attempts.length, 1);
    lost.attempts[0].reject({ code: 'cancelled' }); await flush();
});

for (const code of ['popup_blocked', 'cancelled', 'network_error', 'temporarily_unavailable']) {
    test(`${code} preserves the locked loss and original payment intent`, async () => {
        const h = harness(); await flush(); h.click('start'); h.tick(); lose(h, 90);
        h.click('retry');
        h.attempts[0].reject({ code, checkoutUrl: 'https://linkincash.cc/arcade/checkout/12345678-abcd#secret=test-only' });
        await flush();
        assert.equal(h.record().replay.state, 'payment-pending'); assert.equal(h.game.score, 90);
        assert.equal(h.element('payment-link').hidden, code !== 'popup_blocked');
        const restored = harness(h.storage); await flush();
        assert.equal(restored.attempts.length, 0); restored.click('payment-retry');
        assert.equal(restored.attempts.length, 1);
        restored.attempts[0].reject({ code: 'cancelled' }); await flush();
    });
}

test('unconsumed results, wrong handshake and untrusted fallback URLs fail closed', async () => {
    const h = harness(); await flush(); h.click('start'); h.tick(); lose(h);
    h.click('retry'); h.attempts[0].resolve({ credit_status: 'available' }); await flush();
    assert.equal(h.record().replay.state, 'payment-pending'); assert.equal(h.game.state, 'lost');
    h.click('payment-retry');
    h.attempts[1].reject({ code: 'popup_blocked', checkoutUrl: 'https://evil.example/arcade/checkout/123#secret' });
    await flush(); assert.equal(h.element('payment-link').hidden, true);
    const wrong = harness(new Map(), { purpose: 'wrong' }); await flush(); wrong.click('start'); wrong.tick(); lose(wrong);
    wrong.click('retry'); await flush(); assert.equal(wrong.attempts.length, 0);
    const otherOrigin = harness(new Map(), { origin: 'https://evil.example' }); await flush();
    otherOrigin.click('start'); otherOrigin.tick(); lose(otherOrigin);
    otherOrigin.click('retry'); await flush(); assert.equal(otherOrigin.attempts.length, 0);
});

test('cancel button retains the order and a consumed but unsaved credit never reopens payment', async () => {
    const h = harness(); await flush(); h.click('start'); h.tick(); lose(h);
    h.click('retry'); h.click('payment-cancel'); await flush();
    assert.equal(h.record().replay.state, 'payment-pending'); assert.equal(h.attempts.length, 1);
    h.click('payment-retry'); assert.equal(h.attempts.length, 2);
    h.setFailWrites(true); h.attempts[1].resolve({ credit_status: 'consumed' }); await flush();
    assert.equal(h.record().replay.state, 'payment-pending'); assert.equal(h.game.state, 'lost');
    h.setFailWrites(false); h.click('payment-retry'); h.tick();
    assert.equal(h.attempts.length, 2); assert.equal(h.record().replay.state, 'paid-ready');
    assert.equal(h.game.state, 'running');
});

test('reloading after consumed credit but failed durable commit restores without another unlock', async () => {
    const session = new Map(); const h = harness(new Map(), { session });
    await flush(); h.click('start'); h.tick(); lose(h);
    h.click('retry'); h.setFailWrites(true);
    h.attempts[0].resolve({ credit_status: 'consumed' }); await flush();
    assert.equal(h.record().replay.state, 'payment-pending');
    const restored = harness(h.storage, { session }); await flush();
    restored.click('payment-retry'); restored.tick();
    assert.equal(restored.attempts.length, 0);
    assert.equal(restored.record().replay.state, 'paid-ready');
    assert.equal(restored.game.state, 'running');
});

test('legacy v1 checkpoint still resumes the unfinished stage for free', async () => {
    const original = harness(); original.click('start'); original.tick();
    const legacy = new Map([['casharcade-missile-checkpoint', JSON.stringify(original.record().checkpoint)]]);
    const restored = harness(legacy); await flush(); restored.click('start'); restored.tick();
    assert.equal(restored.attempts.length, 0); assert.equal(restored.game.state, 'running');
    assert.equal(restored.record().version, 2);
});

test('unavailable checkpoint storage prevents a paid attempt or new round', async () => {
    const initial = harness(new Map(), { failWrites: true }); await flush(); initial.click('start'); initial.tick();
    assert.equal(initial.attempts.length, 0); assert.equal(initial.record(), null);
    assert.ok(!initial.audio.includes('defenseStart'));
    const h = harness(); await flush(); h.click('start'); h.tick(); h.setFailWrites(true);
    h.game.cities.forEach(city => { city.hp = 0; }); h.game.state = 'lost'; h.tick();
    assert.equal(h.record().replay.state, 'open');
    h.click('retry'); h.key('r'); assert.equal(h.attempts.length, 0);
    const restored = harness(h.storage, { session: h.session }); await flush();
    restored.click('retry'); assert.equal(restored.attempts.length, 1);
    restored.attempts[0].reject({ code: 'cancelled' }); await flush();
});
