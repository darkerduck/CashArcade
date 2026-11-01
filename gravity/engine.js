/* Gravity Courier: deterministic 120 Hz rules, no DOM or audio dependencies. */
(function (root) {
    'use strict';
    const H = 600, CEILING = 60, FLOOR = 540, RADIUS = 13, HIT_RADIUS = 9, STEP = 1 / 120;
    const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
    const spike = (x, side, width = 150, height = 95) => ({ x, y: side === 'top' ? CEILING : FLOOR - height, w: width, h: height, side });
    const shard = (x, side) => ({ x, y: side === 'top' ? 80 : side === 'bottom' ? 520 : side });
    const platform = (x, y, w = 230, amplitude = 45, period = 4, phase = 0) => ({ x, y, w, h: 18, amplitude, period, phase });
    const laser = (x, side, phase = 0, period = 2.8, on = 1.2) => ({ x, y: side === 'top' ? CEILING : 335, w: 10, h: 205, phase, period, on, warning: .38 });
    const level = (id, name, zone, tip, length, speed, spikes, shards, platforms = [], lasers = [], route = []) => ({
        id, name, zone, tip, length, speed, spikes, shards, platforms, lasers, route,
        goal: Math.round(((length - 200) / speed - .25) * 100) / 100,
    });
    // Every route has a deterministic replay in tests/gravity-engine.test.mjs.
    // The x landmarks document a playable line, not an automated in-game pilot.
    const LEVELS = [
        level('first-light', '第一束光', 'OUTBOUND / 01', '按一下就翻轉重力。提前離開紅色尖刺所在的地面。', 2580, 205,
            [spike(650, 'bottom'), spike(1300, 'top'), spike(1950, 'bottom')],
            [shard(970, 'top'), shard(1620, 'bottom'), shard(2280, 'top')], [], [], [440, 1090, 1740]),
        level('opposite-side', '彼端月台', 'ELEVATED / 02', '不要連按。先落到另一側，再找下一次翻轉的時機。', 2840, 215,
            [spike(620, 'bottom', 220), spike(1390, 'top', 230), spike(2200, 'bottom', 150, 125)],
            [shard(1020, 'top'), shard(1800, 'bottom'), shard(2530, 215)], [], [], [410, 1180, 1990, 2440, 2530]),
        level('floating-dock', '浮動船塢', 'SKY DOCK / 03', '青色月台會上下移動，可以站在上面；側邊不會撞傷你。', 3060, 215,
            [spike(710, 'bottom', 180), spike(1510, 'top', 220), spike(2390, 'bottom', 180)],
            [shard(1110, 215), shard(1930, 'bottom'), shard(2770, 'top')],
            [platform(300, 405, 250, 52, 3.8), platform(1770, 265, 300, 58, 4.3, 1)], [], [460, 1020, 1110, 1270, 2140]),
        level('pulse-crossing', '脈衝通道', 'SIGNAL / 04', '雷射亮紅時危險，金色虛線是預警。可從另一側繞行。', 3220, 220,
            [spike(650, 'bottom'), spike(1460, 'top'), spike(2340, 'bottom')],
            [shard(1020, 'top'), shard(1880, 'bottom'), shard(2810, 'top')], [],
            [laser(910, 'top', .8), laser(1760, 'top', 1.4), laser(2640, 'bottom', .8)], [420, 1220, 2100]),
        level('switchyard', '換軌工場', 'SWITCHYARD / 05', '連續交錯的尖刺。看前方兩個障礙，維持翻轉節奏。', 3590, 225,
            [spike(590, 'bottom', 100), spike(1150, 'top', 130), spike(1730, 'bottom', 140), spike(2320, 'top', 130), spike(2910, 'bottom', 160)],
            [shard(890, 'top'), shard(2020, 'top'), shard(3320, 'top')], [],
            [laser(1420, 'top', .5), laser(2630, 'top', 1.6)], [380, 940, 1520, 2110, 2700]),
        level('orbital-cargo', '軌道貨艙', 'ORBITAL / 06', '浮台讓路線改變。每次翻轉都能立即離開月台。', 3770, 225,
            [spike(690, 'bottom', 170, 120), spike(1550, 'top', 190, 135), spike(2460, 'bottom', 170, 145), spike(3160, 'top', 180, 100)],
            [shard(1130, 215), shard(2010, 'bottom'), shard(3560, 'bottom')],
            [platform(280, 420, 250, 38, 3.2), platform(1810, 300, 310, 60, 4.7), platform(2780, 270, 160, 40, 3.2)],
            [laser(1300, 'bottom', .1), laser(2790, 'bottom', 1.5)], [440, 1040, 1130, 1310, 2220, 2920]),
        level('neon-tide', '霓虹潮汐', 'TIDAL / 07', '較高的尖刺需要更早出發；紅色光束只傷害亮起的區域。', 3950, 235,
            [spike(680, 'bottom', 160, 145), spike(1430, 'top', 170, 155), spike(2180, 'bottom', 170, 145), spike(3010, 'top', 190, 155)],
            [shard(1030, 'top'), shard(2550, 'top'), shard(3570, 'bottom')],
            [platform(1620, 350, 220, 55, 3.6)],
            [laser(1110, 'bottom', .5, 2.4), laser(2590, 'bottom', 1.3, 2.4), laser(3400, 'top', 2, 2.4)], [400, 1150, 1900, 2730]),
        level('midnight-mail', '午夜急件', 'EXPRESS / 08', '金色碎片會短暫加速。跑得越快，越要提早判斷。', 4200, 240,
            [spike(650, 'bottom', 120), spike(1250, 'top', 140), spike(1900, 'bottom', 140), spike(2590, 'top', 160), spike(3300, 'bottom', 180)],
            [shard(960, 185), shard(2240, 'top'), shard(3770, 'top')],
            [platform(1480, 315, 210, 52, 4)],
            [laser(1650, 'top', .6), laser(2930, 'top', 1.2), laser(3670, 'bottom', 1.6)], [390, 860, 950, 1100, 1640, 2330, 3040]),
        level('mirror-works', '鏡面機關', 'MIRROR / 09', '上下通道彼此映照。前方的金色導引燈提示安全路線。', 4450, 240,
            [spike(720, 'bottom', 170, 135), spike(1430, 'top', 180, 140), spike(2150, 'bottom', 160, 155), spike(2920, 'top', 170, 145), spike(3650, 'bottom', 190, 145)],
            [shard(1100, 'top'), shard(2520, 'top'), shard(4140, 'top')],
            [platform(280, 415, 240, 42, 3.5), platform(1700, 300, 240, 55, 4.1), platform(3150, 270, 210, 60, 4.5)],
            [laser(1820, 'top', 1.8), laser(3320, 'top', .6), laser(4030, 'top', 2.6)], [430, 1150, 1870, 2640, 3370]),
        level('last-delivery', '黎明前送達', 'FINAL MILE / 10', '最後一趟。把所有節奏串起來，將核心送回城市。', 4950, 245,
            [spike(680, 'bottom', 170, 130), spike(1360, 'top', 170, 145), spike(2060, 'bottom', 170, 150), spike(2800, 'top', 180, 150), spike(3560, 'bottom', 180, 155), spike(4300, 'top', 160, 140)],
            [shard(1030, 'top'), shard(3170, 400), shard(4740, 'bottom')],
            [platform(275, 420, 230, 40, 3.8), platform(1600, 310, 210, 55, 3.6), platform(3040, 290, 220, 60, 4.4)],
            [laser(1680, 'top', .7), laser(2420, 'bottom', 1.5), laser(3920, 'bottom', 1.2), laser(4650, 'top', .4)], [400, 1080, 1780, 2520, 3070, 3170, 3390, 4020]),
    ];
    for (const item of LEVELS) { for (const key of ['spikes', 'shards', 'platforms', 'lasers', 'route']) { item[key].forEach(Object.freeze); Object.freeze(item[key]); } Object.freeze(item); }
    Object.freeze(LEVELS);
    function platformAt(item, time) { return { ...item, y: item.y + Math.sin(time * Math.PI * 2 / item.period + item.phase) * item.amplitude }; }
    function laserState(item, time) {
        const phase = ((time + item.phase) % item.period + item.period) % item.period;
        return phase < item.on ? 'active' : phase > item.period - item.warning ? 'warning' : 'off';
    }
    function circleRect(x, y, r, rect) {
        const dx = x - clamp(x, rect.x, rect.x + rect.w), dy = y - clamp(y, rect.y, rect.y + rect.h);
        return dx * dx + dy * dy < r * r;
    }
    class Game {
        constructor(index = 0) { this.levelIndex = Number.isInteger(index) ? clamp(index, 0, LEVELS.length - 1) : 0; this.level = LEVELS[this.levelIndex]; this.reset(); }
        reset() {
            this.player = { x: 100, y: FLOOR - RADIUS, vy: 0, gravity: 1, grounded: true, platform: -1 };
            this.state = 'ready'; this.time = 0; this.flips = 0; this.cooldown = 0; this.boost = 0;
            this.collected = []; this.events = []; this.trail = []; this.deathReason = ''; this._accumulator = 0; this.stars = 0;
        }
        start() { if (this.state === 'ready') { this.state = 'running'; this.events.push({ type: 'start' }); return true; } return false; }
        pause() { if (this.state !== 'running') return false; this.state = 'paused'; this._accumulator = 0; this.events.push({ type: 'pause' }); return true; }
        resume() { if (this.state !== 'paused') return false; this.state = 'running'; this.events.push({ type: 'resume' }); return true; }
        restart() { this.reset(); this.start(); }
        flip() {
            if (this.state !== 'running' || this.cooldown > 0) return false;
            const p = this.player; p.gravity *= -1; p.vy = p.gravity * 140; p.grounded = false; p.platform = -1;
            this.cooldown = .11; this.flips++; this.events.push({ type: 'flip', x: p.x, y: p.y }); return true;
        }
        update(dt) {
            if (this.state !== 'running' || !Number.isFinite(dt) || dt <= 0) return;
            this._accumulator += Math.min(dt, .25);
            while (this._accumulator + 1e-10 >= STEP && this.state === 'running') { this.step(STEP); this._accumulator -= STEP; }
            if (this.state !== 'running') this._accumulator = 0;
        }
        step(dt) {
            const p = this.player, oldTime = this.time, oldX = p.x, oldY = p.y;
            this.time += dt; this.cooldown = Math.max(0, this.cooldown - dt);
            p.x += this.level.speed * (this.boost > 0 ? 1.22 : 1) * dt;
            this.boost = Math.max(0, this.boost - dt);
            if (p.platform >= 0) {
                const old = platformAt(this.level.platforms[p.platform], oldTime), next = platformAt(this.level.platforms[p.platform], this.time);
                if (p.x + RADIUS > next.x && p.x - RADIUS < next.x + next.w) { p.y += next.y - old.y; }
                else { p.platform = -1; p.grounded = false; }
            }
            p.vy = clamp(p.vy + p.gravity * 1750 * dt, -620, 620);
            p.y += p.vy * dt; p.grounded = false;
            if (p.y >= FLOOR - RADIUS) { p.y = FLOOR - RADIUS; p.vy = 0; p.grounded = p.gravity > 0; p.platform = -1; }
            if (p.y <= CEILING + RADIUS) { p.y = CEILING + RADIUS; p.vy = 0; p.grounded = p.gravity < 0; p.platform = -1; }
            for (let i = 0; i < this.level.platforms.length; i++) {
                const old = platformAt(this.level.platforms[i], oldTime), next = platformAt(this.level.platforms[i], this.time);
                if (p.x + RADIUS <= next.x || p.x - RADIUS >= next.x + next.w) continue;
                if (p.gravity > 0 && oldY + RADIUS <= old.y + 3 && p.y + RADIUS >= next.y) {
                    p.y = next.y - RADIUS; p.vy = 0; p.grounded = true; p.platform = i;
                } else if (p.gravity < 0 && oldY - RADIUS >= old.y + old.h - 3 && p.y - RADIUS <= next.y + next.h) {
                    p.y = next.y + next.h + RADIUS; p.vy = 0; p.grounded = true; p.platform = i;
                }
            }
            // Fine fixed steps limit each sweep to < 6 px; sample its midpoint too.
            const hit = rect => circleRect(p.x, p.y, HIT_RADIUS, rect) || circleRect((oldX + p.x) / 2, (oldY + p.y) / 2, HIT_RADIUS, rect);
            for (const item of this.level.spikes) {
                // The painted triangular tips are more generous than their art envelope.
                const rect = { x: item.x + 5, y: item.y + (item.side === 'bottom' ? 10 : 0), w: item.w - 10, h: item.h - 10 };
                if (hit(rect)) { this.die('spikes'); return; }
            }
            for (const item of this.level.lasers) if (laserState(item, this.time) === 'active' && hit(item)) { this.die('laser'); return; }
            this.level.shards.forEach((item, i) => { if (!this.collected.includes(i) && Math.hypot(p.x - item.x, p.y - item.y) < 30) {
                this.collected.push(i); this.boost = 1; this.events.push({ type: 'shard', x: item.x, y: item.y });
            } });
            this.trail.push({ x: p.x, y: p.y }); if (this.trail.length > 18) this.trail.shift();
            if (p.x >= this.level.length - 100) {
                this.state = 'delivered'; p.x = this.level.length - 100;
                this.stars = 1 + Number(this.time <= this.level.goal) + Number(this.collected.length === this.level.shards.length);
                this.events.push({ type: 'delivery', stars: this.stars, time: this.time });
            }
        }
        die(reason) { this.state = 'lost'; this.deathReason = reason; this.events.push({ type: 'death', x: this.player.x, y: this.player.y, reason }); }
        drain() { return this.events.splice(0); }
        get progress() { return clamp((this.player.x - 100) / (this.level.length - 200), 0, 1); }
    }
    const api = { Game, LEVELS, H, CEILING, FLOOR, RADIUS, HIT_RADIUS, STEP, platformAt, laserState, circleRect };
    root.GravityCourier = api; if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
