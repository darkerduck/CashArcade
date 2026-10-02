import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { SnakeGame, LEVELS, POWERS, DIRECTIONS } from '../snake/engine.mjs';
import { Campaign, CampaignStore, freshRecord, SAVE_KEY, PAID_KEY, BEST_KEY } from '../snake/storage.mjs';
import { ReplayGate } from '../snake/payment.mjs';
import { Tutorial, LESSONS, shouldOfferTutorial, canEnterTutorial, TUTORIAL_KEY } from '../snake/tutorial.mjs';
import { playEvents } from '../snake/audio-events.mjs';

const source = readFileSync(new URL('../snake/game.js', import.meta.url), 'utf8')
    .replace(/^import .*;\n/gm, '').replace("await import('./renderer.mjs?v=2')", 'await Promise.resolve({ SnakeRenderer: FakeSnakeRenderer })');
const flush = () => new Promise(resolve => setImmediate(resolve));
async function harness(record = null, { unavailable = false, initialData = [], offline = false } = {}) {
    const data = new Map(initialData), listeners = new Map(), elements = new Map(), sounds = [], calls = [], events = new Map(); let now = 0, raf;
    if (record) data.set(SAVE_KEY, JSON.stringify(record));
    const local = { getItem(k) { if (unavailable) throw Error('blocked'); return data.get(k) ?? null; },
        setItem(k, v) { if (unavailable) throw Error('blocked'); data.set(k, v); }, removeItem: k => data.delete(k) };
    function element(id) {
        if (!elements.has(id)) {
            const classes = new Set(), handlers = new Map(), attrs = new Map();
            const isRange = ['tutorial-speed', 'music-volume'].includes(id);
            const isButton = id.endsWith('-button') || id.endsWith('-toggle') || id.startsWith('dir-') || ['tutorial-return', 'tutorial-restart', 'tutorial-rotate', 'cancel-payment'].includes(id);
            elements.set(id, { id, tagName: isRange || id === 'text-input' ? 'INPUT' : isButton ? 'BUTTON' : 'DIV', type: isRange ? 'range' : 'text', dataset: {}, textContent: '', innerHTML: '', hidden: false, disabled: false, href: '#',
                classList: { add: k => classes.add(k), remove: k => classes.delete(k), toggle(k, on) { if (on ?? !classes.has(k)) classes.add(k); else classes.delete(k); } },
                addEventListener: (k, fn) => handlers.set(k, fn), click() { if (!this.disabled) return handlers.get('click')?.(); },
                input(value) { this.value = String(value); if (!this.disabled) return handlers.get('input')?.({ target: this }); },
                setAttribute: (k, v) => attrs.set(k, v), getAttribute(k) { return k === 'href' ? this.href : attrs.get(k) ?? null; },
                emit: (k, event) => handlers.get(k)?.(event), focus(options) { document.activeElement = this; this.focusOptions = options; },
                append() {}, closest(selector) {
                    if (selector === 'input[type="range"]') return this.tagName === 'INPUT' && this.type === 'range' ? this : null;
                    if (selector.startsWith('input,textarea')) return this.tagName === 'INPUT' ? this : null;
                    if (selector.startsWith('button,')) return this.tagName === 'BUTTON' ? this : null;
                    return null;
                }, scrollIntoView() {}, setPointerCapture() {},
                getContext: () => Object.fromEntries(['clearRect', 'fillRect', 'beginPath', 'moveTo', 'lineTo', 'stroke', 'strokeRect'].map(k => [k, () => {}])),
            });
        }
        return elements.get(id);
    }
    const directions = ['forward', 'back', 'right', 'left', 'rise', 'dive'].map(d => { const b = element(`dir-${d}`); b.dataset.direction = d; return b; });
    const document = { documentElement: { dataset: {} }, hidden: false, getElementById: element,
        querySelector: element, querySelectorAll: s => s === '[data-direction]' ? directions : [],
        addEventListener: (k, fn) => listeners.set(k, fn) };
    class SnakeRenderer {
        constructor() { this.lost = false; this.camera = { position: { values: [8, 12, 10], toArray() { return this.values.slice(); } } }; }
        load() {} ready() { return Promise.resolve(); } draw() {} events() {}
        survey(on) { if (!on) this.camera.position.values = [8, 12, 10]; }
        rotateSurvey() { this.camera.position.values[0] += 1; }
    }
    const audio = { resume() {}, play: n => sounds.push(n), musicOutput: {} }, music = { wake() {}, pause() {}, start() {}, resume() {}, duck() {} };
    const sdk = { on: (k, fn) => events.set(k, fn), handshake: async () => { if (offline) throw Error('offline'); return { origin: 'https://darkerduck.github.io', unlock_description: '再來一局' }; },
        unlock: () => new Promise((resolve, reject) => calls.push({ resolve, reject })), cancel() { calls.at(-1)?.reject({ code: 'cancelled' }); } };
    const context = vm.createContext({ document, window: { addEventListener: (k, fn) => listeners.set(k, fn),
        CashArcadeAudio: { create: () => audio }, CashArcadeMusic: { create: () => music }, CashArcadeScores: { snake: {} } },
        localStorage: local, sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} }, performance: { now: () => now },
        matchMedia: () => ({ matches: false, addEventListener() {} }), requestAnimationFrame: fn => { raf = fn; }, confirm: () => true,
        SnakeGame, LEVELS, POWERS, Campaign, CampaignStore, BEST_KEY, SAVE_KEY, ReplayGate, sdkFactory: async () => sdk, playEvents,
        Tutorial, LESSONS, shouldOfferTutorial, canEnterTutorial, FakeSnakeRenderer: SnakeRenderer, console });
    vm.runInContext(source, context); await flush(); await flush();
    const read = expression => vm.runInContext(expression, context);
    assert.equal(read('unavailable'), false, element('overlay-message').textContent);
    return { context, data, calls, sounds, element, read,
        async click(id) { await element(id).click(); await flush(); },
        async key(key, { target = 'key-target', ...options } = {}) {
            const event = { key, repeat: false, target: element(target), defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...options };
            listeners.get('keydown')(event); await flush(); return event;
        },
        async pointer(type, target, pointerId = 1) {
            const el = element(target), event = { target: el, pointerId };
            if (type === 'pointerdown') el.focus();
            el.emit(type, event); listeners.get(type)?.(event); await flush();
        },
        tick(ms) { now += ms; raf?.(now); }, async execute(code) { const result = read(code); await result; await flush(); } };
}

