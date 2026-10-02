import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { musicStub } from './music-stub.mjs';
import { SnakeGame } from '../snake/engine.mjs';
import { playEvents } from '../snake/audio-events.mjs';

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
    const musicEvents = [];
    const visualEvents = [];
    const source = readFileSync(new URL(`../${name}/game.js`, import.meta.url), 'utf8').replace(/\}\)\(\);\s*$/, `${inspectSource}\n})();`);
    const scope = {
        ...musicStub(musicEvents),
        NeonFlightRenderer: class {
            reset() { visualEvents.push(['reset']); } advance(delta) { visualEvents.push(['advance',delta]); }
            flap(y) { visualEvents.push(['flap',y]); } pass(x,y) { visualEvents.push(['pass',x,y]); }
            lose(y) { visualEvents.push(['lose',y]); } draw() {}
        },
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
    return { sounds, musicEvents, visualEvents, inspect: context.inspect, click: selector => elements.get(selector).click() };
}

test('3D snake plays every food once, before exit cues, and restores silently', () => {
    const game = new SnakeGame(), sounds = [], music = [];
    const audio = { play: (name, delay = 0) => sounds.push([name, delay]) };
    const soundtrack = { duck: () => music.push('duck'), pause: () => music.push('pause') };
    playEvents(game.drain(), audio, soundtrack); assert.deepEqual(sounds, []);
    game.start(); game.collected = 5; game.food = { x: 4, y: 0, z: 1 }; game.move();
    playEvents(game.drain(), audio, soundtrack);
    assert.deepEqual(sounds, [['food', 0], ['level', .28]]);
    game.pause(); playEvents(game.drain(), audio, soundtrack);
    playEvents(SnakeGame.restore(game.snapshot()).drain(), audio, soundtrack); assert.equal(sounds.length, 2);
    game.start(); game.dessert = { x: 5, y: 0, z: 1 }; game.move(); playEvents(game.drain(), audio, soundtrack);
    assert.equal(sounds.filter(s => s[0] === 'dessert').length, 1);
    for (const kind of ['shield', 'slow', 'shrink', 'magnet', 'emp']) game.collectPower(kind, game.snake[0]);
    playEvents(game.drain(), audio, soundtrack);
    assert.deepEqual(sounds.slice(-5).map(s => s[0]), ['snakeShield', 'snakeSlow', 'snakeShrink', 'snakeMagnet', 'snakeEmp']);
    game.effects.shield = false; game.bombs = [{ x: 6, y: 0, z: 1 }]; game.move(); playEvents(game.drain(), audio, soundtrack);
    assert.equal(sounds.at(-1)[0], 'bomb'); assert.equal(music.at(-1), 'pause');
});

test('flappy score milestones intensify music; pause, collision and restart do not stack clocks',()=>{
    const h=game('flappy',`window.inspect={update,togglePause,endGame,setScore:value=>score=value,setGates:value=>gates=value};`);
    assert.ok(h.musicEvents.every(e=>e[0]==='pause'));
    h.click('#start-button'); assert.equal(h.musicEvents.at(-1)[0],'start');
    h.inspect.setScore(9); h.inspect.setGates([{x:70,gapTop:100,gapBottom:400,scored:false}]); h.inspect.update(0);
    assert.ok(h.musicEvents.some(e=>e[0]==='phase'&&e[1]===1));
    h.inspect.togglePause(true); assert.equal(h.musicEvents.at(-1)[0],'pause');
    h.click('#start-button'); assert.equal(h.musicEvents.at(-1)[0],'resume');
    h.inspect.endGame(); assert.equal(h.musicEvents.at(-1)[0],'pause');
    h.click('#restart-button'); assert.equal(h.musicEvents.filter(e=>e[0]==='start').length,2);
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
    assert.equal(h.visualEvents.filter(e=>e[0]==='flap').length,2);
    assert.equal(h.visualEvents.filter(e=>e[0]==='pass').length,1);
    assert.equal(h.visualEvents.filter(e=>e[0]==='lose').length,1);
});

test('flappy artwork preserves gravity, flap strength, capped difficulty and the original 16px collision circle',()=>{
    const h=game('flappy',`window.inspect={update,flap,hasCollision,updateDifficulty,
        setPlayer:(y,velocity=0)=>{player.y=y;player.velocity=velocity;},setGates:value=>gates=value,
        setScore:value=>score=value,state:()=>({y:player.y,velocity:player.velocity,speed:gateSpeed,gap:gateGap})};`);
    h.click('#start-button');h.inspect.setGates([]);h.inspect.setPlayer(270);h.inspect.update(.01);
    assert.equal(h.inspect.state().velocity,15);assert.equal(h.inspect.state().y,270.15);
    h.inspect.flap();assert.equal(h.inspect.state().velocity,-460);
    h.inspect.setScore(5);h.inspect.updateDifficulty();assert.equal(h.inspect.state().speed,202);assert.equal(h.inspect.state().gap,155);
    h.inspect.setScore(100);h.inspect.updateDifficulty();assert.equal(h.inspect.state().speed,286);assert.equal(h.inspect.state().gap,125);
    for(const y of [16,494]){h.inspect.setPlayer(y);assert.equal(h.inspect.hasCollision(),true);}
    h.inspect.setPlayer(270);assert.equal(h.inspect.hasCollision(),false);
    h.inspect.setPlayer(205);h.inspect.setGates([{x:184,gapTop:220,gapBottom:380,scored:false}]);assert.equal(h.inspect.hasCollision(),false);
    h.inspect.setGates([{x:183,gapTop:220,gapBottom:380,scored:false}]);assert.equal(h.inspect.hasCollision(),true);
    h.click('#restart-button');assert.equal(h.visualEvents.filter(e=>e[0]==='reset').length,2);
});
