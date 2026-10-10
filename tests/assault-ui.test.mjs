import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const ROUND = 'casharcade-assault-round-v2';
const LEGACY = 'casharcade-assault-checkpoint-v1';
const KEY = 'clgame_31Kgzczh8V6D0U7FCjxMzsdgMV3bPcQoVMGmNlZAulBOTnbw';
const flush = () => new Promise(resolve => setImmediate(resolve));
const sharedData = () => ({ local: new Map(), session: new Map(), failWrite: false, failRead: false, failActive: false });

function harness(shared = sharedData(), options = {}) {
    const els = new Map(), events = new Map(), sdkEvents = new Map(), attempts = [], music = [], sounds = [];
    let frame, now = 0, latest, visualTime = 0, handshakes = 0;
    function element(id) {
        if (!els.has(id)) {
            const listeners = new Map();
            els.set(id, { textContent: '', hidden: false, disabled: false, dataset: {}, style: {}, classList: { toggle() {} },
                addEventListener: (type, fn) => listeners.set(type, fn), setAttribute(name, value) { this[name] = value; },
                removeAttribute(name) { delete this[name]; },
                fire(type, event = {}) { if (type === 'click' && this.disabled) return; return listeners.get(type)?.(event); },
                focus() {}, setPointerCapture() {}, getBoundingClientRect: () => ({ width: 270, height: 390 }),
            });
        }
        return els.get(id);
    }
    const localStorage = {
        getItem(key) { if (shared.failRead) throw Error('blocked'); return shared.local.get(key) ?? null; },
        setItem(key, value) { if (shared.failWrite || (shared.failActive && key === ROUND && JSON.parse(value).phase === 'active')) throw Error('blocked'); shared.local.set(key, value); },
        removeItem(key) { if (shared.failWrite) throw Error('blocked'); shared.local.delete(key); },
    };
    const sessionStorage = {
        getItem: key => shared.session.get(key) ?? null,
        setItem: (key, value) => shared.session.set(key, value),
        removeItem: key => shared.session.delete(key),
    };
    const sdk = {
        on: (event, fn) => sdkEvents.set(event, fn),
        handshake: async () => { handshakes++; return options.handshake || { origin: 'https://darkerduck.github.io', unlock_description: '死亡後再來一局' }; },
        unlock: () => new Promise((resolve, reject) => attempts.push({ resolve, reject })),
        cancel: () => attempts.at(-1)?.reject({ code: 'cancelled' }),
    };
    const scope = vm.createContext({
        document: { documentElement: { dataset: {} }, getElementById: element,
            querySelectorAll: () => [1, 2, 3].map(n => { const el = element('stage' + n); el.dataset.stage = n; return el; }),
            addEventListener: (type, fn) => events.set(type, fn) },
        localStorage, sessionStorage, URL,
        CashLinkArcade: { create: ({ publishableKey }) => { assert.equal(publishableKey, KEY); return sdk; } },
        CashArcadeAudio: { create: () => ({ play: name => sounds.push(name), resume() {}, musicOutput() {} }) },
        CashArcadeMusic: { create: () => Object.fromEntries(['start', 'pause', 'resume', 'phase', 'duck'].map(k => [k, (...args) => music.push([k, ...args])])) },
        NeonAssaultRenderer: class { resize() {} reset() { visualTime = 0; } consume() {} update(dt) { visualTime += dt; } draw(g) { latest = g; } },
        performance: { now: () => now }, requestAnimationFrame: fn => frame = fn,
        addEventListener: (type, fn) => events.set(type, fn),
    });
    scope.window = scope;
    for (const name of ['engine', 'storage', 'payment-gate', 'music', 'game']) {
        vm.runInContext(readFileSync(new URL('../assault/' + name + '.js', import.meta.url), 'utf8'), scope);
    }
    const tick = (n = 1) => { for (let i = 0; i < n; i++) { now += 25; frame(now); } };
    tick();
    return { element, tick, music, sounds, shared, attempts, sdkEvents, scope,
        get game() { return latest; }, get visualTime() { return visualTime; }, get handshakes() { return handshakes; },
        get record() { return JSON.parse(shared.local.get(ROUND) || 'null'); },
        click: id => element(id).fire('click'), blur: () => events.get('blur')(),
        pagehide: () => events.get('pagehide')(),
        key: (key, extra = {}) => events.get('keydown')({ key, target: {}, preventDefault() {}, ...extra }),
        keyup: key => events.get('keyup')({ key }),
        reload: () => harness(shared, options),
    };
}
function lose(h) { h.game.state = 'lost'; h.tick(); assert.equal(h.record.phase, 'lost'); }