test('real UI defaults new players to tutorial, skips into free first campaign and exposes free re-entry', async () => {
    const h = await harness(); assert.equal(h.read('inTutorial'), true); assert.match(h.element('level-number').innerHTML, /教學/);
    assert.match(h.element('payment-note').textContent, /全部免費/); await h.click('tutorial-return'); assert.equal(h.read('inTutorial'), false);
    await h.click('start-button'); h.tick(1001); assert.equal(h.read('game.state'), 'running'); assert.equal(h.calls.length, 0);
    await h.click('tutorial-button'); assert.equal(h.read('inTutorial'), true); assert.equal(h.read('campaign.game.state'), 'paused');
    const original = h.data.get(SAVE_KEY); await h.key('r'); h.tick(1001); h.tick(100); await h.click('restart-button'); h.tick(1001);
    assert.equal(h.calls.length, 0); assert.equal(h.data.get(SAVE_KEY), original); assert.equal(h.data.get(BEST_KEY), undefined);
    await h.click('new-button'); assert.equal(h.read('inTutorial'), false); assert.equal(h.data.get(SAVE_KEY), original);
});

async function practiceHarness(options = {}) {
    const t = new Tutorial();
    while (!t.completed) {
        const i = t.lesson;
        if (t.current.kind === 'reverse') t.input('dive');
        else if (t.current.kind === 'observe') { t.startObservation(); t.observe([0, 1, 2]); t.observe([1, 1, 2]); t.resumeObservation(); }
        else { t.input(t.current.direction); t.begin(); for (let n = 0; n < 1000 && t.lesson === i; n++) t.advance(10); }
        assert.notEqual(t.game.state, 'failed');
    }
    t.enter();
    return harness(null, { initialData: [[TUTORIAL_KEY, JSON.stringify(t.snapshot())]], ...options });
}

