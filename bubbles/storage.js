(() => {
    'use strict';
    const LIMIT = LightbubbleLevels.levels.length;
    const prefix = 'casharcade-bubbles';
    const key = prefix + '-records-v1';
    const fresh = () => ({ version: 1, open: 1, last: 1, records: {} });
    const whole = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
    function validate(data) {
        if (!data || data.version !== 1 || !whole(data.open, 1, LIMIT) ||
            !whole(data.last, 1, data.open) || !data.records || typeof data.records !== 'object') return null;
        const records = {};
        for (const [id, record] of Object.entries(data.records)) {
            if (!/^[1-9][0-9]*$/.test(id) || !whole(Number(id), 1, data.open) || !record ||
                !whole(record.score, 1, 1000000) || !whole(record.shots, 1, 10000)) return null;
            records[id] = { score: record.score, shots: record.shots };
        }
        return { version: 1, open: data.open, last: data.last, records };
    }
    function create(getStorage = () => localStorage) {
        let state = fresh(), unavailable = false;
        try {
            const raw = getStorage().getItem(key);
            if (raw) state = validate(JSON.parse(raw)) ?? fresh();
        } catch { unavailable = true; }
        function persist() {
            try {
                const storage = getStorage(), json = JSON.stringify(state);
                storage.setItem(key, json);
                if (storage.getItem(key) === json) return;
            } catch { /* Keep the current page playable. */ }
            unavailable = true;
        }
        return {
            get state() { return state; },
            get unavailable() { return unavailable; },
            visit(level) {
                if (!whole(level, 1, state.open)) return false;
                if (state.last !== level) { state.last = level; persist(); }
                return true;
            },
            finish(level, score, shots) {
                if (!whole(level, 1, state.open) || !whole(score, 1, 1000000) || !whole(shots, 1, 10000)) return false;
                const best = state.records[level];
                state.records[level] = { score: Math.max(best?.score ?? 0, score), shots: Math.min(best?.shots ?? shots, shots) };
                state.open = Math.min(LIMIT, Math.max(state.open, level + 1));
                persist();
                return true;
            }
        };
    }
    globalThis.LightbubbleStorage = Object.freeze({ prefix, fresh, validate, create });
})();
