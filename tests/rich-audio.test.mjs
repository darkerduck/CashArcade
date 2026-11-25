import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const read = name => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');

// A fuller fake Web Audio context: detune, stereo panners, convolver and delay nodes.
function richContext() {
    const nodes = [];
    class Param {
        constructor(value = 0) { this.value = value; this.events = []; }
        setValueAtTime(v, t) { this.value = v; this.events.push(['set', v, t]); }
        linearRampToValueAtTime(v, t) { this.events.push(['linear', v, t]); }
        exponentialRampToValueAtTime(v, t) { this.events.push(['exp', v, t]); }
        setTargetAtTime(v, t) { this.events.push(['target', v, t]); }
        cancelScheduledValues(t) { this.events.push(['cancel', t]); }
    }
    class Node {
        constructor(kind) { this.kind = kind; this.outputs = []; nodes.push(this); }
        connect(target) { this.outputs.push(target); return target; }
        disconnect() { this.disconnected = true; }
        start(t) { this.started = t; }
        stop(t) { this.stopped = t; }
    }
    const make = (kind, params) => { const node = new Node(kind); for (const p of params) node[p] = new Param(); return node; };
    class Context {
        currentTime = 1; sampleRate = 8000; state = 'running'; destination = new Node('destination');
        createGain() { return make('gain', ['gain']); }
        createBiquadFilter() { return make('filter', ['frequency', 'Q']); }
        createWaveShaper() { return new Node('shaper'); }
        createDynamicsCompressor() { return make('compressor', ['threshold', 'knee', 'ratio', 'attack', 'release']); }
        createOscillator() { return make('oscillator', ['frequency', 'detune']); }
        createBufferSource() { return new Node('noise'); }
        createStereoPanner() { return make('panner', ['pan']); }
        createConvolver() { return new Node('convolver'); }
        createDelay() { return make('delay', ['delayTime']); }
        createBuffer(channels, length) { const data = [...Array(channels)].map(() => new Float32Array(length)); return { getChannelData: c => data[c] }; }
        resume() { return Promise.resolve(); }
    }
    return { Context, nodes };
}

function musicScope() {
    const scope = vm.createContext({});
    vm.runInContext(read('music.js'), scope);
    return scope.CashArcadeMusic;
}

const bassScore = { notesForStep: (_profile, index) => index % 16 === 0
    ? [{ voice: 'bass', note: 40, length: 4, level: 1 }, { voice: 'lead', note: 72, length: 6, level: 1 }]
    : index % 4 === 2 ? [{ voice: 'hat', note: 0, length: 1, level: 1 }] : [] };

test('music synth adds a stereo room, tempo-synced echo and layered lead voices when the browser supports them', () => {
    const { Context, nodes } = richContext(), context = new Context();
    const synth = musicScope().synth(context);
    assert.ok(nodes.some(n => n.kind === 'convolver'), 'room reverb');
    const delay = nodes.find(n => n.kind === 'delay'); assert.ok(delay, 'echo');
    synth.step({ bpm: 120 }, 0, 1.1, bassScore);
    assert.ok(Math.abs(delay.delayTime.events.at(-1)[1] - .375) < 1e-9, 'echo lands on a dotted eighth');
    const oscillators = nodes.filter(n => n.kind === 'oscillator' && n.started !== undefined);
    assert.ok(oscillators.some(n => n.type === 'sawtooth' && n.detune.value === 7), 'detuned lead layer');
    assert.ok(oscillators.some(n => n.type === 'sine' && n.frequency.events[0][1] === 5.6), 'held lead vibrato');
    assert.ok(nodes.some(n => n.kind === 'panner' && n.pan.value !== 0), 'stereo placement');
});

test('pad doubles the bar bass two octaves and a fifth up, and phrase fills add a crash and snare pickup', () => {
    const { Context, nodes } = richContext(), context = new Context();
    const synth = musicScope().synth(context);
    const pitches = () => nodes.filter(n => n.kind === 'oscillator' && n.type === 'sawtooth' && n.detune.value === -9).map(n => Math.round(n.frequency.events[0][1]));
    synth.step({ bpm: 120 }, 0, 1.1, bassScore);
    const hz = note => Math.round(440 * 2 ** ((note - 69) / 12));
    assert.deepEqual(pitches(), [hz(64), hz(71)]);
    const noiseBefore = nodes.filter(n => n.kind === 'noise').length;
    for (const index of [61, 62, 63, 64]) synth.step({ bpm: 120 }, index, 1.2, { notesForStep: () => [] });
    assert.equal(nodes.filter(n => n.kind === 'noise').length - noiseBefore, 4, 'three pickup snares and one crash');

    const { Context: Plain, nodes: plainNodes } = richContext(), quiet = musicScope().synth(new Plain(), undefined, { fills: false });
    for (const index of [61, 62, 63, 64]) quiet.step({ bpm: 120 }, index, 1.2, { notesForStep: () => [] });
    assert.equal(plainNodes.filter(n => n.kind === 'noise').length, 0, 'fills can be disabled for rhythm-critical play');
});

test('silence stops every layered source and mutes the room and echo returns', () => {
    const { Context, nodes } = richContext(), context = new Context();
    const synth = musicScope().synth(context);
    for (let i = 0; i < 16; i++) synth.step({ bpm: 120 }, i, 1.1 + i * .125, bassScore);
    synth.silence();
    const sources = nodes.filter(n => n.started !== undefined);
    assert.ok(sources.length > 6);
    assert.ok(sources.every(n => n.stopped <= context.currentTime + .014));
    const returns = nodes.filter(n => n.kind === 'gain' && n.gain.events.some(e => e[0] === 'linear' && e[1] === 0 && Math.abs(e[2] - (context.currentTime + .04)) < 1e-9));
    assert.equal(returns.length, 2);
    synth.step({ bpm: 120 }, 0, 2, bassScore);
    assert.ok(returns.every(n => n.gain.events.at(-1)[0] === 'linear' && n.gain.events.at(-1)[1] > 0), 'returns fade back in on the next step');
});

test('sound effects gain unison, sub-octave and sparkle layers, stereo spread and a room tail', () => {
    const { Context, nodes } = richContext();
    const button = { setAttribute() {}, addEventListener() {} };
    const window = { AudioContext: Context };
    vm.runInNewContext(read('audio.js'), { window, localStorage: { getItem: () => null, setItem() {} }, Promise, Date, Math });
    const sound = window.CashArcadeAudio.create({ storageKey: 'rich', toggleButton: button });
    sound.play('assaultExplosion');
    const detunes = () => nodes.filter(n => n.kind === 'oscillator').map(n => n.detune.value);
    assert.deepEqual(detunes(), [0, 8, -1200], 'low impact: authored tone, unison and sub-octave');
    assert.ok(nodes.some(n => n.kind === 'convolver'), 'room tail');
    nodes.length = 0; sound.play('assaultPickup');
    assert.deepEqual(detunes(), [0, 8, 1200, 0, 8, 1200], 'rising chime gains an octave sparkle');
    assert.deepEqual(nodes.filter(n => n.kind === 'panner').map(n => n.pan.value), [-.22], 'second tone fans out; the first stays centred');
    nodes.length = 0; sound.play('wall');
    assert.deepEqual(detunes(), [0], 'falling sine cues stay pure');
    for (const n of nodes.filter(n => n.kind === 'oscillator')) assert.ok(n.stopped > n.started);
});
