// Authored volumes, not random mazes. Coordinates are x / altitude y / depth z.
export const DIRECTIONS = Object.freeze({
    right: { x: 1, y: 0, z: 0 }, left: { x: -1, y: 0, z: 0 },
    forward: { x: 0, y: 0, z: -1 }, back: { x: 0, y: 0, z: 1 },
    rise: { x: 0, y: 1, z: 0 }, dive: { x: 0, y: -1, z: 0 },
});
export const POWERS = Object.freeze({
    shield: { name: '能量護盾', glyph: '◇', color: '#54ffd4', detail: '擋一次炸彈／雷射；不防撞牆或自撞' },
    slow: { name: '時間緩速', glyph: '◷', color: '#a595ff', detail: '移動減速 35%，持續 8 秒' },
    shrink: { name: '縮尾脈衝', glyph: '≋', color: '#ff83d5', detail: '縮短四節，至少保留四節' },
    magnet: { name: '能量磁吸', glyph: '⊕', color: '#ffd76a', detail: '同高度、直線兩格內吸取普通食物，10 秒' },
    emp: { name: '電磁脈衝', glyph: 'ϟ', color: '#63cfff', detail: '清除本關炸彈、壓制雷射 8 秒' },
});
export const key = p => `${p.x},${p.y},${p.z}`;
export const equal = (a, b) => !!a && !!b && a.x === b.x && a.y === b.y && a.z === b.z;
export const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
export const distance = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y) + Math.abs(a.z - b.z);

// Separate from LEVELS: campaign indexes, seeds and old checkpoints never shift.
export const TUTORIAL_LEVEL = Object.freeze({ index: -1, name: '光域訓練', width: 10, depth: 10, height: 3,
    quota: 1, delay: 400, bombs: 0, hint: '第 0 關免費教學，可跳過，也可反覆練習。',
    walls: [], portals: [], gates: [], powers: [], exit: { x: 8, y: 2, z: 8 }, seed: 0xCA5A0000, chapter: 0,
});

const specs = [
    ['立方覺醒', 10, 3, 6, 250, 0, '先找金色方塊，E 上升、Q 下降；六面外牆都不能穿越。'],
    ['琉光階梯', 10, 3, 8, 240, 0, '繞過半高牆；每 20 秒出現的蛋糕可一次取得兩份能量。'],
    ['暗核迴廊', 10, 3, 10, 230, 1, '炸彈每 30 秒換位。護盾能救一次，但不能防撞牆或自撞。'],
    ['斷層花園', 12, 4, 10, 220, 1, '升降穿梭錯層通道，紫色緩速道具讓轉向更從容。'],
    ['縮影迴圈', 12, 4, 12, 210, 1, '利用上下缺口穿越雙環；粉紅脈衝能縮短尾巴。'],
    ['引力中樞', 12, 4, 14, 200, 1, '磁吸只穿過同高度的直線空格，不會隔牆吸取。'],
    ['量子折返', 14, 5, 14, 190, 1, '同色光門相連，穿越後保持方向；先確認出口是否被蛇身占用。'],
    ['脈衝柵格', 14, 5, 16, 180, 1, '雷射三秒關閉、一秒預告、兩秒啟動；可升降繞行。'],
    ['電磁風暴', 14, 5, 18, 175, 2, 'EMP 能永久清除本關炸彈，並暫時壓制雷射八秒。'],
    ['星環要塞', 14, 5, 18, 170, 2, '兩組光門分別跨越高度，留意出口方向與蛇尾路線。'],
    ['光牢穿梭', 14, 5, 20, 165, 2, '交錯雷射與雙炸彈：先看高度，再選擇安全穿越時機。'],
    ['霓虹核心', 14, 5, 22, 160, 3, '綜合全部能力。能量集滿後，前往頂層綠色出口完成戰役。'],
];

function layout(index, size, height) {
    const cells = new Map();
    const put = (x, y, z) => cells.set(`${x},${y},${z}`, { x, y, z });
    const column = (x, z, lo, hi) => { for (let y = lo; y <= hi; y++) put(x, y, z); };
    const wall = (x, from, to, lo, hi) => { for (let z = from; z <= to; z++) column(x, z, lo, hi); };
    if (index === 1) { wall(4, 4, 7, 0, 0); wall(7, 3, 6, 1, 2); }
    if (index === 2) { for (const [x, z] of [[4, 4], [5, 4], [4, 5], [5, 5]]) column(x, z, 0, 2); }
    if (index === 3) { wall(4, 3, 8, 0, 1); wall(8, 3, 8, 2, 3); }
    if (index === 4 || index === 9) {
        for (const [cx, cz, y] of [[4, 5, 0], [size - 5, size - 5, height - 2]]) {
            for (let offset = -2; offset <= 2; offset++) {
                put(cx + offset, y, cz - 2); put(cx + offset, y, cz + 2);
                if (offset !== 0) { put(cx - 2, y, cz + offset); put(cx + 2, y, cz + offset); }
            }
        }
    }
    if (index === 5) { wall(4, 3, 8, 0, 1); wall(7, 3, 8, 2, 3); column(9, 6, 0, 2); }
    if (index >= 6) {
        wall(5, 4, size - 4, 0, 1); wall(size - 5, 4, size - 4, height - 2, height - 1);
        if (index >= 8) { column(3, size - 4, 1, 3); column(size - 4, 3, 1, 3); }
        if (index >= 10) wall(6, 5, size - 5, 2, 2);
        if (index === 11) for (let x = 3; x < size - 3; x++) if (x !== 6 && x !== 7) put(x, 3, 9);
    }
    return cells;
}

export const LEVELS = Object.freeze(specs.map(([name, width, height, quota, delay, bombs, hint], index) => {
    const depth = width, walls = layout(index, width, height);
    const portals = index < 6 ? [] : [
        { a: { x: 2, y: 0, z: depth - 3 }, b: { x: width - 3, y: height - 1, z: 2 }, color: '#9f91ff' },
        ...(index >= 9 ? [{ a: { x: width - 3, y: 1, z: depth - 3 }, b: { x: 2, y: height - 2, z: 2 }, color: '#ff72cb' }] : []),
    ];
    const gates = index < 7 ? [] : [
        { cells: Array.from({ length: width - 6 }, (_, j) => ({ x: j + 3, y: 1, z: Math.floor(depth / 2) + 1 })), offset: 0 },
        ...(index >= 10 ? [{ cells: Array.from({ length: depth - 6 }, (_, j) => ({ x: 7, y: 3, z: j + 3 })), offset: 1500 }] : []),
    ];
    const exit = { x: width - 2, y: height - 1, z: depth - 2 };
    for (const p of [...portals.flatMap(p => [p.a, p.b]), exit]) {
        walls.delete(key(p)); for (const d of Object.values(DIRECTIONS)) walls.delete(key(add(p, d)));
    }
    for (const gate of gates) for (const p of gate.cells) walls.delete(key(p));
    // Keep the complete deployment runway clear in every authored volume.
    for (let x = 0; x <= 6; x++) walls.delete(`${x},0,1`);
    const powers = index < 2 ? [] : Object.keys(POWERS).slice(0, index >= 8 ? 5 : Math.min(4, index - 1));
    return Object.freeze({ index, name, width, depth, height, quota, delay, bombs, hint, portals, gates,
        walls: [...walls.values()], exit, powers, newPower: ({ 2: 'shield', 3: 'slow', 4: 'shrink', 5: 'magnet', 8: 'emp' })[index],
        seed: (0xCA5A1200 + index * 7919) >>> 0, chapter: Math.floor(index / 3),
    });
}));
