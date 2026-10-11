import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url), API = require('../reactor/engine.js');
const source = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const html = source('reactor/index.html'), controller = source('reactor/game.js');
function harness(denyStorage = false) {
    let liveGame, now = 0, raf; const calls = [], store = new Map(), handlers = {}, docHandlers = {};
    class Element {
        constructor(id) { this.id = id; this.textContent = ''; this.hidden = id === 'toast'; this.disabled = false; this.style = {}; this.dataset = {}; this.attrs = {}; this.handlers = {}; this.value = '65'; this.classes = new Set(); this.classList = { add: s => this.classes.add(s), remove: s => this.classes.delete(s), toggle: (s, value) => value ? this.classes.add(s) : this.classes.delete(s) }; }
        addEventListener(type, fn) { (this.handlers[type] ||= []).push(fn); }
        setAttribute(name, val) { this.attrs[name] = val; }
        matches() { return false; } closest() { return null; } focus() {} setPointerCapture() {}
        getBoundingClientRect() { return { left: 0, top: 0, width: 600, height: 920 }; }
        emit(type, props = {}) { const e = { preventDefault() {}, currentTarget: this, target: this, pointerType: 'touch', button: 0, pointerId: 1, ...props }; for (const fn of this.handlers[type] || []) fn(e); }
    }
    const els = Object.fromEntries([...html.matchAll(/id="([^"]+)"/g)].map(m => [m[1], new Element(m[1])]));
    const missions = [0, 1, 2].map(i => { const el = new Element('row-' + i); el.dataset.mission = String(i); return el; });
    const document = { documentElement: { dataset: {} }, hidden: false, getElementById: id => els[id], querySelectorAll: () => missions, addEventListener: (name, fn) => { (docHandlers[name] ||= []).push(fn); } };
    const window = { addEventListener: (name, fn) => { (handlers[name] ||= []).push(fn); } };
    const ctx = { document, window, performance: { now: () => now }, requestAnimationFrame: fn => { raf = fn; },
        localStorage: { getItem: key => { if (denyStorage) throw Error('denied'); return store.get(key) ?? null; }, setItem: (key, value) => { if (denyStorage) throw Error('denied'); store.set(key, value); } },
        ReactorPinball: { ...API, Game: class extends API.Game { constructor() { super(); liveGame = this; } } },
        ReactorPinballRenderer: { Renderer: class { reset() { calls.push('render-reset'); } consume() {} draw() {} } },
        CashArcadeAudio: { create: options => { calls.push(['audio-options', options]); return { resume: () => calls.push('sound-resume'), play: effect => calls.push(['sound', effect]), musicOutput() {} }; } },
        CashArcadeMusic: { create: options => { calls.push(['music-options', options]); return Object.fromEntries(['start', 'pause', 'resume', 'wake', 'phase'].map(name => [name, (...args) => calls.push(['music', name, ...args])])); } },
        CashArcadeExpansionScores: { reactor: { name: 'reactor' } }, console,
    };
    vm.createContext(ctx); vm.runInContext(controller, ctx);
    const event = (type, props = {}, doc = false) => { const e = { code: '', repeat: false, target: els['game-canvas'], preventDefault() {}, ...props }; for (const fn of (doc ? docHandlers : handlers)[type] || []) fn(e); };
    const frame = (count = 1) => { for (let i = 0; i < count; i++) { now += 1000 / 60; raf(now); } };
    return { get game() { return liveGame; }, els, calls, store, document, event, frame, start() { els.start.emit('click'); frame(); } };
}
test('page has Traditional Chinese controls, ordered local scripts and no checkout dependency', () => {
    assert.match(html, /lang="zh-Hant"/); assert.match(html, /永遠免費/);
    const scripts = [...html.matchAll(/<script src="([^"?]+)/g)].map(m => m[1]);
    assert.deepEqual(scripts, ['../audio.js', '../music.js', '../expansion-scores.js', './engine.js', './renderer.js', './game.js']);
    for (const path of scripts) assert.ok(existsSync(new URL('../reactor/' + path, import.meta.url)), path);
    assert.doesNotMatch(html, /https?:\/\/[^" ]+\.js|payment-gate|CashLink/i);
    const ids = [...html.matchAll(/id="([^"]+)"/g)].map(m => m[1]); assert.equal(new Set(ids).size, ids.length);
    for (const m of controller.matchAll(/\$\('([^']+)'\)/g)) assert.ok(ids.includes(m[1]), m[1]);
});
test('ready stays silent; start uses shared sound/music, pause/resume continues the score', () => {
    const h = harness(); assert.equal(h.game.state, 'ready'); assert.ok(!h.calls.some(c => c[0] === 'music' && c[1] === 'start'));
    h.start(); assert.equal(h.game.state, 'running'); assert.equal(h.els.overlay.hidden, true);
    assert.ok(h.calls.some(c => c[0] === 'music' && c[1] === 'start' && c[2] === 1));
    h.els.pause.emit('click'); assert.equal(h.game.state, 'paused'); assert.equal(h.els.overlay.hidden, false);
    h.els.start.emit('click'); assert.equal(h.game.state, 'running'); assert.ok(h.calls.some(c => c[0] === 'music' && c[1] === 'resume'));
    const sound = h.calls.find(c => c[0] === 'audio-options')[1], music = h.calls.find(c => c[0] === 'music-options')[1];
    assert.equal(sound.musicMix, true); assert.equal(sound.storageKey, 'casharcade-reactor-sound-muted'); assert.equal(music.storagePrefix, 'casharcade-reactor-music'); assert.equal(typeof music.audioOutput, 'function');
});
test('two simultaneous thumb pointers control each flipper independently', () => {
    const h = harness(); h.start(); h.els.left.emit('pointerdown', { pointerId: 1 }); h.els.right.emit('pointerdown', { pointerId: 2 }); h.frame(8);
    assert.equal(h.game.flippers[0].angle, h.game.flippers[0].active); assert.equal(h.game.flippers[1].angle, h.game.flippers[1].active);
    h.els.left.emit('pointerup', { pointerId: 1 }); h.frame(8);
    assert.equal(h.game.flippers[0].angle, h.game.flippers[0].rest); assert.equal(h.game.flippers[1].angle, h.game.flippers[1].active);
    h.els.right.emit('pointercancel', { pointerId: 2 }); h.frame(8); assert.equal(h.game.flippers[1].angle, h.game.flippers[1].rest);
});
test('canvas lower-half controls use normalized coordinates and release on capture loss', () => {
    const h = harness(); h.start(); h.els['game-canvas'].emit('pointerdown', { clientX: 40, clientY: 760, pointerId: 5 }); h.frame(8);
    assert.equal(h.game.flippers[0].angle, h.game.flippers[0].active);
    h.els['game-canvas'].emit('lostpointercapture', { pointerId: 5 }); h.frame(8); assert.equal(h.game.flippers[0].angle, h.game.flippers[0].rest);
});
test('quick plunger tap launches; cancellation clears charge without firing', () => {
    const h = harness(); h.start(); h.els.plunger.emit('pointerdown'); h.frame(20); assert.ok(h.game.plungerCharge > 0);
    h.els.plunger.emit('pointercancel'); h.frame(2); assert.ok(h.game.staged); assert.equal(h.game.plungerCharge, 0);
    h.els.plunger.emit('pointerdown'); h.els.plunger.emit('pointerup'); assert.equal(h.game.staged, undefined);
    assert.equal(h.game.balls.length, 1);
});
test('keyboard charge launches on keyup; native form keys are ignored', () => {
    const h = harness(); h.start(); h.event('keydown', { code: 'Space', target: { matches: () => true } }); h.frame(5); assert.equal(h.game.plungerCharge, 0);
    h.event('keydown', { code: 'Space' }); h.frame(30); assert.ok(h.game.plungerCharge > .4);
    h.event('keyup', { code: 'Space' }); assert.equal(h.game.staged, undefined);
});
test('visibility loss pauses, clears all input, and never resumes automatically', () => {
    const h = harness(); h.start(); h.event('keydown', { code: 'Space' }); h.els.left.emit('pointerdown'); h.frame(10);
    h.document.hidden = true; h.event('visibilitychange', {}, true); const time = h.game.time; h.frame(20);
    assert.equal(h.game.state, 'paused'); assert.equal(h.game.time, time); assert.equal(h.game.plungerCharge, 0);
    h.document.hidden = false; h.event('visibilitychange', {}, true); assert.equal(h.game.state, 'paused');
    h.els.start.emit('click'); h.frame(10); assert.ok(h.game.staged); assert.equal(h.game.flippers[0].angle, h.game.flippers[0].rest);
});
test('window blur pauses and restart clears previous pointers, score and overload', () => {
    const h = harness(); h.start(); h.els.right.emit('pointerdown', { pointerId: 9 }); h.frame(10); h.game.score = 3210; h.game._charge(100);
    h.event('blur'); assert.equal(h.game.state, 'paused'); h.els.retry.emit('click'); h.frame(8);
    assert.equal(h.game.state, 'running'); assert.equal(h.game.score, 0); assert.equal(h.game.overload, 0); assert.ok(h.game.staged);
    assert.equal(h.game.flippers[1].angle, h.game.flippers[1].rest); assert.ok(Number(h.store.get('casharcade-reactor-best-v1')) >= 3210);
});
test('game over renders the final score once and pauses music, with free retry', () => {
    const h = harness(); h.start(); h.game.score = 9876;
    for (let i = 0; i < 3; i++) { h.game.launch(); h.game._saveUntil = 0; h.game.balls[0].y = 980; h.frame(2); }
    assert.equal(h.game.state, 'over'); assert.equal(h.els.overlay.hidden, false); assert.match(h.els['overlay-message'].textContent, /9,876/);
    assert.match(h.els.start.textContent, /免費/); assert.ok(h.calls.some(c => c[0] === 'music' && c[1] === 'pause'));
    h.els.start.emit('click'); assert.equal(h.game.state, 'running'); assert.equal(h.game.ballsRemaining, 3);
});
test('unavailable storage cannot block start, scoring, pause or restart', () => {
    const h = harness(true); h.start(); h.game.score = 400; h.els.pause.emit('click'); assert.match(h.els['storage-note'].textContent, /無法保存/);
    h.els.retry.emit('click'); assert.equal(h.game.state, 'running');
});

test('focused controls support Space and Enter holds without requiring pointer events', () => {
    const h = harness(); h.start(); h.els.left.emit('keydown', { code: 'Space' }); h.frame(8);
    assert.equal(h.game.flippers[0].angle, h.game.flippers[0].active);
    h.els.left.emit('keyup', { code: 'Space' }); h.frame(8); assert.equal(h.game.flippers[0].angle, h.game.flippers[0].rest);
    h.els.plunger.emit('keydown', { code: 'Enter' }); h.frame(20); assert.ok(h.game.plungerCharge > .2);
    h.els.plunger.emit('keyup', { code: 'Enter' }); assert.equal(h.game.staged, undefined);
});
