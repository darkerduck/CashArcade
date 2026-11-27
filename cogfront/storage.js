// 蒸汽前線 COGFRONT — versioned local progress. Invalid or unavailable storage never blocks play.
(() => {
    'use strict';
    const KEY = 'casharcade-cogfront-v1';
    const D = globalThis.CogfrontData;
    function fresh() { return { version: 1, unlocked: 1, coins: 0, upgrades: D.fresh(), stars: Array(D.STAGES.length).fill(0), best: Array(D.STAGES.length).fill(0), clears: 0, reducedMotion: false }; }
    const int = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
    function valid(d) {
        if (!d || d.version !== 1 || !int(d.unlocked, 1, D.STAGES.length) || !int(d.coins, 0, 1e7) || !int(d.clears, 0, 1e7)) return false;
        if (!d.upgrades || !D.UPGRADES.every(u => int(d.upgrades[u.id], 0, u.max))) return false;
        if (!Array.isArray(d.stars) || d.stars.length !== D.STAGES.length || !d.stars.every(s => int(s, 0, 3))) return false;
        if (!Array.isArray(d.best) || d.best.length !== D.STAGES.length || !d.best.every(s => Number.isFinite(s) && s >= 0 && s < 1e5)) return false;
        return typeof d.reducedMotion === 'boolean';
    }
    function create(storage, onFailure = () => {}) {
        return {
            load() { try { const d = JSON.parse(storage.getItem(KEY)); return valid(d) ? d : fresh(); } catch { onFailure(); return fresh(); } },
            save(d) { if (!valid(d)) return false; try { storage.setItem(KEY, JSON.stringify(d)); return true; } catch { onFailure(); return false; } },
        };
    }
    // Apply a finished stage to the save: coins, stars, best time and next unlock.
    function record(d, game) {
        d.coins = Math.min(1e7, d.coins + Math.max(0, Math.round(game.reward)));
        if (game.state === 'won') {
            const i = game.level - 1; d.clears++;
            d.stars[i] = Math.max(d.stars[i], game.stars);
            d.best[i] = d.best[i] ? Math.min(d.best[i], +game.time.toFixed(1)) : +game.time.toFixed(1);
            d.unlocked = Math.min(D.STAGES.length, Math.max(d.unlocked, game.level + 1));
        }
        return d;
    }
    function buy(d, id) {
        const u = D.UPGRADES.find(x => x.id === id); if (!u || d.upgrades[id] >= u.max) return false;
        if (u.troop && D.TROOPS[u.troop].unlock > d.unlocked) return false;
        const price = D.cost(u, d.upgrades[id]); if (d.coins < price) return false;
        d.coins -= price; d.upgrades[id]++; return true;
    }
    globalThis.CogfrontStorage = Object.freeze({ KEY, fresh, valid, create, record, buy });
    if (typeof module !== 'undefined' && module.exports) module.exports = globalThis.CogfrontStorage;
})();
