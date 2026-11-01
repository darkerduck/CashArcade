(() => {
    'use strict';
    const upgrades = [
        ['damage', '電弧', '高壓線圈', 3, n => `電弧傷害 ${24 + n * 9} → ${33 + n * 9}`],
        ['jumps', '電弧', '分支電網', 3, n => `額外跳躍 ${2 + n} → ${3 + n} 個不同目標`],
        ['reach', '電弧', '遠距導體', 3, n => `跳躍距離 ${150 + n * 35} → ${185 + n * 35}`],
        ['cooldown', '衝刺', '脈衝電容', 3, n => `每次回充 ${(2.4 - n * .35).toFixed(2)} → ${(2.05 - n * .35).toFixed(2)} 秒`],
        ['trail', '衝刺', '離子殘影', 3, n => `殘影每秒 ${n * 24} → ${(n + 1) * 24} 傷害，持續 1.2 秒`],
        ['charge', '衝刺', '雙核儲能', 1, () => '衝刺儲存上限 1 → 2 次，逐次回充'],
        ['deathBlast', '爆破', '連鎖反應', 3, n => n ? `擊殺爆破基礎傷害 ${18 + n * 12} → ${30 + n * 12}` : '擊殺引爆：30 傷害、90 半徑'],
        ['radius', '爆破', '擴散震波', 3, n => `所有爆炸半徑 +${n * 25} → +${(n + 1) * 25}`],
        ['blastDamage', '爆破', '熱能增幅', 3, n => `所有爆炸傷害 +${n * 30}% → +${(n + 1) * 30}%`],
        ['armor', '生存', '複層裝甲', 3, n => `裝甲上限 ${5 + n} → ${6 + n}，立即修復 1 格`],
        ['speed', '生存', '向量步行', 3, n => `移速 ${215 + n * 22} → ${237 + n * 22} / 秒`],
        ['shield', '生存', '相位護盾', 3, n => `每波一次護盾擋下首擊，破盾無敵 ${1 + n * .5} → ${1.5 + n * .5} 秒`],
    ].map(([id, route, name, max, effect]) => Object.freeze({ id, route, name, max, effect }));
    const waves = [
        [14,35,['swarm']], [20,35,['swarm','charger']], [26,35,['swarm','charger','shooter']],
        [0,0,[], '鋸輪監工'],
        [32,40,['swarm','charger','shooter','guard']], [38,40,['swarm','shooter','splitter']], [44,40,['swarm','charger','shooter','guard','splitter']],
        [0,0,[], '磁暴核心'],
        [50,45,['swarm','charger','shooter','guard','splitter']], [58,45,['swarm','charger','shooter','guard','splitter']], [66,45,['swarm','charger','shooter','guard','splitter']],
        [0,0,[], '封鎖主機'],
    ].map(([count, duration, enemies, boss], i) => Object.freeze({ wave: i + 1, count, duration, enemies, boss, sector: Math.floor(i / 4) }));
    const enemies = Object.freeze({
        swarm: { hp:24, speed:78, r:12, score:80 }, charger: { hp:52, speed:57, r:17, score:140 },
        shooter: { hp:42, speed:49, r:15, score:130 }, guard: { hp:150, speed:40, r:24, score:250 },
        splitter: { hp:68, speed:61, r:19, score:180 }, shard: { hp:18, speed:103, r:9, score:30 },
    });
    const levels = () => Object.fromEntries(upgrades.map(u => [u.id, 0]));
    function stats(u) {
        return { damage:24 + u.damage * 9, jumps:2 + u.jumps, reach:150 + u.reach * 35,
            cooldown:2.4 - u.cooldown * .35, charges:1 + u.charge, speed:215 + u.speed * 22,
            maxHp:5 + u.armor, radius:90 + u.radius * 25, blastMultiplier:1 + u.blastDamage * .3,
            deathDamage:u.deathBlast ? 18 + u.deathBlast * 12 : 0, trail:u.trail * 24 };
    }
    globalThis.NeonArenaData = Object.freeze({ upgrades, waves, enemies, levels, stats, sectors:['能源工廠','磁暴反應爐','封鎖核心'] });
})();
