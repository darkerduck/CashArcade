(() => {
    'use strict';

    // Each voice is [start Hz, end Hz, duration seconds, delay seconds, level, wave].
    const EFFECTS = Object.freeze({
        confirm: { tones: [[660, 880, .09, 0, .10, 'sine']] },
        start: { tones: [[392, 523, .10, 0, .11, 'triangle'], [523, 784, .12, .10, .09, 'triangle']] },
        food: { tones: [[660, 880, .10, 0, .10, 'sine'], [880, 1047, .08, .06, .07, 'sine']] },
        speed: { tones: [[523, 523, .08, 0, .08, 'triangle'], [659, 659, .08, .09, .08, 'triangle'], [784, 988, .13, .18, .09, 'triangle']] },
        wrap: { tones: [[330, 220, .065, 0, .055, 'sine']], minGap: 90 },
        pause: { tones: [[440, 330, .10, 0, .07, 'triangle']] },
        resume: { tones: [[440, 660, .10, 0, .08, 'triangle']] },
        lose: { tones: [[440, 330, .15, 0, .10, 'triangle'], [330, 220, .20, .15, .09, 'triangle']] },
        win: { tones: [[523, 523, .11, 0, .10, 'triangle'], [659, 659, .11, .12, .10, 'triangle'], [784, 784, .11, .24, .10, 'triangle'], [1047, 1047, .24, .36, .11, 'triangle']] },
        wall: { tones: [[240, 190, .045, 0, .045, 'sine']], minGap: 75 },
        paddle: { tones: [[330, 510, .075, 0, .075, 'triangle']], minGap: 85 },
        brick: { tones: [[660, 480, .09, 0, .075, 'triangle']], minGap: 45 },
        crack: { tones: [[420, 230, .11, 0, .075, 'sawtooth']], noise: [.055, .045, 1800], minGap: 45 },
        reinforced: { tones: [[740, 520, .13, 0, .09, 'triangle'], [520, 780, .08, .07, .06, 'sine']], noise: [.045, .035, 2600], minGap: 45 },
        life: { tones: [[320, 180, .20, 0, .09, 'triangle']], noise: [.11, .045, 900] },
        level: { tones: [[523, 523, .10, 0, .09, 'triangle'], [784, 784, .10, .12, .09, 'triangle'], [1047, 1047, .18, .24, .10, 'triangle']] },
        flap: { tones: [[390, 570, .075, 0, .065, 'sine']], minGap: 55 },
        pass: { tones: [[740, 990, .11, 0, .085, 'sine']], minGap: 80 },
    });

    function create({ storageKey, toggleButton }) {
        let muted = false;
        let context;
        let output;
        let unavailable = false;
        const lastPlayed = new Map();

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
                output = context.createGain();
                output.gain.value = .23;
                output.connect(context.destination);
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

        function envelope(gain, start, duration, level) {
            gain.setValueAtTime(.0001, start);
            gain.exponentialRampToValueAtTime(level, start + Math.min(.008, duration / 3));
            gain.exponentialRampToValueAtTime(.0001, start + duration);
        }

        function tone(audio, spec, base) {
            const [from, to, duration, delay, level, wave] = spec;
            const start = base + delay;
            const oscillator = audio.createOscillator();
            const gain = audio.createGain();
            oscillator.type = wave;
            oscillator.frequency.setValueAtTime(from, start);
            oscillator.frequency.exponentialRampToValueAtTime(to, start + duration);
            envelope(gain.gain, start, duration, level);
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

        function play(name) {
            if (muted || !Object.prototype.hasOwnProperty.call(EFFECTS, name)) return;
            const effect = EFFECTS[name];
            const now = Date.now();
            if (effect.minGap && now - (lastPlayed.get(name) ?? -Infinity) < effect.minGap) return;
            const audio = getContext();
            if (!audio) return;
            resume();
            try {
                const start = audio.currentTime + .005;
                effect.tones.forEach(spec => tone(audio, spec, start));
                if (effect.noise) noise(audio, effect.noise, start);
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
        return Object.freeze({ play, toggleMuted, isMuted: () => muted, resume });
    }

    window.CashArcadeAudio = Object.freeze({ create });
})();
