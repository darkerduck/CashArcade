import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const gateSource = readFileSync(new URL('../breakout/payment-gate.js', import.meta.url), 'utf8');
const gameSource = readFileSync(new URL('../breakout/game.js', import.meta.url), 'utf8').replace(/\}\)\(\);\s*$/, `
window.inspect = {
    state: () => ({ gameState, score, lives, levelIndex, paidReady }),
    set: (state, points = score) => { gameState = state; score = points; },
    setBall: value => { ball = { ...ball, ...value }; },
    setBricks: value => { bricks = value; },
    setLevel: value => { levelIndex = value; },
    checkpoint, handleStart, requestNewGame, update, collideWithBricks, completeLevel, loseLife
};
})();`);
const KEY = 'clgame_1B2urqXhsmgm1tz3HmqppmCd3VElMeIXOUDGV5HUpwmSTReR';
const PENDING = 'casharcade.breakout.replay-pending.v1';
const SDK_KEY = `cashlink.arcade.v1.${KEY}`;
const flush = () => new Promise(resolve => setImmediate(resolve));
function storage() {
    const map = new Map();
    return { getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, String(value)), removeItem: key => map.delete(key) };
}
function element() {
    const handlers = new Map();
    return {
        handlers, textContent: '', disabled: false, hidden: true, dataset: {},
        addEventListener: (name, handler) => handlers.set(name, handler),
        removeAttribute(name) { delete this[name]; },
        click() { if (!this.disabled) return handlers.get('click')?.({}); },
        getBoundingClientRect: () => ({ left: 0, width: 720 }),
        setPointerCapture() {}, releasePointerCapture() {},
        getContext: () => new Proxy({}, { get: (_, key) => key === 'createLinearGradient' ? () => ({ addColorStop() {} }) : () => {} }),
    };
}
async function harness({ session = storage(), local = storage(), handshakeError = false, purpose = '再來一局' } = {}) {
    const elements = new Map();
    const events = new Map();
    const sdkEvents = new Map();
    const attempts = [];
    const audioEvents = [];
    let failHandshake = handshakeError;
    const sdk = {
        on: (name, handler) => sdkEvents.set(name, handler),
        handshake: async () => { if (failHandshake) throw new Error('offline'); return { origin: 'https://darkerduck.github.io', unlock_description: purpose }; },
        unlock: () => new Promise((resolve, reject) => attempts.push({ resolve, reject })),
        cancel: () => attempts.at(-1)?.reject({ code: 'cancelled' }),
    };
    const sandbox = {
        sessionStorage: session, localStorage: local, URL,
        CashLinkArcade: { create: options => { assert.equal(options.publishableKey, KEY); return sdk; } },
        CashArcadeAudio: { create: () => ({ play: name => audioEvents.push(name), resume() {} }) },
        performance: { now: () => 0 }, requestAnimationFrame: () => 1, cancelAnimationFrame() {},
        matchMedia: () => ({ matches: false }), getComputedStyle: () => ({ getPropertyValue: () => '#000' }),
        addEventListener: (name, handler) => events.set(`window:${name}`, handler),
        document: {
            documentElement: { dataset: {} },
            querySelector: selector => { if (!elements.has(selector)) elements.set(selector, element()); return elements.get(selector); },
            addEventListener: (name, handler) => events.set(name, handler),
        },
    };
    sandbox.window = sandbox;
    const context = vm.createContext(sandbox);
    vm.runInContext(gateSource, context);
    vm.runInContext(gameSource, context);
    await flush();
    return {
        context, session, local, attempts, sdkEvents, audioEvents,
        click: selector => elements.get(selector).click(),
        el: selector => elements.get(selector),
        key(key, code = '', repeat = false) { let prevented = false; events.get('keydown')({ key, code, repeat, preventDefault() { prevented = true; } }); return prevented; },
        state: () => context.inspect.state(), set: (...args) => context.inspect.set(...args),
        inspect: context.inspect,
        checkpoint: () => context.inspect.checkpoint(),
        connect: () => { failHandshake = false; },
    };
}

