(() => {
    'use strict';
    // Preserve the existing missile API, soundtrack and storage keys.
    globalThis.NeonDefenseMusic = Object.freeze({
        create: options => CashArcadeMusic.create({ ...options, score: NeonDefenseScore, storagePrefix: 'casharcade-missile-music' }),
        synth(context, destination) {
            const instrument = CashArcadeMusic.synth(context, destination);
            return { ...instrument, step: (profile, index, when) => instrument.step(profile, index, when, NeonDefenseScore) };
        },
    });
})();
