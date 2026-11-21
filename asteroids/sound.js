(() => {
    'use strict';
    const effects = Object.freeze({
        shatter: 'starRock', destroy: 'starBurst', partDown: 'starBurst',
        pickup: 'starPickup', shield: 'starShield', hurt: 'starHurt', swallowed: 'starHole',
        shipDown: 'starBurst', boss: 'starBoss', overload: 'starBoss', bossDown: 'starBossDown',
        clear: 'starClear', won: 'starClear', lesson: 'starPickup'
    });
    const weapons = Object.freeze({ pulse: 'starPulse', spread: 'starSpread', laser: 'starLaser' });
    function createThrust(output) {
        let voice = null;
        function update(active) {
            if (active === Boolean(voice)) return;
            if (!active) {
                const { context, source, gain } = voice;
                voice = null;
                try {
                    const now = context.currentTime;
                    gain.gain.cancelScheduledValues(now);
                    gain.gain.setTargetAtTime(0, now, .008);
                    source.stop(now + .035);
                } catch { /* Context closed by the browser. */ }
                return;
            }
            try {
                const bus = output();
                if (!bus) return;
                const { context, destination } = bus;
                const source = context.createOscillator(), filter = context.createBiquadFilter(), gain = context.createGain();
                const now = context.currentTime;
                source.type = 'sawtooth';
                source.frequency.setValueAtTime(69, now);
                filter.type = 'lowpass'; filter.frequency.value = 188;
                gain.gain.setValueAtTime(0, now);
                gain.gain.setTargetAtTime(.048, now, .018);
                source.connect(filter); filter.connect(gain); gain.connect(destination);
                source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); };
                source.start(now);
                voice = { source, gain, context };
            } catch { /* Sound is optional. */ }
        }
        return { update };
    }
    globalThis.StarshardSound = Object.freeze({ effects, weapons, createThrust });
})();
