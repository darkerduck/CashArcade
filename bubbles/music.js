(() => {
    'use strict';
    const songs = [
        { name: '露米的晨光', bpm: 114, root: 48, bass: [0, 5, 9, 7, 0, 4, 5, 7], beat: [0, 3, 6, 8, 11, 14],
            phrases: [[7, 12, 16, 14, 12, 7], [5, 12, 17, 16, 12, 9], [9, 16, 21, 19, 16, 12], [7, 14, 17, 19, 14, 11],
                [7, 12, 19, 16, 14, 12], [4, 11, 16, 19, 16, 11], [5, 12, 17, 21, 19, 16], [14, 17, 19, 23, 19, 14]] },
        { name: '潮汐信號', bpm: 126, root: 50, bass: [0, 10, 5, 7, 0, 3, 10, 7], beat: [0, 2, 5, 8, 10, 13],
            phrases: [[12, 15, 19, 17, 15, 10], [10, 14, 17, 22, 17, 14], [5, 12, 17, 20, 17, 12], [7, 14, 19, 22, 17, 14],
                [12, 19, 22, 26, 22, 17], [3, 10, 15, 19, 15, 10], [14, 17, 22, 26, 22, 17], [7, 14, 19, 23, 19, 14]] },
        { name: '晶核開花', bpm: 140, root: 45, bass: [0, 8, 5, 7, 0, 10, 8, 7], beat: [0, 2, 4, 7, 10, 13],
            phrases: [[0, 7, 12, 15, 19, 17], [8, 12, 15, 20, 24, 20], [5, 12, 17, 20, 17, 12], [7, 11, 14, 19, 23, 14],
                [12, 15, 19, 24, 27, 24], [10, 17, 22, 26, 22, 17], [8, 15, 20, 27, 24, 20], [19, 14, 11, 23, 19, 14]] }
    ];
    function profile(level = 1, phase = 0) {
        level = Math.max(1, Math.min(18, Math.floor(level) || 1));
        const theme = songs[Math.floor((level - 1) / 6)];
        const intensity = phase === 'pressure' ? 1 : 0;
        return { ...theme, level, intensity, label: theme.name + (intensity ? ' · 加奏' : '') + ' · ' + theme.bpm + ' BPM' };
    }
    function notesForStep(p, index) {
        const bar = Math.floor(index / 16) % 8, tick = index % 16, root = p.bass[bar];
        const output = [];
        const put = (voice, note, length, level) => output.push({ voice, note, length, level });
        const lead = p.beat.indexOf(tick);
        if (lead >= 0) put('lead', p.root + 12 + p.phrases[bar][lead], lead === 5 ? 1.8 : 1.3, .62);
        if ([0, 4, 7, 8, 12, 14].includes(tick)) put('bass', p.root - 12 + root + (tick === 14 ? 7 : 0), 1.75, .68);
        if (tick % (p.intensity ? 1 : 2) === 0) put('arp', p.root + 12 + root + [0, 7, 12, 7][(tick + bar) % 4], .7, .35);
        if (bar % 2 && tick === 15) put('echo', p.root + 24 + root, 1.25, .33);
        if (tick === 0 || tick === 8 || (p.intensity && tick === 6)) put('kick', 0, .8, .72);
        if (tick === 4 || tick === 12) put('snare', 0, .8, .48);
        if (tick % 2 === 0 || p.intensity) put('hat', 0, .6, .26);
        return output;
    }
    globalThis.LightbubbleScore = Object.freeze({ profile, notesForStep });
})();