test('first play, pause/resume, lost-life relaunch and level transition are free', async () => {
    const h = await harness();
    h.click('#start-button');
    assert.equal(h.state().gameState, 'running');
    h.click('#pause-button');
    h.click('#start-button');
    h.set('life-lost'); h.click('#start-button');
    h.set('level-clear'); h.click('#start-button');
    assert.equal(h.state().levelIndex, 1);
    assert.equal(h.state().gameState, 'running');
    assert.equal(h.attempts.length, 0);
    assert.equal(h.key(' ', 'Space'), true);
    assert.equal(h.state().gameState, 'paused');
});

test('all new-game controls serialize one awaited unlock; events do not authorize play', async () => {
    const h = await harness();
    h.click('#start-button'); h.set('running', 125);
    const restart = h.click('#restart-button');
    h.key('R'); h.click('#payment-retry'); h.click('#start-button');
    assert.equal(h.attempts.length, 1);
    assert.equal(h.state().gameState, 'paused');
    assert.equal(h.state().score, 125);
    assert.deepEqual(h.audioEvents, ['start']);
    h.sdkEvents.get('payment_status')({ credit_status: 'available' });
    h.sdkEvents.get('unlocked')({ credit_status: 'consumed' });
    assert.equal(h.state().gameState, 'paused');
    h.attempts[0].resolve({ credit_status: 'consumed' }); await restart;
    assert.equal(h.state().score, 0);
    assert.equal(h.state().gameState, 'running');
    assert.deepEqual(h.audioEvents, ['start', 'start']);
    assert.equal(h.session.getItem(PENDING), null);
});

for (const [state, control] of [['over', 'button'], ['won', 'button'], ['over', 'space'], ['running', 'r']]) {
    test(`${state}/${control} enters the same paid gate`, async () => {
        const h = await harness(); h.set(state, 50);
        if (control === 'button') h.click('#start-button');
        else h.key(control === 'space' ? ' ' : 'r', control === 'space' ? 'Space' : 'KeyR');
        assert.equal(h.attempts.length, 1);
        assert.equal(h.state().score, 50);
        h.attempts[0].reject({ code: 'cancelled' }); await flush();
    });
}

for (const code of ['cancelled', 'network_error', 'temporarily_unavailable', 'popup_blocked']) {
    test(`${code} keeps original order and does not start a replacement`, async () => {
        const h = await harness(); h.set('over', 95);
        h.local.setItem(SDK_KEY, 'original-sdk-state');
        const promise = h.click('#restart-button');
        h.attempts[0].reject({ code, checkoutUrl: 'https://linkincash.cc/arcade/checkout/12345678-abcd#secret=test-only' });
        await promise;
        assert.equal(h.state().gameState, 'over');
        assert.equal(h.state().score, 95);
        assert.equal(h.session.getItem(PENDING), '1');
        assert.equal(h.local.getItem(SDK_KEY), 'original-sdk-state');
        if (code === 'popup_blocked') assert.equal(h.el('#payment-link').hidden, false);
        const reloaded = await harness({ session: h.session, local: h.local });
        assert.equal(reloaded.state().gameState, 'replay-pending');
        assert.equal(reloaded.attempts.length, 0);
        const retry = reloaded.click('#payment-retry');
        assert.equal(reloaded.attempts.length, 1);
        reloaded.attempts[0].resolve({ credit_status: 'consumed' }); await retry;
        assert.equal(reloaded.state().gameState, 'running');
    });
}

test('cancel button settles pending unlock without resetting game', async () => {
    const h = await harness(); h.set('over', 20);
    const promise = h.click('#restart-button'); h.click('#payment-cancel'); await promise;
    assert.equal(h.state().score, 20);
    assert.equal(h.el('#restart-button').disabled, false);
});

test('active round reload restores paused checkpoint and continues without payment', async () => {
    const h = await harness(); h.click('#start-button'); h.set('running', 135); h.checkpoint();
    const reload = await harness({ session: h.session, local: h.local });
    assert.equal(reload.state().gameState, 'paused');
    assert.equal(reload.state().score, 135);
    reload.click('#start-button');
    assert.equal(reload.state().gameState, 'running');
    assert.equal(reload.attempts.length, 0);
});

