(() => {
    'use strict';
    const clamp = n => Math.max(0, Math.min(1, n));

    // A dedicated, reusable music bus leaves the existing four-game SFX gain untouched.
    // This synth is also used by the OfflineAudioContext verification pages.
    // Scores stay authored note data; the synth adds layered chip timbres, a pad that
    // doubles the bar's bass root, phrase fills, stereo placement and a shared room.
    const LEVELS = { lead: .15, echo: .1, bass: .27, arp: .058, kick: .44, snare: .23, hat: .14, pad: .026, crash: .07 };
    const PAN = { lead: 0, echo: -.34, bass: 0, arp: .3, kick: 0, snare: .05, hat: .24, pad: 0, crash: -.12 };
    const SEND = { lead: [.2, .16], echo: [.3, .3], arp: [.2, .24], bass: [.02, 0], kick: [.05, 0], snare: [.24, 0], hat: [.06, 0], pad: [.55, .1], crash: [.35, 0] };
    const MAX_VOICES = 64;

    function seeded(seed) { return () => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 2147483648 - 1; }; }

    function synth(context, destination = context.destination, options = {}) {
        const fills = options.fills !== false;
        const has = name => typeof context[name] === 'function';
        const bus = context.createGain(), output = context.createGain(), filter = context.createBiquadFilter();
        filter.type = 'lowpass'; filter.frequency.value = 7600; filter.Q.value = .5;
        const compressor = context.createDynamicsCompressor();
        compressor.threshold.value = -12; compressor.knee.value = 8; compressor.ratio.value = 4;
        compressor.attack.value = .004; compressor.release.value = .16;
        const limiter = context.createWaveShaper(), curve = new Float32Array(4097);
        for (let i=0;i<curve.length;i++) {
            const x=i*2/(curve.length-1)-1, a=Math.abs(x);
            curve[i]=Math.sign(x)*(a<=.1 ? a : .1+.08*(1-Math.exp(-(a-.1)/.08)));
        }
        // SFX already peaks near .8. Reserve its headroom even at music volume 100%.
        limiter.curve=curve; limiter.oversample='4x';
        bus.connect(filter); filter.connect(compressor); compressor.connect(output); output.connect(limiter); limiter.connect(destination);
        output.gain.value = .65;
        const voices = new Set();
        const random = seeded(173);
        function noiseBuffer(seconds, channels = 1) {
            const buffer = context.createBuffer(channels, Math.ceil(context.sampleRate * seconds), context.sampleRate);
            for (let c = 0; c < channels; c++) { const data = buffer.getChannelData(c); for (let i = 0; i < data.length; i++) data[i] = random(); }
            return buffer;
        }
        const noise = noiseBuffer(.22), wash = noiseBuffer(1.4);

        // Optional space: a short stereo room and a tempo-synced echo. Both feed the
        // compressor, so the existing limiter and headroom still bound the result.
        const wet = [];
        let reverbSend = null, delaySend = null, delayNode = null, delayBpm = 0, hushed = false;
        if (has('createConvolver')) {
            try {
                const room = context.createConvolver(), length = Math.ceil(context.sampleRate * 1.7);
                const impulse = context.createBuffer(2, length, context.sampleRate);
                for (let c = 0; c < 2; c++) {
                    const data = impulse.getChannelData(c);
                    for (let i = 0; i < length; i++) data[i] = random() * (1 - i / length) ** 2.8 * (i < 90 ? i / 90 : 1);
                }
                room.buffer = impulse;
                reverbSend = context.createGain(); const back = context.createGain(); back.gain.value = .36;
                reverbSend.connect(room); room.connect(back); back.connect(compressor); wet.push({ node: back, level: .36 });
            } catch { reverbSend = null; }
        }
        if (has('createDelay')) {
            try {
                delayNode = context.createDelay(2); delayNode.delayTime.value = .34;
                const feedback = context.createGain(), damp = context.createBiquadFilter(), back = context.createGain();
                damp.type = 'lowpass'; damp.frequency.value = 2800; feedback.gain.value = .3; back.gain.value = .24;
                delaySend = context.createGain(); delaySend.connect(delayNode); delayNode.connect(damp);
                damp.connect(feedback); feedback.connect(delayNode); damp.connect(back); back.connect(compressor);
                wet.push({ node: back, level: .24 });
            } catch { delaySend = null; delayNode = null; }
        }

        function frequency(note) { return 440 * 2 ** ((note - 69) / 12); }
        function envelope(gain, time, duration, peak, attack = .004, sustain = .65) {
            gain.gain.setValueAtTime(0, time);
            gain.gain.linearRampToValueAtTime(peak, time + attack);
            gain.gain.exponentialRampToValueAtTime(Math.max(.0001, peak * sustain), time + Math.max(attack + .001, duration * .45));
            gain.gain.exponentialRampToValueAtTime(.0001, time + duration);
            gain.gain.linearRampToValueAtTime(0, time + duration + .006);
        }
        function oscillator(type, hz, time, nodes, sources, detune = 0) {
            const source = context.createOscillator(); source.type = type;
            source.frequency.setValueAtTime(hz, time);
            if (detune && source.detune) source.detune.value = detune;
            nodes.push(source); sources.push(source); return source;
        }
        function layer(source, level, target, nodes) {
            if (level === 1) { source.connect(target); return; }
            const gain = context.createGain(); gain.gain.value = level; nodes.push(gain); source.connect(gain); gain.connect(target);
        }
        function lowpass(hz, q, nodes) {
            const node = context.createBiquadFilter(); node.type = 'lowpass'; node.frequency.value = hz; node.Q.value = q; nodes.push(node); return node;
        }
        function route(gain, kind, pan, nodes) {
            let out = gain;
            if (pan && has('createStereoPanner')) { const panner = context.createStereoPanner(); panner.pan.value = pan; nodes.push(panner); gain.connect(panner); out = panner; }
            out.connect(bus);
            const [room, echo] = SEND[kind] || [0, 0];
            for (const [send, amount] of [[reverbSend, room], [delaySend, echo]]) {
                if (!send || !amount) continue;
                const tap = context.createGain(); tap.gain.value = amount; nodes.push(tap); out.connect(tap); tap.connect(send);
            }
        }

        function voice(event, time, stepDuration) {
            if ([...voices].filter(entry => entry.end > time).length >= MAX_VOICES) return;
            const { voice: kind, note, length, level } = event;
            if (!(kind in LEVELS)) return;
            const durations = { hat: .05, snare: .17, kick: .19, crash: 1.3 };
            const duration = durations[kind] ?? Math.max(.035, length * stepDuration);
            const gain = context.createGain(), nodes = [gain], sources = [];
            const peak = LEVELS[kind] * level, end = time + duration;
            let pan = PAN[kind];
            if (kind === 'pad') {
                // Slow swell; sustains through the bar so short leads sit on a bed.
                gain.gain.setValueAtTime(0, time);
                gain.gain.linearRampToValueAtTime(peak, time + Math.min(.35, duration * .3));
                gain.gain.setValueAtTime(peak, time + duration * .7);
                gain.gain.exponentialRampToValueAtTime(.0001, end);
                gain.gain.linearRampToValueAtTime(0, end + .006);
            } else envelope(gain, time, duration, peak, kind === 'crash' ? .002 : .004, kind === 'bass' ? .8 : .65);

            if (kind === 'hat' || kind === 'snare' || kind === 'crash') {
                const source = context.createBufferSource(); source.buffer = kind === 'crash' ? wash : noise; nodes.push(source); sources.push(source);
                const shape = context.createBiquadFilter(); nodes.push(shape);
                shape.type = 'highpass';
                shape.frequency.value = kind === 'hat' ? 5600 : kind === 'crash' ? 4800 : 1500;
                source.connect(shape); shape.connect(gain);
                if (kind === 'snare') {
                    // Tonal body under the noise gives the backbeat weight.
                    const body = oscillator('triangle', 210, time, nodes, sources);
                    body.frequency.exponentialRampToValueAtTime(150, time + .09);
                    layer(body, .22, gain, nodes);
                }
            } else if (kind === 'kick') {
                const body = oscillator('sine', 150, time, nodes, sources);
                body.frequency.exponentialRampToValueAtTime(44, time + .15);
                body.connect(gain);
                const click = oscillator('triangle', 1400, time, nodes, sources);
                click.frequency.exponentialRampToValueAtTime(220, time + .018);
                const clickGain = context.createGain(); nodes.push(clickGain);
                clickGain.gain.setValueAtTime(.45, time); clickGain.gain.exponentialRampToValueAtTime(.0001, time + .025);
                click.connect(clickGain); clickGain.connect(gain);
            } else {
                const hz = frequency(note);
                if (kind === 'lead' || kind === 'echo') {
                    const tone = lowpass(kind === 'lead' ? 2400 : 1800, kind === 'lead' ? 1.6 : .8, nodes);
                    tone.frequency.setValueAtTime(kind === 'lead' ? 2400 : 1800, time);
                    tone.frequency.linearRampToValueAtTime(kind === 'lead' ? 9000 : 5200, time + .015);
                    tone.frequency.exponentialRampToValueAtTime(kind === 'lead' ? 5600 : 3400, time + Math.max(.05, duration * .6));
                    const main = oscillator('square', hz, time, nodes, sources);
                    const thick = oscillator('sawtooth', hz, time, nodes, sources, 7);
                    main.connect(tone); layer(thick, .45, tone, nodes); tone.connect(gain);
                    if (kind === 'lead' && duration > .22 && main.detune && thick.detune) {
                        // Delayed vibrato only on held notes, so fast runs stay crisp.
                        const lfo = oscillator('sine', 5.6, time, nodes, sources), depth = context.createGain(); nodes.push(depth);
                        depth.gain.setValueAtTime(0, time); depth.gain.linearRampToValueAtTime(0, time + .12);
                        depth.gain.linearRampToValueAtTime(9, time + .3);
                        lfo.connect(depth); depth.connect(main.detune); depth.connect(thick.detune);
                    }
                } else if (kind === 'arp') {
                    const pluck = lowpass(8000, 2.4, nodes);
                    pluck.frequency.setValueAtTime(8000, time);
                    pluck.frequency.exponentialRampToValueAtTime(2200, time + Math.max(.04, duration * .8));
                    oscillator('square', hz, time, nodes, sources).connect(pluck); pluck.connect(gain);
                    pan = note % 2 ? .34 : -.34;
                } else if (kind === 'bass') {
                    oscillator('triangle', hz, time, nodes, sources).connect(gain);
                    const grit = lowpass(780, 1.2, nodes);
                    layer(oscillator('square', hz, time, nodes, sources), .22, grit, nodes); grit.connect(gain);
                } else if (kind === 'pad') {
                    const warm = lowpass(1800, .7, nodes);
                    warm.frequency.setValueAtTime(1400, time);
                    warm.frequency.linearRampToValueAtTime(3200, time + duration * .5);
                    warm.frequency.linearRampToValueAtTime(1600, end);
                    for (const cents of [-9, 9]) layer(oscillator('sawtooth', hz, time, nodes, sources, cents), .5, warm, nodes);
                    warm.connect(gain);
                    pan = note % 2 ? .28 : -.28;
                }
            }
            route(gain, kind, pan, nodes);
            const entry = { sources, gain, nodes, end: end + .008 }; voices.add(entry);
            let pending = sources.length;
            const release = () => {
                if (--pending > 0) return;
                voices.delete(entry); nodes.forEach(node => { try { node.disconnect(); } catch { /* Already disconnected. */ } });
            };
            try {
                for (const source of sources) { source.onended = release; source.start(time); source.stop(entry.end); }
            } catch (error) {
                voices.delete(entry); nodes.forEach(node => { try { node.disconnect(); } catch { /* Ignore. */ } }); throw error;
            }
        }
        function silence() {
            const now = context.currentTime;
            for (const { sources, gain } of voices) {
                try {
                    gain.gain.cancelScheduledValues(now); gain.gain.setValueAtTime(gain.gain.value, now);
                    gain.gain.linearRampToValueAtTime(0, now + .012);
                } catch { /* Already finished voices are harmless. */ }
                for (const source of sources) { try { source.stop(now + .014); } catch { /* Already stopped. */ } }
            }
            voices.clear();
            // Mute room and echo tails so a pause sounds like a pause.
            for (const { node } of wet) {
                try { node.gain.cancelScheduledValues(now); node.gain.setValueAtTime(node.gain.value, now); node.gain.linearRampToValueAtTime(0, now + .04); } catch { /* Optional. */ }
            }
            hushed = wet.length > 0;
        }
        function volume(value, ducked = false) {
            const now = context.currentTime;
            output.gain.cancelScheduledValues(now);
            output.gain.setTargetAtTime(clamp(value) * (ducked ? .55 : 1), now, .025);
        }
        // Derived arrangement layers. They only double the bar's own bass note (two octaves and
        // a fifth above) or add percussion, so authored harmony and melody stay unchanged.
        function arrange(events, index) {
            const extra = [];
            if (index % 16 === 0) {
                const bass = events.find(event => event.voice === 'bass');
                if (bass) for (const offset of [24, 31]) extra.push({ voice: 'pad', note: bass.note + offset, length: 15.2, level: 1 });
            }
            if (fills) {
                const inPhrase = index % 64;
                if (inPhrase === 0 && index > 0 && !events.some(event => event.voice === 'crash')) extra.push({ voice: 'crash', note: 0, length: 1, level: 1 });
                if (inPhrase >= 61 && !events.some(event => event.voice === 'snare')) extra.push({ voice: 'snare', note: 0, length: 1, level: [.38, .55, .75][inPhrase - 61] });
            }
            return extra;
        }
        function step(profile, index, when, score) {
            // Prune expired voices even if the browser has delayed onended callbacks.
            for (const entry of voices) if (entry.end < context.currentTime) voices.delete(entry);
            if (hushed) {
                for (const { node, level } of wet) { try { node.gain.cancelScheduledValues(when); node.gain.setValueAtTime(0, when); node.gain.linearRampToValueAtTime(level, when + .05); } catch { /* Optional. */ } }
                hushed = false;
            }
            const sixteenth = 60 / profile.bpm / 4;
            if (delayNode && profile.bpm !== delayBpm) {
                delayBpm = profile.bpm;
                try { delayNode.delayTime.setValueAtTime(Math.min(1.5, sixteenth * 3), when); } catch { /* Keep the previous echo time. */ }
            }
            const events = score.notesForStep(profile, index);
            for (const event of [...events, ...arrange(events, index)]) voice(event, when, sixteenth);
        }
        return { step, silence, volume };
    }

    function create({ toggleButton, volumeInput, volumeLabel, trackLabel, score, storagePrefix, audioOutput, initialLevel = 1, initialPhase = 0 }) {
        const MUTED = `${storagePrefix}-muted`, VOLUME = `${storagePrefix}-volume`;
        let muted = false, volume = .65, context, instrument, unavailable = false;
        let active = false, timer = null, cursor = 0, nextTime = 0, epoch = 0, duckUntil = 0;
        let current = score.profile(initialLevel, initialPhase), pending = null;
        function read(key) { try { return localStorage.getItem(key); } catch { return null; } }
        function save(key, value) { try { localStorage.setItem(key, value); } catch { /* Keep this page's preference. */ } }
        muted = read(MUTED) === '1';
        const savedVolume = read(VOLUME);
        if (savedVolume !== null && Number.isFinite(Number(savedVolume))) volume = clamp(Number(savedVolume));
        function ui() {
            toggleButton.textContent = muted ? '♫ 音樂：關' : '♫ 音樂：開';
            const label = muted ? '開啟背景音樂' : '關閉背景音樂';
            toggleButton.setAttribute('aria-label', label); toggleButton.setAttribute('title', label);
            toggleButton.setAttribute('aria-pressed', String(!muted));
            volumeInput.value = String(Math.round(volume * 100)); volumeLabel.textContent = `${Math.round(volume * 100)}%`;
            trackLabel.textContent = unavailable ? '此瀏覽器暫時無法播放音樂；遊戲仍可繼續' : `${current.label}${active ? '' : ' · 待命'}`;
        }
        function stopClock() {
            epoch++;
            if (timer !== null) clearInterval(timer); timer = null;
            if (context && active) {
                // Undo look-ahead only: continue at the next unplayed sixteenth after pause.
                cursor = Math.max(0, cursor - Math.ceil(Math.max(0, nextTime - context.currentTime) / (60 / current.bpm / 4)));
            }
            try { instrument?.silence(); } catch { /* Audio must not affect gameplay. */ }
        }
        function fail() { stopClock(); unavailable = true; ui(); }
        function pump() {
            if (!context || context.state !== 'running' || !active || muted || unavailable) return;
            try {
                const now = context.currentTime;
                // Never play a burst of missed notes after a stalled tab or device change.
                if (nextTime < now - .15) nextTime = now + .015;
                instrument.volume(volume, now < duckUntil);
                while (nextTime < now + .1) {
                    if (pending && cursor % 16 === 0) { current = pending; pending = null; ui(); }
                    instrument.step(current, cursor, nextTime, score);
                    cursor = (cursor + 1) % 256; nextTime += 60 / current.bpm / 4;
                }
            } catch { fail(); }
        }
        function ensure() {
            if (unavailable) return false;
            if (!context) {
                const Audio = globalThis.AudioContext || globalThis.webkitAudioContext;
                if (!Audio && !audioOutput) { fail(); return false; }
                try {
                    const shared = audioOutput?.();
                    if (audioOutput && !shared) { fail(); return false; }
                    context = shared ? shared.context : new Audio();
                    instrument = synth(context, shared?.destination); instrument.volume(volume);
                }
                catch { fail(); return false; }
            }
            return true;
        }
        function wake() {
            if (!active || muted || volume === 0 || !ensure()) return;
            const token = epoch;
            const beginClock = () => {
                if (token !== epoch || !active || muted || context.state !== 'running' || timer !== null) return;
                nextTime = context.currentTime + .025; pump();
                if (!unavailable) timer = setInterval(pump, 25);
            };
            try {
                if (context.state === 'running') beginClock();
                else Promise.resolve(context.resume()).then(beginClock).catch(() => { /* A later gesture can retry. */ });
            } catch { /* A browser may refuse a resume without a gesture. */ }
        }
        function start(level, phase = 'shield') {
            stopClock(); current = score.profile(level, phase); pending = null; cursor = 0;
            active = true; duckUntil = 0; ui(); wake();
        }
        function pause() { stopClock(); active = false; ui(); }
        function resume() { active = true; ui(); wake(); }
        function phase(value) {
            const next = score.profile(current.level, value);
            if (next.intensity > (pending || current).intensity) pending = next;
        }
        function duck() { if (context) duckUntil = context.currentTime + .3; }
        function toggle() {
            stopClock(); muted = !muted; save(MUTED, muted ? '1' : '0'); ui(); wake();
        }
        toggleButton.addEventListener('click', toggle);
        volumeInput.addEventListener('input', () => {
            const number = Number(volumeInput.value); if (!Number.isFinite(number)) return;
            volume = clamp(number / 100); save(VOLUME, String(volume));
            if (volume === 0) stopClock();
            try { instrument?.volume(volume); } catch { fail(); }
            ui(); wake();
        });
        ui();
        return Object.freeze({ start, pause, resume, phase, duck, wake });
    }
    globalThis.CashArcadeMusic = Object.freeze({ create, synth });
})();