test('free practice starts with every legal direction, same heading, touch or Space exactly once', async () => {
    for (const [key, direction] of [['ArrowUp', 'forward'], ['w', 'forward'], ['ArrowDown', 'back'], ['s', 'back'], ['ArrowRight', 'right'], ['d', 'right'], ['e', 'rise'], ['q', 'dive']]) {
        const h = await practiceHarness(); assert.equal(h.read('game.state'), 'ready');
        await h.key('a'); assert.equal(h.read('countdown'), 0); await h.key('ArrowLeft'); assert.equal(h.read('countdown'), 0);
        await h.key(key); const countdown = h.read('countdown'); assert.ok(countdown > 0);
        await h.key('e'); await h.key(key, { repeat: true }); assert.equal(h.read('countdown'), countdown);
        h.tick(1001); assert.equal(h.read('game.state'), 'running');
        const expected = direction === 'right' ? [] : [DIRECTIONS[direction]];
        assert.deepEqual(JSON.parse(JSON.stringify(h.read('game.queue'))), expected);
        assert.equal(h.sounds.filter(n => n === 'start').length, 1); assert.equal(h.calls.length, 0);
        assert.equal(h.data.has(SAVE_KEY), false); assert.equal(h.data.has(BEST_KEY), false);
        assert.equal(h.read('game.queue.length'), direction === 'right' ? 0 : 1);
    }
    for (const direction of ['forward', 'back', 'right', 'rise', 'dive']) {
        const h = await practiceHarness(); await h.click(`dir-${direction}`); h.tick(1001);
        assert.equal(h.read('game.state'), 'running'); assert.equal(h.calls.length, 0);
    }
    const h = await practiceHarness(); await h.key(' '); h.tick(1001);
    assert.equal(h.read('game.state'), 'running'); assert.equal(h.calls.length, 0);
});

test('paused or reloaded practice rejects direction-start and resumes only through explicit controls', async () => {
    for (const key of ['p', 'Escape', ' ']) {
        const h = await practiceHarness(); await h.key('e'); h.tick(1001); await h.execute('pause(true)');
        const saved = h.read('game.snapshot()'); const reload = await harness(null, { initialData: h.data });
        await reload.key('w'); await reload.click('dir-rise');
        assert.equal(reload.read('game.state'), 'paused'); assert.equal(reload.read('countdown'), 0);
        assert.deepEqual(JSON.parse(JSON.stringify(reload.read('game.snapshot()'))), saved);
        await reload.key(key); assert.ok(reload.read('countdown') > 0); reload.tick(1001);
        assert.equal(reload.read('game.state'), 'running'); assert.equal(reload.calls.length, 0);
    }
});

test('pointer slider release returns focus without scrolling, starting, or interfering with keyboard navigation', async () => {
    for (const id of ['tutorial-speed', 'music-volume']) {
        const h = await practiceHarness();
        await h.pointer('pointerdown', id, 7); await h.pointer('pointerup', id, 8);
        assert.equal(h.read('document.activeElement.id'), id);
        await h.pointer('pointerup', id, 7);
        assert.equal(h.read('document.activeElement.id'), 'game-canvas');
        assert.equal(h.element('game-canvas').focusOptions.preventScroll, true);
        assert.equal(h.read('game.state'), 'ready'); assert.equal(h.read('countdown'), 0);
        await h.pointer('pointerdown', id, 9); await h.pointer('pointercancel', id, 9);
        assert.equal(h.read('document.activeElement.id'), 'game-canvas');
        h.element('key-target').focus(); h.element(id).emit('pointerdown', { pointerId: 10 });
        await h.pointer('pointerup', id, 10); assert.equal(h.read('document.activeElement.id'), 'game-canvas');
        await h.pointer('pointerdown', id, 11); h.element('theme-toggle').focus();
        await h.pointer('pointerup', id, 11); assert.equal(h.read('document.activeElement.id'), 'theme-toggle');
        for (const key of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'Tab']) {
            const event = await h.key(key, { target: id, repeat: true }); assert.equal(event.defaultPrevented, false);
            assert.equal(h.read('countdown'), 0);
        }
        await h.key('e', { target: id }); h.tick(1001); assert.equal(h.read('game.state'), 'running');
        await h.key('p', { target: id }); assert.equal(h.read('game.state'), 'paused');
        await h.key('Escape', { target: id }); h.tick(1001); assert.equal(h.read('game.state'), 'running');
        await h.key('r', { target: id }); await h.key('r', { target: id }); h.tick(1001);
        assert.equal(h.read('game.state'), 'running'); assert.equal(h.calls.length, 0); assert.equal(h.data.has(BEST_KEY), false);
    }
});

