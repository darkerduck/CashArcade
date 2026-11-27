import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const D = require('../cogfront/data.js'), { Game, STEP } = require('../cogfront/engine.js');
const { campaign } = await import('./cogfront-balance.mjs');

const run = (game, seconds, input = {}) => { for (let t = 0; t < seconds; t += STEP) game.update(STEP, input); };
// Clear garrisons so a test controls exactly which enemies exist.
const empty = (opts = {}) => { const g = new Game({ stage: 1, seed: 9, ...opts }); g.enemies = []; g.stageData = { ...g.stageData, peaks: [], trickle: { every: 1e9, kinds: ['saw'] } }; g.trickleTimer = 1e9; return g; };
const finite = value => JSON.stringify(value, (k, v) => { if (typeof v === 'number') assert.ok(Number.isFinite(v), k); return v; });

test('data: eight stages, two bosses, five troop types with staged unlocks and bounded upgrades', () => {
    assert.equal(D.STAGES.length, 8);
    assert.deepEqual(D.STAGES.filter(s => s.boss).map(s => [s.id, s.boss]), [[4, 'colossus'], [8, 'airship']]);
    assert.deepEqual(D.TROOP_ORDER.map(k => D.TROOPS[k].unlock), [1, 2, 3, 5, 6]);
    for (const s of D.STAGES) { assert.ok(s.boss ? !s.gateHp : s.gateHp > 0); assert.ok(s.garrisons.length >= 2 && s.peaks.length >= 3); }
    const maxed = Object.fromEntries(D.UPGRADES.map(u => [u.id, 99])), st = D.stats(maxed);
    assert.equal(st.heroHp, 260 + 5 * 40); assert.equal(st.trainHp, 1500 + 4 * 300); assert.ok(st.burst.cooldown < D.HERO.skills.burst.cooldown);
    assert.equal(D.cost(D.UPGRADES[0], 2), D.UPGRADES[0].base * 3);
});

test('same seed and inputs replay identically; different seeds differ', () => {
    const play = seed => { const g = new Game({ stage: 3, seed }); for (let i = 0; i < 1800; i++) { if (i % 20 === 0) g.attack(); if (i % 200 === 0) g.deploy('sword'); g.update(STEP, { move: i % 400 < 300 ? 1 : 0 }); } g.drain(); return finite(g); };
    assert.equal(play(5), play(5));
    assert.notEqual(play(5), play(6));
});

test('three-hit combo chains, the finisher knocks back hard and fills the overdrive meter', () => {
    const g = empty(), h = g.hero; const e = g.spawnEnemy('brute', h.x + 60); e.idle = false; e.cool = 99;
    const events = [];
    for (let i = 0; i < 3; i++) { g.attack(); run(g, .05); g.attack(); run(g, .4); events.push(...g.drain()); }
    const swings = events.filter(x => x.type === 'swing').map(x => x.combo);
    assert.deepEqual(swings.slice(0, 3), [0, 1, 2]);
    assert.ok(e.hp < e.maxHp - 60, 'all three hits landed');
    assert.ok(h.meter >= D.HERO.skills.overdrive.perHit * 3);
    const knocked = new Game({ stage: 1, seed: 1 }); knocked.enemies = []; const s = knocked.spawnEnemy('saw', knocked.hero.x + 50); s.idle = false; s.cool = 99; s.hp = 999;
    knocked.hero.combo = 1; knocked.hero.comboTimer = .3; knocked.attack(); run(knocked, .45);
    assert.ok(s.x > knocked.hero.x + 70, 'finisher pushed the saw out of melee reach');
});

test('skills respect cooldowns; burst stuns light enemies; charge passes through; overdrive needs a full meter', () => {
    const g = empty(), h = g.hero;
    const a = g.spawnEnemy('saw', h.x + 80), b = g.spawnEnemy('saw', h.x + 140); a.idle = b.idle = false;
    g.skill('burst'); run(g, STEP * 2);
    assert.ok(a.stun > 0 && b.stun > 0); assert.ok(h.burstCd > 6);
    g.skill('burst'); run(g, STEP * 2); assert.ok(g.drain().some(e => e.type === 'denied' && e.reason === 'burst'));
    const startX = h.x; g.skill('charge'); run(g, .3);
    assert.ok(h.x > startX + 200, 'charge moved the hero forward'); assert.ok(h.chargeCd > 8);
    g.skill('overdrive'); run(g, STEP * 2); assert.equal(h.overdrive, 0);
    h.meter = 100; g.skill('overdrive'); run(g, STEP * 2); assert.ok(h.overdrive > 7);
});

