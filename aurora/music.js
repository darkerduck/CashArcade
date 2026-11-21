(() => {
    'use strict';
    const themes = [
        { name: '霓雨快線', root: 48, bpm: 145, bass: [0, 3, 10, 7, 0, 5, 8, 7], beat: [0, 3, 6, 8, 10, 14],
            phrases: [[7, 12, 15, 19, 15, 12], [3, 10, 15, 19, 22, 15], [10, 17, 22, 26, 22, 17], [7, 14, 19, 23, 19, 14],
                [12, 15, 19, 24, 19, 17], [5, 12, 17, 20, 24, 20], [8, 15, 20, 24, 27, 24], [7, 14, 19, 23, 26, 19]] },
        { name: '港灣脈衝', root: 43, bpm: 156, bass: [0, 8, 6, 5, 0, 3, 8, 7], beat: [0, 2, 5, 8, 11, 14],
            phrases: [[12, 6, 7, 15, 10, 7], [8, 15, 20, 17, 12, 8], [6, 13, 18, 22, 18, 13], [5, 12, 17, 20, 17, 12],
                [19, 12, 15, 22, 19, 15], [3, 10, 15, 19, 15, 10], [8, 15, 20, 24, 20, 15], [14, 11, 19, 23, 19, 14]] },
        { name: '越過極光線', root: 45, bpm: 168, bass: [0, 10, 8, 5, 0, 10, 8, 7], beat: [0, 2, 4, 7, 10, 13],
            phrases: [[0, 7, 12, 15, 19, 17], [10, 17, 22, 26, 22, 17], [8, 15, 20, 24, 27, 20], [5, 12, 17, 21, 20, 17],
                [12, 15, 19, 24, 27, 24], [10, 17, 22, 26, 29, 26], [15, 20, 24, 27, 31, 27], [19, 14, 11, 23, 26, 23]] }
    ];
    function profile(level = 1, phase = 0) {
        level = Math.max(1, Math.min(9, Math.floor(level) || 1));
        const theme = themes[Math.floor((level - 1) / 3)];
        const intensity = phase === 'final' ? 1 : 0;
        const bpm = theme.bpm + intensity * 6;
        return { ...theme, level, intensity, bpm, label: theme.name + (intensity ? ' · 終段' : '') + ' · ' + bpm + ' BPM' };
    }
    function notesForStep(p, index) {
        const bar = Math.floor(index / 16) % 8, tick = index % 16, chord = p.bass[bar];
        const result = [];
        const add = (voice, note, length, level) => result.push({ voice, note, length, level });
        const lead = p.beat.indexOf(tick);
        if (lead >= 0) add('lead', p.root + 12 + p.phrases[bar][lead], lead === 5 ? 1.6 : 1.25, .71);
        if (tick % 2 === 0) add('bass', p.root - 12 + chord + (tick === 14 ? 7 : 0), 1.48, .77);
        if (tick % (p.intensity ? 1 : 2) === 0) add('arp', p.root + 12 + chord + [0, 7, 3, 12][(tick + bar) % 4], .65, .34);
        if (bar % 2 && tick === 12) add('echo', p.root + 24 + chord, 1.6, .37);
        if ([0, 6, 8].includes(tick) || (p.intensity && tick === 14)) add('kick', 0, .8, .78);
        if (tick === 4 || tick === 12) add('snare', 0, .8, .63);
        if (tick % 2 === 0 || p.intensity) add('hat', 0, .6, .34);
        return result;
    }
    globalThis.AuroraScore = Object.freeze({ profile, notesForStep });
})();