test('free first play, movement, bomb and pause resume without unlock', async () => {
    const h = harness(); await flush();
    assert.equal(h.handshakes, 1); assert.equal(h.sounds.length, 0);
    h.click('start'); h.tick(4); assert.equal(h.game.state, 'running');
    const x = h.game.player.x; h.key('d'); h.tick(4); h.keyup('d'); assert.ok(h.game.player.x > x + 20);
    h.key(' '); h.key(' ', { repeat: true }); assert.equal(h.game.bombs, 1);
    h.blur(); const time = h.game.time, visual = h.visualTime; h.tick(40);
    assert.equal(h.game.time, time); assert.equal(h.visualTime, visual);
    h.click('start'); h.tick(4); assert.ok(h.game.time > time);
    assert.equal(h.attempts.length, 0);
});

test('full in-progress snapshot restores player, projectiles, boss, timers and waits for resume', async () => {
    const h = harness(); await flush(); h.click('start'); h.tick(4);
    h.game.player.x = 311; h.game.score = 1234; h.game.spawnBoss(); h.game.boss.age = 3;
    h.game.bullets.push({ x: 100, y: 500, vx: 2, vy: 7, r: 5, type: 'round' }); h.game.time = 51; h.pagehide();
    const reload = h.reload(); await flush();
    assert.equal(reload.game.state, 'paused'); assert.equal(reload.game.player.x, 311);
    assert.equal(reload.game.score, 1234); assert.equal(reload.game.bullets.length, 1);
    assert.equal(reload.game.boss.age, 3); assert.equal(reload.game.time, 51);
    reload.tick(20); assert.equal(reload.game.time, 51);
    reload.click('start'); reload.tick(); assert.equal(reload.game.state, 'running');
    assert.equal(reload.attempts.length, 0);
});

test('stage completion and victory are free; legacy checkpoint migrates', async () => {
    const legacy = sharedData();
    legacy.local.set(LEGACY, JSON.stringify({ version: 1, level: 2, score: 3000, hp: 4, bombs: 2, weapon: 'laser', power: 2, wings: 1 }));
    const h = harness(legacy); await flush();
    assert.equal(h.record.phase, 'ready'); assert.equal(legacy.local.has(LEGACY), false);
    h.click('start'); h.tick(); assert.equal(h.game.level, 2);
    h.game.state = 'stageClear'; h.tick(); assert.equal(h.record.phase, 'stageClear');
    const reload = h.reload(); await flush(); reload.click('start'); reload.tick();
    assert.equal(reload.game.level, 3); assert.equal(reload.attempts.length, 0);
    reload.game.state = 'won'; reload.tick(); assert.equal(reload.record.phase, 'won');
    reload.click('start'); reload.tick(); assert.equal(reload.game.level, 1); assert.equal(reload.attempts.length, 0);
});

test('death buttons and R share one gate; pending intent survives cancellation and reload', async () => {
    const h = harness(); await flush(); h.click('start'); h.tick(); lose(h);
    h.click('new'); assert.equal(h.record.phase, 'pending'); assert.equal(h.record.intent, 'new');
    assert.equal(h.attempts.length, 1); h.key('r'); h.click('start'); assert.equal(h.attempts.length, 1);
    h.attempts[0].reject({ code: 'cancelled' }); await flush();
    assert.equal(h.game.state, 'lost'); assert.equal(h.record.intent, 'new');
    const reload = h.reload(); await flush();
    assert.equal(reload.record.phase, 'pending'); reload.key('r');
    assert.equal(reload.attempts.length, 1);
    reload.attempts[0].resolve({ credit_status: 'available' }); await flush();
    assert.equal(reload.game.state, 'lost'); assert.equal(reload.record.phase, 'pending');
    reload.click('start'); assert.equal(reload.attempts.length, 2);
    reload.attempts[1].resolve({ credit_status: 'consumed' }); await flush(); reload.tick();
    assert.equal(reload.game.state, 'running'); assert.equal(reload.game.level, 1);
    assert.equal(reload.record.phase, 'active'); assert.equal(reload.record.serial, 1);
});

