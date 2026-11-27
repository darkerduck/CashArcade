(() => {
    'use strict';
    const { ROAD_HALF, sectors, roadAt, tunnelAt, rng } = AuroraRoutes;
    const W = 720, H = 450, HORIZON = 132, SCALE = 49, VANISH = 585;
    const paint = ['#d970e4', '#6cd8ff', '#ffc47a', '#a49cff', '#7de3ae'];
    const fog = (color, alpha) => color + Math.round(Math.max(0, Math.min(1, alpha)) * 255).toString(16).padStart(2, '0');
    function poly(ctx, points, fill, stroke, width = 1) {
        ctx.beginPath();
        ctx.moveTo(...points[0]);
        for (const point of points.slice(1)) ctx.lineTo(...point);
        ctx.closePath();
        if (fill) { ctx.fillStyle = fill; ctx.fill(); }
        if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(); }
    }
    function line(ctx, points, color, width = 1) {
        ctx.beginPath();
        ctx.moveTo(...points[0]);
        for (const point of points.slice(1)) ctx.lineTo(...point);
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.stroke();
    }
    function band(ctx, a, b, inner, outer, color) {
        poly(ctx, [[a.x + inner * a.zoom, a.y], [a.x + outer * a.zoom, a.y],
            [b.x + outer * b.zoom, b.y], [b.x + inner * b.zoom, b.y]], color);
    }
    class Renderer {
        constructor(canvas) {
            this.canvas = canvas;
            this.ctx = canvas.getContext('2d', { alpha: false });
            this.sky = document.createElement('canvas');
            this.sky.width = W; this.sky.height = H;
            this.ratio = 1; this.last = 0; this.kick = 0; this.wasBoosting = false;
            this.fx = globalThis.CashArcadeFX?.createFx({ maxParticles: 220, maxShake: 11 }) ?? null;
            const rainRandom = rng(964);
            this.rain = Array.from({ length: 69 }, () => ({
                x: rainRandom() * W, y: rainRandom() * H, v: 95 + rainRandom() * 165, h: 7 + rainRandom() * 19
            }));
        }
        get busy() { return Boolean(this.fx?.busy) || this.kick > 0; }
        timeScale() { return this.fx?.timeScale() ?? 1; }
        // Arcade feedback for engine events; the player car sits at the bottom centre of the view.
        event(event, game) {
            const fx = this.fx; if (!fx) return;
            const sector = sectors[game.level.sector], cx = W / 2, cy = 360;
            if (event.type === 'hit') {
                fx.hitStop(.07); fx.shake(.7); fx.flash('#ff5f7e', .26, .3);
                fx.burst(cx, cy - 20, { color: '#ffc47a', count: 22, speed: 360, life: .55, angle: -Math.PI / 2, spread: 2.6, gravity: 500 });
                fx.burst(cx, cy - 20, { kind: 'shard', color: '#ffe0b9', count: 8, speed: 260, life: .7, gravity: 600 });
                fx.popup(cx, cy - 70, 'CRASH', { color: '#ff7a92', size: 20 });
            }
            if (event.type === 'pass') {
                fx.popup(cx + (event.close ? 0 : 40), cy - 92, event.close ? 'CLOSE CALL!' : 'PASS', { color: event.close ? '#ffe27a' : '#a9f4ff', size: event.close ? 18 : 14 });
                if (event.close) { fx.shake(.12); fx.burst(cx, cy - 40, { kind: 'ring', color: sector.light, size: 120, life: .4 }); }
            }
            if (event.type === 'cell') { fx.popup(cx, cy - 92, 'NITRO +', { color: '#81ffdf', size: 16 }); fx.burst(cx, cy - 50, { color: '#81ffdf', count: 14, speed: 240, life: .45 }); }
            if (event.type === 'boost') { this.kick = 1; fx.flash('#9bdeff', .12, .2); fx.shake(.18); }
            if (event.type === 'won') { fx.banner('FINISH', game.level.name ?? '', { color: '#98fff4', duration: 1.6 }); fx.flash('#ffffff', .2, .4); }
        }
        background(sector, light) {
            const key = sector + ':' + light + ':' + this.ratio;
            if (key === this.key) return;
            this.key = key;
            this.sky.width = Math.round(W * this.ratio); this.sky.height = Math.round(H * this.ratio);
            const ctx = this.sky.getContext('2d'), colors = sectors[sector], random = rng(2289 + sector);
            ctx.setTransform?.(this.ratio, 0, 0, this.ratio, 0, 0);
            const sky = ctx.createLinearGradient(0, 0, 0, 220);
            sky.addColorStop(0, light ? '#526993' : '#080d24');
            sky.addColorStop(.56, light ? '#9c9dc7' : '#24244a');
            sky.addColorStop(1, light ? '#e5bfd5' : '#482c5c');
            ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
            const bloom = ctx.createRadialGradient(360, 116, 0, 360, 116, 290);
            bloom.addColorStop(0, fog(colors.light, .26)); bloom.addColorStop(1, fog(colors.light, 0));
            ctx.fillStyle = bloom; ctx.fillRect(0, 0, W, 235);
            if (sector === 2) {
                for (let i = 0; i < 6; i++) {
                    const y = 22 + i * 7;
                    ctx.beginPath(); ctx.moveTo(-48, y + 30);
                    ctx.bezierCurveTo(114, y - 44, 311, y + 30, 405, y - 4);
                    ctx.bezierCurveTo(541, y - 44, 591, y + 31, 762, y + 4);
                    ctx.strokeStyle = fog(i % 2 ? '#70f5d4' : colors.accent, .13 + i * .022);
                    ctx.lineWidth = 8 + i * 2; ctx.stroke();
                }
                for (let layer = 0; layer < 3; layer++) {
                    const peaks = Array.from({ length: 17 }, (_, i) =>
                        [i * 46 - 12, 76 + layer * 14 + random() * 64 + Math.cos(i * .61) * 27]);
                    poly(ctx, [...peaks, [W, H], [0, H]], light ? ['#64799c', '#4a5d80', '#333f63'][layer] :
                        ['#303357', '#242747', '#171e36'][layer]);
                }
            } else {
                for (let i = 0; i < 45; i++) {
                    const x = i * 17 - 12, building = 17 + random() * (sector ? 54 : 91);
                    const y = 151 - building, w = 12 + random() * 16;
                    ctx.fillStyle = light ? '#576886' : i % 2 ? '#141933' : '#191d3a';
                    ctx.fillRect(x, y, w, building + 20);
                    if (sector && i % 4 === 0) line(ctx, [[x, y + 10], [x + 13, y - 20], [x + 35, y - 20]], '#55658b', 2);
                    withWindows(ctx, x, y, w, building, random, colors);
                }
            }
            const bank = ctx.createLinearGradient(0, 133, 0, H);
            bank.addColorStop(0, light ? '#697893' : '#202135');
            bank.addColorStop(.37, light ? '#4d647e' : '#141b2c');
            bank.addColorStop(1, light ? '#2d465e' : '#0a1423');
            ctx.fillStyle = bank; ctx.fillRect(0, 145, W, H);
        }
        project(game, base, distance) {
            const ahead = distance - game.distance;
            const sample = roadAt(game.level, distance);
            const near = 19 / Math.max(14, 21 + ahead);
            const center = sample.x - base.x - base.heading * ahead - game.x * .43;
            return { x: W / 2 + center * SCALE * near, y: HORIZON + near * 309,
                zoom: SCALE * near, near, distance, ahead };
        }
        road(ctx, game, base, light) {
            const sector = sectors[game.level.sector], wet = sector.rain, samples = [];
            const first = Math.max(0, Math.floor(game.distance / 7) * 7);
            for (let z = first - 3; z <= game.distance + VANISH; z += 7) {
                if (z < game.distance - 6) continue;
                samples.push(this.project(game, base, z));
            }
            // Fill the foreground even when the nearest world marker is in front of the bumper.
            if (samples[0].ahead > -6) samples.unshift(this.project(game, base, game.distance - 6));
            for (let i = samples.length - 2; i >= 0; i--) {
                const a = samples[i], b = samples[i + 1];
                const index = Math.floor(b.distance / 7), covered = tunnelAt(game.level, b.distance);
                const surface = covered ? (index % 2 ? '#242a3e' : '#252b41') :
                    light ? index % 2 ? '#354458' : '#37465a' : index % 2 ? '#21283e' : '#242b40';
                band(ctx, a, b, -ROAD_HALF - 1.05, ROAD_HALF + 1.05, covered ? '#131d32' : '#17283c');
                band(ctx, a, b, -ROAD_HALF, ROAD_HALF, surface);
                for (const side of [-1, 1]) {
                    const tint = side < 0 ? sector.accent : sector.light;
                    band(ctx, a, b, side * (ROAD_HALF - 1.18), side * (ROAD_HALF - .25), fog(tint, .09 * wet));
                    band(ctx, a, b, side * (ROAD_HALF - .18), side * (ROAD_HALF + .05), fog(tint, .74));
                    band(ctx, a, b, side * (ROAD_HALF + .12), side * (ROAD_HALF + .49), index % 4 < 2 ? '#93adc4' : '#344560');
                }
                if (index % 5 < 2) {
                    for (const x of [-2.1, 2.1]) band(ctx, a, b, x - .045, x + .045, '#accde1af');
                }
                if (index % 7 >= 4) {
                    const x = Math.sin(index * 3.11) * 3.1, width = .12 + (index % 5) * .10;
                    band(ctx, a, b, x, x + width, fog(index % 2 ? sector.accent : sector.light, .13 * wet));
                    band(ctx, a, b, -x, -x + .05, '#a2caff18');
                }
            }
        }
        furniture(ctx, game, base) {
            const { level, distance } = game, sector = sectors[level.sector];
            const start = Math.ceil((distance + VANISH) / 56) * 56;
            for (let z = start; z >= distance; z -= 56) {
                if (tunnelAt(level, z)) continue;
                const p = this.project(game, base, z), index = Math.floor(z / 56), height = 2.9 * p.zoom;
                const random = rng(index + level.id * 238);
                for (const s of [-1, 1]) {
                    const x = p.x + s * p.zoom * (ROAD_HALF + 1.6);
                    const color = s === -1 ? sector.accent : sector.light;
                    line(ctx, [[x, p.y], [x, p.y - height], [x - s * p.zoom * .78, p.y - height - .7]], '#344a66', Math.max(1, p.zoom * .065));
                    line(ctx, [[x - s * p.zoom * .89, p.y - height], [x - s * p.zoom * .4, p.y - height]], color, Math.max(.75, p.zoom * .1));
                    if (index % 3 === 2) {
                        const hx = x + s * p.zoom * (1.75 + random() * 2), hy = p.y - p.zoom * 1.8;
                        ctx.fillStyle = '#172744'; ctx.fillRect(hx - p.zoom * .83, hy, p.zoom * 1.66, p.zoom * .9);
                        ctx.strokeStyle = fog(color, .7); ctx.strokeRect(hx - p.zoom * .83, hy, p.zoom * 1.66, p.zoom * .9);
                        line(ctx, [[hx - p.zoom * .37, hy + p.zoom * .3], [hx, hy + p.zoom * .58],
                            [hx + p.zoom * .37, hy + p.zoom * .3]], color, Math.max(.7, p.zoom * .10));
                    }
                }
            }
        }
        tunnels(ctx, game, base, reduced) {
            const sector = sectors[game.level.sector];
            for (const [entry, exit] of game.level.tunnels.slice().reverse()) {
                const far = Math.min(exit, game.distance + VANISH), near = Math.max(entry, game.distance - 4);
                if (far < near) continue;
                const ceiling = p => p.y - 6.65 * p.zoom;
                const a = this.project(game, base, near), b = this.project(game, base, far);
                const topLeft = p => p.x - ROAD_HALF * .81 * p.zoom;
                const topRight = p => p.x + ROAD_HALF * .81 * p.zoom;
                const roof = ctx.createLinearGradient(0, Math.min(ceiling(a), ceiling(b)), 0,
                    Math.max(ceiling(a), ceiling(b)) + 1);
                roof.addColorStop(0, '#0c1024dc'); roof.addColorStop(1, '#1a234589');
                poly(ctx, [[topLeft(a), ceiling(a)], [topLeft(b), ceiling(b)], [topRight(b), ceiling(b)],
                    [topRight(a), ceiling(a)]], roof);
                if (game.distance >= entry && game.distance <= exit) {
                    poly(ctx, [[0, 0], [W, 0], [topRight(a), ceiling(a)], [topLeft(a), ceiling(a)]], '#0d132ac9');
                }
                for (const side of [-1, 1]) poly(ctx, [
                    [a.x + side * ROAD_HALF * a.zoom, a.y], [b.x + side * ROAD_HALF * b.zoom, b.y],
                    [b.x + side * ROAD_HALF * .81 * b.zoom, ceiling(b)],
                    [a.x + side * ROAD_HALF * .81 * a.zoom, ceiling(a)]
                ], '#131d32a0');
                const stride = 15;
                for (let z = entry + Math.floor((far - entry) / stride) * stride; z >= near; z -= stride) {
                    const p = this.project(game, base, z), index = Math.round((z - entry) / stride);
                    const side = (ROAD_HALF + .18) * p.zoom;
                    const top = ceiling(p), lightColor = index % 2 ? sector.accent : sector.light;
                    const glow = reduced ? .68 : .58 + .30 * (1 - Math.min(1, p.ahead / 155));
                    const points = [[p.x - side, p.y], [p.x - side, top + 1.03 * p.zoom], [p.x - side * .80, top],
                        [p.x + side * .8, top], [p.x + side, top + 1.03 * p.zoom], [p.x + side, p.y]];
                    line(ctx, points, '#1c2e4a', Math.max(1.2, p.zoom * .22));
                    line(ctx, points.slice(1, 5), fog(lightColor, .19), Math.max(1.8, p.zoom * .22));
                    line(ctx, points.slice(1, 5), fog(lightColor, glow), Math.max(.75, p.zoom * .065));
                    for (const sign of [-1, 1]) this.reflection(ctx, p.x + side * sign * .83, p.y - .08 * p.zoom,
                        p.zoom * .58, p.zoom * .37, lightColor, .18);
                }
            }
        }
        reflection(ctx, x, y, w, h, color, opacity) {
            if (h < 1) return;
            const shine = ctx.createLinearGradient(x, y, x, y + h);
            shine.addColorStop(0, fog(color, opacity)); shine.addColorStop(.40, fog(color, opacity * .55));
            shine.addColorStop(1, fog(color, 0));
            poly(ctx, [[x - w * .5, y], [x + w * .5, y], [x + w * .73, y + h], [x - w * .65, y + h]], shine);
        }
        vehicle(ctx, x, y, scale, type, color, { player = false, nitro = false, brake = false, signal = 0 } = {}) {
            const truck = type === 'truck', w = scale * (truck ? 2.36 : 1.96);
            const body = scale * (truck ? 1.43 : .8), tail = brake ? '#ff344f' : '#ff6479';
            for (const dir of [-1, 1]) this.reflection(ctx, x + dir * w * .32, y + 1, w * .48, scale * 1.12, tail, .48);
            ctx.fillStyle = '#060b19bc'; ctx.fillRect(x - w * .55, y - body * .23, w * 1.1, body * .30);
            const sheen = ctx.createLinearGradient(x, y - body, x, y);
            sheen.addColorStop(0, color); sheen.addColorStop(.36, '#34435e'); sheen.addColorStop(1, '#1c2442');
            if (truck) {
                poly(ctx, [[x - w * .5, y - body], [x + w * .5, y - body], [x + w * .49, y - body * .12],
                    [x - w * .49, y - body * .12]], sheen, color, Math.max(.7, scale * .033));
                line(ctx, [[x, y - body * .92], [x, y - body * .16]], '#0c1527', Math.max(.6, scale * .027));
                for (let i = 1; i < 5; i++) line(ctx, [[x - w * .44, y - body * i / 5], [x + w * .44, y - body * i / 5]], '#1b263e99', Math.max(.4, scale * .025));
            } else {
                poly(ctx, [[x - w * .49, y - body * .11], [x - w * .51, y - body * .62], [x - w * .32, y - body * .73],
                    [x - w * .23, y - body * 1.53], [x + w * .22, y - body * 1.53], [x + w * .34, y - body * .73],
                    [x + w * .51, y - body * .62], [x + w * .49, y - body * .11]],
                    sheen, color, Math.max(.65, scale * (player ? .054 : .032)));
                poly(ctx, [[x - w * .31, y - body * .71], [x - w * .20, y - body * 1.38],
                    [x + w * .19, y - body * 1.38], [x + w * .31, y - body * .71]], '#101b36', fog(color, .4), 1);
                line(ctx, [[x - w * .43, y - body * .64], [x + w * .43, y - body * .64]], fog(color, .8), Math.max(.7, scale * .025));
            }
            for (const dir of [-1, 1]) {
                ctx.fillStyle = tail;
                ctx.fillRect(x + dir * w * .34 - w * .11, y - body * .41, w * .22, Math.max(1, scale * .083));
                ctx.fillStyle = '#ffc3df';
                ctx.fillRect(x + dir * w * .34 - w * .07, y - body * .40, w * .14, Math.max(.6, scale * .022));
            }
            if (signal) {
                ctx.fillStyle = '#ffe28c';
                ctx.fillRect(x + signal * w * .44 - w * .09, y - body * .58, w * .18, Math.max(1, scale * .095));
            }
            if (nitro) {
                for (const sign of [-1, 1]) {
                    const xx = x + sign * w * .24, exhaust = ctx.createLinearGradient(xx, y - 5, xx, y + scale * .96);
                    exhaust.addColorStop(0, '#f2ffff'); exhaust.addColorStop(.28, '#69dfff'); exhaust.addColorStop(1, '#9075ff00');
                    poly(ctx, [[xx - w * .065, y - 5], [xx + w * .065, y - 5], [xx + w * .02, y + scale * .93]], exhaust);
                }
            }
        }
        scenery(ctx, game, base, reduced) {
            const visible = game.objects.filter(o => o.z > game.distance + 1 && o.z < game.distance + VANISH)
                .sort((a, b) => b.z - a.z);
            for (const obj of visible) {
                const p = this.project(game, base, obj.z), x = p.x + obj.x * p.zoom, y = p.y;
                const s = p.zoom;
                if (obj.type === 'car' || obj.type === 'truck') {
                    this.vehicle(ctx, x, y, s, obj.type, paint[obj.color % paint.length], {
                        signal: reduced || Math.floor(game.time * 7) % 2 ? obj.signal : 0
                    });
                } else if (obj.type === 'barrier') {
                    const width = s * 2.62, h = s * .61;
                    this.reflection(ctx, x, y, width * .95, h * .93, '#ff9f55', .34);
                    ctx.fillStyle = '#432b42'; ctx.fillRect(x - width / 2, y - h, width, h);
                    for (let i = 0; i < 5; i++) {
                        const xx = x - width / 2 + i * width / 5;
                        poly(ctx, [[xx, y - h], [xx + width * .12, y - h], [xx + width * .19, y], [xx + width * .07, y]], '#ffb06d');
                    }
                    ctx.strokeStyle = '#ffe0b9'; ctx.lineWidth = Math.max(.7, s * .04);
                    ctx.strokeRect(x - width / 2, y - h, width, h);
                } else if (obj.type === 'cell') {
                    const r = s * .49, h = reduced ? 0 : Math.sin(game.time * 3 + obj.id) * r * .23;
                    this.reflection(ctx, x, y, r * 2, r * 1.2, '#81ffdf', .38);
                    poly(ctx, [[x, y - r * 2.2 + h], [x + r, y - r * 1.2 + h], [x, y - r * .15 + h], [x - r, y - r * 1.2 + h]],
                        '#296965', '#aaffea', Math.max(.8, s * .058));
                    line(ctx, [[x + r * .33, y - r * 1.7 + h], [x - r * .24, y - r * 1.13 + h], [x + r * .21, y - r * 1.13 + h],
                        [x - r * .21, y - r * .64 + h]], '#dbfff6', Math.max(.8, r * .12));
                }
            }
            const left = game.level.length - game.distance;
            if (left < VANISH && left >= 0) {
                const p = this.project(game, base, game.level.length), s = p.zoom, span = s * ROAD_HALF;
                line(ctx, [[p.x - span, p.y], [p.x - span, p.y - s * 3.4], [p.x + span, p.y - s * 3.4],
                    [p.x + span, p.y]], '#98fff4', Math.max(1, s * .11));
                for (let i = 0; i < 12; i++) {
                    ctx.fillStyle = i % 2 ? '#0d2336' : '#b8fff6';
                    ctx.fillRect(p.x - span + 2 * span * i / 12, p.y - s * 3.45, 2 * span / 12, Math.max(3, s * .30));
                }
                if (left < 225) {
                    ctx.font = '700 ' + Math.max(9, s * .45) + 'px system-ui';
                    ctx.fillStyle = '#e7fffd'; ctx.textAlign = 'center'; ctx.fillText('終點', p.x, p.y - s * 3.67);
                }
            }
        }
        // Speed streaks along both screen edges grow with speed even without nitro.
        speedLines(ctx, game) {
            const amount = Math.max(0, (game.speed - 30) / 45);
            if (amount <= 0) return;
            ctx.beginPath();
            for (let i = 0; i < 22; i++) {
                const s = i % 2 ? -1 : 1, f = (game.distance * .041 + i * .2713) % 1, lane = .62 + (i % 5) * .09;
                const x = W / 2 + s * W * lane * (.35 + f * .75), y = HORIZON + 40 + f * (H - HORIZON);
                ctx.moveTo(x, y); ctx.lineTo(x + s * (14 + f * 60) * amount, y + (6 + f * 26) * amount);
            }
            ctx.lineWidth = 1.2; ctx.strokeStyle = fog('#d8f2ff', Math.min(.45, amount * .35)); ctx.stroke();
        }
        atmosphere(ctx, game, reduced) {
            if (reduced) return;
            this.speedLines(ctx, game);
            const covered = game.inTunnel;
            if (!covered) {
                const { rain } = sectors[game.level.sector];
                const strength = .45 + game.speed / 106;
                ctx.beginPath();
                for (const item of this.rain) {
                    const y = (item.y + game.time * item.v + game.distance * .45) % H, x = (item.x + y * .10) % W;
                    ctx.moveTo(x, y); ctx.lineTo(x - 2.5, y + item.h * strength);
                }
                ctx.strokeStyle = fog('#b4dbff', .25 * rain);
                ctx.lineWidth = .80; ctx.stroke();
            }
            if (game.boosting) {
                ctx.beginPath();
                for (let i = 0; i < 16; i++) {
                    const s = i % 2 ? -1 : 1, f = (game.distance * .058 + i * .3791) % 1;
                    const x = W / 2 + s * (108 + f * 259), y = 180 + f * 253;
                    ctx.moveTo(x, y); ctx.lineTo(x + s * (9 + f * 31), y + 3 + f * 16);
                }
                ctx.lineWidth = 1.45; ctx.strokeStyle = '#9bdeff8a'; ctx.stroke();
            }
        }
        draw(game, { theme = 'dark', reduced = false } = {}) {
            const ctx = this.ctx, light = theme === 'light', sector = sectors[game.level.sector];
            const now = globalThis.performance?.now?.() ?? 0, dt = this.last ? Math.min(.1, Math.max(0, (now - this.last) / 1000)) : 0; this.last = now;
            this.fx?.setReduced(reduced); this.fx?.update(dt);
            if (game.boosting && !this.wasBoosting && !this.fx) this.kick = 1;
            this.wasBoosting = game.boosting;
            this.kick = Math.max(0, this.kick - dt * 1.6);
            this.ratio = globalThis.CashArcadeFX?.fitCanvas(this.canvas, W, H) ?? 1;
            ctx.setTransform?.(this.ratio, 0, 0, this.ratio, 0, 0);
            this.background(game.level.sector, light);
            ctx.drawImage(this.sky, 0, 0, W, H);
            ctx.save(); this.fx?.apply(ctx);
            // Nitro punches the camera forward toward the vanishing point, then eases back.
            const push = reduced ? 0 : Math.sin(Math.min(1, this.kick) * Math.PI) * .045 + (game.boosting ? .02 : 0);
            if (push) { ctx.translate(W / 2, HORIZON); ctx.scale(1 + push, 1 + push); ctx.translate(-W / 2, -HORIZON); }
            const base = roadAt(game.level, game.distance);
            this.road(ctx, game, base, light);
            this.furniture(ctx, game, base);
            this.tunnels(ctx, game, base, reduced);
            this.scenery(ctx, game, base, reduced);
            const p = this.project(game, base, game.distance);
            // High speed adds a fine engine vibration to the player car.
            const rumble = reduced ? 0 : Math.max(0, game.speed - 30) * .03 * Math.sin(game.time * 63);
            this.vehicle(ctx, p.x + game.x * p.zoom, p.y + rumble, p.zoom * 1.08, 'car', sector.accent, {
                player: true, nitro: game.boosting, brake: game.braking
            });
            this.atmosphere(ctx, game, reduced);
            const shade = ctx.createRadialGradient(W / 2, H * .57, 200, W / 2, H * .57, 448);
            shade.addColorStop(0, '#06091300'); shade.addColorStop(1, '#06091380');
            ctx.fillStyle = shade; ctx.fillRect(-30, -30, W + 60, H + 60);
            this.fx?.draw(ctx, W, H);
            ctx.restore();
            if (!light) globalThis.CashArcadeFX?.crt(ctx, W, H, .05);
        }
    }
    function withWindows(ctx, x, y, w, h, random, colors) {
        for (let floor = 7; floor < h - 6; floor += 10) {
            ctx.fillStyle = fog(random() > .42 ? colors.accent : colors.light, .22 + random() * .39);
            ctx.fillRect(x + 3, y + floor, w * .28, 2);
        }
    }
    globalThis.AuroraRenderer = Object.freeze({ Renderer, W, H });
})();
