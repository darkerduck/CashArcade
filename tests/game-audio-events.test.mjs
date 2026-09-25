import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function element() {
    const events = new Map();
    return {
        hidden: false, disabled: false, textContent: '', dataset: {}, width: 600, height: 600,
        addEventListener: (name, callback) => events.set(name, callback),
        click: () => events.get('click')?.({ preventDefault() {} }),
        getContext: () => new Proxy({}, { get: (_, name) => name.startsWith('create') ? () => ({ addColorStop() {} }) : () => {} }),
        getBoundingClientRect: () => ({ left: 0, width: 600 }),
    };
}

function game(name, inspectSource) {
    const elements = new Map();
    const sounds = [];
    const source = readFileSync(new URL(`../${name}/game.js`, import.meta.url), 'utf8').replace(/\}\)\(\);\s*$/, `${inspectSource}\n})();`);
    const scope = {
        localStorage: { getItem: () => null, setItem() {} },
        CashArcadeAudio: { create: () => ({ play: sound => sounds.push(sound), resume() {} }) },
        CashLinkArcade: { create: () => ({ on() {}, handshake: async () => ({ price_satoshis: 1000 }) }) },
        performance: { now: () => 0 },
        setTimeout: () => 1, clearTimeout() {}, requestAnimationFrame: () => 1, cancelAnimationFrame() {},
        getComputedStyle: () => ({ getPropertyValue: () => '#111' }), matchMedia: () => ({ matches: false }),
        addEventListener() {},
        document: {
            documentElement: { dataset: {} }, addEventListener() {}, querySelectorAll: () => [],
            querySelector: selector => { if (!elements.has(selector)) elements.set(selector, element()); return elements.get(selector); },
        },
    };
    scope.window = scope;
    const context = vm.createContext(scope);
    vm.runInContext(source, context);
    return { sounds, inspect: context.inspect, click: selector => elements.get(selector).click() };
}

test('snake sounds follow food, speed, wrap, pause and self-collision', () => {
    const h = game('snake', `window.inspect = {
        tick,
        setFood: (x, y) => { food = { x, y }; },
        setFoodsEaten: value => { foodsEaten = value; },
        setSnake: value => { snake = value; },
        setHeading: value => { direction = value; queuedDirection = value; }
    };`);
    assert.deepEqual(h.sounds, []);
    h.click('#start-button');
    h.inspect.setFood(11, 10); h.inspect.tick();
    h.inspect.setFoodsEaten(4); h.inspect.setFood(12, 10); h.inspect.tick();
    h.inspect.setSnake([{ x: 19, y: 10 }, { x: 18, y: 10 }, { x: 17, y: 10 }]);
    h.inspect.setFood(5, 5); h.inspect.setHeading({ x: 1, y: 0 }); h.inspect.tick();
    h.click('#pause-button'); h.click('#pause-button');
    h.inspect.setSnake([{ x: 2, y: 2 }, { x: 3, y: 2 }, { x: 3, y: 3 }, { x: 2, y: 3 }]);
    h.inspect.setHeading({ x: 1, y: 0 }); h.inspect.tick();
    assert.deepEqual(h.sounds, ['start', 'food', 'food', 'speed', 'wrap', 'pause', 'resume', 'lose']);
});

test('flappy starts with one flap, rewards a gate once and stays silent on auto-pause', () => {
    const h = game('flappy', `window.inspect = {
        flap, update, togglePause, endGame,
        setScore: value => { score = value; },
        setGates: value => { gates = value; }
    };`);
    assert.deepEqual(h.sounds, []);
    h.click('#start-button');
    assert.deepEqual(h.sounds, ['flap']);
    h.inspect.setScore(4);
    h.inspect.setGates([{ x: 70, gapTop: 100, gapBottom: 400, scored: false }]);
    h.inspect.update(.01);
    h.inspect.update(.01);
    assert.deepEqual(h.sounds.slice(1), ['pass', 'speed']);
    h.inspect.togglePause(true);
    assert.deepEqual(h.sounds.slice(1), ['pass', 'speed']);
    h.inspect.togglePause();
    h.inspect.flap();
    h.inspect.endGame();
    assert.deepEqual(h.sounds.slice(-3), ['resume', 'flap', 'lose']);
});
