(() => {
    'use strict';
    const prefix = 'casharcade-aurora';
    const key = prefix + '-records-v1', total = AuroraRoutes.levels.length;
    const fresh = () => ({ version: 1, unlocked: 1, selected: 1, best: {} });
    const whole = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
    function validate(data) {
        if (!data || data.version !== 1 || !whole(data.unlocked, 1, total) ||
            !whole(data.selected, 1, data.unlocked) || !data.best || typeof data.best !== 'object') return null;
        const best = {};
        for (const [id, record] of Object.entries(data.best)) {
            if (!/^[1-9]$/.test(id) || Number(id) > data.unlocked || !record ||
                !whole(record.ms, 1, 200000) || !whole(record.score, 0, 1000000) ||
                !whole(record.passes, 0, 200)) return null;
            best[id] = { ms: record.ms, score: record.score, passes: record.passes };
        }
        return { version: 1, unlocked: data.unlocked, selected: data.selected, best };
    }
    function create(getStorage = () => localStorage) {
        let state = fresh(), unavailable = false;
        try {
            const raw = getStorage().getItem(key);
            if (raw) state = validate(JSON.parse(raw)) ?? fresh();
        } catch { unavailable = true; }
        function persist() {
            try {
                const storage = getStorage(), value = JSON.stringify(state);
                storage.setItem(key, value);
                if (storage.getItem(key) === value) return;
            } catch { /* Keep the local session playable. */ }
            unavailable = true;
        }
        return {
            get state() { return state; },
            get unavailable() { return unavailable; },
            select(id) {
                if (!whole(id, 1, state.unlocked)) return false;
                if (id !== state.selected) { state.selected = id; persist(); }
                return true;
            },
            finish(id, ms, score, passes) {
                if (!whole(id, 1, state.unlocked) || !whole(ms, 1, 200000) || !whole(score, 0, 1000000) ||
                    !whole(passes, 0, 200)) return false;
                const best = state.best[id];
                state.best[id] = { ms: Math.min(best?.ms ?? ms, ms), score: Math.max(best?.score ?? 0, score),
                    passes: Math.max(best?.passes ?? 0, passes) };
                state.unlocked = Math.max(state.unlocked, Math.min(total, id + 1));
                persist();
                return true;
            }
        };
    }
    globalThis.AuroraStorage = Object.freeze({ prefix, validate, create });
})();