test('popup blocked exposes only an approved checkout URL; errors keep the failed round', async () => {
    for (const error of [
        { code: 'popup_blocked', checkoutUrl: 'https://linkincash.cc/arcade/checkout/123e4567-e89b-12d3-a456-426614174000#secret=test' },
        { code: 'cancelled' }, { code: 'api_error' }, { code: 'temporarily_unavailable' },
    ]) {
        const h = harness(); await flush(); h.click('start'); h.tick(); lose(h);
        h.click('retry'); h.attempts[0].reject(error); await flush();
        assert.equal(h.record.phase, 'pending'); assert.equal(h.game.state, 'lost');
        assert.equal(h.element('payment-link').hidden, error.code !== 'popup_blocked');
        if (error.code === 'popup_blocked') assert.match(h.element('payment-link').href, /#secret=test$/);
    }
    const h = harness(); await flush(); h.click('start'); h.tick(); lose(h);
    h.click('retry'); h.attempts[0].reject({ code: 'popup_blocked', checkoutUrl: 'https://evil.example/arcade/checkout/123#secret' });
    await flush(); assert.equal(h.element('payment-link').hidden, true);
});

test('consumed credit with failed local write recovers from session backup without another unlock', async () => {
    const shared = sharedData(), h = harness(shared); await flush(); h.click('start'); h.tick(); lose(h);
    h.click('retry'); shared.failWrite = true;
    h.attempts[0].resolve({ credit_status: 'consumed' }); await flush(); h.tick();
    assert.equal(h.game.state, 'lost'); assert.equal(h.attempts.length, 1);
    assert.ok(shared.session.has('casharcade.assault.paid-backup.v2'));
    shared.failWrite = false;
    const reload = h.reload(); await flush();
    assert.equal(reload.record.phase, 'paid-ready');
    reload.click('start'); reload.tick();
    assert.equal(reload.game.state, 'running'); assert.equal(reload.attempts.length, 0);
    assert.equal(reload.record.phase, 'active');
});

test('a later successful save retires paid backup before a second death', async () => {
    const shared = sharedData(), h = harness(shared); await flush(); h.click('start'); h.tick(); lose(h);
    h.click('retry'); shared.failActive = true;
    h.attempts[0].resolve({ credit_status: 'consumed' }); await flush(); h.tick();
    assert.equal(h.game.state, 'paused'); assert.equal(h.record.phase, 'paid-ready');
    shared.failActive = false; h.click('start'); h.tick();
    assert.equal(h.game.state, 'running'); assert.equal(h.attempts.length, 1);
    assert.equal(h.record.phase, 'active'); assert.equal(shared.session.size, 0);
    lose(h); h.key('r'); assert.equal(h.attempts.length, 2);
});

test('storage failure while playing freezes the run until a verified save succeeds', async () => {
    const shared = sharedData(), h = harness(shared); await flush(); h.click('start'); h.tick();
    shared.failActive = true; h.tick(12);
    assert.equal(h.game.state, 'paused'); assert.match(h.element('storage-note').textContent, /無法安全保存/);
    const time = h.game.time; h.tick(20); assert.equal(h.game.time, time);
    shared.failActive = false; h.click('start'); h.tick();
    assert.equal(h.game.state, 'running'); assert.equal(h.attempts.length, 0);
});

test('a failed death save survives reload without restoring a free live round', async () => {
    const shared = sharedData(), h = harness(shared); await flush(); h.click('start'); h.tick();
    shared.failWrite = true; h.game.state = 'lost'; h.tick();
    assert.equal(h.game.state, 'lost');
    assert.equal(JSON.parse(shared.local.get(ROUND)).phase, 'active');
    assert.equal(JSON.parse(shared.session.get('casharcade.assault.recovery.v2')).phase, 'lost');
    shared.failWrite = false;
    const reload = h.reload(); await flush();
    assert.equal(reload.record.phase, 'lost'); assert.equal(reload.game.state, 'lost');
    reload.key('r'); assert.equal(reload.attempts.length, 1);
});

test('invalid save or blocked storage fails closed; handshake purpose mismatch cannot charge', async () => {
    const corrupt = sharedData(); corrupt.local.set(ROUND, '{bad');
    const h = harness(corrupt); await flush(); h.click('start');
    assert.equal(h.game.state, 'ready'); assert.equal(h.element('start').disabled, true);
    const blocked = sharedData(); blocked.failRead = true;
    const b = harness(blocked); await flush(); b.click('start'); assert.equal(b.game.state, 'ready');
    const mismatch = harness(sharedData(), { handshake: { origin: 'https://evil.example', unlock_description: '再來一局' } });
    await flush(); mismatch.click('start'); mismatch.tick(); lose(mismatch);
    mismatch.click('start'); await flush(); assert.equal(mismatch.attempts.length, 0);
    assert.equal(mismatch.record.phase, 'pending');
});