test('button focus keeps letter controls, native Space/Enter dispatches once, and text/browser shortcuts stay untouched', async () => {
    for (const id of ['theme-toggle', 'sound-toggle', 'music-toggle', 'fullscreen-button', 'pause-button']) {
        const h = await practiceHarness();
        for (const key of [' ', 'Enter']) { assert.equal((await h.key(key, { target: id })).defaultPrevented, false); assert.equal(h.read('countdown'), 0); }
        await h.key('e', { target: id }); h.tick(1001); assert.equal(h.read('game.state'), 'running');
        await h.key('p', { target: id }); assert.equal(h.read('game.state'), 'paused'); assert.equal(h.calls.length, 0);
    }
    const h = await practiceHarness();
    const event = await h.key(' ', { target: 'start-button' }); assert.equal(event.defaultPrevented, false);
    assert.equal(h.read('countdown'), 0); await h.click('start-button'); const countdown = h.read('countdown');
    await h.click('start-button'); assert.equal(h.read('countdown'), countdown); h.tick(1001);
    assert.equal(h.sounds.filter(n => n === 'start').length, 1);
    const before = h.read('game.snapshot()');
    for (const options of [{ target: 'text-input' }, { ctrlKey: true }, { altKey: true }, { metaKey: true }]) {
        assert.equal((await h.key('r', options)).defaultPrevented, false);
        assert.deepEqual(JSON.parse(JSON.stringify(h.read('game.snapshot()'))), before);
    }
    assert.equal(h.calls.length, 0);
});

test('every actual tutorial retry control stays free after death and rapid R presses do not invoke the SDK', async () => {
    for (const control of ['start-button', 'restart-button', 'r']) {
        const h = await harness(null, { offline: true }); await h.execute("tutorial.game.fail('wall', tutorial.game.peek()); showState(); controls(); save()");
        if (control === 'r') { await h.key('r'); await h.key('r'); await h.key('r'); } else await h.click(control);
        h.tick(1001); assert.equal(h.read('game.state'), 'running'); assert.equal(h.calls.length, 0);
        assert.ok(h.data.has(TUTORIAL_KEY)); assert.equal(h.data.has(SAVE_KEY), false);
    }
});

test('all guided UI objectives, accessible rotation and free practice complete without official score writes', async () => {
    const h = await harness();
    for (let i = 0; i < LESSONS.length; i++) {
        assert.equal(h.read('tutorial.lesson'), i);
        if (LESSONS[i].kind === 'reverse') await h.key('q');
        else if (LESSONS[i].kind === 'observe') {
            await h.click('start-button'); assert.equal(h.element('start-button').disabled, true);
            await h.click('tutorial-rotate'); assert.equal(h.element('start-button').disabled, false);
            await h.click('start-button');
        } else {
            await h.click('start-button'); h.tick(1001);
            for (let n = 0; n < 80 && h.read('tutorial.lesson') === i; n++) h.tick(100);
        }
        assert.equal(h.read('tutorial.lesson'), i + 1);
    }
    assert.equal(h.read('tutorial.completed'), true); assert.equal(h.read('game.tutorialPractice'), true);
    assert.equal(h.read('game.state'), 'ready'); assert.equal(h.calls.length, 0);
    assert.equal(h.sounds.filter(n => n === 'food').length, 10); assert.equal(h.data.has(BEST_KEY), false); assert.equal(h.data.has(SAVE_KEY), false);
    await h.click('start-button'); h.tick(1001); h.tick(300); await h.execute('pause(true)');
    const saved = h.read('game.snapshot()'); const reload = await harness(null, { initialData: h.data });
    assert.equal(reload.read('inTutorial'), true); assert.equal(reload.read('game.state'), 'paused');
    assert.equal(reload.read('tutorial.completed'), true); assert.equal(reload.read('game.time'), saved.time);
    assert.deepEqual(JSON.parse(JSON.stringify(reload.read('game.snake'))), saved.snake); assert.equal(reload.calls.length, 0);
    await reload.click('tutorial-return'); const formal = await harness(null, { initialData: reload.data });
    assert.equal(formal.read('inTutorial'), false); assert.equal(formal.read('campaign.record.played'), false);
});