test('deploying spends steam, enforces per-type cooldown and stage unlocks', () => {
    const g = empty(); g.steam = 100;
    g.deploy('sword'); run(g, STEP * 2);
    assert.equal(g.allies.length, 1); assert.ok(g.steam < 85);
    g.deploy('sword'); run(g, STEP * 2);
    assert.equal(g.allies.length, 1); assert.ok(g.drain().some(e => e.reason === 'cooldown'));
    g.deploy('musket'); run(g, STEP * 2); assert.ok(g.drain().some(e => e.reason === 'locked'));
    g.steam = 5; run(g, 2.5); g.steam = 5; g.deploy('sword'); run(g, STEP); assert.ok(g.drain().some(e => e.reason === 'steam'));
    const later = new Game({ stage: 1, seed: 2, unlocked: 6 }); later.steam = 100; later.deploy('mechanic'); run(later, STEP * 2); assert.equal(later.allies[0].kind, 'mechanic');
});

test('troops follow behind the hero, charge to the front, or hold the rally line', () => {
    const g = empty(); g.steam = 100; g.deploy('sword'); run(g, STEP * 2);
    const unit = g.allies[0];
    run(g, 4, { move: 1 }); run(g, 9);
    assert.ok(unit.x < g.hero.x && g.hero.x - unit.x <= unit.offset + 10, 'follow keeps the unit behind the hero');
    g.toggleOrder(); run(g, 4); assert.equal(g.order, 'charge'); assert.ok(unit.x > g.hero.x, 'charge pushes past the hero');
    g.toggleOrder(); run(g, STEP); const rally = g.rallyX; run(g, 5, { move: -1 }); assert.equal(g.order, 'hold');
    assert.ok(Math.abs(unit.x - (rally - unit.offset * .35)) < 8, 'hold stays at the rally line');
});

test('hero death respawns at the train after five seconds while the battle continues', () => {
    const g = empty(), h = g.hero;
    g.damage(h, 9999, 0, 'test'); assert.equal(h.alive, false); assert.equal(g.state, 'running');
    run(g, 4.9); assert.equal(h.alive, false); run(g, .2);
    assert.equal(h.alive, true); assert.equal(h.hp, h.maxHp); assert.ok(h.x < 260);
});

test('destroying the train loses; destroying the gate wins with stars and a coin reward', () => {
    const lost = empty(); lost.damage(lost.train, 1e6, 0, 'test'); assert.equal(lost.state, 'lost');
    const won = empty(); won.damage(won.gate, 1e6, 0, 'lancer');
    assert.equal(won.state, 'won'); assert.equal(won.stars, 3); assert.ok(won.reward >= 100 + 40);
    const armour = empty(); const before = armour.gate.hp; armour.damage(armour.gate, 100, 0, 'hero'); assert.equal(before - armour.gate.hp, 40);
});

test('boss stages spawn the boss near its position, telegraph attacks and win on its defeat', () => {
    for (const stage of [4, 8]) {
        const g = new Game({ stage, seed: 4 }); g.enemies = []; g.hero.x = g.stageData.bossAt - 500; g.hero.inv = 1e9;
        run(g, .5); assert.ok(g.boss, 'boss entered'); const events = [];
        for (let i = 0; i < 12 * 60; i++) { g.update(1 / 60); events.push(...g.drain()); }
        assert.ok(events.some(e => e.type === 'telegraph') || events.some(e => e.type === 'bossAttack'));
        g.damage(g.boss, 1e6, 0, 'lancer'); assert.equal(g.state, 'won');
    }
});

test('input-only pilot clears the whole campaign with first contact inside five seconds', () => {
    const results = campaign(11);
    assert.equal(results.length, 8); assert.ok(results.every(r => r.state === 'won'), JSON.stringify(results));
    for (const r of results) { assert.ok(r.firstContact !== null && r.firstContact <= 5, `stage ${r.stage} contact ${r.firstContact}`); assert.ok(r.seconds >= 45 && r.seconds <= 300, `stage ${r.stage} ${r.seconds}s`); }
});
