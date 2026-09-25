import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../snake/game.js', import.meta.url), 'utf8').replace(/\}\)\(\);\s*$/, `
    window.inspect = {
        tick, updateDessert, resetGame, togglePause, playingTime,
        state: () => ({ snake, food, dessert, bomb, score, foodsEaten, growthRemaining, gameState }),
        set: values => {
            if ('snake' in values) snake = values.snake;
            if ('food' in values) food = values.food;
            if ('dessert' in values) dessert = values.dessert;
            if ('bomb' in values) bomb = values.bomb;
            if ('foodsEaten' in values) foodsEaten = values.foodsEaten;
            if ('growthRemaining' in values) growthRemaining = values.growthRemaining;
            if ('direction' in values) direction = queuedDirection = values.direction;
        }
    };
})();`);

function harness() {
    let now = 0;
    let hidden = false;
    let resolveUnlock;
    let rejectUnlock;
    let unlockCalls = 0;
    const sounds = [];
    const elements = new Map();
    const documentEvents = new Map();
    const elementsFactory = () => {
        const listeners = new Map();
        return {
            hidden: false, disabled: false, textContent: '', dataset: {}, width: 600, height: 600,
            addEventListener: (name, handler) => listeners.set(name, handler),
            click: () => listeners.get('click')?.({ preventDefault() {} }),
            getContext: () => new Proxy({}, { get: () => () => {} }),
        };
    };
    const sdk = {
        on() {}, handshake: async () => ({ price_satoshis: 1000 }),
        unlock() { unlockCalls += 1; return new Promise((resolve, reject) => { resolveUnlock = resolve; rejectUnlock = reject; }); },
    };
    const scope = {
        localStorage: { getItem: () => null, setItem() {} },
        CashArcadeAudio: { create: () => ({ play: (...args) => sounds.push(args), resume() {} }) },
        CashLinkArcade: { create: () => sdk },
        performance: { now: () => now },
        setTimeout: () => 1, clearTimeout() {}, requestAnimationFrame: () => 1,
        getComputedStyle: () => ({ getPropertyValue: () => '#111' }),
        matchMedia: () => ({ matches: false }),
        addEventListener() {},
        document: {
            documentElement: { dataset: {} },
            get hidden() { return hidden; },
            addEventListener: (name, handler) => documentEvents.set(name, handler),
            querySelectorAll: () => [],
            querySelector: selector => {
                if (!elements.has(selector)) elements.set(selector, elementsFactory());
                return elements.get(selector);
            },
        },
    };
    scope.window = scope;
    vm.runInNewContext(source, scope);
    return {
        sounds, inspect: scope.inspect,
        el: selector => elements.get(selector),
        click: selector => elements.get(selector).click(),
        time: value => { now = value; },
        hide: () => { hidden = true; documentEvents.get('visibilitychange')(); },
        show: () => { hidden = false; documentEvents.get('visibilitychange')(); },
        unlock: () => resolveUnlock(),
        rejectUnlock: code => rejectUnlock({ code }),
        unlockCalls: () => unlockCalls,
    };
}

const state = h => JSON.parse(JSON.stringify(h.inspect.state()));

test('ordinary food and bomb start on separate open cells', () => {
    const h = harness();
    const { snake, food, bomb, dessert } = state(h);
    assert.ok(food && bomb);
    assert.equal(dessert, null);
    assert.notDeepEqual(food, bomb);
    assert.ok(!snake.some(segment => segment.x === food.x && segment.y === food.y));
    assert.ok(!snake.some(segment => segment.x === bomb.x && segment.y === bomb.y));
    assert.equal(h.el('#dessert-status').textContent, '下次甜點 20 秒後');
});

test('dessert appears at 20 seconds, expires at 30 and returns at 40 without early respawn', () => {
    const h = harness(); h.click('#start-button');
    h.time(19999); h.inspect.updateDessert();
    assert.equal(state(h).dessert, null);
    h.time(20000); h.inspect.updateDessert();
    let current = state(h);
    assert.ok(current.dessert);
    assert.notDeepEqual(current.dessert, current.food);
    assert.notDeepEqual(current.dessert, current.bomb);
    assert.equal(h.el('#dessert-status').textContent, '甜點剩餘 10 秒');
    h.time(29999); h.inspect.updateDessert();
    assert.ok(state(h).dessert);
    h.time(30000); h.inspect.updateDessert();
    assert.equal(state(h).dessert, null);
    h.time(40000); h.inspect.updateDessert();
    assert.ok(state(h).dessert);
    h.inspect.set({ dessert: null });
    h.time(41000); h.inspect.updateDessert();
    assert.equal(state(h).dessert, null);
    h.time(60000); h.inspect.updateDessert();
    assert.ok(state(h).dessert);
});

test('manual pause, hidden-page auto pause and restart freeze or reset the dessert clock', () => {
    const h = harness(); h.click('#start-button');
    h.time(5000); h.click('#pause-button');
    h.time(25000); h.inspect.updateDessert();
    assert.equal(h.inspect.playingTime(), 5000);
    assert.equal(state(h).dessert, null);
    h.click('#pause-button');
    h.time(40000); h.inspect.updateDessert();
    assert.ok(state(h).dessert);
    const before = h.sounds.length;
    h.hide();
    assert.equal(state(h).gameState, 'paused');
    assert.equal(h.sounds.length, before, 'auto pause must be silent');
    h.time(90000); h.inspect.updateDessert();
    assert.equal(h.inspect.playingTime(), 20000);
    assert.ok(state(h).dessert);
    h.show();
    assert.equal(state(h).gameState, 'paused');
    h.click('#pause-button');
    h.time(100000); h.inspect.updateDessert();
    assert.equal(state(h).dessert, null);
    h.inspect.resetGame();
    assert.equal(h.inspect.playingTime(), 0);
    assert.equal(h.el('#dessert-status').textContent, '下次甜點 20 秒後');
});

test('dessert scores 20, grows twice and crosses a five-food speed threshold once', () => {
    const h = harness(); h.click('#start-button');
    h.time(20000); h.inspect.updateDessert();
    h.inspect.set({
        snake: [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }],
        direction: { x: 1, y: 0 }, food: { x: 1, y: 1 }, bomb: { x: 2, y: 2 },
        dessert: { x: 11, y: 10 }, foodsEaten: 4,
    });
    h.inspect.tick();
    assert.equal(state(h).score, 20);
    assert.equal(state(h).foodsEaten, 6);
    assert.equal(state(h).snake.length, 4);
    assert.equal(state(h).growthRemaining, 1);
    assert.deepEqual(h.sounds.slice(-2), [['dessert'], ['speed', .26]]);
    assert.equal(state(h).dessert, null);
    h.inspect.tick();
    assert.equal(state(h).snake.length, 5);
    assert.equal(state(h).growthRemaining, 0);
});

test('ordinary food scores 10, grows one segment and plays its pickup sound', () => {
    const h = harness(); h.click('#start-button');
    h.inspect.set({ food: { x: 11, y: 10 }, bomb: { x: 2, y: 2 }, dessert: null });
    h.inspect.tick();
    assert.equal(state(h).score, 10);
    assert.equal(state(h).foodsEaten, 1);
    assert.equal(state(h).snake.length, 4);
    assert.equal(state(h).growthRemaining, 0);
    assert.equal(h.sounds.at(-1)[0], 'food');
    assert.deepEqual(state(h).bomb, { x: 2, y: 2 });
    assert.notDeepEqual(state(h).food, state(h).bomb);
    assert.ok(!state(h).snake.some(segment => segment.x === state(h).food.x && segment.y === state(h).food.y));
});

test('a food pickup while crossing the edge keeps the pickup sound clear', () => {
    const h = harness(); h.click('#start-button');
    h.inspect.set({
        snake: [{ x: 19, y: 10 }, { x: 18, y: 10 }, { x: 17, y: 10 }],
        food: { x: 0, y: 10 }, bomb: { x: 2, y: 2 }, dessert: null,
        direction: { x: 1, y: 0 },
    });
    h.inspect.tick();
    assert.equal(state(h).score, 10);
    assert.deepEqual(h.sounds.slice(-1), [['food']]);
    assert.ok(!h.sounds.some(([name]) => name === 'wrap'));
});

test('an expired dessert is removed before movement and cannot be collected', () => {
    const h = harness(); h.click('#start-button');
    h.time(20000); h.inspect.updateDessert();
    h.inspect.set({ dessert: { x: 11, y: 10 }, food: { x: 1, y: 1 }, bomb: { x: 2, y: 2 } });
    h.time(30000); h.inspect.tick();
    assert.equal(state(h).dessert, null);
    assert.equal(state(h).score, 0);
    assert.equal(state(h).snake.length, 3);
    assert.equal(state(h).gameState, 'running');
    assert.ok(!h.sounds.some(([name]) => name === 'dessert'));
});

test('a tail cell still collides during the deferred second segment', () => {
    const h = harness(); h.click('#start-button');
    h.inspect.set({
        snake: [{ x: 10, y: 10 }, { x: 10, y: 9 }, { x: 11, y: 9 }, { x: 11, y: 10 }],
        direction: { x: 1, y: 0 }, food: { x: 1, y: 1 }, bomb: { x: 2, y: 2 },
        dessert: null, growthRemaining: 1,
    });
    h.inspect.tick();
    assert.equal(state(h).gameState, 'over');
    assert.equal(h.sounds.at(-1)[0], 'lose');
});

test('bomb ends the round without points and paid restart cannot be bypassed by pause', async () => {
    const h = harness(); h.click('#start-button');
    h.inspect.set({
        food: { x: 1, y: 1 }, bomb: { x: 11, y: 10 }, dessert: null,
        snake: [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }],
        direction: { x: 1, y: 0 },
    });
    h.inspect.tick();
    assert.equal(state(h).gameState, 'over');
    assert.equal(state(h).score, 0);
    assert.equal(h.sounds.at(-1)[0], 'bomb');
    assert.equal(h.el('#overlay-title').textContent, '碰到炸彈！');
    h.click('#start-button');
    assert.equal(h.unlockCalls(), 1);
    assert.equal(state(h).gameState, 'over');
    h.unlock(); await new Promise(resolve => setImmediate(resolve));
    assert.equal(state(h).gameState, 'running');
    h.click('#restart-button');
    assert.equal(h.unlockCalls(), 2);
    assert.equal(state(h).gameState, 'paused');
    h.time(25000);
    assert.equal(h.inspect.playingTime(), 0);
    h.click('#pause-button'); h.inspect.togglePause();
    assert.equal(state(h).gameState, 'paused');
    h.unlock(); await new Promise(resolve => setImmediate(resolve));
    assert.equal(state(h).gameState, 'running');
    assert.equal(h.inspect.playingTime(), 0);
});

test('cancelled payment leaves the prior round paused without time or success sounds', async () => {
    const h = harness(); h.click('#start-button');
    h.time(5000); h.click('#restart-button');
    const before = h.sounds.length;
    h.time(25000);
    assert.equal(h.inspect.playingTime(), 5000);
    h.rejectUnlock('cancelled'); await new Promise(resolve => setImmediate(resolve));
    assert.equal(state(h).gameState, 'paused');
    assert.equal(h.inspect.playingTime(), 5000);
    assert.equal(h.el('#pause-button').disabled, true);
    assert.equal(h.sounds.length, before);
});

test('the last safe cells remove the bomb and allow a food pickup to win', () => {
    const h = harness(); h.click('#start-button');
    const remaining = [];
    for (let y = 0; y < 20; y += 1) {
        for (let x = 0; x < 20; x += 1) {
            if ((x === 1 || x === 2) && y === 0) continue;
            remaining.push({ x, y });
        }
    }
    const head = remaining.splice(0, 1)[0];
    h.inspect.set({ snake: [head, ...remaining], direction: { x: 1, y: 0 },
        food: { x: 1, y: 0 }, bomb: { x: 2, y: 0 }, dessert: null });
    h.inspect.tick();
    assert.equal(state(h).snake.length, 399);
    assert.equal(state(h).bomb, null);
    assert.deepEqual(state(h).food, { x: 2, y: 0 });
    h.inspect.tick();
    assert.equal(state(h).snake.length, 400);
    assert.equal(state(h).gameState, 'won');
    assert.deepEqual(h.sounds.slice(-2), [['food'], ['win', .26]]);
});
