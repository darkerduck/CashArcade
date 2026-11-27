(() => {
    'use strict';
    const size = 720;
    const sectors = ['碎星礦帶', '引力星雲', '艦隊殘骸'];
    const well = (x, y, lethal = false) => Object.freeze({
        x, y, lethal, range: lethal ? 176 : 152, core: lethal ? 23 : 0,
        strength: lethal ? 138 : 100
    });
    // Waves arrive from 0.3 s and are packed into ~55% of the authored duration, so the
    // field fills quickly and groups overlap instead of trickling in one at a time.
    const field = (name, goal, duration, groups, wells = []) => ({
        name, goal, wells, groups: groups.map((types, i) => ({ at: 0.3 + i * (duration * 0.55 - 0.3) / (groups.length - 1), types }))
    });
    const boss = (name, goal, id, wells = []) => ({ name, goal, boss: id, wells, groups: [] });
    const levels = [
        field('碎星邊境', '擊碎隕石。穿過邊界會從另一側出現。', 64,
            [['large', 'small'], ['medium', 'small'], ['large'], ['medium', 'small', 'small'], ['large', 'medium'], ['medium', 'small'], ['large', 'small'], ['medium', 'medium']]),
        field('獵航航道', '擊落砲艇，收集金色武器模組。', 66,
            [['fighter', 'medium'], ['gunship', 'small'], ['large', 'fighter'], ['fighter', 'medium', 'small'], ['gunship', 'small'], ['large', 'fighter'], ['medium', 'fighter']]),
        boss('採掘巨艦', '拆除兩側砲塔，露出中央核心。', 1),
        field('引力花園', '青紫引力圈會彎折飛船與彈道。', 66,
            [['large', 'medium'], ['gunship', 'fighter'], ['large'], ['medium', 'gunship'], ['fighter', 'fighter'], ['large', 'medium']], [well(355, 230)]),
        field('暗潮航線', '橘色黑洞核心會直接吞噬飛船。', 69,
            [['large', 'fighter'], ['medium', 'gunship'], ['large', 'medium'], ['gunship', 'fighter'], ['large', 'fighter'], ['medium', 'gunship']], [well(192, 218, true)]),
        boss('重力織網者', '先摧毀三個引力節點，避開牽引區與扇形砲火。', 2, [well(550, 455)]),
        field('艦隊前哨', '攔截運輸艦和編隊護衛。', 72,
            [['transport', 'fighter', 'fighter'], ['frigate'], ['gunship', 'fighter'], ['large', 'medium'], ['transport', 'fighter', 'fighter'], ['frigate', 'gunship']], [well(185, 260)]),
        field('崩解星海', '在碎岩、艦隊與黑洞之間保留一條航線。', 76,
            [['large', 'transport', 'fighter'], ['frigate', 'small'], ['large', 'gunship'], ['fighter', 'fighter', 'medium'], ['frigate', 'transport'], ['large', 'gunship', 'fighter']], [well(520, 198, true), well(178, 470)]),
        boss('噬星旗艦', '突破護衛與外側武裝。核心低血量時會過載。', 3, [well(560, 510, true)])
    ];
    levels.forEach((level, i) => {
        level.sector = Math.floor(i / 3);
        Object.freeze(level);
    });
    const units = Object.freeze({
        large:     { radius: 30, hp: 60, speed: 44, points: 80, split: 'medium' },
        medium:    { radius: 19, hp: 36, speed: 60, points: 55, split: 'small' },
        small:     { radius: 10, hp: 18, speed: 92, points: 35 },
        fighter:   { radius: 12, hp: 42, speed: 112, points: 140, interval: 3.8, shots: 1, distance: 115 },
        gunship:   { radius: 17, hp: 75, speed: 66, points: 240, interval: 3.3, shots: 3, distance: 240 },
        transport: { radius: 22, hp: 112, speed: 49, points: 320, interval: 4.4, shots: 2, distance: 300 },
        frigate:   { radius: 23, hp: 144, speed: 58, points: 420, interval: 3.0, shots: 5, distance: 215 }
    });
    const rocks = ['large', 'medium', 'small'];
    const limits = Object.freeze({ enemies: 72, hostile: 160, friendly: 120, loot: 14, fields: 4, events: 256 });
    globalThis.NeonAsteroidsData = Object.freeze({ size, sectors, levels, units, rocks, limits });
})();
