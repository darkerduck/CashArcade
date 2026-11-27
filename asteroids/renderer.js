(() => {
    'use strict';
    const { size, rocks } = NeonAsteroidsData;
    const { wrap } = NeonAsteroids;
    const TAU = Math.PI * 2;
    const icons = { spread: 'Ｓ', laser: 'Ｌ', escort: '◇', shield: '⬡', repair: '+' };
    const themes = [
        { glow: '35,98,162', rock: '#c09bf6', label: 'MINERAL BELT' },
        { glow: '97,48,166', rock: '#b29fff', label: 'GRAVITY NEBULA' },
        { glow: '90,42,101', rock: '#eba3bd', label: 'FLEET GRAVEYARD' }
    ];
    const stars = Array.from({ length: 135 }, (_, i) => ({
        x: (i * 191.39 + i * i * 7.337) % size, y: (i * 67.77 + i * i * 0.79) % size,
        r: i % 11 === 0 ? 1.6 : 0.7, alpha: 0.18 + (i % 7) * 0.08
    }));
    function ring(c, x, y, r, color, width = 1) {
        c.beginPath();
        c.arc(x, y, r, 0, TAU);
        c.lineWidth = width;
        c.strokeStyle = color;
        c.stroke();
    }
    function polygon(c, points, fill, stroke, width = 2) {
        c.beginPath();
        c.moveTo(...points[0]);
        for (const point of points.slice(1)) c.lineTo(...point);
        c.closePath();
        c.fillStyle = fill;
        c.fill();
        if (stroke) { c.strokeStyle = stroke; c.lineWidth = width; c.stroke(); }
    }
    function copies(c, obj, radius, paint) {
        const xs = [obj.x], ys = [obj.y];
        if (obj.x < radius) xs.push(obj.x + size);
        if (obj.x > size - radius) xs.push(obj.x - size);
        if (obj.y < radius) ys.push(obj.y + size);
        if (obj.y > size - radius) ys.push(obj.y - size);
        for (const x of xs) for (const y of ys) {
            c.save(); c.translate(x, y); paint(c); c.restore();
        }
    }
    const ROCK_SHAKE = { large: .26, medium: .13, small: .06 };
    const ROCK_SHARDS = { large: 16, medium: 11, small: 6 };
    // Near star layer drifts against the ship for parallax; the far layer is baked into the cache.
    const dust = Array.from({ length: 70 }, (_, i) => ({ x: (i * 97.13 + i * i * 3.71) % size, y: (i * 151.7 + i * i * 1.93) % size,
        r: i % 9 === 0 ? 1.8 : 1.1, depth: .5 + (i % 5) * .18 }));
    class Renderer {
        constructor(canvas) {
            this.canvas = canvas;
            this.ctx = canvas.getContext('2d', { alpha: false });
            this.back = document.createElement('canvas');
            this.back.width = this.back.height = size;
            this.particles = [];
            this.rings = [];
            this.fx = globalThis.CashArcadeFX?.createFx() ?? null;
            this.flashes = new Map();
            this.lowMotion = false;
            this.shake = 0;
            this.clock = 0;
            this.level = 0;
        }
        get reduced() { return this.lowMotion; }
        set reduced(value) { this.lowMotion = Boolean(value); this.fx?.setReduced(this.lowMotion); }
        timeScale() { return this.fx?.timeScale() ?? 1; }
        reset() {
            this.particles.length = this.rings.length = 0;
            this.shake = 0;
            this.flashes.clear();
            this.fx?.clear();
            this.level = 0;
        }
        consume(events) {
            const fx = this.fx;
            for (const event of events) {
                const { type, x, y } = event;
                if (type === 'hit' && event.id !== undefined) this.flashes.set(event.id, .09);
                if (!fx) continue;
                if (type === 'shatter') {
                    const kind = event.rock ?? 'medium', r = event.radius ?? 16;
                    fx.burst(x, y, { kind: 'shard', color: '#d8b8ff', count: ROCK_SHARDS[kind] ?? 10, speed: 120 + r * 4, life: .7, size: 1.6 + r * .08 });
                    fx.burst(x, y, { kind: 'spark', color: '#a6f6ff', count: 8, speed: 260, life: .4 });
                    fx.burst(x, y, { kind: 'ring', color: '#c9a3ff', size: r * 2.4, life: .4 });
                    if (event.points) fx.popup(x, y - r * .6, '+' + event.points, { color: '#e8d6ff', size: kind === 'large' ? 18 : 14 });
                    fx.shake(ROCK_SHAKE[kind] ?? .1);
                    if (kind === 'large') fx.hitStop(.045);
                } else if (type === 'destroy') {
                    fx.burst(x, y, { kind: 'spark', color: '#ffb07a', count: 18, speed: 320, life: .55 });
                    fx.burst(x, y, { kind: 'shard', color: '#ff9e79', count: 8, speed: 200, life: .6 });
                    fx.burst(x, y, { kind: 'ring', color: '#ffcf9a', size: 56, life: .45 });
                    if (event.points) fx.popup(x, y - 18, '+' + event.points, { color: '#ffd9a8', size: 16 });
                    fx.shake(.18); fx.hitStop(.035);
                } else if (type === 'hit') {
                    fx.burst(x, y, { kind: 'spark', color: '#c8f8ff', count: 4, speed: 180, life: .22, size: 1.8 });
                } else if (type === 'hurt') {
                    fx.burst(x, y, { kind: 'spark', color: '#ff8f7a', count: 14, speed: 260, life: .45 });
                    fx.flash('#ff4d6a', .22, .22); fx.shake(.45); fx.hitStop(.07);
                } else if (type === 'shipDown') {
                    fx.burst(x, y, { kind: 'shard', color: '#8df4ff', count: 22, speed: 260, life: 1 });
                    fx.burst(x, y, { kind: 'ring', color: '#8df4ff', size: 140, life: .7 });
                    fx.flash('#ffffff', .3, .3); fx.shake(.8); fx.slowMotion(.7, .3);
                } else if (type === 'partDown') {
                    fx.burst(x, y, { kind: 'spark', color: '#ffd180', count: 26, speed: 360, life: .7 });
                    fx.burst(x, y, { kind: 'ring', color: '#ffd180', size: 120, life: .55 });
                    fx.shake(.4); fx.hitStop(.06);
                } else if (type === 'bossDown') {
                    fx.burst(x, y, { kind: 'shard', color: '#ed8ee9', count: 40, speed: 380, life: 1.3 });
                    fx.burst(x, y, { kind: 'spark', color: '#ffe0a0', count: 50, speed: 460, life: 1 });
                    fx.burst(x, y, { kind: 'ring', color: '#ffffff', size: 320, life: 1 });
                    fx.flash('#ffffff', .4, .45); fx.shake(1); fx.hitStop(.12); fx.slowMotion(.9, .35);
                } else if (type === 'swallowed') {
                    fx.burst(x, y, { kind: 'spark', color: '#ffb47b', count: 16, speed: 140, life: .6 });
                } else if (type === 'pickup') {
                    fx.burst(x, y, { kind: 'ring', color: '#ffe399', size: 60, life: .4 });
                    fx.popup(x, y - 26, { spread: 'SPREAD', laser: 'LASER', escort: 'ESCORT', shield: 'SHIELD', repair: 'REPAIR' }[event.item] ?? 'POWER', { color: '#ffe399', size: 14 });
                } else if (type === 'shield') {
                    fx.burst(x, y, { kind: 'ring', color: '#7eeaff', size: 70, life: .4 });
                } else if (type === 'spawn') {
                    fx.burst(x, y, { kind: 'ring', color: '#b9a4ff', size: 40, life: .35 });
                } else if (type === 'boss') {
                    fx.banner('WARNING', 'FLAGSHIP INBOUND', { color: '#ffb06e', duration: 1.6 });
                    fx.shake(.3);
                }
            }
        }
        update(dt) {
            this.clock += dt;
            this.fx?.update(dt);
            for (const [id, left] of this.flashes) { if (left - dt <= 0) this.flashes.delete(id); else this.flashes.set(id, left - dt); }
        }
        background(sector, light) {
            const key = sector + ':' + light;
            if (key === this.backKey) return;
            this.backKey = key;
            const c = this.back.getContext('2d'), palette = themes[sector];
            c.setTransform(this.back.width / size, 0, 0, this.back.width / size, 0, 0);
            const glow = c.createRadialGradient(385, 230, 0, 385, 230, 500);
            glow.addColorStop(0, light ? '#e8e6ff' : 'rgb(' + palette.glow + ')');
            glow.addColorStop(0.48, light ? '#e6effc' : '#141b38');
            glow.addColorStop(1, light ? '#f4f8ff' : '#070e20');
            c.fillStyle = glow;
            c.fillRect(0, 0, size, size);
            for (const star of stars) {
                c.globalAlpha = star.alpha;
                c.fillStyle = light ? '#545a99' : '#d4eaff';
                c.fillRect(star.x, star.y, star.r, star.r);
            }
            c.globalAlpha = 1;
            const soft = light ? '#46628925' : '#a9bff01c';
            c.strokeStyle = soft;
            c.lineWidth = 1;
            c.beginPath();
            if (sector === 0) {
                for (let i = -650; i < size; i += 68) { c.moveTo(i, size); c.lineTo(i + 550, 0); }
                c.stroke();
            } else if (sector === 1) {
                c.save(); c.translate(360, 315); c.rotate(-0.42);
                for (let i = 1; i <= 6; i++) { c.beginPath(); c.ellipse(0, 0, i * 78, i * 35, 0, 0, TAU); c.stroke(); }
                c.restore();
            } else {
                c.setLineDash([8, 16]);
                for (let i = 60; i <= 660; i += 60) {
                    c.moveTo(i, 0); c.lineTo(i, size); c.moveTo(0, i); c.lineTo(size, i);
                }
                c.stroke(); c.setLineDash([]);
            }
            c.font = '13px monospace';
            c.fillStyle = light ? '#364b74' : '#b6c9e9';
            c.fillText(palette.label, 19, 29);
        }
        // Live layers over the cached backdrop: two drifting nebula wisps and parallax dust.
        ambience(game, light) {
            const c = this.ctx, p = game.player, t = this.lowMotion ? 0 : this.clock;
            const palette = themes[game.data.sector];
            if (!light) {
                c.save(); c.globalCompositeOperation = 'lighter';
                for (const [ox, oy, r, speed] of [[180, 520, 230, .05], [560, 160, 190, -.04]]) {
                    const x = ox + Math.sin(t * speed * 6) * 40, y = oy + Math.cos(t * speed * 5) * 30;
                    const wisp = c.createRadialGradient(x, y, 0, x, y, r);
                    wisp.addColorStop(0, 'rgba(' + palette.glow + ',.16)'); wisp.addColorStop(1, 'rgba(' + palette.glow + ',0)');
                    c.fillStyle = wisp; c.fillRect(x - r, y - r, r * 2, r * 2);
                }
                c.restore();
            }
            const shiftX = (p.x - size / 2) * .05 + p.vx * .02, shiftY = (p.y - size / 2) * .05 + p.vy * .02;
            c.fillStyle = light ? '#4b5a94' : '#e6f4ff';
            for (const d of dust) {
                c.globalAlpha = (light ? .35 : .55) * d.depth;
                const x = ((d.x - shiftX * d.depth * 3) % size + size) % size, y = ((d.y - shiftY * d.depth * 3) % size + size) % size;
                c.fillRect(x, y, d.r, d.r);
            }
            c.globalAlpha = 1;
        }
        field(field, time, light) {
            const color = field.lethal ? (light ? '#a84318' : '#ffb47b') : (light ? '#6445af' : '#bba1ff');
            const dark = light ? '#32244f' : '#070710';
            copies(this.ctx, field, field.range, c => {
                const wash = c.createRadialGradient(0, 0, 0, 0, 0, field.range);
                wash.addColorStop(0, color + '35'); wash.addColorStop(1, color + '00');
                c.fillStyle = wash; c.fillRect(-field.range, -field.range, field.range * 2, field.range * 2);
                c.setLineDash([6, 9]);
                ring(c, 0, 0, field.range, color + 'a0', 1.5);
                c.setLineDash([]);
                for (let i = 1; i <= 3; i++) {
                    const radius = field.core + (field.range - field.core) * i * 0.22;
                    c.beginPath();
                    c.arc(0, 0, radius, time * (this.reduced ? 0 : 0.7) + i, time * (this.reduced ? 0 : 0.7) + i + 2.5);
                    c.strokeStyle = color + '80'; c.lineWidth = field.lethal ? 2 : 1; c.stroke();
                }
                if (field.lethal) {
                    c.beginPath(); c.arc(0, 0, field.core, 0, TAU); c.fillStyle = dark; c.fill();
                    ring(c, 0, 0, field.core + 2, color, 3);
                    c.textAlign = 'center'; c.font = 'bold 15px system-ui'; c.fillStyle = color;
                    c.fillText('致命核心', 0, -field.core - 11);
                } else ring(c, 0, 0, 8, color, 2);
            });
        }
        drawRock(enemy, color, light) {
            const flash = this.flashes.has(enemy.id);
            copies(this.ctx, enemy, enemy.radius + 6, c => {
                c.rotate(enemy.angle);
                const r = enemy.radius;
                const corners = Array.from({ length: 11 }, (_, i) => {
                    const angle = i / 11 * TAU, edge = r * (0.78 + ((i * 13 + enemy.id * 7) % 11) * 0.024);
                    return [Math.cos(angle) * edge, Math.sin(angle) * edge];
                });
                // Vector-arcade rock: dark body, soft outer halo stroke, bright rim, inset facet ring.
                polygon(c, corners, flash ? (light ? '#ffffff' : '#f2e8ff') : (light ? '#d7c5ef' : '#1c1834'));
                c.beginPath(); c.moveTo(...corners[0]); for (const pt of corners.slice(1)) c.lineTo(...pt); c.closePath();
                c.strokeStyle = color + '40'; c.lineWidth = 6; c.stroke();
                c.strokeStyle = flash ? '#ffffff' : color; c.lineWidth = 2; c.stroke();
                c.beginPath();
                corners.forEach(([x, y], i) => i ? c.lineTo(x * .62, y * .62) : c.moveTo(x * .62, y * .62));
                c.closePath(); c.strokeStyle = color + '55'; c.lineWidth = 1; c.stroke();
                c.beginPath();
                for (let i = 0; i < 11; i += 2) { c.moveTo(corners[i][0] * .62, corners[i][1] * .62); c.lineTo(corners[i][0] * .95, corners[i][1] * .95); }
                c.strokeStyle = color + '70'; c.stroke();
                polygon(c, [[-r * .5, -r * .38], [r * .2, -r * .5], [-r * .05, -r * .05]], color + '2a');
                if (enemy.maxHp && enemy.hp < enemy.maxHp) {
                    // Cracks grow as the rock loses hit points.
                    const damage = 1 - enemy.hp / enemy.maxHp;
                    c.beginPath(); c.moveTo(0, 0);
                    c.lineTo(r * .3, -r * .2 * damage); c.lineTo(r * .7 * damage + r * .2, -r * .05);
                    c.moveTo(0, 0); c.lineTo(-r * .25, r * .45 * damage + r * .1);
                    c.strokeStyle = light ? '#5b2f86' : '#ffffffb0'; c.lineWidth = 1.3; c.stroke();
                }
                if (enemy.grace) { c.setLineDash([3, 4]); ring(c, 0, 0, r + 4, color, 1); c.setLineDash([]); }
            });
        }
        ship(obj, angle, light, kind, thrust = false) {
            const player = kind === 'player' || kind === 'escort';
            const color = player ? (light ? '#00638d' : '#80f4ff') : (light ? '#a13d54' : '#ffa08a');
            const flash = this.flashes.has(obj.id);
            const scale = (obj.radius / 12) * (kind === 'player' ? 1.25 : 1.1);
            copies(this.ctx, obj, thrust ? 100 : 60, c => {
                c.rotate(angle);
                c.scale(scale, scale);
                if (thrust) {
                    const flicker = this.lowMotion ? 1 : .8 + Math.sin(this.clock * 60) * .2;
                    const flame = c.createLinearGradient(-44 * flicker, 0, -8, 0);
                    flame.addColorStop(0, '#ad6aff00'); flame.addColorStop(0.6, '#9f68ffcc'); flame.addColorStop(1, '#e6ffff');
                    polygon(c, [[-11, -5], [-44 * flicker, 0], [-11, 5]], flame);
                    polygon(c, [[-11, -2.5], [-26 * flicker, 0], [-11, 2.5]], '#ffffffcc');
                }
                if (obj.invulnerable > 0 && !this.lowMotion) c.globalAlpha = 0.55 + Math.sin(this.clock * 30) * .3;
                const bulky = kind === 'gunship' || kind === 'frigate' || kind === 'transport';
                const points = bulky ? [[14, -8], [9, -11], [-10, -11], [-14, -5], [-14, 5], [-10, 11], [9, 11], [14, 8]]
                    : [[19, 0], [2, -6], [-9, -12], [-14, -7], [-8, 0], [-14, 7], [-9, 12], [2, 6]];
                polygon(c, points, flash ? '#ffffff' : light ? (player ? '#b3edf4' : '#f7d0c8') : (player ? '#0b2a3a' : '#2c1530'));
                c.beginPath(); c.moveTo(...points[0]); for (const pt of points.slice(1)) c.lineTo(...pt); c.closePath();
                c.strokeStyle = color + '45'; c.lineWidth = 5; c.stroke();
                c.strokeStyle = color; c.lineWidth = 1.8; c.stroke();
                // Inner trim line and a lit cockpit give the hull a second contour.
                c.beginPath(); points.forEach(([x, y], i) => i ? c.lineTo(x * .62, y * .62) : c.moveTo(x * .62, y * .62)); c.closePath();
                c.strokeStyle = color + '80'; c.lineWidth = 1; c.stroke();
                polygon(c, [[8, 0], [-6, -3], [-6, 3]], color);
                c.beginPath(); c.arc(4, 0, 2, 0, TAU); c.fillStyle = light ? '#ffffff' : '#f4ffff'; c.fill();
                if (bulky) { c.fillStyle = color; c.fillRect(-8, -8, 3, 16); }
                if (obj.shield) {
                    const pulse = this.lowMotion ? 0 : Math.sin(this.clock * 6) * 1.5;
                    ring(c, 0, 0, 24 + pulse, light ? '#007c9e' : '#7eeaff', 1.6);
                    ring(c, 0, 0, 27 + pulse, light ? '#007c9e40' : '#7eeaff40', 3);
                }
                if (kind === 'player') {
                    c.beginPath(); c.moveTo(23, 0); c.lineTo(35, 0); c.strokeStyle = color + 'aa'; c.lineWidth = 1.2; c.stroke();
                }
            });
        }
        boss(game, light) {
            const b = game.boss, c = this.ctx, outer = light ? '#a24c71' : '#ed8ee9';
            const outline = b.kind === 3 ?
                [[-117, 8], [-83, -30], [-38, -48], [0, -67], [38, -48], [83, -30], [117, 8], [77, 42], [0, 74], [-77, 42]] :
                [[-86, 6], [-66, -35], [-17, -57], [17, -57], [66, -35], [86, 6], [60, 39], [0, 58], [-60, 39]];
            if (!b.core.dead) copies(c, b, 125, ctx => {
                polygon(ctx, outline, light ? '#e6c7e9' : '#292044', outer, 3);
                polygon(ctx, [[-75, 5], [0, -45], [75, 5], [0, 54]], light ? '#c7abd8' : '#412949', outer + '90');
                if (b.kind === 2) ring(ctx, 0, 0, 67, outer + '9a', 2);
            });
            if (b.tell && !b.core.dead) copies(c, b.tell.source, size / 2, ctx => {
                ctx.rotate(b.tell.angle);
                const r = b.tell.source.radius;
                ctx.strokeStyle = '#ffb06e'; ctx.lineWidth = 1.75; ctx.setLineDash([7, 7]);
                ctx.beginPath(); ctx.moveTo(r, 0); ctx.lineTo(300, 0); ctx.stroke();
                if (b.tell.pull) ring(ctx, 145, 0, 130, '#ffb06eaa', 1.4);
            });
            for (const part of [...b.parts, b.core]) {
                if (part.dead) continue;
                const locked = game.locked(part);
                const color = locked ? outer : light ? '#b1471f' : '#ffd180';
                copies(c, part, part.radius + 16, ctx => {
                    if (part.role === 'guard') {
                        polygon(ctx, [[0, -23], [21, 0], [0, 17], [-21, 0]], light ? '#f3cbcb' : '#432b50', color);
                    } else {
                        ring(ctx, 0, 0, part.role === 'core' ? part.radius * 0.75 : part.radius, color, locked ? 1.8 : 3);
                    }
                    if (locked) {
                        ctx.setLineDash([4, 5]); ring(ctx, 0, 0, part.radius + 3, color, 1.5); ctx.setLineDash([]);
                        ctx.fillStyle = color; ctx.fillRect(-5, -5, 10, 10);
                    } else {
                        ctx.fillStyle = color;
                        ctx.fillRect(-part.radius, part.radius + 7, part.radius * 2 * part.hp / part.maxHp, 3);
                    }
                });
            }
        }
        draw(game, theme = 'dark') {
            const c = this.ctx, light = theme === 'light', palette = themes[game.data.sector], p = game.player;
            const color = light ? '#075a78' : '#a8f4ff';
            const ratio = globalThis.CashArcadeFX?.fitCanvas(this.canvas, size, size) ?? 1;
            if (this.back.width !== size * ratio) { this.back.width = this.back.height = size * ratio; this.backKey = null; }
            this.background(game.data.sector, light);
            c.setTransform(1, 0, 0, 1, 0, 0);
            c.drawImage(this.back, 0, 0, this.canvas.width, this.canvas.height);
            c.setTransform(ratio, 0, 0, ratio, 0, 0);
            if (this.level !== game.level && game.mode === 'running') {
                this.level = game.level;
                this.fx?.banner(`SECTOR ${String(game.level).padStart(2, '0')}`, game.data.name, { color: light ? '#075a78' : '#a8f4ff' });
            }
            this.ambience(game, light);
            c.save();
            this.fx?.apply(c);
            for (const field of game.fields) this.field(field, game.time, light);
            for (const warning of game.warnings) copies(c, warning, 30, ctx => {
                // Warp-in: a contracting ring and a spinning tick marker before the rock appears.
                const t = Math.max(0, Math.min(1, warning.ttl / .8)), warn = light ? '#ad441e' : '#ffb06e';
                ctx.setLineDash([5, 4]);
                ring(ctx, 0, 0, 12 + t * 16, warn, 2);
                ctx.setLineDash([]);
                ctx.rotate(this.lowMotion ? 0 : this.clock * 4);
                for (let i = 0; i < 4; i++) { ctx.rotate(TAU / 4); ctx.beginPath(); ctx.moveTo(18 + t * 10, 0); ctx.lineTo(24 + t * 10, 0); ctx.strokeStyle = warn; ctx.lineWidth = 2; ctx.stroke(); }
                polygon(ctx, [[0, -7], [6, 5], [-6, 5]], '#fbb47742', warn);
            });
            if (game.boss) this.boss(game, light);
            else if (game.data.boss && !game.practice) {
                ring(c, 360, 190, 96, '#ffb06eaa', 2);
                c.fillStyle = light ? '#953d1a' : '#ffbd89'; c.font = '16px system-ui';
                c.textAlign = 'center'; c.fillText('旗艦進入中', 360, 190); c.textAlign = 'start';
            }
            for (const enemy of game.enemies) {
                if (rocks.includes(enemy.type)) this.drawRock(enemy, light ? '#704694' : palette.rock, light);
                else this.ship(enemy, enemy.angle, light, enemy.type);
            }
            for (const item of game.loot) copies(c, item, 25, ctx => {
                const gold = light ? '#824d04' : '#ffdb7a';
                const bob = this.lowMotion ? 0 : Math.sin(this.clock * 4 + item.x) * 2;
                ctx.translate(0, bob);
                ctx.globalAlpha = item.ttl < 3 ? 0.5 + Math.sin(this.clock * 14) * .3 : 1;
                ring(ctx, 0, 0, 15, gold, 2); ring(ctx, 0, 0, 19, gold + '45', 3);
                ctx.font = 'bold 16px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillStyle = gold; ctx.fillText(icons[item.type], 0, 1);
            });
            for (const bullet of game.projectiles) copies(c, bullet, 30, ctx => {
                ctx.rotate(Math.atan2(bullet.vy, bullet.vx));
                const tint = bullet.hostile ? (light ? '#c4482d' : '#ff9d68') : bullet.type === 'laser' ? (light ? '#6f32b7' : '#d3a7ff') : color;
                const tail = bullet.type === 'laser' ? -26 : bullet.hostile ? -9 : -16;
                ctx.lineCap = 'round';
                ctx.strokeStyle = tint + '45'; ctx.lineWidth = bullet.type === 'laser' ? 9 : 6;
                ctx.beginPath(); ctx.moveTo(tail, 0); ctx.lineTo(4, 0); ctx.stroke();
                ctx.strokeStyle = tint; ctx.lineWidth = bullet.type === 'laser' ? 3.5 : 2.4;
                ctx.beginPath(); ctx.moveTo(tail * .8, 0); ctx.lineTo(4, 0); ctx.stroke();
                ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(3, 0, bullet.type === 'laser' ? 2 : 1.4, 0, TAU); ctx.fill();
            });
            if (p.hull > 0) {
                const speed = Math.hypot(p.vx, p.vy);
                if (p.thrust && this.fx && !this.lowMotion) {
                    const back = p.angle + Math.PI;
                    this.fx.burst(p.x + Math.cos(back) * 16, p.y + Math.sin(back) * 16,
                        { kind: 'spark', color: '#b98cff', count: 2, speed: 160, life: .28, angle: back, spread: .5, size: 2 });
                }
                if (speed > 12) copies(c, p, 100, ctx => {
                    ctx.rotate(Math.atan2(p.vy, p.vx));
                    const reach = 25 + speed * 0.14;
                    ctx.beginPath(); ctx.moveTo(19, 0); ctx.lineTo(reach, 0);
                    ctx.setLineDash([4, 4]); ctx.strokeStyle = light ? '#60469e' : '#c3abff'; ctx.lineWidth = 2; ctx.stroke();
                    ctx.setLineDash([]);
                    polygon(ctx, [[reach + 5, 0], [reach - 3, -4], [reach - 3, 4]], light ? '#60469e' : '#c3abff');
                });
                for (let i = 0; i < p.escorts; i++) this.ship(game.escort(i), p.angle, light, 'escort');
                this.ship(p, p.angle, light, 'player', p.thrust);
            }
            this.fx?.draw(c, size, size);
            c.restore();
            if (!light) globalThis.CashArcadeFX?.crt(c, size, size, .06);
            c.strokeStyle = light ? '#38607a' : '#7ce5ff85';
            c.lineWidth = 2;
            c.strokeRect(1, 1, size - 2, size - 2);
        }
    }
    globalThis.NeonAsteroidsRenderer = Renderer;
})();
