import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function harness(storage = new Map(), failStorage = false) {
    const els = new Map(), events = new Map(), music = [], sounds = []; let frame, now = 0, latest, visualTime = 0;
    function element(id) {
        if (!els.has(id)) {
            const listeners = new Map();
            els.set(id, { textContent: '', hidden: false, disabled: false, dataset: {}, style: {}, classList: { toggle() {} },
                addEventListener: (type, fn) => listeners.set(type, fn), setAttribute(name, value) { this[name] = value; },
                fire(type, event = {}) { if (type === 'click' && this.disabled) return; return listeners.get(type)?.(event); },
                focus() {}, setPointerCapture() {}, getBoundingClientRect: () => ({ width: 270, height: 390 }),
            });
        }
        return els.get(id);
    }
    const scope = vm.createContext({ document: { documentElement: { dataset: {} }, getElementById: element,
        querySelectorAll: () => [1, 2, 3].map(n => { const el = element('stage' + n); el.dataset.stage = n; return el; }),
        addEventListener: (type, fn) => events.set(type, fn) },
        localStorage: { getItem: key => { if (failStorage) throw Error('blocked'); return storage.get(key) ?? null; },
            setItem: (key, value) => { if (failStorage) throw Error('blocked'); storage.set(key, value); }, removeItem: key => storage.delete(key) },
        CashArcadeAudio: { create: () => ({ play: name => sounds.push(name), resume() {}, musicOutput() {} }) },
        CashArcadeMusic: { create: () => Object.fromEntries(['start', 'pause', 'resume', 'phase', 'duck'].map(k => [k, (...args) => music.push([k, ...args])])) },
        NeonAssaultRenderer: class { resize() {} reset() { visualTime = 0; } consume() {} update(dt) { visualTime += dt; } draw(g) { latest = g; } },
        performance: { now: () => now }, requestAnimationFrame: fn => frame = fn,
        addEventListener: (type, fn) => events.set(type, fn),
    }); scope.window = scope;
    for (const name of ['engine', 'music', 'game']) vm.runInContext(readFileSync(new URL(`../assault/${name}.js`, import.meta.url), 'utf8'), scope);
    const tick = (n = 1) => { for (let i = 0; i < n; i++) { now += 25; frame(now); } }; tick();
    return { element, tick, music, sounds, storage, get game() { return latest; }, get visualTime() { return visualTime; },
        click: id => element(id).fire('click'), blur: () => events.get('blur')(),
        key: (key, extra = {}) => events.get('keydown')({ key, target: {}, preventDefault() {}, ...extra }),
        keyup: key => events.get('keyup')({ key }),
    };
}

test('no autoplay, keyboard and relative mobile drag work; blur freezes visuals and music without stale input', () => {
    const h = harness(); assert.equal(h.sounds.length, 0); assert.equal(h.music.length, 0);
    h.click('start'); h.tick(4); assert.ok(h.music.some(m => m[0] === 'start')); assert.ok(h.game.shots.length);
    const x = h.game.player.x; h.key('d'); h.tick(4); h.keyup('d'); assert.ok(h.game.player.x > x + 20);
    const canvas = h.element('game-canvas'), at = h.game.player.x;
    canvas.fire('pointerdown', { button: 0, pointerId: 2, clientX: 30, clientY: 300, preventDefault() {} }); h.tick(); assert.equal(h.game.player.x, at);
    canvas.fire('pointermove', { pointerId: 2, clientX: 60, clientY: 290 }); h.tick(5); assert.ok(h.game.player.x >= at + 59);
    h.blur(); const time = h.game.time, visual = h.visualTime; h.tick(40); assert.equal(h.game.time, time); assert.equal(h.visualTime, visual);
    assert.equal(h.music.at(-1)[0], 'pause'); const stoppedX = h.game.player.x;
    h.click('start'); h.tick(4); assert.equal(h.game.player.x, stoppedX); assert.ok(h.game.time > time);
});

test('slider keys do not fly or bomb; repeat does not waste bombs; pause works when a button is focused', () => {
    const h = harness(); h.click('start'); h.tick(); const x = h.game.player.x;
    const input = { target: { closest: selector => selector.includes('input') } };
    h.key('ArrowRight', input); h.key(' ', input); h.tick(4); assert.equal(h.game.player.x, x); assert.equal(h.game.bombs, 2);
    h.key(' '); h.key(' ', { repeat: true }); assert.equal(h.game.bombs, 1);
    h.key('p', { target: { closest: s => s.startsWith('button') } }); h.tick(); assert.equal(h.game.state, 'paused');
    h.key('p'); h.tick(); assert.equal(h.game.state, 'running');
});

test('stage completion persists next stage, reload waits for gesture, retry restores and victory removes checkpoint', () => {
    const h = harness(); h.click('start'); h.tick(); h.game.score = 3000; h.game.hp = 3; h.game.state = 'stageClear'; h.tick();
    const cp = JSON.parse(h.storage.get('casharcade-assault-checkpoint-v1')); assert.equal(cp.level, 2); assert.equal(cp.hp, 4);
    const reload = harness(h.storage); assert.equal(reload.game.state, 'ready'); assert.equal(reload.music.length, 0);
    reload.click('start'); reload.tick(); assert.equal(reload.game.level, 2); assert.equal(reload.game.score, 3000);
    reload.game.hp = 1; reload.game.score = 3900; reload.game.state = 'lost'; reload.tick(); reload.key('r'); reload.tick();
    assert.equal(reload.game.hp, 4); assert.equal(reload.game.score, 3000);
    reload.game.state = 'won'; reload.tick(); assert.equal(h.storage.has('casharcade-assault-checkpoint-v1'), false);
    reload.click('start'); reload.tick(); assert.equal(reload.game.level, 1);
});

test('clearing animation freezes on blur and resumes to the correct ending without restarting music', () => {
    const h = harness(); h.click('start'); h.tick(); h.game.state = 'clearing'; h.game.clearTime = .3;
    h.blur(); h.tick(40); assert.equal(h.game.clearTime, .3); h.click('start'); h.tick(20);
    assert.equal(h.game.state, 'stageClear'); assert.equal(h.music.filter(m => m[0] === 'resume').length, 0);
});

test('corrupt or blocked storage leaves the free campaign playable', () => {
    for (const h of [harness(new Map([['casharcade-assault-checkpoint-v1', '{bad']])), harness(new Map(), true)]) {
        h.click('start'); h.tick(10); assert.equal(h.game.state, 'running'); assert.equal(h.game.level, 1);
    }
});
