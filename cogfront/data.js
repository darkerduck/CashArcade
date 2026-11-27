// 蒸汽前線 COGFRONT — pure data: hero, troops, enemies, bosses, eight stages and upgrades.
// All numbers are per second / pixels in the 960 × 540 logical view; no DOM, Node-loadable.
(() => {
    'use strict';
    const VIEW = Object.freeze({ width: 960, height: 540, ground: 438 });

    const HERO = Object.freeze({
        hp: 260, speed: 195, reach: 74, radius: 22,
        combo: Object.freeze([
            { damage: 22, time: .27, active: [.08, .16], knock: 10 },
            { damage: 24, time: .27, active: [.08, .16], knock: 14 },
            { damage: 40, time: .4, active: [.12, .22], knock: 190 },
        ]),
        chain: .32, respawn: 5,
        dodge: { time: .34, distance: 135, invulnerable: .3, cooldown: .85 },
        skills: Object.freeze({
            burst: { cooldown: 7, damage: 46, reach: 175, knock: 340, stun: .55 },
            charge: { cooldown: 9, damage: 38, distance: 270, time: .26 },
            overdrive: { duration: 8, damage: 1.5, speed: 1.35, troops: 1.3, meter: 100, perHit: 6, perHurt: 2 },
        }),
    });

    // cost = steam, cooldown = seconds between deployments of the same type.
    const TROOPS = Object.freeze({
        sword:    { name: '發條劍兵', short: '劍兵', cost: 20, cooldown: 2.4, hp: 95,  damage: 12, reach: 34,  rate: .8,  speed: 98, radius: 13, unlock: 1 },
        lancer:   { name: '鉚釘槍兵', short: '槍兵', cost: 35, cooldown: 4,   hp: 115, damage: 17, reach: 64,  rate: 1.05, speed: 88, radius: 14, unlock: 2, vsHeavy: 1.8 },
        musket:   { name: '蒸汽火槍手', short: '火槍', cost: 45, cooldown: 5,   hp: 72,  damage: 21, reach: 270, rate: 1.6, speed: 82, radius: 13, unlock: 3, ranged: true },
        shield:   { name: '鍋爐盾衛', short: '盾衛', cost: 60, cooldown: 8,   hp: 340, damage: 8,  reach: 32,  rate: 1.2, speed: 70, radius: 17, unlock: 5, taunt: true },
        mechanic: { name: '扳手技師', short: '技師', cost: 50, cooldown: 10,  hp: 82,  damage: 5,  reach: 30,  rate: 1.4, speed: 86, radius: 13, unlock: 6, heal: 15, healRange: 115 },
    });
    const TROOP_ORDER = Object.freeze(['sword', 'lancer', 'musket', 'shield', 'mechanic']);

    const ENEMIES = Object.freeze({
        drone:  { name: '廢鐵無人機', hp: 42,  damage: 7,  reach: 30,  rate: .7,  speed: 128, radius: 12, bounty: 3, flying: true },
        saw:    { name: '鋸輪跑者',   hp: 72,  damage: 12, reach: 34,  rate: .8,  speed: 102, radius: 14, bounty: 4 },
        brute:  { name: '鉚錘巨漢',   hp: 230, damage: 28, reach: 46,  rate: 1.6, speed: 60,  radius: 22, bounty: 10, heavy: true, knock: 120 },
        walker: { name: '步行砲台',   hp: 125, damage: 16, reach: 285, rate: 2.2, speed: 52,  radius: 18, bounty: 8, ranged: true },
        beetle: { name: '地雷甲蟲',   hp: 52,  damage: 46, reach: 26,  rate: 0,   speed: 118, radius: 12, bounty: 5, blast: 72 },
    });

    const BOSSES = Object.freeze({
        colossus: { name: '鍋爐巨像', hp: 6400, speed: 34, radius: 92, reach: 120, heavy: true, bounty: 120,
            attacks: ['slam', 'vent', 'summon'], overload: .4 },
        airship: { name: '飛艇要塞「灰燼號」', hp: 15000, speed: 26, radius: 100, reach: 140, heavy: true, bounty: 220,
            attacks: ['bombs', 'cannon', 'drop'], overload: .45 },
    });

    // garrisons: groups standing on the line that wake when the front line comes within 430 px.
    // peaks: timed waves sent from the gate (or the right edge on boss stages).
    // trickle: a steady stream from the gate so the front never goes quiet.
    const stage = (id, name, zone, length, gateHp, garrisons, peaks, trickle, extra = {}) => Object.freeze({
        id, name, zone, length, gateHp, garrisons: Object.freeze(garrisons), peaks: Object.freeze(peaks), trickle: Object.freeze(trickle),
        zoneIndex: id <= 3 ? 0 : id <= 6 ? 1 : 2, timeGoal: Math.round(length / 22 + 75), ...extra,
    });
    const STAGES = Object.freeze([
        stage(1, '鐵道郊線', '城郊鐵道', 2500, 3200,
            [[640, { drone: 2, saw: 1 }], [1150, { saw: 2, drone: 2 }], [1700, { saw: 3 }], [2150, { saw: 2, drone: 3 }]],
            [[22, { saw: 3, drone: 2 }], [48, { saw: 4, drone: 3 }], [78, { saw: 5, drone: 4 }]],
            { every: 6.5, kinds: ['drone', 'saw'] }),
        stage(2, '煤倉轉轍場', '城郊鐵道', 2900, 4000,
            [[620, { saw: 2, drone: 2 }], [1150, { brute: 1, saw: 2 }], [1750, { saw: 3, drone: 2 }], [2400, { brute: 1, saw: 3 }]],
            [[20, { saw: 4, drone: 2 }], [45, { brute: 1, saw: 3 }], [72, { saw: 5, drone: 4 }], [100, { brute: 2, saw: 3 }]],
            { every: 6, kinds: ['drone', 'saw', 'saw'] }),
        stage(3, '高架水塔', '城郊鐵道', 3200, 4000,
            [[640, { saw: 3 }], [1200, { walker: 1, saw: 2 }], [1850, { brute: 1, drone: 3 }], [2600, { walker: 1, brute: 1, saw: 2 }]],
            [[20, { saw: 4, walker: 1 }], [46, { brute: 1, drone: 4 }], [74, { saw: 5, walker: 1 }], [104, { brute: 2, saw: 4 }]],
            { every: 5.6, kinds: ['drone', 'saw', 'walker'] }),
        stage(4, '鍋爐巨像', '齒輪工業區', 2600, 0,
            [[640, { saw: 3, drone: 2 }], [1150, { brute: 1, walker: 1, saw: 2 }]],
            [[24, { saw: 4, drone: 3 }], [52, { brute: 1, saw: 3 }], [82, { walker: 1, saw: 4 }]],
            { every: 7, kinds: ['drone', 'saw'] }, { boss: 'colossus', bossAt: 2050 }),
        stage(5, '齒輪礦坑', '齒輪工業區', 3400, 6000,
            [[640, { saw: 3, beetle: 1 }], [1250, { brute: 1, beetle: 2, saw: 2 }], [1900, { walker: 2, saw: 2 }], [2700, { brute: 2, beetle: 2 }]],
            [[20, { saw: 4, beetle: 2 }], [44, { brute: 2, drone: 3 }], [70, { walker: 1, beetle: 3, saw: 3 }], [98, { brute: 2, saw: 5 }]],
            { every: 5.2, kinds: ['drone', 'saw', 'beetle'] }),
        stage(6, '鑄模長廊', '齒輪工業區', 3700, 5400,
            [[620, { saw: 3, drone: 3 }], [1300, { brute: 2, walker: 1 }], [2000, { beetle: 3, saw: 3 }], [2900, { brute: 2, walker: 2 }]],
            [[18, { saw: 5, beetle: 2 }], [42, { brute: 2, walker: 1, drone: 3 }], [68, { saw: 6, beetle: 3 }], [96, { brute: 3, walker: 2 }]],
            { every: 5, kinds: ['drone', 'saw', 'beetle', 'walker'] }),
        stage(7, '熔爐外牆', '熔爐要塞', 4000, 6600,
            [[620, { saw: 4, drone: 3 }], [1300, { brute: 2, beetle: 2 }], [2050, { walker: 2, saw: 4 }], [2900, { brute: 3, beetle: 2 }], [3450, { walker: 2, brute: 2 }]],
            [[18, { saw: 5, drone: 4 }], [40, { brute: 2, beetle: 3 }], [64, { walker: 2, saw: 5 }], [90, { brute: 3, drone: 5 }], [118, { brute: 2, walker: 2, beetle: 3 }]],
            { every: 4.6, kinds: ['drone', 'saw', 'beetle', 'walker', 'saw'] }),
        stage(8, '灰燼號', '熔爐要塞', 3000, 0,
            [[640, { saw: 4, beetle: 2 }], [1250, { brute: 2, walker: 1 }], [1850, { saw: 4, drone: 4 }]],
            [[20, { saw: 5, drone: 3 }], [46, { brute: 2, beetle: 3 }], [74, { walker: 2, saw: 4 }]],
            { every: 6, kinds: ['drone', 'saw', 'beetle'] }, { boss: 'airship', bossAt: 2450 }),
    ]);

    const UPGRADES = Object.freeze([
        { id: 'heroHp', name: '強化鍋爐裝甲', group: '主角', max: 5, base: 70, effect: n => `主角血量 ${260 + n * 40} → ${300 + n * 40}` },
        { id: 'heroAtk', name: '高壓刃片', group: '主角', max: 5, base: 80, effect: n => `連斬傷害 +${n * 15}% → +${(n + 1) * 15}%` },
        { id: 'burst', name: '蒸汽衝擊波', group: '招式', max: 3, base: 90, effect: n => `威力 +${n * 25}% → +${(n + 1) * 25}%，冷卻 −${(n + 1) * 10}%` },
        { id: 'charge', name: '活塞突進', group: '招式', max: 3, base: 90, effect: n => `威力 +${n * 25}% → +${(n + 1) * 25}%，冷卻 −${(n + 1) * 10}%` },
        { id: 'overdrive', name: '超載核心', group: '招式', max: 3, base: 110, effect: n => `超載 ${8 + n * 1.5} → ${9.5 + n * 1.5} 秒` },
        { id: 'steam', name: '雙缸鍋爐', group: '後勤', max: 4, base: 80, effect: n => `蒸汽壓回充 ${(6 + n * 1.5).toFixed(1)} → ${(7.5 + n * 1.5).toFixed(1)} / 秒` },
        { id: 'train', name: '列車鋼板', group: '後勤', max: 4, base: 70, effect: n => `列車耐久 ${1500 + n * 300} → ${1800 + n * 300}` },
        ...TROOP_ORDER.map(kind => ({ id: 'troop:' + kind, name: TROOPS[kind].name + '升級', group: '兵種', max: 3, base: 60, troop: kind,
            effect: n => `血量與傷害 +${n * 20}% → +${(n + 1) * 20}%` })),
    ].map(Object.freeze));

    const cost = (upgrade, level) => upgrade.base * (level + 1);
    const fresh = () => Object.fromEntries(UPGRADES.map(u => [u.id, 0]));

    // Derived numbers for the current upgrade levels.
    function stats(levels = fresh()) {
        const l = id => Math.max(0, Math.min(UPGRADES.find(u => u.id === id)?.max ?? 0, Number(levels[id]) || 0));
        return Object.freeze({
            heroHp: HERO.hp + l('heroHp') * 40,
            heroDamage: 1 + l('heroAtk') * .15,
            burst: { power: 1 + l('burst') * .25, cooldown: HERO.skills.burst.cooldown * (1 - l('burst') * .1) },
            charge: { power: 1 + l('charge') * .25, cooldown: HERO.skills.charge.cooldown * (1 - l('charge') * .1) },
            overdrive: HERO.skills.overdrive.duration + l('overdrive') * 1.5,
            steamRate: 6 + l('steam') * 1.5, steamMax: 100,
            trainHp: 1500 + l('train') * 300,
            troop: Object.fromEntries(TROOP_ORDER.map(kind => [kind, 1 + l('troop:' + kind) * .2])),
        });
    }

    globalThis.CogfrontData = Object.freeze({ VIEW, HERO, TROOPS, TROOP_ORDER, ENEMIES, BOSSES, STAGES, UPGRADES, cost, fresh, stats });
    if (typeof module !== 'undefined' && module.exports) module.exports = globalThis.CogfrontData;
})();
