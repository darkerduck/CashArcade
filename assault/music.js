(() => {
    'use strict';
    // Three original motifs with an eight-bar call and response, plus boss variations.
    const themes = [
        { name: '光城出擊', root: 48, bpm: 168, chords: [[0,3,7],[8,12,15],[5,8,12],[7,11,14]], melody: [
            [[0,0,2],[3,7,1],[4,12,3],[8,10,2],[11,7,1],[12,3,3]],
            [[0,8,2],[2,12,2],[6,15,2],[8,12,3],[12,8,3]],
            [[0,5,3],[4,12,2],[7,15,1],[8,17,3],[12,12,3]],
            [[0,14,2],[3,11,1],[4,7,3],[8,11,2],[12,14,2],[14,19,2]],
        ] },
        { name: '裂谷追光', root: 50, bpm: 176, chords: [[0,3,7],[5,8,12],[1,5,8],[7,11,14]], melody: [
            [[0,12,2],[3,7,2],[6,3,2],[8,7,3],[12,10,3]],
            [[0,12,3],[4,8,2],[7,5,1],[8,8,3],[12,15,3]],
            [[0,13,2],[3,8,2],[6,5,2],[8,1,3],[12,8,3]],
            [[0,7,3],[4,11,2],[6,14,2],[8,19,3],[12,14,3]],
        ] },
        { name: '零界決戰', root: 45, bpm: 184, chords: [[0,3,7],[1,5,8],[8,12,15],[7,11,14]], melody: [
            [[0,0,3],[4,7,2],[6,12,2],[8,15,3],[12,12,3]],
            [[0,13,3],[4,8,2],[6,5,2],[8,1,3],[12,8,3]],
            [[0,8,2],[2,12,2],[4,15,3],[8,20,3],[12,15,3]],
            [[0,19,3],[4,14,2],[6,11,2],[8,7,2],[11,11,1],[12,14,3]],
        ] },
    ];
    function profile(level = 1, phase = 0) {
        const index = Math.max(0, Math.min(2, level - 1)), t = themes[index];
        const intensity = { armor: 1, core: 2, rage: 3 }[phase] || 0, bpm = t.bpm + intensity * 8;
        return { ...t, level: index + 1, intensity, bpm, label: `${t.name}${intensity ? ' · 頭目交鋒' : ''} · ${bpm} BPM` };
    }
    function notesForStep(p, step) {
        const bar = Math.floor(step / 16) % 8, beat = step % 16, chord = p.chords[bar % 4], notes = [];
        const add = (voice, note, length, level = 1) => notes.push({ voice, note, length, level });
        for (const [at, note, length] of p.melody[bar % 4]) if (at === beat) {
            add('lead', p.root + 12 + (bar >= 4 && beat === 12 ? chord[2] + 12 : note), length * .8, .8);
        }
        if (beat % 2 === 0) add('bass', p.root - 12 + chord[beat === 14 ? 2 : 0], 1.5, .9);
        if (beat % (p.intensity > 1 ? 1 : 2) === 0) add('arp', p.root + 12 + chord[[0,2,1,2][beat % 4]], .7, .6);
        if ([0,6,8,14].includes(beat) || p.intensity >= 2 && beat === 3) add('kick', 0, 1, .9);
        if (beat === 4 || beat === 12 || bar === 7 && beat === 15) add('snare', 0, 1, .7);
        if (beat % 2 === 0) add('hat', 0, 1, .5);
        return notes;
    }
    globalThis.NeonAssaultScore = Object.freeze({ profile, notesForStep });
})();
