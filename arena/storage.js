(() => {
    'use strict';
    const KEY = 'casharcade-arena-checkpoint-v1', BEST = 'casharcade-arena-high-score';
    const copy = value => JSON.parse(JSON.stringify(value));
    function fresh(seed = Date.now() >>> 0) { return { version:1, kind:'wave', wave:1, hp:5, score:0, elapsed:0, seed:seed || 1, upgrades:NeonArenaData.levels() }; }
    function valid(c) {
        if (!c || c.version !== 1 || !['wave','upgrade'].includes(c.kind) || !Number.isInteger(c.wave) || c.wave < 1 || c.wave > 12) return false;
        if (!Number.isInteger(c.seed) || c.seed < 1 || c.seed > 4294967295 || !Number.isInteger(c.score) || c.score < 0 || c.score > 1e9) return false;
        if (!Number.isFinite(c.elapsed) || c.elapsed < 0 || c.elapsed > 1e7 || !c.upgrades) return false;
        if (!NeonArenaData.upgrades.every(u => Number.isInteger(c.upgrades[u.id]) && c.upgrades[u.id] >= 0 && c.upgrades[u.id] <= u.max)) return false;
        if (!Number.isInteger(c.hp) || c.hp < 1 || c.hp > NeonArenaData.stats(c.upgrades).maxHp) return false;
        if (Object.values(c.upgrades).reduce((sum,n) => sum + n, 0) !== c.wave - 1) return false;
        return c.kind === 'wave' || c.wave < 12 && Array.isArray(c.choices) && c.choices.length === 3 && new Set(c.choices).size === 3 && c.choices.every(id => NeonArenaData.upgrades.some(u => u.id === id && c.upgrades[id] < u.max));
    }
    function create(storage, onFailure = () => {}) {
        function read(key) { try { return storage.getItem(key); } catch { onFailure(); return null; } }
        function write(key, value) {
            try {
                if (value === null) storage.removeItem(key); else storage.setItem(key, value);
                if (storage.getItem(key) !== value) throw new Error('Storage verification failed');
                return true;
            } catch { onFailure(); return false; }
        }
        return { load() { try { const c = JSON.parse(read(KEY)); return valid(c) ? copy(c) : null; } catch { return null; } },
            save(c) { return valid(c) && write(KEY, JSON.stringify(c)); }, clear:() => write(KEY,null),
            best:() => Math.max(0, Math.min(1e9, Number(read(BEST)) || 0)), saveBest:n => write(BEST,String(n)) };
    }
    globalThis.NeonArenaStorage = Object.freeze({ fresh, valid, copy, create, KEY, BEST });
})();
