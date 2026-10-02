(() => {
    'use strict';

    // Each voice is [start Hz, end Hz, duration seconds, delay seconds, level, wave, optional hold seconds].
    // Boost quiet effects by 18 dB while softly limiting loud or overlapping voices.
    const MASTER_LEVEL = .7;
    const VOICE_BOOST = 2.5;
    const OUTPUT_BOOST = 10 ** (18 / 20);
    const LIMIT_KNEE = .9;
    const LIMIT_HEADROOM = .09;
    const EFFECTS = Object.freeze({
        snakeShield: { tones: [[260, 660, .3, 0, .1, 'triangle', .07]] },
        snakeSlow: { tones: [[480, 150, .42, 0, .10, 'triangle', .06]] },
        snakeShrink: { tones: [[650, 250, .24, 0, .10, 'triangle'], [420, 160, .2, .12, .08, 'sine']] },
        snakeMagnet: { tones: [[180, 380, .22, 0, .10, 'triangle'], [380, 760, .22, .18, .085, 'triangle']] },
        snakeEmp: { tones: [[180, 55, .38, 0, .11, 'triangle', .08]], noise: [.25, .07, 2100] },
        snakePortal: { tones: [[180, 880, .25, 0, .09, 'triangle'], [660, 220, .2, .12, .07, 'sine']], minGap: 120 },
        snakeShieldHit: { tones: [[780, 270, .24, 0, .09, 'triangle']], noise: [.12, .035, 2200], minGap: 100 },
        snakeWarning: { tones: [[360, 460, .14, 0, .045, 'triangle']], minGap: 450 },
        assaultStart: { tones: [[220, 440, .12, 0, .07, 'triangle'], [440, 880, .2, .12, .07, 'square']] },
        assaultShot: { tones: [[840, 290, .07, 0, .027, 'square']], minGap: 130 },
        assaultLaser: { tones: [[360, 180, .10, 0, .035, 'sawtooth']], minGap: 170 },
        assaultExplosion: { tones: [[130, 40, .22, 0, .06, 'triangle']], noise: [.18, .04, 1500], minGap: 70 },
        assaultHurt: { tones: [[170, 50, .3, 0, .08, 'sawtooth']], noise: [.24, .045, 850], minGap: 150 },
        assaultPickup: { tones: [[523, 784, .10, 0, .065, 'square'], [784, 1047, .13, .10, .065, 'triangle']] },
        assaultBomb: { tones: [[95, 38, .6, 0, .09, 'triangle'], [220, 880, .28, .06, .04, 'square']], noise: [.5, .06, 1100], minGap: 450 },
        assaultPart: { tones: [[190, 60, .36, 0, .07, 'triangle']], noise: [.28, .05, 1900], minGap: 110 },
        assaultBossDown: { tones: [[145, 36, .7, 0, .08, 'triangle'], [523, 1047, .3, .35, .05, 'square']], noise: [.65, .06, 1100], minGap: 450 },
        defenseStart: { tones: [[220, 440, .22, 0, .12, 'triangle', .06]] },
        defenseLaunch: { tones: [[300, 760, .17, 0, .11, 'triangle', .045]], noise: [.08, .04, 2300] },
        defenseBlast: { tones: [[170, 60, .34, 0, .1, 'triangle', .08]], noise: [.28, .08, 1700], minGap: 65 },
        defenseChain: { tones: [[380, 190, .19, 0, .085, 'triangle', .04]], noise: [.12, .055, 2400], minGap: 80 },
        defenseArmor: { tones: [[660, 280, .16, 0, .07, 'triangle', .03]], minGap: 65 },
        defenseDamage: { tones: [[180, 55, .45, 0, .12, 'triangle', .10]], noise: [.35, .075, 950], minGap: 100 },
        defensePickup: { tones: [[523, 784, .18, 0, .1, 'triangle', .06], [784, 1047, .20, .15, .1, 'triangle', .05]] },
        defenseShield: { tones: [[300, 650, .25, 0, .11, 'sine', .08]], minGap: 80 },
        defenseAlarm: { tones: [[440, 660, .30, 0, .1, 'triangle', .12], [440, 660, .30, .35, .1, 'triangle', .12]] },
        defenseBoss: { tones: [[220, 45, .7, 0, .12, 'triangle', .2]], noise: [.65, .09, 1900] },
        defenseUpgrade: { tones: [[523, 659, .16, 0, .1, 'triangle', .04], [784, 1047, .24, .17, .11, 'triangle', .06]] },
        confirm: { tones: [[660, 880, .09, 0, .10, 'sine']] },
        start: { tones: [[392, 523, .10, 0, .11, 'triangle'], [523, 784, .12, .10, .09, 'triangle']] },
        food: { tones: [[520, 260, .24, 0, .12, 'triangle', .09], [260, 180, .19, 0, .07, 'sine', .055]], noise: [.035, .035, 1800] },
        dessert: { tones: [[784, 1047, .10, 0, .09, 'triangle'], [1047, 1319, .11, .09, .10, 'sine']] },
        bomb: { tones: [[220, 65, .28, 0, .12, 'sawtooth']], noise: [.22, .07, 800] },
        speed: { tones: [[523, 523, .08, 0, .08, 'triangle'], [659, 659, .08, .09, .08, 'triangle'], [784, 988, .13, .18, .09, 'triangle']] },
        wrap: { tones: [[330, 220, .085, 0, .055, 'sine']], minGap: 90 },
        pause: { tones: [[440, 330, .10, 0, .07, 'triangle']] },
        resume: { tones: [[440, 660, .10, 0, .08, 'triangle']] },
        lose: { tones: [[440, 330, .15, 0, .10, 'triangle'], [330, 220, .20, .15, .09, 'triangle']] },
        win: { tones: [[523, 523, .11, 0, .10, 'triangle'], [659, 659, .11, .12, .10, 'triangle'], [784, 784, .11, .24, .10, 'triangle'], [1047, 1047, .24, .36, .11, 'triangle']] },
        wall: { tones: [[240, 190, .065, 0, .045, 'sine']], minGap: 75 },
        paddle: { tones: [[330, 510, .075, 0, .075, 'triangle']], minGap: 85 },
        brick: { tones: [[660, 480, .09, 0, .075, 'triangle']], minGap: 45 },
        crack: { tones: [[420, 230, .11, 0, .075, 'sawtooth']], noise: [.055, .045, 1800], minGap: 45 },
        reinforced: { tones: [[740, 520, .13, 0, .09, 'triangle'], [520, 780, .08, .07, .06, 'sine']], noise: [.045, .035, 2600], minGap: 45 },
        life: { tones: [[320, 180, .20, 0, .09, 'triangle']], noise: [.11, .045, 900] },
        level: { tones: [[523, 523, .10, 0, .09, 'triangle'], [784, 784, .10, .12, .09, 'triangle'], [1047, 1047, .18, .24, .10, 'triangle']] },
        flap: { tones: [[390, 570, .105, 0, .065, 'sine']], minGap: 55 },
        pass: { tones: [[740, 990, .11, 0, .085, 'sine']], minGap: 80 },
        breakoutCharge: { tones: [[135, 280, .32, 0, .08, 'triangle', .10]], minGap: 200 },
        breakoutImpulse: { tones: [[170, 360, .20, 0, .09, 'triangle', .07]], noise: [.09, .035, 1200], minGap: 120 },
        breakoutStrong: { tones: [[150, 470, .26, 0, .12, 'triangle', .08], [310, 180, .22, .02, .07, 'sine']], noise: [.13, .05, 1600], minGap: 100 },
        breakoutHeavy: { tones: [[145, 65, .24, 0, .11, 'triangle', .065]], noise: [.13, .055, 1000], minGap: 65 },
        breakoutTiny: { tones: [[650, 440, .16, 0, .065, 'triangle', .04]], minGap: 70 },
        breakoutPower: { tones: [[330, 660, .16, 0, .11, 'triangle', .05], [660, 880, .20, .12, .10, 'triangle', .05]] },
        breakoutPortal: { tones: [[180, 980, .29, 0, .09, 'triangle', .04], [700, 260, .20, .08, .055, 'sine']], minGap: 110 },
        breakoutMagnetic: { tones: [[110, 190, .22, 0, .08, 'sawtooth', .04]], minGap: 160 },
        breakoutSwitch: { tones: [[160, 250, .18, 0, .10, 'square'], [330, 660, .18, .16, .09, 'triangle']], noise: [.12, .04, 1200] },
        breakoutExplosion: { tones: [[170, 45, .32, 0, .12, 'triangle', .06]], noise: [.24, .085, 1100], minGap: 80 },
        breakoutLightning: { tones: [[240, 100, .17, 0, .08, 'sawtooth']], noise: [.14, .065, 2600], minGap: 100 },
        breakoutLaser: { tones: [[390, 180, .13, 0, .065, 'triangle']], minGap: 160 },
        breakoutBoss: { tones: [[120, 220, .22, 0, .11, 'sawtooth', .08], [220, 120, .22, .23, .10, 'sawtooth', .08]] },
        breakoutBossDown: { tones: [[190, 50, .45, 0, .13, 'triangle', .09], [440, 880, .22, .32, .09, 'triangle']], noise: [.40, .09, 1300], minGap: 250 },
    });

    function limiterCurve() {
        const curve = new Float32Array(4097);
        for (let index = 0; index < curve.length; index += 1) {
            const input = index * 2 / (curve.length - 1) - 1;
            const boosted = Math.abs(input) * OUTPUT_BOOST;
            const limited = boosted <= LIMIT_KNEE
                ? boosted
                : LIMIT_KNEE + LIMIT_HEADROOM * (1 - Math.exp(-(boosted - LIMIT_KNEE) / LIMIT_HEADROOM));
            curve[index] = Math.sign(input) * limited;
        }
        return curve;
    }

    function create({ storageKey, toggleButton, outputLevel = 1, musicMix = false }) {
        let muted = false;
        let context;
        let output;
        let mix;
        let unavailable = false;
        const lastPlayed = new Map();
        let voiceEnds = [];

        try { muted = localStorage.getItem(storageKey) === '1'; } catch { /* Current page still has a sound setting. */ }

        function updateButton() {
            const label = muted ? '開啟音效' : '關閉音效';
            toggleButton.setAttribute('aria-label', label);
            toggleButton.setAttribute('title', label);
            toggleButton.setAttribute('aria-pressed', String(!muted));
        }

        function getContext() {
            if (unavailable) return null;
            if (context) return context;
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (!AudioContextClass) { unavailable = true; return null; }
            try {
                context = new AudioContextClass();
                // Opt-in final mix bus: preserve the existing SFX gain and limit only
                // loud music+SFX sums. Unchanged games keep their original graph.
                let destination = context.destination;
                if (musicMix && typeof context.createWaveShaper === 'function') {
                    mix = context.createGain();
                    const safety = context.createWaveShaper(), curve = new Float32Array(4097);
                    for (let i = 0; i < curve.length; i++) {
                        const x = i * 2 / (curve.length - 1) - 1, a = Math.abs(x);
                        curve[i] = Math.sign(x) * (a <= .88 ? a : .88 + .1 * (1 - Math.exp(-(a - .88) / .1)));
                    }
                    safety.curve = curve; safety.oversample = '4x';
                    mix.connect(safety); safety.connect(context.destination); destination = mix;
                }
                output = context.createGain();
                output.gain.value = MASTER_LEVEL;
                if (typeof context.createWaveShaper === 'function') {
                    const limiter = context.createWaveShaper();
                    limiter.curve = limiterCurve();
                    limiter.oversample = '4x';
                    output.connect(limiter);
                    if (outputLevel !== 1) {
                        const headroom = context.createGain();
                        headroom.gain.value = Number.isFinite(outputLevel) ? Math.max(0, Math.min(1, outputLevel)) : 1;
                        limiter.connect(headroom);
                        headroom.connect(destination);
                    } else limiter.connect(destination);
                } else {
                    output.connect(destination);
                }
                return context;
            } catch {
                unavailable = true;
                return null;
            }
        }

        function resume() {
            if (muted) return;
            const audio = getContext();
            if (audio && audio.state === 'suspended') {
                try { Promise.resolve(audio.resume()).catch(() => {}); } catch { /* Sound is optional. */ }
            }
        }

        function envelope(gain, start, duration, level, hold = 0) {
            gain.setValueAtTime(.0001, start);
            const attackEnd = start + Math.min(.008, duration / 3);
            const peak = level * VOICE_BOOST;
            gain.exponentialRampToValueAtTime(peak, attackEnd);
            if (hold > 0) gain.setValueAtTime(peak, Math.max(attackEnd, start + Math.min(hold, duration - .01)));
            gain.exponentialRampToValueAtTime(.0001, start + duration);
        }

        function tone(audio, spec, base) {
            const [from, to, duration, delay, level, wave, hold] = spec;
            const start = base + delay;
            const oscillator = audio.createOscillator();
            const gain = audio.createGain();
            oscillator.type = wave;
            oscillator.frequency.setValueAtTime(from, start);
            oscillator.frequency.exponentialRampToValueAtTime(to, start + duration);
            envelope(gain.gain, start, duration, level, hold);
            oscillator.connect(gain);
            gain.connect(output);
            oscillator.start(start);
            oscillator.stop(start + duration + .015);
        }

        function noise(audio, spec, base) {
            const [duration, level, cutoff] = spec;
            const buffer = audio.createBuffer(1, Math.ceil(audio.sampleRate * duration), audio.sampleRate);
            const samples = buffer.getChannelData(0);
            for (let index = 0; index < samples.length; index += 1) samples[index] = Math.random() * 2 - 1;
            const source = audio.createBufferSource();
            const filter = audio.createBiquadFilter();
            const gain = audio.createGain();
            source.buffer = buffer;
            filter.type = 'lowpass';
            filter.frequency.value = cutoff;
            envelope(gain.gain, base, duration, level);
            source.connect(filter);
            filter.connect(gain);
            gain.connect(output);
            source.start(base);
            source.stop(base + duration + .015);
        }

        function play(name, delay = 0) {
            if (muted || !Object.prototype.hasOwnProperty.call(EFFECTS, name)) return;
            const effect = EFFECTS[name];
            const now = Date.now();
            if (effect.minGap && now - (lastPlayed.get(name) ?? -Infinity) < effect.minGap) return;
            const audio = getContext();
            if (!audio) return;
            resume();
            try {
                const start = audio.currentTime + .005 + (Number.isFinite(delay) ? Math.max(0, Math.min(delay, 1)) : 0);
                voiceEnds = voiceEnds.filter(end => end > audio.currentTime);
                const needed = effect.tones.length + (effect.noise ? 1 : 0);
                if (voiceEnds.length + needed > 40) return; // Bound dense multiball/polyphonic bursts.
                effect.tones.forEach(spec => tone(audio, spec, start));
                if (effect.noise) noise(audio, effect.noise, start);
                effect.tones.forEach(spec => voiceEnds.push(start + spec[3] + spec[2] + .015));
                if (effect.noise) voiceEnds.push(start + effect.noise[0] + .015);
                lastPlayed.set(name, now);
            } catch { /* Audio failure must never stop a game or payment flow. */ }
        }

        function toggleMuted() {
            muted = !muted;
            try { localStorage.setItem(storageKey, muted ? '1' : '0'); } catch { /* Keep current page preference. */ }
            updateButton();
            if (!muted) play('confirm');
        }

        toggleButton.addEventListener('click', toggleMuted);
        updateButton();
        function musicOutput() {
            const audio = getContext();
            return audio ? { context: audio, destination: mix || audio.destination } : null;
        }
        return Object.freeze({ play, toggleMuted, isMuted: () => muted, resume, musicOutput });
    }

    window.CashArcadeAudio = Object.freeze({ create });
})();
