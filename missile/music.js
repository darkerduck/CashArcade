(() => {
    'use strict';
    const MUTED = 'casharcade-missile-music-muted', VOLUME = 'casharcade-missile-music-volume';
    const clamp = n => Math.max(0, Math.min(1, n));

    // A dedicated, reusable music bus leaves the existing four-game SFX gain untouched.
    // This synth is also used by the OfflineAudioContext verification page.
    function synth(context, destination = context.destination) {
        const bus = context.createGain(), output = context.createGain(), filter = context.createBiquadFilter();
        filter.type = 'lowpass'; filter.frequency.value = 6200; filter.Q.value = .5;
        const compressor = context.createDynamicsCompressor();
        compressor.threshold.value = -10; compressor.knee.value = 6; compressor.ratio.value = 4;
        compressor.attack.value = .003; compressor.release.value = .14;
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
        const noise = context.createBuffer(1, Math.ceil(context.sampleRate * .22), context.sampleRate);
        let seed = 173;
        const samples = noise.getChannelData(0);
        for (let i = 0; i < samples.length; i++) { seed = (1664525 * seed + 1013904223) >>> 0; samples[i] = seed / 2147483648 - 1; }
        function voice(event, time, stepDuration) {
            if ([...voices].filter(entry => entry.end > time).length >= 48) return;
            const { voice: kind, note, length, level } = event;
            const drum = kind === 'hat' || kind === 'snare';
            const duration = drum ? (kind === 'hat' ? .045 : .15) : kind === 'kick' ? .19 : Math.max(.035, length * stepDuration);
            const levels = { lead: .18, echo: .12, bass: .37, arp: .065, kick: .44, snare: .25, hat: .13 };
            const gain = context.createGain(), source = drum ? context.createBufferSource() : context.createOscillator();
            const nodes = [source, gain];
            const end = time + duration;
            const peak = levels[kind] * level;
            gain.gain.setValueAtTime(0, time);
            gain.gain.linearRampToValueAtTime(peak, time + .004);
            gain.gain.exponentialRampToValueAtTime(Math.max(.0001, peak * .65), time + duration * .45);
            gain.gain.exponentialRampToValueAtTime(.0001, end);
            gain.gain.linearRampToValueAtTime(0, end + .006);
            if (drum) {
                source.buffer = noise;
                const highpass = context.createBiquadFilter(); nodes.push(highpass);
                highpass.type = 'highpass'; highpass.frequency.value = kind === 'hat' ? 5400 : 1500;
                source.connect(highpass); highpass.connect(gain);
            } else {
                source.type = kind === 'lead' || kind === 'arp' ? 'square' : kind === 'kick' ? 'sine' : 'triangle';
                const frequency = 440 * 2 ** ((note - 69) / 12);
                source.frequency.setValueAtTime(kind === 'kick' ? 145 : frequency, time);
                if (kind === 'kick') source.frequency.exponentialRampToValueAtTime(45, time + .14);
                source.connect(gain);
            }
            gain.connect(bus);
            const entry = { source, gain, nodes, end: end + .008 }; voices.add(entry);
            source.onended = () => { voices.delete(entry); nodes.forEach(node => { try { node.disconnect(); } catch { /* Already disconnected. */ } }); };
            try { source.start(time); source.stop(entry.end); }
            catch (error) { voices.delete(entry); nodes.forEach(node => node.disconnect()); throw error; }
        }
        function silence() {
            const now = context.currentTime;
            for (const { source, gain } of voices) {
                try {
                    gain.gain.cancelScheduledValues(now); gain.gain.setValueAtTime(gain.gain.value, now);
                    gain.gain.linearRampToValueAtTime(0, now + .012); source.stop(now + .014);
                } catch { /* Already finished sources are harmless. */ }
            }
            voices.clear();
        }
        function volume(value, ducked = false) {
            const now = context.currentTime;
            output.gain.cancelScheduledValues(now);
            output.gain.setTargetAtTime(clamp(value) * (ducked ? .55 : 1), now, .025);
        }
        function step(profile, index, when) {
            // Prune expired voices even if the browser has delayed onended callbacks.
            for (const entry of voices) if (entry.end < context.currentTime) voices.delete(entry);
            for (const event of NeonDefenseScore.notesForStep(profile, index)) voice(event, when, 60 / profile.bpm / 4);
        }
        return { step, silence, volume };
    }

    function create({ toggleButton, volumeInput, volumeLabel, trackLabel }) {
        let muted = false, volume = .65, context, instrument, unavailable = false;
        let active = false, timer = null, cursor = 0, nextTime = 0, epoch = 0, duckUntil = 0;
        let current = NeonDefenseScore.profile(1), pending = null;
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
                    instrument.step(current, cursor, nextTime);
                    cursor = (cursor + 1) % 256; nextTime += 60 / current.bpm / 4;
                }
            } catch { fail(); }
        }
        function ensure() {
            if (unavailable) return false;
            if (!context) {
                const Audio = globalThis.AudioContext || globalThis.webkitAudioContext;
                if (!Audio) { fail(); return false; }
                try { context = new Audio(); instrument = synth(context); instrument.volume(volume); }
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
            stopClock(); current = NeonDefenseScore.profile(level, phase); pending = null; cursor = 0;
            active = true; duckUntil = 0; ui(); wake();
        }
        function pause() { stopClock(); active = false; ui(); }
        function resume() { active = true; ui(); wake(); }
        function phase(value) {
            if (!current.boss) return;
            const next = NeonDefenseScore.profile(current.level, value);
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
    globalThis.NeonDefenseMusic = Object.freeze({ create, synth });
})();
