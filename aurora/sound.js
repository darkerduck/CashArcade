(() => {
    'use strict';
    const effects = Object.freeze({
        start: 'auroraStart', boost: 'auroraBoost', pass: 'auroraPass', cell: 'auroraCell',
        hit: 'auroraCrash', brake: 'auroraBrake', tunnel: 'auroraTunnel', won: 'auroraWin', lost: 'auroraLost'
    });
    function createRoadSound(output) {
        let voice = null;
        function start() {
            const bus = output();
            if (!bus) return null;
            const { context, destination } = bus, now = context.currentTime;
            const motor = context.createOscillator(), motorTone = context.createBiquadFilter(), motorGain = context.createGain();
            const rain = context.createBufferSource(), rainTone = context.createBiquadFilter(), rainGain = context.createGain();
            const mix = context.createGain(), noise = context.createBuffer(1, context.sampleRate, context.sampleRate);
            const data = noise.getChannelData(0);
            const random = AuroraRoutes.rng(733);
            for (let i = 0; i < data.length; i++) data[i] = random() * 2 - 1;
            motor.type = 'sawtooth'; motor.frequency.value = 49;
            motorTone.type = 'lowpass'; motorTone.frequency.value = 270;
            rain.buffer = noise; rain.loop = true;
            rainTone.type = 'bandpass'; rainTone.frequency.value = 1100; rainTone.Q.value = .4;
            mix.gain.setValueAtTime(0, now); mix.gain.setTargetAtTime(1, now, .025);
            motorGain.gain.value = .035; rainGain.gain.value = .03;
            motor.connect(motorTone); motorTone.connect(motorGain); motorGain.connect(mix);
            rain.connect(rainTone); rainTone.connect(rainGain); rainGain.connect(mix);
            mix.connect(destination);
            rain.onended = () => [motor, motorTone, motorGain, rain, rainTone, rainGain, mix].forEach(node => node.disconnect());
            motor.start(now); rain.start(now);
            return { context, motor, motorTone, motorGain, rain, rainGain, mix };
        }
        function stop() {
            if (!voice) return;
            const current = voice;
            voice = null;
            try {
                const now = current.context.currentTime;
                current.mix.gain.cancelScheduledValues(now);
                current.mix.gain.setTargetAtTime(0, now, .009);
                current.motor.stop(now + .045); current.rain.stop(now + .045);
            } catch { /* Context may be closed. */ }
        }
        function sync(game) {
            if (!game) { stop(); return; }
            try {
                voice ??= start();
                if (!voice) return;
                const now = voice.context.currentTime, speed = game.speed;
                voice.motor.frequency.setTargetAtTime(46 + speed * 1.27 + (game.boosting ? 16 : 0), now, .055);
                voice.motorTone.frequency.setTargetAtTime((game.inTunnel ? 235 : 205) + speed * 5.8, now, .06);
                voice.motorGain.gain.setTargetAtTime(.026 + speed * .00031, now, .05);
                voice.rainGain.gain.setTargetAtTime(game.inTunnel ? .007 : .018 + speed * .00052, now, .09);
            } catch { stop(); }
        }
        return { sync, stop };
    }
    globalThis.AuroraSound = Object.freeze({ createRoadSound, effects });
})();
