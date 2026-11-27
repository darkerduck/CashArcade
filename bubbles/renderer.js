(() => {
    'use strict';
    const { W, H, R, ORIGIN, LEFT, RIGHT, TOP, ROW, LINE, position } = Lightbubble;
    const { colors, tools } = LightbubbleLevels;
    const PI2 = Math.PI * 2;
    const palettes = ['#38b8ac', '#4388d8', '#aa6af2'];
    function line(ctx, points, color, width = 1) {
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (const p of points.slice(1)) ctx.lineTo(p.x, p.y);
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.stroke();
    }
    function circle(ctx, x, y, r, fill, stroke, width = 1) {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, PI2);
        if (fill) { ctx.fillStyle = fill; ctx.fill(); }
        if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(); }
    }
    function polygon(ctx, points, fill, stroke, width = 1) {
        ctx.beginPath();
        ctx.moveTo(...points[0]);
        for (const p of points.slice(1)) ctx.lineTo(...p);
        ctx.closePath();
        if (fill) { ctx.fillStyle = fill; ctx.fill(); }
        if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(); }
    }
    function pattern(ctx, type) {
        const kind = colors[type].pattern, ink = '#f4fdff';
        if (kind === 'ring') circle(ctx, 0, 1, 5, null, ink, 1.8);
        if (kind === 'diamond') polygon(ctx, [[0, -5], [5, 1], [0, 7], [-5, 1]], null, ink, 1.8);
        if (kind === 'triangle') polygon(ctx, [[0, -5], [6, 6], [-6, 6]], null, ink, 1.8);
        if (kind === 'cross') {
            line(ctx, [{ x: -5, y: 1 }, { x: 5, y: 1 }], ink, 1.8);
            line(ctx, [{ x: 0, y: -4 }, { x: 0, y: 6 }], ink, 1.8);
        }
        if (kind === 'lines') {
            for (const y of [-3, 2, 7]) line(ctx, [{ x: -5, y }, { x: 5, y }], ink, 1.65);
        }
    }
    function drawBubble(ctx, x, y, type, hp = 2, radius = R) {
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(radius / R, radius / R);
        if (colors[type]) {
            const color = colors[type], glow = ctx.createRadialGradient(-6, -7, 1, 1, 3, 23);
            glow.addColorStop(0, color.bright);
            glow.addColorStop(.35, color.dim);
            glow.addColorStop(.78, '#10172d');
            glow.addColorStop(1, color.bright);
            circle(ctx, 0, 0, R - 0.8, glow, color.bright, 1.45);
            circle(ctx, -5.6, -8.5, 2.4, '#ffffffc0');
            pattern(ctx, type);
        } else if (type === 'X') {
            const bright = hp === 1 ? '#f0a1ff' : '#baa5ff';
            polygon(ctx, [[0, -17], [13, -11], [16, 3], [6, 16], [-11, 12], [-16, -1], [-10, -12]],
                '#463478', bright, 2);
            polygon(ctx, [[0, -14], [10, 0], [3, 12], [-10, 3]], '#7964a8', '#dacbff');
            if (hp === 1) line(ctx, [{ x: -9, y: -9 }, { x: -2, y: -1 }, { x: -4, y: 3 }, { x: 5, y: 11 }], '#ffe1fd', 2);
        } else if (type === 'L') {
            circle(ctx, 0, 0, 16.7, '#593c32', '#ffdf84', 2);
            polygon(ctx, [[0, -10], [3, -3], [10, 0], [3, 3], [0, 10], [-3, 3], [-10, 0], [-3, -3]], '#ffeaa0', '#fff6cb');
            circle(ctx, 0, 0, 2.5, '#ffffff');
        } else if (tools[type]) {
            const bright = { rainbow: '#ffabeb', pulse: '#ffcf7b', drill: '#8ffafa' }[type];
            circle(ctx, 0, 0, 17, '#1e274c', bright, 2);
            if (type === 'rainbow') {
                ['#ff7ccb', '#ffdc78', '#81f092', '#63e8ff'].forEach((color, i) => {
                    ctx.beginPath(); ctx.arc(0, 0, 13, i * Math.PI / 2, (i + .97) * Math.PI / 2);
                    ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke();
                });
            }
            ctx.fillStyle = bright;
            ctx.font = 'bold 21px system-ui';
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(tools[type].glyph, 0, 0);
        }
        ctx.restore();
    }
    class Renderer {
        constructor(canvas) {
            this.canvas = canvas;
            this.ctx = canvas.getContext('2d', { alpha: false });
            this.back = document.createElement('canvas');
            this.back.width = W; this.back.height = H;
            this.fx = globalThis.CashArcadeFX?.createFx({ maxParticles: 260, maxShake: 8 }) ?? null;
            this.ratio = 1;
            this.reduced = false;
            this.reset();
        }
        reset() {
            this.parts = []; this.rings = []; this.offset = 0; this.badge = null;
            this.pops = []; this.clock = 0; this.cheer = 0; this.recoil = 0; this.flinch = 0; this.fx?.clear();
        }
        // True while any transient animation still needs frames; the idle mascot is handled by the page loop.
        get busy() { return Boolean(this.offset || this.badge || this.parts.length || this.rings.length || this.pops.length || this.cheer > 0 || this.recoil > 0 || this.fx?.busy); }
        background(sector, light) {
            const token = sector + ':' + light + ':' + this.ratio;
            if (this.key === token) return;
            this.key = token;
            this.back.width = Math.round(W * this.ratio); this.back.height = Math.round(H * this.ratio);
            const ctx = this.back.getContext('2d'), accent = palettes[sector];
            ctx.setTransform?.(this.ratio, 0, 0, this.ratio, 0, 0);
            const bloom = ctx.createRadialGradient(W * .52, H * .40, 24, W * .52, H * .40, 320);
            bloom.addColorStop(0, light ? ['#d9fbf1', '#dcefff', '#ebddff'][sector] : ['#143744', '#182c55', '#32204f'][sector]);
            bloom.addColorStop(1, light ? '#f4f8ff' : '#080f24');
            ctx.fillStyle = bloom; ctx.fillRect(0, 0, W, H);
            for (let i = 0; i < 65; i++) {
                const x = ((i * 127.37 + i * i * 2.61) % W), y = ((i * 61.7 + i * i * .75) % H);
                circle(ctx, x, y, i % 9 === 0 ? 1.8 : .8, light ? '#45648440' : '#b9d8ff66');
            }
            ctx.save();
            ctx.strokeStyle = accent + (light ? '37' : '59');
            if (sector === 0) {
                for (const side of [0, W]) {
                    ctx.save(); ctx.translate(side, 0); if (side) ctx.scale(-1, 1);
                    for (let row = 0; row < 5; row++) {
                        ctx.beginPath(); ctx.moveTo(0, 190 + row * 61);
                        ctx.bezierCurveTo(76, 175 + row * 61, 23, 225 + row * 61, 0, 246 + row * 61); ctx.stroke();
                    }
                    ctx.restore();
                }
            } else if (sector === 1) {
                ctx.setLineDash([4, 7]);
                for (let i = 0; i < 7; i++) {
                    ctx.beginPath(); ctx.moveTo(0, 115 + i * 48);
                    ctx.bezierCurveTo(125, 52 + i * 48, 269, 203 + i * 48, W, 123 + i * 48); ctx.stroke();
                }
            } else {
                for (let i = 0; i < 6; i++) {
                    const x = i * 72;
                    polygon(ctx, [[x, 194], [x + 33, 245], [x + 17, 430], [x - 13, 326]], null, accent + '54');
                }
            }
            ctx.restore();
            const base = ctx.createLinearGradient(0, LINE - 40, 0, H);
            base.addColorStop(0, light ? '#d5e2f100' : '#070d2300');
            base.addColorStop(1, light ? '#dfe9fa' : '#090e22');
            ctx.fillStyle = base; ctx.fillRect(0, LINE - 40, W, H - LINE + 40);
            line(ctx, [{ x: LEFT - R, y: TOP - 23 }, { x: LEFT - R, y: LINE + 16 }], accent + 'b0', 2);
            line(ctx, [{ x: RIGHT + R, y: TOP - 23 }, { x: RIGHT + R, y: LINE + 16 }], accent + 'b0', 2);
        }
        // A popped bubble swells, flashes and bursts; chains pop one after another instead of vanishing at once.
        burstBubble(b, falling) {
            const color = colors[b.type]?.bright ?? '#ffe495';
            if (this.rings.length < 45) this.rings.push({ x: b.x, y: b.y, radius: R * .6, life: .32, color });
            if (this.reduced) return;
            if (falling) { if (this.parts.length < 230) this.parts.push({ ...b, falling: true, vx: Math.sin(b.x * 6.2) * 58, vy: 20, life: 1.5 }); return; }
            for (let i = 0; i < 5 && this.parts.length < 230; i++) {
                const angle = i * PI2 / 5 + b.x * .15, speed = 45 + i * 15;
                this.parts.push({ x: b.x, y: b.y, color, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 55,
                    life: .5 + i * .075, size: 1.3 + i * .45 });
            }
            this.fx?.burst(b.x, b.y, { kind: 'shard', color, count: 3, speed: 150, life: .4, gravity: 260 });
        }
        consume(events) {
            for (const event of events) {
                if (event.type === 'descend') {
                    this.offset = this.reduced ? 0 : -ROW; this.flinch = 1;
                    this.fx?.shake(.45); this.fx?.flash('#ff6f8e', .12, .25); continue;
                }
                if (event.type === 'launch') this.recoil = 1;
                if (event.type === 'won') { this.cheer = 2; this.fx?.burst(W / 2, H * .35, { color: '#ffe495', count: 40, speed: 320, life: 1, gravity: 240 }); }
                if (event.type === 'lost') { this.flinch = 1; this.fx?.shake(.6); this.fx?.flash('#ff6f8e', .25, .4); }
                if (event.type === 'bounce' || event.type === 'pulse' || event.type === 'drill' || event.type === 'crack') {
                    if (this.rings.length < 20) this.rings.push({ x: event.x, y: event.y,
                        radius: event.type === 'bounce' ? 3 : 9, life: .33, color: '#9df5ff' });
                }
                if (!event.bubbles) continue;
                const count = event.bubbles.length, falling = event.type === 'drop';
                if (count >= 7) this.badge = { seconds: 1.05, count, drop: falling };
                // Pop order follows distance from the impact so the chain visibly ripples outward.
                const first = event.bubbles[0], sorted = event.bubbles.slice().sort((a, b) => Math.hypot(a.x - first.x, a.y - first.y) - Math.hypot(b.x - first.x, b.y - first.y));
                sorted.forEach((b, i) => {
                    if (this.reduced) { this.burstBubble(b, falling); return; }
                    this.pops.push({ ...b, falling, delay: Math.min(.32, i * (falling ? .02 : .035)), age: 0 });
                });
                if (this.pops.length > 80) this.pops.splice(0, this.pops.length - 80).forEach(b => this.burstBubble(b, b.falling));
                const cx = sorted.reduce((sum, b) => sum + b.x, 0) / count, cy = sorted.reduce((sum, b) => sum + b.y, 0) / count;
                if (this.fx) {
                    if (event.combo > 1) this.fx.popup(cx, cy - 18, 'CHAIN ×' + event.combo, { color: '#ffe495', size: 15 });
                    else if (count >= 4) this.fx.popup(cx, cy - 12, (falling ? 'FALL ×' : 'POP ×') + count, { color: '#bff8ff', size: 13 });
                    if (count >= 7 || falling) { this.fx.shake(Math.min(.5, .15 + count * .02)); this.fx.flash('#ffffff', .07, .15); }
                }
                if (count >= 6 || falling) this.cheer = Math.max(this.cheer, 1.2);
            }
        }
        update(dt) {
            this.clock += dt; this.cheer = Math.max(0, this.cheer - dt); this.recoil = Math.max(0, this.recoil - dt * 5); this.flinch = Math.max(0, this.flinch - dt * 1.5);
            this.fx?.setReduced(this.reduced); this.fx?.update(dt);
            for (const pop of this.pops) { pop.age += dt; if (pop.age >= pop.delay + .1 && !pop.done) { pop.done = true; this.burstBubble(pop, pop.falling); } }
            this.pops = this.pops.filter(pop => !pop.done);
            this.offset = Math.min(0, this.offset + 175 * dt);
            for (const p of this.parts) {
                p.x += p.vx * dt; p.y += p.vy * dt;
                p.vy += (p.falling ? 485 : 145) * dt;
                p.life -= dt;
            }
            for (const ring of this.rings) { ring.radius += 49 * dt; ring.life -= dt; }
            this.parts = this.parts.filter(p => p.life > 0 && p.y < H + 35);
            this.rings = this.rings.filter(ring => ring.life > 0);
            if (this.badge && (this.badge.seconds -= dt) <= 0) this.badge = null;
        }
        lumi(ctx, light, angle = 0, worried = false) {
            const t = this.reduced ? 0 : this.clock, cheer = this.reduced ? 0 : this.cheer;
            const hop = cheer > 0 ? -Math.abs(Math.sin(t * 11)) * 9 : Math.sin(t * 2.2) * 1.6;
            const shake = this.flinch > 0 && !this.reduced ? Math.sin(t * 60) * 2 * this.flinch : 0;
            ctx.save();
            ctx.translate(71 + shake, 491 + hop);
            // Soft glow puddle under the robot.
            ctx.globalAlpha = .25; circle(ctx, 0, 30 - hop, 20, light ? '#7cc8c0' : '#3fe0d0'); ctx.globalAlpha = 1;
            const wave = cheer > 0 ? Math.sin(t * 16) * .5 : Math.sin(t * 3) * .08;
            ctx.save(); ctx.rotate(-wave);
            line(ctx, [{ x: -6, y: -22 }, { x: -12, y: -32 }, { x: -17, y: -35 }], '#85e6bd', 2.2);
            line(ctx, [{ x: 8, y: -21 }, { x: 12, y: -31 }, { x: 18, y: -32 }], '#85e6bd', 2.2);
            polygon(ctx, [[-17, -35], [-22, -37], [-20, -30]], '#adffbc');
            polygon(ctx, [[18, -32], [23, -35], [21, -28]], '#90f6cc');
            ctx.restore();
            if (!this.reduced) { ctx.globalAlpha = .5 + .5 * Math.sin(t * 5); circle(ctx, -17, -35, 2.4, '#ffffff'); circle(ctx, 18, -32, 2.4, '#ffffff'); ctx.globalAlpha = 1; }
            polygon(ctx, [[-17, 18], [-12, 5], [11, 5], [17, 19], [14, 26], [-14, 26]], '#6576a0', '#c4e6fc');
            polygon(ctx, [[-26, -13], [-15, -23], [17, -23], [27, -13], [27, 6], [16, 16], [-16, 16], [-26, 6]],
                light ? '#dae6ef' : '#c3dfed', '#6adece', 2);
            polygon(ctx, [[-20, -10], [-13, -16], [15, -16], [22, -9], [22, 4], [15, 10], [-13, 10], [-20, 4]],
                '#101b36', '#7fd2ec');
            // Eyes track the aim, blink every few seconds, squint happily on big chains and shrink when worried.
            const look = Math.sin(angle) * 3, blink = !this.reduced && (t % 3.7) < .12;
            ctx.fillStyle = worried ? '#ffb0bd' : '#7ef6ff';
            if (cheer > 0) {
                line(ctx, [{ x: -11, y: -1 }, { x: -7, y: -5 }, { x: -3, y: -1 }], '#7ef6ff', 2);
                line(ctx, [{ x: 4, y: -1 }, { x: 8, y: -5 }, { x: 12, y: -1 }], '#7ef6ff', 2);
            } else if (blink) { ctx.fillRect(-9 + look, -2, 4, 2); ctx.fillRect(6 + look, -2, 4, 2); }
            else if (worried) { ctx.fillRect(-8 + look, -4, 3, 5); ctx.fillRect(7 + look, -4, 3, 5); }
            else { ctx.fillRect(-9 + look, -6, 4, 8); ctx.fillRect(6 + look, -6, 4, 8); }
            if (worried && !this.reduced) polygon(ctx, [[22, -20], [25, -14], [22, -11], [19, -14]], '#9fe9ff');
            circle(ctx, -24, 6, 3.8, cheer > 0 ? '#ff9ad5' : '#ffcc76'); circle(ctx, 25, 6, 3.8, cheer > 0 ? '#ff9ad5' : '#ffcc76');
            ctx.restore();
        }
        draw(game, { angle = 0, guide = true, theme = 'dark', cancel = false, dragging = false } = {}) {
            const ctx = this.ctx, light = theme === 'light';
            const accent = light ? '#126278' : '#7df6ff';
            this.ratio = globalThis.CashArcadeFX?.fitCanvas(this.canvas, W, H) ?? 1;
            ctx.setTransform?.(this.ratio, 0, 0, this.ratio, 0, 0);
            this.background(game.level.sector, light);
            ctx.drawImage(this.back, 0, 0, W, H);
            ctx.save(); this.fx?.apply(ctx);
            const dropOffset = this.reduced ? 0 : this.offset;
            const rail = TOP + game.descent * ROW - R - 4 + dropOffset;
            ctx.fillStyle = light ? '#8bb4bc' : '#254767';
            ctx.fillRect(7, rail - 6, W - 14, 6);
            line(ctx, [{ x: 8, y: rail }, { x: W - 8, y: rail }], accent, 1.5);
            ctx.setLineDash([5, 5]);
            line(ctx, [{ x: 6, y: LINE }, { x: W - 6, y: LINE }], light ? '#9f3a4f' : '#ff9aa882');
            ctx.setLineDash([]);
            if (guide && !cancel && !dropOffset && game.mode === 'ready') {
                const route = game.preview(angle);
                ctx.setLineDash([2.5, 6]);
                line(ctx, route.points, dragging ? accent : accent + 'a0', 1.6);
                ctx.setLineDash([]);
                for (const p of route.points) {
                    if (p.bounce || p.pierce) circle(ctx, p.x, p.y, 4, light ? '#fff' : '#142538', accent, 1.5);
                }
                const target = game.loaded === 'pulse' || game.loaded === 'drill' ?
                    (route.hit ? position(route.hit.r, route.hit.c, game.descent) : route.cell) : route.cell;
                if (target) circle(ctx, target.x, target.y, R + 2, null, accent, 2);
            }
            for (const b of game.board.values()) {
                const p = position(b.r, b.c, game.descent);
                drawBubble(ctx, p.x, p.y + dropOffset, b.type, b.hp);
            }
            for (const pop of this.pops) {
                const k = Math.max(0, pop.age - pop.delay) / .1;
                ctx.globalAlpha = 1 - k * .6;
                drawBubble(ctx, pop.x, pop.y, pop.type, pop.hp, R * (1 + k * .35));
                if (k > 0) { ctx.globalAlpha = k * .8; circle(ctx, pop.x, pop.y, R * (1 + k * .35), '#ffffff'); }
                ctx.globalAlpha = 1;
            }
            for (const item of this.parts) {
                ctx.globalAlpha = Math.min(1, item.life * 1.9);
                if (item.falling) drawBubble(ctx, item.x, item.y, item.type, item.hp, 11);
                else {
                    line(ctx, [{ x: item.x, y: item.y }, { x: item.x - item.vx * .055, y: item.y - item.vy * .066 }], item.color, item.size);
                }
            }
            for (const ring of this.rings) {
                ctx.globalAlpha = Math.min(.75, ring.life * 2);
                circle(ctx, ring.x, ring.y, ring.radius, null, ring.color, 1.6);
            }
            ctx.globalAlpha = 1;
            this.lumi(ctx, light, angle, game.misses >= game.level.missLimit - 1);
            ctx.save();
            ctx.translate(ORIGIN.x, ORIGIN.y);
            ctx.rotate(angle);
            if (!this.reduced) ctx.translate(0, this.recoil * this.recoil * 6);
            polygon(ctx, [[-13, 7], [-12, -22], [-9, -30], [9, -30], [12, -22], [13, 7]], light ? '#bbcddd' : '#263757', accent, 2);
            ctx.restore();
            circle(ctx, ORIGIN.x, ORIGIN.y, 24, light ? '#c3d7eb' : '#13213a', accent, 2);
            if (game.mode === 'ready') drawBubble(ctx, ORIGIN.x, ORIGIN.y, game.loaded, 2, 16);
            if (game.projectile) drawBubble(ctx, game.projectile.x, game.projectile.y, game.projectile.type);
            drawBubble(ctx, W - 52, ORIGIN.y, game.next, 2, 13);
            ctx.font = '11px system-ui'; ctx.textAlign = 'center'; ctx.fillStyle = light ? '#133a58' : '#b1c7e5';
            ctx.fillText('下一顆', W - 52, ORIGIN.y + 27);
            if (dragging) {
                ctx.fillStyle = cancel ? (light ? '#ffb3bd' : '#6b3549') : (light ? '#d6e6f1' : '#182742');
                ctx.fillRect(0, 532, W, H - 532);
                ctx.fillStyle = cancel ? (light ? '#60192c' : '#fff0f3') : (light ? '#335879' : '#b2cdea');
                ctx.font = 'bold 13px system-ui';
                ctx.fillText(cancel ? '已取消瞄準，放手不會發射' : '拖到此處即可取消', W / 2, 553);
            }
            if (this.badge) {
                ctx.globalAlpha = Math.min(1, this.badge.seconds * 2);
                ctx.font = 'bold 17px system-ui'; ctx.fillStyle = light ? '#594196' : '#e5d5ff';
                ctx.fillText((this.badge.drop ? '能量瀑布 ×' : '同色消除 ×') + this.badge.count, W / 2, LINE + 24);
                ctx.globalAlpha = 1;
            }
            this.fx?.draw(ctx, W, H);
            ctx.restore();
            if (!light) globalThis.CashArcadeFX?.crt(ctx, W, H, .045);
        }
    }
    globalThis.LightbubbleRenderer = Object.freeze({ Renderer, drawBubble });
})();
