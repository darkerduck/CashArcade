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
        constructor(id, tagName = 'div') { this.id = id; this.tagName = tagName; this.textContent = ''; this.hidden = id === 'toast'; this.disabled = false; this.style = {}; this.dataset = {}; this.attrs = {}; this.handlers = {}; this.value = '65'; this.classes = new Set(); this.classList = { add: s => this.classes.add(s), remove: s => this.classes.delete(s), toggle: (s, value) => value ? this.classes.add(s) : this.classes.delete(s) }; }
        addEventListener(type, fn) { (this.handlers[type] ||= []).push(fn); }
        setAttribute(name, val) { this.attrs[name] = val; }
        matches(selector) { return selector.split(',').includes(this.tagName); } closest(selector) { return this.matches(selector) ? this : null; } focus() {} setPointerCapture() {}
        getBoundingClientRect() { return { left: 0, top: 0, width: 600, height: 920 }; }
        emit(type, props = {}) {
            const e = { code: '', repeat: false, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, currentTarget: this, target: this, pointerType: 'touch', button: 0, pointerId: 1, ...props };
            for (const fn of this.handlers[type] || []) fn(e);
            if (type === 'keydown' || type === 'keyup') for (const fn of handlers[type] || []) fn(e);
            return e;
        }
    }
    const els = Object.fromEntries([...html.matchAll(/<([a-z][a-z0-9]*)\b[^>]*id="([^"]+)"/g)].map(m => [m[2], new Element(m[2], m[1])]));
    const missions = [0, 1, 2].map(i => { const el = new Element('row-' + i); el.dataset.mission = String(i); return el; });
    const document = { documentElement: { dataset: {} }, hidden: false, getElementById: id => els[id], querySelectorAll: () => missions, addEventListener: (name, fn) => { (docHandlers[name] ||= []).push(fn); } };
    const window = { addEventListener: (name, fn) => { (handlers[name] ||= []).push(fn); } };
    const ctx = { document, window, performance: { now: () => now }, requestAnimationFrame: fn => { raf = fn; },
        localStorage: { getItem: key => { if (denyStorage) throw Error('denied'); return store.get(key) ?? null; }, setItem: (key, value) => { if (denyStorage) throw Error('denied'); store.set(key, value); } },
        ReactorPinball: { ...API, Game: class extends API.Game { constructor() { super(); liveGame = this; } } },
        ReactorPinballRenderer: { Renderer: class { reset() { calls.push('render-reset'); } consume(events) { for (const event of events) calls.push(['render-event', event.type]); } draw() {} } },
        CashArcadeAudio: { create: options => { calls.push(['audio-options', options]); return { resume: () => calls.push('sound-resume'), play: effect => calls.push(['sound', effect]), musicOutput() {} }; } },
        CashArcadeMusic: { create: options => { calls.push(['music-options', options]); return Object.fromEntries(['start', 'pause', 'resume', 'wake', 'phase'].map(name => [name, (...args) => calls.push(['music', name, ...args])])); } },
        CashArcadeExpansionScores: { reactor: { name: 'reactor' } }, console,
    };
    vm.createContext(ctx); vm.runInContext(controller, ctx);
    const event = (type, props = {}, doc = false) => { const e = { code: '', repeat: false, target: els['game-canvas'], defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...props }; for (const fn of (doc ? docHandlers : handlers)[type] || []) fn(e); return e; };
    const frame = (count = 1) => { for (let i = 0; i < count; i++) { now += 1000 / 60; raf(now); } };
    // Model the native button default action after the controller and bubbling
    // handlers run: Enter clicks on keydown, Space clicks on keyup.
    const nativeButtonKey = (id, type, props = {}) => {
        const el = els[id], event = el.emit(type, props);
        if (!el.disabled && !event.defaultPrevented && ((type === 'keydown' && event.code === 'Enter') || (type === 'keyup' && event.code === 'Space'))) el.emit('click', { detail: 0 });
        return event;
    };
    return { nativeButtonKey, get game() { return liveGame; }, els, calls, store, document, event, frame, start() { els.start.emit('click'); frame(); } };
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
test('keyboard and touch-plunger launches enter the table and stay out of the shooter lane', () => {
    for (const control of ['keyboard', 'touch']) for (const frames of [0, 16, 48, 70]) {
        const h = harness(); h.start(); const ball = h.game.staged;
        if (control === 'keyboard') h.event('keydown', { code: 'Space' });
        else h.els.plunger.emit('pointerdown', { pointerId: 3 });
        h.frame(frames);
        if (control === 'keyboard') h.event('keyup', { code: 'Space' });
        else h.els.plunger.emit('pointerup', { pointerId: 3 });
        assert.equal(ball.staged, false); let entered = false;
        for (let i = 0; i < 720 && h.game.balls.includes(ball); i++) {
            h.frame(); entered ||= ball.inField;
            if (entered && ball.y <= 897) assert.ok(ball.x <= 513.001, `${control}, charge frames ${frames}`);
        }
        assert.ok(entered, `${control}, charge frames ${frames} did not enter`);
        h.els.retry.emit('click'); assert.equal(h.game.staged.inField, false); assert.equal(h.game.balls.length, 1);
    }
});


function fieldBall(h) {
    const ball = h.game.staged || h.game.balls[0];
    Object.assign(ball, { x: 291, y: 650, vx: 0, vy: 0, staged: false, inField: true });
    h.frame(4); return ball;
}
function nudgeEvents(h) { return h.calls.filter(call => call[0] === 'render-event' && call[1] === 'nudge').length; }
function waitForNudge(h) {
    // Keep the fixture away from drains while testing real cooldown/heat ticks.
    for (let i = 0; i < 60 && h.game.nudgeCooldown > 1e-9; i++) {
        for (const ball of h.game.balls) Object.assign(ball, { x: 291, y: 650, vx: 0, vy: 0 });
        h.frame();
    }
    h.frame(4); assert.equal(h.game.nudgeCooldown, 0);
}
function tiltViaButton(h) {
    for (let i = 0; i < 3; i++) {
        h.els.nudge.emit('click');
        if (i < 2) waitForNudge(h);
    }
    assert.equal(h.game.tilted, true);
}

test('nudge has a separate mobile row, visible penalty, keyboard shortcut and fresh asset versions', () => {
    assert.match(html, /class="touch-controls"[\s\S]*id="right"[\s\S]*class="nudge-controls"/);
    assert.match(html, /id="nudge"[^>]*type="button"[^>]*aria-keyshortcuts="Z"[^>]*aria-describedby="nudge-status nudge-help"/);
    assert.match(html, /id="nudge-help">Z 或點按搖晃。[^<]*TILT[^<]*擋板、得分與救球/);
    for (const [asset, version] of [['style.css', 2], ['engine.js', 3], ['renderer.js', 2], ['game.js', 2]]) assert.ok(html.includes(`./${asset}?v=${version}`));
    const css = source('reactor/style.css');
    assert.match(css, /\.nudge-controls\{display:grid;grid-template-columns:minmax\(135px,\.9fr\) minmax\(0,1fr\)/);
    assert.match(css, /\.nudge-controls button\{min-height:48px/);
});
test('KeyZ nudges once per press and held or repeated keys cannot fire after cooldown', () => {
    const h = harness(); h.start(); fieldBall(h);
    assert.equal(h.els.nudge.disabled, false);
    const ball = h.game.balls[0], before = ball.vy;
    h.event('keydown', { code: 'KeyZ' });
    assert.equal(nudgeEvents(h), 1); assert.ok(ball.vy < before);
    assert.equal(h.els.nudge.disabled, true); assert.match(h.els['nudge-status'].textContent, /冷卻/);
    waitForNudge(h); assert.equal(h.els.nudge.disabled, false);
    h.event('keydown', { code: 'KeyZ', repeat: true });
    h.event('keydown', { code: 'KeyZ' });
    assert.equal(nudgeEvents(h), 1); assert.equal(h.game.tilted, false);
    h.event('keyup', { code: 'KeyZ' }); h.event('keydown', { code: 'KeyZ' });
    assert.equal(nudgeEvents(h), 2); assert.ok(Number(h.els['nudge-meter'].attrs['aria-valuenow']) > 50);
    assert.equal(h.els['nudge-controls'].classes.has('warning'), true);
});
test('touch and mouse use one semantic click, with no hold or pointerdown auto-fire', () => {
    for (const pointerType of ['touch', 'mouse']) {
        const h = harness(); h.start(); fieldBall(h);
        h.els.nudge.emit('pointerdown', { pointerType }); h.frame(8);
        assert.equal(nudgeEvents(h), 0);
        h.els.nudge.emit('pointerup', { pointerType }); h.els.nudge.emit('click', { pointerType, detail: 1 });
        assert.equal(nudgeEvents(h), 1);
        h.els.nudge.emit('click', { pointerType, detail: 1 }); assert.equal(nudgeEvents(h), 1);
        waitForNudge(h); assert.equal(nudgeEvents(h), 1);
        h.els.nudge.emit('pointerdown', { pointerType }); h.els.nudge.emit('pointercancel', { pointerType });
        assert.equal(nudgeEvents(h), 1);
        h.els.nudge.emit('click', { detail: 0 }); assert.equal(nudgeEvents(h), 2);
    }
});
test('focused nudge uses native Enter and Space clicks exactly once and blocks key repeats', () => {
    for (const code of ['Enter', 'Space']) {
        const h = harness(); h.start(); fieldBall(h);
        const down = h.nativeButtonKey('nudge', 'keydown', { code });
        assert.equal(down.defaultPrevented, false);
        assert.equal(nudgeEvents(h), code === 'Enter' ? 1 : 0);
        if (code === 'Enter') waitForNudge(h);
        assert.equal(h.nativeButtonKey('nudge', 'keydown', { code, repeat: true }).defaultPrevented, true);
        assert.equal(h.nativeButtonKey('nudge', 'keydown', { code }).defaultPrevented, true);
        h.nativeButtonKey('nudge', 'keyup', { code });
        assert.equal(nudgeEvents(h), 1); assert.equal(h.game.plungerCharge, 0);
        waitForNudge(h);
        h.nativeButtonKey('nudge', 'keydown', { code }); h.nativeButtonKey('nudge', 'keyup', { code });
        assert.equal(nudgeEvents(h), 2);
    }
});
test('ready, staged, shooter-lane, paused and cooldown nudges are rejected without being queued', () => {
    const h = harness(); assert.equal(h.els.nudge.disabled, true);
    h.event('keydown', { code: 'KeyZ' }); h.els.nudge.emit('click'); assert.equal(nudgeEvents(h), 0);
    h.start(); assert.equal(h.els.nudge.disabled, true); assert.match(h.els['nudge-status'].textContent, /進場後/);
    h.els.nudge.emit('click'); h.game.launch(); h.frame(4);
    assert.equal(h.game.balls[0].inField, false); assert.equal(h.els.nudge.disabled, true);
    h.event('keydown', { code: 'KeyZ' }); h.els.nudge.emit('click'); assert.equal(nudgeEvents(h), 0);
    fieldBall(h); h.event('keydown', { code: 'KeyZ', repeat: true }); assert.equal(nudgeEvents(h), 0);
    h.event('keyup', { code: 'KeyZ' });
    h.els.pause.emit('click'); assert.equal(h.els.nudge.disabled, true); assert.match(h.els['nudge-status'].textContent, /暫停/);
    h.event('keydown', { code: 'KeyZ' }); h.els.nudge.emit('click'); h.frame(60); assert.equal(nudgeEvents(h), 0);
    h.els.start.emit('click'); h.event('keydown', { code: 'KeyZ', repeat: true }); assert.equal(nudgeEvents(h), 0);
    h.event('keyup', { code: 'KeyZ' }); h.event('keydown', { code: 'KeyZ' }); assert.equal(nudgeEvents(h), 1);
    h.event('keyup', { code: 'KeyZ' }); h.event('keydown', { code: 'KeyZ' }); h.els.nudge.emit('click'); assert.equal(nudgeEvents(h), 1);
    waitForNudge(h); h.event('keydown', { code: 'KeyZ', repeat: true }); assert.equal(nudgeEvents(h), 1);
    h.event('keyup', { code: 'KeyZ' }); h.event('keydown', { code: 'KeyZ' }); assert.equal(nudgeEvents(h), 2);
    const cooldown = h.game.nudgeCooldown, heat = h.game.nudgeHeat; assert.ok(cooldown > 0);
    h.els.pause.emit('click'); h.frame(60); assert.equal(h.game.nudgeCooldown, cooldown); assert.equal(h.game.nudgeHeat, heat);
});
test('typing Z in native form or editable controls never nudges', () => {
    const h = harness(); h.start(); fieldBall(h);
    for (const target of [h.els['music-volume'], { matches: selector => selector.includes('[contenteditable]') }]) {
        h.event('keydown', { code: 'KeyZ', target }); h.event('keyup', { code: 'KeyZ', target });
    }
    assert.equal(nudgeEvents(h), 0); assert.equal(h.game.nudgeHeat, 0);
});
test('third rapid nudge displays TILT, clears held flippers and blocks further activations', () => {
    const h = harness(); h.start(); fieldBall(h);
    h.els.left.emit('pointerdown', { pointerId: 8 }); h.event('keydown', { code: 'KeyD' }); h.frame(8);
    tiltViaButton(h);
    assert.equal(nudgeEvents(h), 2); assert.equal(h.els.nudge.disabled, true);
    for (const id of ['left', 'right']) { assert.equal(h.els[id].disabled, true); assert.equal(h.els[id].attrs['aria-pressed'], 'false'); }
    for (const id of ['nudge-status', 'reactor-state', 'table-status', 'toast', 'live']) assert.match(h.els[id].textContent, /TILT/, id);
    assert.equal(h.els['nudge-controls'].classes.has('tilted'), true);
    assert.equal(h.els['nudge-meter'].attrs['aria-valuenow'], '100');
    h.els.nudge.emit('click'); h.event('keydown', { code: 'KeyZ' }); assert.equal(nudgeEvents(h), 2);
    h.frame(8); assert.equal(h.game.flippers[0].angle, h.game.flippers[0].rest); assert.equal(h.game.flippers[1].angle, h.game.flippers[1].rest);
});
test('a fresh serve clears all tilt UI without requiring a tiltReset event', () => {
    const h = harness(); h.start(); fieldBall(h); tiltViaButton(h);
    for (const ball of h.game.balls) Object.assign(ball, { y: 980, vy: 0 });
    h.frame(8);
    assert.ok(h.game.staged); assert.equal(h.game.tilted, false); assert.equal(h.game.ballsRemaining, 2);
    assert.equal(h.els.nudge.disabled, true); assert.equal(h.els.left.disabled, false);
    assert.equal(h.els['nudge-controls'].classes.has('tilted'), false); assert.equal(h.els['nudge-controls'].classes.has('warning'), false);
    assert.equal(h.els['nudge-fill'].style.width, '0%'); assert.equal(h.els['nudge-meter'].attrs['aria-valuenow'], '0');
    assert.match(h.els['nudge-status'].textContent, /發球進場後/); assert.doesNotMatch(h.els['reactor-state'].textContent, /TILT/);
    assert.equal(h.els.toast.hidden, true);
    fieldBall(h); assert.equal(h.els.nudge.disabled, false); h.els.nudge.emit('click'); assert.equal(nudgeEvents(h), 3);
});
test('restart and blur clear nudge input state without generating deferred nudges', () => {
    const h = harness(); h.start(); fieldBall(h);
    h.event('keydown', { code: 'KeyZ' }); h.event('blur'); h.frame(60);
    assert.equal(h.game.state, 'paused'); assert.equal(nudgeEvents(h), 1);
    h.els.start.emit('click'); waitForNudge(h); h.event('keydown', { code: 'KeyZ' }); assert.equal(nudgeEvents(h), 2);
    h.els.retry.emit('click'); h.frame(4);
    assert.equal(h.game.nudgeHeat, 0); assert.equal(h.game.nudgeCooldown, 0); assert.equal(h.game.tilted, false);
    assert.equal(h.els['nudge-meter'].attrs['aria-valuenow'], '0'); assert.equal(h.els.nudge.disabled, true);
    fieldBall(h); h.event('keydown', { code: 'KeyZ' }); assert.equal(nudgeEvents(h), 3);
});

test('an active field ball enables nudge even if an independent ball is staged', () => {
    const h = harness(); h.start(); const staged = h.game.staged;
    h.game._ball(291, 650); h.frame(4);
    assert.equal(h.els.nudge.disabled, false); assert.match(h.els['nudge-status'].textContent, /可搖晃/);
    h.els.nudge.emit('click'); assert.equal(nudgeEvents(h), 1);
    assert.equal(staged.vx, 0); assert.equal(staged.vy, 0); assert.equal(h.game.staged, staged);
});
test('last-ball tilt ends normally and restart removes the lock and stale message', () => {
    const h = harness(); h.start(); fieldBall(h); h.game.ballsRemaining = 1; tiltViaButton(h);
    h.game.balls[0].y = 980; h.frame(8);
    assert.equal(h.game.state, 'over'); assert.equal(h.els.nudge.disabled, true);
    assert.equal(h.els['nudge-status'].textContent, '本局結束'); assert.equal(h.els.overlay.hidden, false);
    h.els.start.emit('click'); assert.equal(h.game.tilted, false); assert.equal(h.els.toast.hidden, true);
    assert.equal(h.els['nudge-controls'].classes.has('tilted'), false); assert.equal(h.els['nudge-meter'].attrs['aria-valuenow'], '0');
});
