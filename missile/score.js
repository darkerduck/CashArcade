(() => {
    'use strict';
    // Original 4/4 chip score. Melody tuples: sixteenth-note onset, tonic-relative
    // semitone, length. Four authored bars answer with a variation over eight bars.
    const THEMES = {
        sentinel: { name: '曙光防線', feel: '堅定行進', groove: 'march',
            harmony: [[0,3,7],[8,12,15],[3,7,10],[7,11,14],[0,3,7],[5,8,12],[8,12,15],[7,11,14]],
            melody: [
                [[0,0,3],[4,7,2],[6,10,2],[8,12,3],[12,7,2],[14,3,2]],
                [[0,8,3],[4,7,2],[6,3,2],[8,12,4],[14,15,2]],
                [[0,10,2],[2,7,2],[4,3,4],[10,7,2],[12,10,3]],
                [[0,11,3],[4,7,2],[6,2,2],[8,11,3],[12,14,2],[14,11,2]],
            ] },
        velocity: { name: '光速交鋒', feel: '高速追擊', groove: 'drive',
            harmony: [[0,3,7],[0,3,7],[8,12,15],[7,11,14],[0,3,7],[3,7,10],[5,8,12],[7,11,14]],
            melody: [
                [[0,12,2],[3,7,1],[4,10,2],[7,7,1],[8,3,2],[10,7,2],[12,0,3]],
                [[0,3,2],[2,7,1],[4,12,2],[7,10,1],[8,7,3],[12,15,2],[14,14,2]],
                [[0,12,3],[4,8,2],[6,7,2],[8,3,2],[11,8,1],[12,15,3]],
                [[0,14,2],[2,11,2],[4,7,3],[8,11,2],[10,14,2],[12,19,2],[14,11,2]],
            ] },
        fracture: { name: '碎星脈衝', feel: '切分蜂群', groove: 'break',
            harmony: [[0,3,7],[5,8,12],[8,12,15],[7,11,14],[0,3,7],[5,8,12],[2,5,8],[7,11,14]],
            melody: [
                [[0,0,2],[3,12,2],[6,7,2],[9,10,2],[12,3,2],[15,7,1]],
                [[0,8,2],[3,5,2],[6,12,2],[9,15,2],[12,8,3]],
                [[0,15,2],[3,12,2],[6,8,2],[9,7,2],[12,12,2],[15,15,1]],
                [[0,14,2],[3,11,2],[6,7,2],[9,2,2],[12,11,2],[14,14,2]],
            ] },
        iron: { name: '鋼鐵心跳', feel: '重甲進軍', groove: 'heavy',
            harmony: [[0,3,7],[0,3,7],[1,5,8],[7,11,14],[0,3,7],[8,12,15],[5,8,12],[7,11,14]],
            melody: [
                [[0,0,5],[6,7,2],[8,3,4],[14,0,2]],
                [[0,7,5],[6,10,2],[8,12,5],[14,7,2]],
                [[0,8,4],[6,5,2],[8,1,4],[14,5,2]],
                [[0,2,3],[4,7,3],[8,11,3],[12,7,4]],
            ] },
        sky: { name: '蒼穹航線', feel: '空戰琶音', groove: 'flight',
            harmony: [[0,3,7],[3,7,10],[8,12,15],[10,14,17],[0,3,7],[5,8,12],[8,12,15],[7,11,14]],
            melody: [
                [[0,7,4],[5,12,2],[8,15,4],[13,14,2]],
                [[0,10,3],[4,7,3],[8,3,3],[12,7,3]],
                [[0,8,3],[4,12,3],[8,15,3],[12,19,3]],
                [[0,17,4],[6,14,2],[8,10,4],[14,14,2]],
            ] },
        siege: { name: '終界倒數', feel: '飽和攻勢', groove: 'break',
            harmony: [[0,3,7],[8,12,15],[5,8,12],[7,11,14],[0,3,7],[1,5,8],[8,12,15],[7,11,14]],
            melody: [
                [[0,12,2],[2,12,1],[4,7,2],[7,10,1],[8,12,2],[10,15,2],[12,14,3]],
                [[0,15,3],[4,12,2],[7,8,1],[8,12,2],[10,15,2],[12,20,3]],
                [[0,17,2],[2,15,2],[4,12,2],[7,8,1],[8,5,2],[10,8,2],[12,12,3]],
                [[0,14,2],[2,11,2],[4,7,2],[6,11,2],[8,14,2],[10,19,2],[12,11,3]],
            ] },
        carrier: { name: '黑曜母艦', feel: '母艦壓境', groove: 'boss',
            harmony: [[0,3,7],[1,5,8],[0,3,7],[7,11,14],[8,12,15],[5,8,12],[1,5,8],[7,11,14]],
            melody: [
                [[0,0,5],[6,12,2],[8,7,3],[12,3,3]],
                [[0,1,5],[6,8,2],[8,13,3],[12,8,3]],
                [[0,12,3],[4,10,2],[6,7,2],[8,3,3],[12,0,3]],
                [[0,11,3],[4,14,3],[8,19,3],[12,11,4]],
            ] },
        ark: { name: '終焉方舟', feel: '最終決戰', groove: 'boss',
            harmony: [[0,3,7],[1,5,8],[8,12,15],[7,11,14],[0,3,7],[5,8,12],[1,5,8],[7,11,14]],
            melody: [
                [[0,0,3],[4,12,2],[6,7,2],[8,15,3],[12,14,2],[14,12,2]],
                [[0,13,3],[4,8,2],[6,5,2],[8,1,3],[12,8,2],[14,13,2]],
                [[0,15,3],[4,12,2],[6,8,2],[8,20,3],[12,19,2],[14,15,2]],
                [[0,14,2],[2,11,2],[4,7,3],[8,19,3],[12,23,2],[14,11,2]],
            ] },
    };
    // Each sector has an intentional key, tempo and arrangement density.
    const SECTORS = [
        ['sentinel',50,160,1],['sentinel',50,168,1],['velocity',52,180,1],['fracture',50,176,1],
        ['iron',45,168,1],['sky',50,176,1],['velocity',53,188,2],['iron',47,176,2],
        ['siege',50,192,2],['carrier',45,176,2],['velocity',54,192,2],['fracture',52,188,2],
        ['iron',47,184,2],['sky',52,192,2],['siege',52,200,3],['fracture',53,196,3],
        ['sky',53,200,3],['siege',53,204,3],['siege',54,208,3],['ark',47,184,2],
    ];
    function profile(level, phase = 'shield') {
        const index = Math.max(0, Math.min(19, Math.trunc(Number(level) || 1) - 1));
        const [id, root, baseTempo, density] = SECTORS[index];
        const boss = index === 9 || index === 19;
        const intensity = boss ? (phase === 'rage' ? 2 : phase === 'core' ? 1 : 0) : 0;
        return { ...THEMES[id], id, level: index + 1, root, boss, intensity,
            bpm: baseTempo + intensity * 16, density: Math.min(4, density + intensity),
            label: `${THEMES[id].name} · ${baseTempo + intensity * 16} BPM${boss ? [' · 護盾防衛',' · 核心暴露',' · 狂暴'][intensity] : ''}` };
    }
    function notesForStep(p, step) {
        const bar = Math.floor(step / 16) % 8, beat = step % 16, phrase = Math.floor(step / 128) % 2;
        const chord = p.harmony[bar], notes = [];
        const add = (voice, note, length, level = 1) => notes.push({ voice, note, length, level });
        const melodyBar = p.melody[bar % 4];
        for (const [onset, note, length] of melodyBar) if (onset === beat) {
            // Response phrase uses chord tones on the new harmony, retaining the motif's contour.
            const n = bar < 4 ? note : chord[(Math.round(note / 4) + phrase) % 3] + (note >= 12 ? 12 : 0);
            add('lead', p.root + 12 + n, length * .86, .88);
            if (p.intensity === 2 && beat % 4 === 0) add('echo', p.root + n, length * .6, .32);
        }
        const heavy = p.groove === 'heavy' || p.groove === 'boss';
        const bassSteps = heavy && p.intensity < 2 ? [0,3,6,8,11,14] : [0,2,4,6,8,10,12,14];
        if (bassSteps.includes(beat)) add('bass', p.root - 12 + chord[beat === 14 ? 2 : 0] + (beat === 6 || beat === 10 ? 12 : 0), heavy ? 1.4 : 1.7);
        if (p.density >= 2 && (beat === 7 || beat === 15)) add('bass', p.root - 12 + chord[0], .75, .7);
        const arpStride = p.density >= 2 ? 1 : 2;
        if (beat % arpStride === 0) {
            const order = p.groove === 'flight' ? [0,1,2,1,2,1,0,2] : [0,2,1,2];
            add('arp', p.root + 12 + chord[order[Math.floor(beat / arpStride) % order.length]], .65, bar >= 4 ? .9 : .7);
        }
        const kicks = heavy ? [0,3,6,8,11,14] : p.groove === 'break' || p.groove === 'drive' ? [0,3,8,10] : [0,6,8,14];
        if (kicks.includes(beat) || (p.density >= 2 && beat === 14) || (p.intensity === 2 && beat % 4 === 0)) add('kick', 0, 1);
        if (beat === 4 || beat === 12 || (bar === 7 && beat >= 14)) add('snare', 0, 1, beat >= 14 ? .65 : 1);
        if (beat % 2 === 0 || (p.density >= 3 && beat % 4 === 3)) add('hat', 0, 1, beat % 4 === 0 ? .85 : .5);
        return notes;
    }
    globalThis.NeonDefenseScore = Object.freeze({ profile, notesForStep });
})();
