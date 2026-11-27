// 蒸汽前線 COGFRONT — four original pieces for the shared CashArcadeMusic synth:
// a brass-band march per zone plus a boss engine theme. Oom-pah bass, snare rolls, hats on the off-beat.
(() => {
    'use strict';
    const themes = [
        { name: '鐵道進行曲', root: 50, bpm: 132, chords: [[0, 4, 7], [5, 9, 12], [7, 11, 14], [0, 4, 7]],
            melody: [[12, 11, 12, 14, 16, 14, 12, 7], [17, 16, 14, 12, 14, 16, 17, 21], [19, 17, 16, 14, 11, 14, 16, 19], [16, 14, 12, 11, 12, 16, 19, 24]] },
        { name: '齒輪工廠', root: 45, bpm: 140, chords: [[0, 3, 7], [8, 12, 15], [5, 8, 12], [7, 11, 14]],
            melody: [[12, 15, 12, 10, 12, 7, 10, 12], [15, 20, 19, 15, 12, 15, 17, 20], [17, 15, 12, 17, 20, 17, 15, 12], [19, 14, 11, 14, 19, 23, 19, 14]] },
        { name: '熔爐攻城', root: 43, bpm: 148, chords: [[0, 3, 7], [1, 5, 8], [0, 3, 7], [7, 10, 14]],
            melody: [[12, 12, 15, 19, 18, 15, 12, 10], [13, 17, 20, 17, 13, 12, 13, 17], [15, 19, 22, 19, 15, 12, 10, 12], [19, 17, 14, 10, 14, 17, 19, 22]] },
        { name: '巨械心臟', root: 41, bpm: 156, chords: [[0, 3, 6], [0, 3, 7], [1, 4, 8], [7, 11, 14]],
            melody: [[12, 15, 18, 15, 12, 11, 12, 18], [12, 15, 19, 24, 19, 15, 12, 7], [13, 16, 20, 25, 20, 16, 13, 8], [19, 23, 26, 23, 19, 14, 11, 14]] },
    ];
    function profile(stage = 1, phase = 0) {
        stage = Math.max(1, Math.min(8, Math.floor(stage) || 1));
        const boss = stage === 4 || stage === 8, zone = stage <= 3 ? 0 : stage <= 6 ? 1 : 2, index = boss ? 3 : zone, t = themes[index];
        const intensity = phase === 'overload' ? 2 : boss ? 1 : 0, bpm = t.bpm + (intensity === 2 ? 10 : 0) + (boss ? 0 : zone * 2);
        return { ...t, level: stage, index, boss, intensity, bpm, label: `${t.name}${intensity === 2 ? ' · 過載' : ''} · ${bpm} BPM` };
    }
    function notesForStep(p, index) {
        const bar = Math.floor(index / 16) % 8, step = index % 16, chord = p.chords[bar % 4], melody = p.melody[bar % 4], notes = [];
        const add = (voice, note, length, level) => notes.push({ voice, note, length, level });
        if (step % 2 === 0) add('lead', p.root + 12 + melody[step / 2] + (bar >= 4 && step === 14 ? 12 : 0), step === 14 ? 2.5 : 1.6, .7);
        // Oom-pah: root on the beat, fifth on the off-beat.
        if (step % 4 === 0) add('bass', p.root - 12 + chord[0], 2, .9);
        if (step % 4 === 2) add('bass', p.root - 12 + chord[2], 1.4, .65);
        if (p.boss || p.intensity) { if (step % 2 === 1) add('arp', p.root + 24 + chord[(step >> 1) % 3], .6, .3); }
        else if (step % 4 === 3) add('arp', p.root + 12 + chord[1], .8, .3);
        if (bar >= 4 && step === 8) add('echo', p.root + 24 + chord[2], 3, .32);
        if (step === 0 || step === 8 || (p.boss && step === 10)) add('kick', 0, 1, .85);
        if (step === 4 || step === 12) add('snare', 0, 1, .62);
        if (bar % 4 === 3 && step >= 13) add('snare', 0, 1, .35 + (step - 13) * .12);
        if (step % 4 === 2) add('hat', 0, 1, .42);
        return notes;
    }
    globalThis.CogfrontScore = Object.freeze({ profile, notesForStep });
})();
