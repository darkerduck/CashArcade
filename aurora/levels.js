(() => {
    'use strict';
    const ROAD_HALF = 6.3, LANES = Object.freeze([-4.2, 0, 4.2]), STEP = 10;
    const sectors = Object.freeze([
        { name: '雨夜市區', accent: '#5be8ff', light: '#eb84f4', rain: 1 },
        { name: '貨運港灣', accent: '#66f7c9', light: '#ffc87b', rain: .82 },
        { name: '極光山隧', accent: '#b6a0ff', light: '#76efff', rain: .62 }
    ]);
    const routes = [
        ['霓雨大道', 2840, 72, [.12, -.36, .38, -.28, .22, 0], [[.40, .49]], '熟悉自由轉向與氮氣。讓出慢車的車道，再加速超越。'],
        ['鏡光環城', 3060, 76, [.35, .46, -.39, -.25, .35, 0], [[.30, .39], [.70, .80]], '視野受彎道遮擋時，先收住速度，再看清路障。'],
        ['紫電高架', 3290, 80, [-.42, .62, -.53, .45, -.31, 0], [[.37, .49], [.78, .90]], '留意前車方向燈。施工三角牌後方有封閉車道。'],
        ['碼頭入夜', 3380, 82, [.32, -.55, .44, -.28, .46, 0], [[.45, .55]], '重型貨車較慢，別貼著車尾開氮氣。'],
        ['雨幕貨櫃道', 3600, 86, [-.55, .42, -.6, .49, -.48, 0], [[.27, .39], [.62, .72]], '貨運區有交錯路障。用煞車留出換線空間。'],
        ['深港急送', 3780, 90, [.62, -.61, .54, -.46, .6, 0], [[.34, .46], [.72, .82]], '前車變換車道前會先閃方向燈。'],
        ['雪線迴廊', 3890, 94, [-.6, .69, -.54, .56, .42, 0], [[.17, .33], [.56, .72]], '隧道入口和出口都可能有慢車。善用直線補回時間。'],
        ['銀紫折峰', 4080, 98, [.72, -.75, .55, -.68, .65, 0], [[.13, .27], [.39, .53], [.68, .79]], '連續彎與窄視野會接連出現，留意路邊的反光標。'],
        ['極光終點線', 4320, 102, [-.75, .73, -.63, .78, -.73, 0], [[.18, .33], [.44, .59], [.72, .91]], '把氮氣留給看得清楚的空檔，穿過最後一條隧道。']
    ];
    function rng(seed) {
        return () => {
            seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
            return seed / 4294967296;
        };
    }
    function makeRoad(length, turns) {
        const samples = [];
        let x = 0, heading = 0;
        for (let z = 0; z <= length + 670; z += STEP) {
            const at = Math.min(turns.length - 1, z / length * turns.length);
            const section = Math.floor(at);
            const curve = turns[section] * Math.sin((at - section) * Math.PI);
            samples.push({ x, heading, curve });
            x += heading * STEP;
            heading += curve * STEP * .00128;
        }
        return samples;
    }
    function traffic(level, length) {
        const random = rng(7103 + level * 17651), entries = [];
        let id = 0;
        const span = Math.max(120, 202 - level * 8);
        for (let at = 0; at < length - 240; at += span) {
            const lane = Math.floor(random() * LANES.length);
            const truck = level >= 4 && random() < .42;
            const change = level >= 3 && random() < .42;
            entries.push({ id: ++id, at, z: at + 145 + random() * 28, lane,
                type: truck ? 'truck' : 'car', speed: truck ? 19 + random() * 5 : 22 + random() * 11,
                change: change ? { delay: 1.4 + random() * 2.8, lane: (lane + (lane === 2 ? 2 : 1)) % 3 } : null,
                color: Math.floor(random() * 5) });
            if (level >= 4 && Math.floor(at / span) % 3 === 1) {
                entries.push({ id: ++id, at, z: at + 224, lane: (lane + 1) % 3,
                    type: 'car', speed: 23 + random() * 6, color: level % 5 });
            }
            if (at > 200 && Math.floor(at / span) % (level < 4 ? 3 : 2) === 1) {
                entries.push({ id: ++id, at, z: at + 160, lane: (lane + 2) % 3, type: 'barrier', speed: 0 });
            }
            if (Math.floor(at / span) % 5 === 2) {
                entries.push({ id: ++id, at, z: at + 125, lane: (lane + 1) % 3, type: 'cell', speed: 0 });
            }
        }
        return Object.freeze(entries);
    }
    const levels = routes.map(([name, length, limit, turns, tunnels, description], index) => Object.freeze({
        id: index + 1, name, length, limit, description, sector: Math.floor(index / 3),
        road: makeRoad(length, turns), traffic: traffic(index + 1, length),
        tunnels: tunnels.map(([start, end]) => [Math.round(start * length), Math.round(end * length)])
    }));
    function roadAt(level, distance) {
        const raw = Math.max(0, Math.min(level.road.length - 1, distance / STEP));
        const i = Math.floor(raw), f = raw - i;
        const a = level.road[i], b = level.road[i + 1] ?? a;
        return { x: a.x + (b.x - a.x) * f, heading: a.heading + (b.heading - a.heading) * f,
            curve: a.curve + (b.curve - a.curve) * f };
    }
    function tunnelAt(level, distance) {
        return level.tunnels.some(([entry, exit]) => distance >= entry && distance <= exit);
    }
    globalThis.AuroraRoutes = Object.freeze({ ROAD_HALF, LANES, sectors, levels: Object.freeze(levels), roadAt, tunnelAt, rng });
})();
