// Deterministic input-only pilot for COGFRONT: it may only move, attack, use skills, dodge,
// deploy troops and buy upgrades between stages — exactly what a player can do.
// Run: node tests/cogfront-balance.mjs
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const D = require('../cogfront/data.js'), { Game } = require('../cogfront/engine.js');

export function pilot(game, i) {
    const h = game.hero, near = game.targetsNear(h.x, 1, 90, 10);
    const crowd = game.targetsNear(h.x, 1, 175, 20).length;
    const danger = game.telegraphs.some(t => t.time < .45 && h.x >= t.from - 30 && h.x <= t.to + 30);
    let move = 1;
    if (!h.alive) move = 0;
    else if (danger) { move = -1; if (i % 12 === 0) game.dodge(); }
    else if (near.length) move = 0;
    else if (h.hp < h.maxHp * .35 && game.allies.length < 3) move = -1;
    if (h.alive && !danger) {
        if (near.length && i % 14 === 0) game.attack();
        if (crowd >= 3) game.skill('burst');
        if (near.length >= 2 && h.chargeCd <= 0) game.skill('charge');
        if (h.meter >= 100) game.skill('overdrive');
    }
    if (i % 30 === 0) {
        const want = ['shield', 'musket', 'lancer', 'mechanic', 'sword'].find(k => game.unlockedTroop(k) && game.cooldowns[k] <= 0 && game.steam >= D.TROOPS[k].cost + (k === 'sword' ? 0 : 10));
        if (want) game.deploy(want);
    }
    return { move };
}

export function campaign(seed, { maxSeconds = 420 } = {}) {
    const levels = D.fresh(), run = [];
    let coins = 0;
    for (let stage = 1; stage <= D.STAGES.length; stage++) {
        let result;
        for (let attempt = 1; attempt <= 3; attempt++) {
            const game = new Game({ stage, seed: seed + stage * 101 + attempt, upgrades: levels, unlocked: stage });
            let i = 0, deaths = 0, peakEnemies = 0;
            while (game.state === 'running' && game.time < maxSeconds) { game.update(1 / 60, pilot(game, i++)); deaths += game.drain().filter(e => e.type === 'heroDown').length; peakEnemies = Math.max(peakEnemies, game.enemies.filter(e => !e.idle).length); }
            result = { stage, attempt, state: game.state === 'running' ? 'timeout' : game.state, seconds: +game.time.toFixed(1),
                firstContact: game.firstContact === null ? null : +game.firstContact.toFixed(1), train: Math.round(game.train.hp / game.train.maxHp * 100), stars: game.stars, kills: game.kills, deaths, peakEnemies };
            coins += game.reward;
            // Spend on the cheapest affordable upgrade, repeatedly (hero first, then logistics, then troops).
            for (;;) {
                const options = D.UPGRADES.filter(u => levels[u.id] < u.max).map(u => ({ u, price: D.cost(u, levels[u.id]) })).sort((a, b) => a.price - b.price);
                if (!options.length || options[0].price > coins) break;
                coins -= options[0].price; levels[options[0].u.id]++;
            }
            if (game.state === 'won') break;
        }
        run.push(result);
        if (result.state !== 'won') break;
    }
    return run;
}

if (import.meta.url === `file://${process.argv[1]}`) {
    for (const seed of [11, 2026, 77]) console.log(JSON.stringify({ seed, run: campaign(seed) }));
}
