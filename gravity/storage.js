(function (root) {
    'use strict';
    const KEY = 'casharcade-gravity-v1', COUNT = 10;
    const fresh = () => ({ version: 1, selected: 0, unlocked: 1, reducedMotion: false, records: Array.from({ length: COUNT }, () => ({ stars: 0, best: null, shards: 0, deliveries: 0 })) });
    function clean(raw) {
        const data = fresh(); if (!raw || raw.version !== 1) return data;
        if (typeof raw.reducedMotion === 'boolean') data.reducedMotion = raw.reducedMotion;
        if (Array.isArray(raw.records)) data.records = data.records.map((base, i) => {
            const record = raw.records[i] || {};
            return { stars: Number.isInteger(record.stars) && record.stars >= 0 && record.stars <= 3 ? record.stars : 0,
                best: Number.isFinite(record.best) && record.best > 0 && record.best <= 300 ? record.best : null,
                shards: Number.isInteger(record.shards) && record.shards >= 0 && record.shards <= 3 ? record.shards : 0,
                deliveries: Number.isSafeInteger(record.deliveries) && record.deliveries >= 0 && record.deliveries <= 1e9 ? record.deliveries : 0 };
        });
        // Derive unlocked levels from verified-shaped delivery records, not an arbitrary count.
        let unlocked = 1; for (let i = 0; i < COUNT - 1; i++) { if (!data.records[i].stars) break; unlocked = i + 2; }
        data.unlocked = unlocked;
        if (Number.isInteger(raw.selected) && raw.selected >= 0 && raw.selected < unlocked) data.selected = raw.selected;
        return data;
    }
    function complete(data, index, game) {
        if (!Number.isInteger(index) || index < 0 || index >= COUNT || game.state !== 'delivered') return false;
        const record = data.records[index]; record.stars = Math.max(record.stars, game.stars);
        record.best = record.best === null ? game.time : Math.min(record.best, game.time);
        record.shards = Math.max(record.shards, game.collected.length); record.deliveries++;
        data.unlocked = Math.min(COUNT, Math.max(data.unlocked, index + 2)); return true;
    }
    function create(storage) {
        let available = true;
        if (!arguments.length) { try { storage = root.localStorage; } catch { available = false; } }
        return { load() { try { return clean(JSON.parse(storage.getItem(KEY))); } catch { available = false; return fresh(); } },
            save(data) { try { const value = JSON.stringify(clean(data)); storage.setItem(KEY, value); available = storage.getItem(KEY) === value; return available; } catch { available = false; return false; } },
            get available() { return available; } };
    }
    const api = { KEY, fresh, clean, complete, create }; root.GravityCourierStorage = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