test('committed paid checkpoint closes crash window before pending marker cleanup', async () => {
    const h = await harness(); const promise = h.click('#restart-button');
    h.attempts[0].resolve({ credit_status: 'consumed' }); await promise;
    h.session.setItem(PENDING, '1');
    const reload = await harness({ session: h.session, local: h.local });
    assert.equal(reload.state().gameState, 'paused');
    assert.equal(reload.session.getItem(PENDING), null);
    reload.click('#start-button'); assert.equal(reload.attempts.length, 0);
    const next = reload.click('#restart-button');
    reload.attempts[0].reject({ code: 'cancelled' }); await next;
    const again = await harness({ session: h.session, local: h.local });
    assert.equal(again.state().gameState, 'replay-pending');
});

test('failed handshake needs a fresh gesture after reconnect, preserving popup activation', async () => {
    const h = await harness({ handshakeError: true });
    h.connect(); await h.click('#restart-button');
    assert.equal(h.attempts.length, 0);
    const promise = h.click('#restart-button'); assert.equal(h.attempts.length, 1);
    h.attempts[0].reject({ code: 'cancelled' }); await promise;
});

test('wrong payment purpose, unavailable intent storage and unconsumed results fail closed', async () => {
    const mismatch = await harness({ purpose: 'wrong purpose' });
    await mismatch.click('#restart-button'); assert.equal(mismatch.attempts.length, 0);
    const h = await harness();
    h.session.setItem = () => { throw new Error('storage denied'); };
    await h.click('#restart-button'); assert.equal(h.attempts.length, 0);
    const invalid = await harness(); invalid.set('over', 44);
    const promise = invalid.click('#restart-button'); invalid.attempts[0].resolve({ credit_status: 'available' }); await promise;
    assert.equal(invalid.state().score, 44);
    assert.equal(invalid.state().gameState, 'over');
});

test('untrusted popup fallback URLs are never displayed', async () => {
    const h = await harness();
    const promise = h.click('#restart-button');
    h.attempts[0].reject({ code: 'popup_blocked', checkoutUrl: 'https://evil.example/arcade/checkout/123#secret' }); await promise;
    assert.equal(h.el('#payment-link').hidden, true);
    assert.equal(h.el('#payment-link').href, undefined);
});

test('breakout collision and transition sounds follow gameplay, not redraws', async () => {
    const h = await harness(); h.click('#start-button');
    h.inspect.setBricks([
        { x: 100, y: 100, width: 64, height: 22, hp: 2, maxHp: 2, row: 0 },
        { x: 210, y: 100, width: 64, height: 22, hp: 1, maxHp: 1, row: 0 },
    ]);
    h.inspect.setBall({ x: 110, y: 110, vx: 0, vy: 200 }); h.inspect.collideWithBricks(.016);
    h.inspect.setBall({ x: 110, y: 110, vx: 0, vy: 200 }); h.inspect.collideWithBricks(.016);
    h.inspect.setBall({ x: 220, y: 110, vx: 0, vy: 200 }); h.inspect.collideWithBricks(.016);
    assert.deepEqual(h.audioEvents.slice(0, 5), ['start', 'crack', 'reinforced', 'brick', 'level']);
    h.inspect.setBricks([{ x: 100, y: 100, width: 64, height: 22, hp: 1, maxHp: 1, row: 0 }]);
    h.inspect.setBall({ x: 7, y: 320, vx: -100, vy: -100 }); h.inspect.update(.016);
    h.inspect.setBall({ x: 360, y: 490, vx: 0, vy: 200 }); h.inspect.update(.016);
    assert.ok(h.audioEvents.includes('wall'));
    assert.ok(h.audioEvents.includes('paddle'));
    h.inspect.loseLife();
    assert.ok(h.audioEvents.includes('life'));
    h.inspect.setLevel(2); h.inspect.completeLevel();
    assert.equal(h.audioEvents.at(-1), 'win');
});