test('existing failure/pending/paid-ready restores original campaign through tutorial and retains paid gate', async () => {
    for (const replay of ['open', 'pending', 'paid-ready']) {
        const r = freshRecord(); r.played = true; r.replay = replay; r.intent = replay === 'pending' ? 'retry' : null;
        const g = new SnakeGame(7, 500); g.fail('wall', g.peek()); r.game = g.snapshot();
        const h = await harness(r); assert.equal(h.read('inTutorial'), false);
        await h.click('tutorial-button'); const original = h.data.get(SAVE_KEY);
        await h.click('restart-button'); h.tick(1001); await h.click('tutorial-return');
        assert.equal(h.read('game.levelIndex'), 7); assert.equal(h.read('game.score'), 500); assert.equal(h.read('game.state'), 'failed');
        assert.equal(h.data.get(SAVE_KEY), original); assert.equal(h.calls.length, 0);
        const start = h.element('start-button').click(); await flush();
        if (replay === 'paid-ready') { await start; assert.equal(h.calls.length, 0); }
        else { assert.equal(h.calls.length, 1); assert.equal(h.element('tutorial-button').disabled, true); h.calls[0].reject({ code: 'cancelled' }); await start; }
    }
});

test('storage unavailable leaves tutorial playable and never overwrites or opens a formal paid round', async () => {
    const h = await harness(null, { unavailable: true }); assert.equal(h.read('storageError'), true);
    await h.click('tutorial-button'); assert.equal(h.read('inTutorial'), true); await h.click('start-button'); h.tick(1001); h.tick(100);
    assert.equal(h.read('game.state'), 'running'); assert.equal(h.calls.length, 0); assert.match(h.element('storage-note').textContent, /儲存不可用/);
    await h.click('tutorial-return'); assert.equal(h.read('storageError'), true); assert.equal(h.calls.length, 0); assert.equal(h.data.has(SAVE_KEY), false);
});

test('practice speed slider applies immediately, persists across reload/retry, and never touches formal saves or unlock', async () => {
    const h = await harness(); assert.equal(h.read('game.delay()'), 800); assert.equal(h.element('tutorial-speed').value, '0.5');
    assert.equal(h.element('tutorial-speed-value').textContent, '0.5×');
    h.element('tutorial-speed').input(2); assert.equal(h.read('game.delay()'), 200);
    assert.equal(h.element('tutorial-speed-value').textContent, '2×'); assert.match(h.element('tutorial-speed-detail').textContent, /200ms/);
    await h.click('start-button'); assert.equal(h.element('tutorial-speed').disabled, true); h.tick(1001);
    assert.equal(h.element('tutorial-speed').disabled, false);
    for (let i = 0; i < 6; i++) h.tick(100);
    assert.equal(h.read('tutorial.lesson'), 1); assert.equal(h.read('game.delay()'), 200);
    const reload = await harness(null, { initialData: h.data }); assert.equal(reload.read('game.delay()'), 200);
    assert.equal(reload.element('tutorial-speed').value, '2'); await reload.key('r'); reload.tick(1001);
    assert.equal(reload.read('game.delay()'), 200); assert.equal(reload.calls.length, 0);
    assert.equal(reload.data.has(SAVE_KEY), false); assert.equal(reload.data.has(BEST_KEY), false);
    await reload.click('tutorial-return'); assert.equal(reload.read('game.delay()'), 250);
    assert.equal(reload.element('tutorial-panel').hidden, true); assert.equal(reload.read('campaign.record.played'), false);
});
