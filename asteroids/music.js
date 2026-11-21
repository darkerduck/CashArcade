(() => {
    'use strict';
    // Scale degrees in semitones. Each row is a two-bar phrase and its answer.
    const tracks = [
        { name: '碎岩晨光', bpm: 144, root: 48, beat: [0, 3, 6, 8, 11, 14],
            bass: [0, 8, 3, 10, 0, 8, 5, 7],
            phrases: [[7, 12, 15, 12, 7, 3], [0, 8, 12, 15, 12, 8], [3, 10, 15, 17, 15, 10], [10, 14, 17, 14, 10, 7]] },
        { name: '礦脈切割機', bpm: 158, root: 43, beat: [0, 2, 5, 9, 12, 14],
            bass: [0, 1, 0, 6, 0, 3, 1, 7],
            phrases: [[0, 6, 7, 12, 7, 6], [1, 13, 8, 5, 8, 13], [12, 15, 19, 18, 12, 7], [6, 13, 10, 18, 13, 10]] },
        { name: '星雲擺渡', bpm: 136, root: 50, beat: [0, 4, 7, 9, 12, 15],
            bass: [0, 5, 10, 8, 0, 3, 5, 10],
            phrases: [[12, 19, 15, 17, 19, 22], [17, 12, 8, 12, 15, 17], [22, 17, 14, 10, 14, 17], [20, 15, 12, 8, 12, 15]] },
        { name: '織引之輪', bpm: 162, root: 45, beat: [0, 3, 5, 8, 10, 13],
            bass: [0, 6, 5, 1, 0, 6, 8, 7],
            phrases: [[12, 7, 3, 15, 10, 7], [18, 13, 10, 22, 18, 13], [5, 12, 17, 20, 17, 12], [13, 8, 5, 1, 8, 13]] },
        { name: '殘艦訊號', bpm: 152, root: 47, beat: [0, 2, 6, 8, 12, 14],
            bass: [0, 10, 8, 5, 0, 3, 10, 7],
            phrases: [[7, 10, 15, 19, 15, 12], [10, 17, 19, 22, 17, 14], [8, 12, 15, 24, 20, 15], [5, 12, 17, 21, 17, 12]] },
        { name: '噬星倒數', bpm: 174, root: 41, beat: [0, 2, 4, 7, 10, 13],
            bass: [0, 1, 6, 7, 0, 8, 1, 7],
            phrases: [[0, 12, 3, 15, 19, 22], [13, 8, 17, 20, 13, 24], [6, 18, 13, 22, 25, 18], [19, 14, 11, 23, 26, 23]] }
    ];
    function profile(level = 1, phase = 0) {
        level = Math.min(9, Math.max(1, Math.floor(level) || 1));
        const boss = level % 3 === 0;
        const track = tracks[Math.floor((level - 1) / 3) * 2 + Number(boss)];
        const overload = level === 9 && phase === 'overload';
        const bpm = track.bpm + (overload ? 10 : 0);
        return { ...track, level, bpm, boss, overload, intensity: Number(overload),
            label: track.name + (overload ? ' · 過載' : '') + ' · ' + bpm + ' BPM' };
    }
    function notesForStep(p, index) {
        const bar = Math.floor(index / 16) % 8, tick = index % 16, bass = p.bass[bar];
        const output = [];
        const add = (voice, note, length, level) => output.push({ voice, note, length, level });
        const lead = p.beat.indexOf(tick);
        if (lead !== -1) {
            const motif = p.phrases[bar % 4][lead];
            add('lead', p.root + 12 + motif + (bar >= 4 && lead >= 4 ? 5 : 0), lead === 5 ? 1.5 : 1.2, .72);
        }
        if (tick % 2 === 0) add('bass', p.root - 12 + bass + (tick === 14 ? 7 : 0), 1.45, .77);
        if (tick % (p.overload ? 1 : 2) === 0) {
            add('arp', p.root + 12 + bass + [0, 7, p.boss ? 3 : 5, 12][(tick + bar) % 4], .66, .34);
        }
        if (bar >= 4 && tick === 11) add('echo', p.root + bass + 24, 2.2, .34);
        if (tick === 0 || tick === 8 || (p.boss && tick === 6) || (p.overload && tick === 14)) add('kick', 0, .8, .83);
        if (tick === 4 || tick === 12) add('snare', 0, .7, .56);
        if (tick % 2 === 0 || p.overload) add('hat', 0, .6, .32);
        return output;
    }
    globalThis.StarshardScore = Object.freeze({ profile, notesForStep });
})();
