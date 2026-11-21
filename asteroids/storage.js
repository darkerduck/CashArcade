(() => {
    'use strict';
    const prefix = 'casharcade-asteroids';
    const saveKey = prefix + '-checkpoint-v1';
    const bestKey = prefix + '-high-score';
    const tutorialKey = prefix + '-tutorial-v1';
    const integer = (value, low, high) => Number.isInteger(value) && value >= low && value <= high;
    function fresh(seed) {
        return { version: 1, level: 1, hull: 3, score: 0, seed: seed >>> 0, elapsed: 0,
            weapon: 'pulse', spread: 0, laser: 0, escorts: 0, shield: false };
    }
    function validate(value) {
        if (!value || value.version !== 1 || !integer(value.level, 1, 9) ||
            !integer(value.hull, 1, 3) || !integer(value.score, 0, Number.MAX_SAFE_INTEGER) ||
            !integer(value.seed, 0, 0xffffffff) || !Number.isFinite(value.elapsed) || value.elapsed < 0 ||
            !integer(value.spread, 0, 3) || !integer(value.laser, 0, 3) ||
            !integer(value.escorts, 0, 2) || typeof value.shield !== 'boolean') return null;
        if (!['pulse', 'spread', 'laser'].includes(value.weapon) ||
            (value.weapon !== 'pulse' && value[value.weapon] === 0)) return null;
        const { version, level, hull, score, seed, elapsed, weapon, spread, laser, escorts, shield } = value;
        return { version, level, hull, score, seed, elapsed, weapon, spread, laser, escorts, shield };
    }
    function create(getStorage = () => globalThis.localStorage) {
        let unavailable = false;
        function read(key) {
            try { return getStorage().getItem(key); }
            catch { unavailable = true; return null; }
        }
        function write(key, value) {
            try {
                const storage = getStorage();
                if (value === null) storage.removeItem(key);
                else storage.setItem(key, value);
                if (storage.getItem(key) === value) return true;
            } catch { /* Continue playing when storage is denied. */ }
            unavailable = true;
            return false;
        }
        return {
            load() {
                try { return validate(JSON.parse(read(saveKey))); }
                catch { return null; }
            },
            save(value) {
                const safe = validate(value);
                return safe ? write(saveKey, JSON.stringify(safe)) : false;
            },
            clear: () => write(saveKey, null),
            best() {
                const value = Number(read(bestKey));
                return integer(value, 0, Number.MAX_SAFE_INTEGER) ? value : 0;
            },
            saveBest: value => write(bestKey, String(value)),
            tutorialSeen: () => read(tutorialKey) === '1',
            finishTutorial: () => write(tutorialKey, '1'),
            get unavailable() { return unavailable; }
        };
    }
    globalThis.NeonAsteroidsStorage = Object.freeze({ prefix, fresh, validate, create });
})();
