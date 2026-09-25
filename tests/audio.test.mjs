import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../audio.js', import.meta.url), 'utf8');

function setup({ supported = true, initial = new Map(), storageFails = false } = {}) {
    const calls = [];
    const attributes = new Map();
    const listeners = new Map();
    const button = {
        textContent: '',
        setAttribute: (name, value) => attributes.set(name, value),
        addEventListener: (name, callback) => listeners.set(name, callback),
        click: () => listeners.get('click')(),
    };
    const storage = {
        getItem(key) { if (storageFails) throw new Error('storage denied'); return initial.get(key) ?? null; },
        setItem(key, value) { if (storageFails) throw new Error('storage denied'); initial.set(key, value); },
    };
    class AudioContext {
        constructor() { calls.push(['context']); this.currentTime = 1; this.sampleRate = 44100; this.state = 'suspended'; this.destination = {}; }
        createGain() {
            const gain = { setValueAtTime: (...args) => calls.push(['gainSet', ...args]), exponentialRampToValueAtTime: (...args) => calls.push(['gainRamp', ...args]) };
            Object.defineProperty(gain, 'value', { set: value => calls.push(['gainValue', value]) });
            return { gain, connect: () => {} };
        }
        createOscillator() { return { frequency: { setValueAtTime: (...args) => calls.push(['freqSet', ...args]), exponentialRampToValueAtTime: (...args) => calls.push(['freqRamp', ...args]) }, connect: () => {}, start: time => calls.push(['toneStart', time]), stop: time => calls.push(['toneStop', time]) }; }
        createBuffer(_channels, length) { calls.push(['buffer', length]); return { getChannelData: () => new Float32Array(length) }; }
        createBufferSource() { return { connect: () => {}, start: time => calls.push(['noiseStart', time]), stop: time => calls.push(['noiseStop', time]) }; }
        createBiquadFilter() { return { frequency: {}, connect: () => {} }; }
        resume() { this.state = 'running'; calls.push(['resume']); return Promise.resolve(); }
    }
    const window = supported ? { AudioContext } : {};
    const sandbox = { window, localStorage: storage, Promise, Date, Math };
    vm.runInNewContext(source, sandbox);
    return { create: (key = 'game-a') => window.CashArcadeAudio.create({ storageKey: key, toggleButton: button }), calls, button, attributes, initial };
}

test('AudioContext starts only after an enabled sound and schedules bounded voices', () => {
    const h = setup();
    const sound = h.create();
    assert.equal(h.calls.length, 0);
    sound.play('unknown');
    assert.equal(h.calls.length, 0);
    sound.play('start');
    assert.equal(h.calls.filter(([name]) => name === 'context').length, 1);
    assert.equal(h.calls.filter(([name]) => name === 'toneStart').length, 2);
    assert.equal(h.calls.filter(([name]) => name === 'toneStop').length, 2);
    assert.equal(h.calls.filter(([name]) => name === 'resume').length, 1);
    assert.ok(h.calls.every(([, value]) => typeof value !== 'number' || Number.isFinite(value)));
    sound.play('crack');
    assert.equal(h.calls.filter(([name]) => name === 'noiseStart').length, 1);
    assert.equal(h.calls.filter(([name]) => name === 'noiseStop').length, 1);
});

test('rapid collision sounds are throttled while other effects still play', () => {
    const h = setup(); const sound = h.create();
    sound.play('wall'); sound.play('wall'); sound.play('brick');
    assert.equal(h.calls.filter(([name]) => name === 'toneStart').length, 2);
});

test('short flap tone reaches an audible output level without clipping', () => {
    const h = setup(); const sound = h.create();
    sound.play('flap');
    const master = h.calls.find(([name]) => name === 'gainValue')[1];
    const peak = Math.max(...h.calls.filter(([name]) => name === 'gainRamp').map(([, value]) => value));
    assert.ok(master * peak >= .1, `effective peak ${master * peak} is too quiet`);
    assert.ok(master * peak < .5, `effective peak ${master * peak} risks clipping`);
});

test('mute persists by game key, updates accessibility and unmutes with confirmation', () => {
    const h = setup({ initial: new Map([['game-a', '1']]) });
    const sound = h.create();
    assert.equal(sound.isMuted(), true);
    assert.equal(h.attributes.get('aria-label'), '開啟音效');
    assert.equal(h.attributes.get('aria-pressed'), 'false');
    sound.play('win');
    assert.equal(h.calls.length, 0);
    h.button.click();
    assert.equal(sound.isMuted(), false);
    assert.equal(h.initial.get('game-a'), '0');
    assert.equal(h.attributes.get('aria-pressed'), 'true');
    assert.equal(h.calls.filter(([name]) => name === 'toneStart').length, 1);
    h.button.click();
    assert.equal(h.initial.get('game-a'), '1');
    const other = setup({ initial: h.initial });
    assert.equal(other.create('game-b').isMuted(), false);
});

test('unavailable Web Audio and blocked storage leave controls and play safe', () => {
    const unavailable = setup({ supported: false });
    const sound = unavailable.create();
    assert.doesNotThrow(() => { sound.play('food'); sound.resume(); unavailable.button.click(); });
    const noStorage = setup({ storageFails: true });
    const currentPage = noStorage.create();
    assert.equal(currentPage.isMuted(), false);
    noStorage.button.click();
    assert.equal(currentPage.isMuted(), true);
});
