import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function harness(storage = new Map()) {
    const elements = new Map(), events = new Map(), audio = [];
    let frame, now = 0, latest;
    const element = id => {
        if (!elements.has(id)) {
            const listeners = new Map();
            elements.set(id, { hidden: false, disabled: false, textContent: '', dataset: {},
                addEventListener: (type, fn) => listeners.set(type, fn),
                fire: (type, event = {}) => listeners.get(type)?.(event),
                focus() {}, setPointerCapture() {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 960, height: 720 }),
            });
        }
        return elements.get(id);
    };
    const choices = ['radius', 'reload', 'repair'].map(id => { const e = element(id); e.dataset.upgrade = id; return e; });
    const scope = vm.createContext({
        document: { hidden: false, documentElement: { dataset: {} }, getElementById: element,
            querySelectorAll: () => choices, addEventListener: (type, fn) => events.set(type, fn) },
        localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
        CashArcadeAudio: { create: () => ({ play: name => audio.push(name), resume() {}, isMuted: () => false }) },
        NeonDefenseRenderer: class { draw(game) { latest = game; } event() {} },
        performance: { now: () => now }, requestAnimationFrame: fn => { frame = fn; },
        HTMLButtonElement: class {}, confirm: () => true,
        addEventListener: (type, fn) => events.set(type, fn),
    });
    scope.window = scope;
    for (const file of ['engine.js', 'game.js']) vm.runInContext(readFileSync(new URL(`../missile/${file}`, import.meta.url), 'utf8'), scope);
    function tick(count = 1) { for (let i = 0; i < count; i++) { now += 25; frame(now); } }
    tick();
    return { storage, audio, element, scope, tick, get game() { return latest; },
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
    assert.equal(JSON.parse(h.storage.get('casharcade-missile-checkpoint')).phase, 'upgrade');
    const restored = harness(h.storage); restored.click('start'); restored.click('radius'); restored.click('radius'); restored.tick();
    const saved = JSON.parse(h.storage.get('casharcade-missile-checkpoint'));
    assert.equal(saved.level, 2); assert.equal(saved.radius, 72); assert.equal(saved.score, 1200);
    const next = harness(h.storage); next.click('start'); next.tick(); assert.equal(next.game.level, 2); assert.equal(next.game.score, 1200);
    next.game.state = 'won'; next.tick(); assert.equal(h.storage.has('casharcade-missile-checkpoint'), false);
});
