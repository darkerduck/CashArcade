import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const read = name => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const scope = vm.createContext({});
for (const file of ['music-scores.js', 'missile/score.js', 'assault/music.js']) vm.runInContext(read(file), scope);
const games = [
    { name: 'snake', score: scope.CashArcadeScores.snake, levels: 1, phases: [0, 1, 2, 3] },
    { name: 'breakout', score: scope.CashArcadeScores.breakout, levels: 30, phases: [0, 1, 2] },
    { name: 'flappy', score: scope.CashArcadeScores.flappy, levels: 1, phases: [0, 1, 2, 3] },
    { name: 'missile', score: scope.NeonDefenseScore, levels: 20, phases: ['shield', 'core', 'rage'] },
    { name: 'assault', score: scope.NeonAssaultScore, levels: 3, phases: ['shield', 'armor', 'core', 'rage'] },
];
const phrase = (score, profile) => Array.from({ length: 128 }, (_, i) => score.notesForStep(profile, i));

for (const { name, score, levels, phases } of games) test(`${name}: every authored stage/phase has finite, deterministic six-voice chiptune data`, () => {
    for (let level = 1; level <= levels; level++) for (const phase of phases) {
        const p = score.profile(level, phase), notes = phrase(score, p).flat();
        assert.ok(p.bpm >= 100 && p.bpm <= 260, `${name} tempo ${p.bpm}`);
        assert.ok(typeof p.label === 'string' && p.label.length > 0);
        for (const kind of ['lead', 'bass', 'arp', 'kick', 'snare', 'hat']) {
            assert.ok(notes.some(n => n.voice === kind), `${name} level ${level} phase ${phase}: ${kind}`);
        }
        assert.ok(notes.every(n => Number.isFinite(n.note) && n.note >= 0 && n.note <= 127
            && Number.isFinite(n.length) && n.length > 0 && n.length <= 8
            && Number.isFinite(n.level) && n.level > 0 && n.level <= 1));
        assert.equal(JSON.stringify(phrase(score, p)), JSON.stringify(phrase(score, score.profile(level, phase))),
            'score events must be deterministic rather than random pitch generation');
        assert.ok(new Set(notes.filter(n => n.voice === 'lead').map(n => n.note)).size >= 5,
            'a real composed melody must vary in pitch');
        assert.ok(new Set(notes.filter(n => n.voice === 'bass').map(n => n.note)).size >= 3,
            'bass part must move through harmonic changes');
    }
});

test('the five existing games have distinct starting phrase/tempo identities', () => {
    const signatures = games.map(({ score }) => {
        const p = score.profile(1);
        return JSON.stringify({ bpm: p.bpm, events: phrase(score, p) });
    });
    assert.equal(new Set(signatures).size, 5);
});

test('Assault has three distinct stage themes and four bounded intensity tiers', () => {
    const score = scope.NeonAssaultScore, names = new Set(), phrases = new Set();
    for (let level = 1; level <= 3; level++) {
        const base = score.profile(level); names.add(base.name); phrases.add(JSON.stringify(phrase(score, base)));
        for (const [intensity, phase] of ['shield', 'armor', 'core', 'rage'].entries()) {
            const p = score.profile(level, phase);
            assert.equal(p.intensity, intensity); assert.equal(p.bpm, base.bpm + intensity * 8);
        }
        const dense = phrase(score, score.profile(level, 'core')).flat();
        const light = phrase(score, base).flat();
        assert.ok(dense.filter(n => n.voice === 'arp').length > light.filter(n => n.voice === 'arp').length);
    }
    assert.equal(names.size, 3); assert.equal(phrases.size, 3);
});

test('all five existing pages load production sound/music controls and lifecycle controller wiring', () => {
    for (const { name } of games) {
        const html = read(`${name}/index.html`), controller = read(`${name}/game.js`);
        for (const id of ['sound-toggle', 'music-toggle', 'music-volume', 'music-volume-value', 'music-track']) {
            assert.match(html, new RegExp(`id=["']${id}["']`), `${name}: ${id}`);
        }
        assert.match(html, /src=["']\.\.\/audio\.js/);
        assert.match(html, /src=["']\.\.\/music\.js/);
        assert.match(controller, /music\.start\(/);
        assert.match(controller, /music\.pause\(/);
        assert.match(controller, /music\.resume\(/);
        assert.match(controller, /visibilitychange/);
        assert.match(controller, /document\.hidden/);
        assert.match(controller, /sound\.play\(/);
    }
});
