import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url), engine = require('../gravity/engine.js'), storageApi = require('../gravity/storage.js');
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const html = read('gravity/index.html'), controller = read('gravity/game.js');
test('page has local ordered scripts, standalone free play, shared music and all favicons', () => {
    const scripts = [...html.matchAll(/<script src="([^"?]+)/g)].map(m => m[1]);
    assert.deepEqual(scripts, ['../audio.js', '../music.js', '../expansion-scores.js', './engine.js', './storage.js', './renderer.js', './game.js']);
    for (const path of scripts) assert.ok(existsSync(new URL('../gravity/' + path, import.meta.url)));
    assert.doesNotMatch(html + controller, /cashlink|payment|https?:\/\/[^" ]+\.js/i);
    for (const pattern of [/favicon-32\.png/, /favicon-16\.png/, /sizes="180x180"/, /manifest/, /brand\.css/, /aria-live="polite"/]) assert.match(html, pattern);
    const ids = [...html.matchAll(/id="([^"]+)"/g)].map(m => m[1]); assert.equal(new Set(ids).size, ids.length);
    for (const m of controller.matchAll(/\$\('([^']+)'\)/g)) assert.ok(ids.includes(m[1]), m[1]);
});
function setup(saved = null) {
    const events = new Map(), winEvents = new Map(), elements = new Map(), audio = [], musicCalls = [], scheduled = [];
    function element(id = '') {
        const handlers = new Map(), classes = new Set();
        return { id, hidden: false, disabled: false, checked: false, children: [], style: {}, dataset: {}, textContent: '', innerHTML: '', attrs: {},
            classList: { add: k => classes.add(k), remove: k => classes.delete(k), contains: k => classes.has(k) },
            addEventListener(type, fn) { if (!handlers.has(type)) handlers.set(type, []); handlers.get(type).push(fn); },
            fire(type, extra = {}) { for (const fn of handlers.get(type) || []) fn({ target: this, preventDefault() {}, detail: 1, ...extra }); },
            setAttribute(k, v) { this.attrs[k] = String(v); }, replaceChildren() { this.children = []; }, append(child) { this.children.push(child); },
            focus() {}, setPointerCapture() {}, matches() { return false; }, closest() { return null; }, requestFullscreen: async () => {} };
    }
    for (const m of html.matchAll(/id="([^"]+)"/g)) elements.set(m[1], element(m[1]));
    const document = { documentElement: { dataset: {} }, hidden: false, fullscreenElement: null,
        getElementById: id => { assert.ok(elements.has(id), id); return elements.get(id); }, createElement: () => element(), querySelector: () => element(),
        addEventListener(type, fn) { if (!events.has(type)) events.set(type, []); events.get(type).push(fn); } };
    const values = new Map(); if (saved) values.set(storageApi.KEY, JSON.stringify(saved));
    const localStorage = { getItem: k => values.get(k) || null, setItem: (k, v) => values.set(k, v) };
    const context = { document, localStorage, GravityCourier: engine, GravityCourierStorage: { ...storageApi, create: () => storageApi.create(localStorage) },
        GravityCourierRenderer: { Renderer: class { constructor() { this.effects = []; } render() {} event() {} } },
        CashArcadeAudio: { create: () => ({ resume() {}, play: name => audio.push(name), musicOutput() {} }) },
        CashArcadeMusic: { create: () => Object.fromEntries(['start', 'pause', 'resume', 'wake'].map(name => [name, (...args) => musicCalls.push([name, ...args])])) },
        CashArcadeExpansionScores: { gravity: {} }, matchMedia: () => ({ matches: false }), innerWidth: 1000, innerHeight: 900,
        requestAnimationFrame: callback => scheduled.push(callback), window: { addEventListener(type, fn) { winEvents.set(type, fn); } } };
    vm.createContext(context); vm.runInContext(controller, context);
    let now = 100;
    const frame = (count = 1) => { for (let i = 0; i < count; i++) { now += 1000 / 60; scheduled.shift()(now); } };
    const dispatch = (type, extra = {}) => { for (const fn of events.get(type) || []) fn({ code: '', target: element(), preventDefault() {}, repeat: false, ...extra }); };
    return { context, document, elements, frame, dispatch, musicCalls, audio, snapshot: () => context.GravityCourierApp.snapshot(), blur: () => winEvents.get('blur')() };
}
test('controller starts, flips once per press, ignores repeat/native form input and pauses on hidden/blur', () => {
    const env = setup(); env.frame(); assert.equal(env.snapshot().state, 'ready');
    env.elements.get('start').fire('click'); env.frame(2); assert.equal(env.snapshot().state, 'running');
    env.dispatch('keydown', { code: 'Space' }); const flips = env.snapshot().flips; assert.equal(flips, 1);
    env.frame(12); env.dispatch('keydown', { code: 'Space', repeat: true }); assert.equal(env.snapshot().flips, flips);
    env.dispatch('keydown', { code: 'Space', target: { matches: () => true } }); assert.equal(env.snapshot().flips, flips);
    env.document.hidden = true; env.dispatch('visibilitychange'); assert.equal(env.snapshot().state, 'paused');
    const time = env.snapshot().time; env.frame(20); assert.equal(env.snapshot().time, time);
    env.elements.get('start').fire('click'); assert.equal(env.snapshot().state, 'running'); env.blur(); assert.equal(env.snapshot().state, 'paused');
    assert.ok(env.musicCalls.some(x => x[0] === 'pause')); assert.ok(env.musicCalls.some(x => x[0] === 'resume'));
});
test('pointer cancellation clears state; multiple touches cannot double flip; retry resets the attempt', () => {
    const env = setup(); env.elements.get('start').fire('click'); const button = env.elements.get('flip');
    button.fire('pointerdown', { pointerId: 1, button: 0 }); assert.equal(env.snapshot().flips, 1); env.frame(12);
    button.fire('pointerdown', { pointerId: 2, button: 0 }); assert.equal(env.snapshot().flips, 1);
    button.fire('pointercancel', { pointerId: 1 }); assert.equal(button.classList.contains('active'), false);
    button.fire('pointerdown', { pointerId: 3, button: 0 }); assert.equal(env.snapshot().flips, 2);
    button.fire('lostpointercapture', { pointerId: 3 }); assert.equal(button.classList.contains('active'), false);
    env.elements.get('retry').fire('click'); assert.equal(env.snapshot().flips, 0); assert.equal(env.snapshot().x, 100); assert.equal(env.snapshot().time, 0);
});
test('controller delivery records once, unlocks next route, and next button advances safely', () => {
    const env = setup(); env.elements.get('start').fire('click'); let cursor = 0;
    for (let i = 0; i < 1500 && env.snapshot().state === 'running'; i++) {
        if (env.snapshot().x >= engine.LEVELS[0].route[cursor]) { env.dispatch('keydown', { code: 'Space' }); cursor++; }
        env.frame();
    }
    assert.equal(env.snapshot().state, 'delivered'); assert.equal(env.snapshot().unlocked, 2); assert.equal(env.snapshot().stars, 3);
    const stored = JSON.parse(env.context.localStorage.getItem(storageApi.KEY)); assert.equal(stored.records[0].deliveries, 1);
    env.frame(30); assert.equal(JSON.parse(env.context.localStorage.getItem(storageApi.KEY)).records[0].deliveries, 1);
    env.elements.get('start').fire('click'); assert.equal(env.snapshot().level, 1); assert.equal(env.snapshot().state, 'running');
    assert.equal(env.elements.get('levels').children[2].disabled, true);
});
test('saved progress returns to the selected route in ready state, with preferences', () => {
    const data = storageApi.fresh(); storageApi.complete(data, 0, { state: 'delivered', stars: 3, time: 11, collected: [0, 1, 2] }); data.selected = 1; data.reducedMotion = true;
    const env = setup(data); assert.equal(env.snapshot().level, 1); assert.equal(env.snapshot().state, 'ready'); assert.equal(env.snapshot().unlocked, 2); assert.equal(env.elements.get('motion').checked, true);
});
