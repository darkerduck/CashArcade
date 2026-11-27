(() => {
    'use strict';
    const TAU = Math.PI * 2;
    // Circuit traces per sector: light pulses travel along these in the live layer.
    const TRACES = [
        [0, 1, 2, 3].map(n => { const y = 120 + n * 160; return [[20, y], [100, y], [145, y + 35], [575, y + 35], [620, y], [700, y]]; }),
        [155, 225, 285].map(r => Array.from({ length: 33 }, (_, i) => [360 + Math.cos(i / 32 * TAU) * r, 360 + Math.sin(i / 32 * TAU) * r])),
        Array.from({ length: 8 }, (_, i) => { const a = i * Math.PI / 4; return [[360 + Math.cos(a) * 105, 360 + Math.sin(a) * 105], [360 + Math.cos(a) * 310, 360 + Math.sin(a) * 310]]; }),
    ].map(set => set.map(points => {
        const lengths = [0];
        for (let i = 1; i < points.length; i++) lengths.push(lengths[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]));
        return { points, lengths, total: lengths.at(-1) };
    }));
    function along(trace, distance) {
        const d = ((distance % trace.total) + trace.total) % trace.total;
        let i = 1; while (i < trace.lengths.length - 1 && trace.lengths[i] < d) i++;
        const [a, b] = [trace.points[i - 1], trace.points[i]], span = trace.lengths[i] - trace.lengths[i - 1] || 1, t = (d - trace.lengths[i - 1]) / span;
        return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    }
    const outBack = t => { const x = Math.min(1, Math.max(0, t)) - 1; return 1 + 2.70158 * x ** 3 + 1.70158 * x ** 2; };

    class Renderer {
        constructor(canvas) {
            this.canvas = canvas; this.ctx = canvas.getContext('2d');
            const motion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
            this.fx = globalThis.CashArcadeFX?.createFx() ?? null;
            this.lowMotion = false; this.reduced = motion?.matches || false;
            motion?.addEventListener?.('change', e => { this.reduced = e.matches; if (e.matches) { this.ghosts = []; this.shake = 0; } });
            this.flashes = new Map(); this.born = new Map(); this.waveShown = 0; this.cache = null; this.cacheKey = '';
            this.reset(); this.resize();
        }
        get reduced() { return this.lowMotion; }
        set reduced(value) { this.lowMotion = Boolean(value); this.fx?.setReduced(this.lowMotion); }
        timeScale() { return this.fx?.timeScale() ?? 1; }
        resize() { const d = Math.min(2, globalThis.devicePixelRatio || 1); this.canvas.width = 720 * d; this.canvas.height = 720 * d; this.scale = d; this.cacheKey = ''; }
        reset() { this.time = 0; this.particles = []; this.arcs = []; this.rings = []; this.ghosts = []; this.shake = 0; this.flashes?.clear(); this.born?.clear(); this.fx?.clear(); this.waveShown = 0; }
        consume(events) {
            const fx = this.fx;
            for (const e of events) {
                if (e.type === 'arc') { this.arcs.push({ points: e.points, life: .16 }); if (this.arcs.length > 12) this.arcs.shift(); }
                if (e.type === 'ghost' && !this.reduced) { this.ghosts.push({ ...e, life: .28 }); if (this.ghosts.length > 40) this.ghosts.shift(); }
                if (e.type === 'hit' && e.id !== undefined) this.flashes.set(e.id, .08);
                if (['explode', 'shield', 'hurt', 'bossDown', 'kill'].includes(e.type)) {
                    const color = e.type === 'shield' ? '#5ceaff' : e.type === 'hurt' ? '#ff758c' : e.type === 'kill' ? '#ae82ff' : '#ffd46c';
                    this.rings.push({ ...e, color, life: e.type === 'bossDown' ? 1 : .42, total: e.type === 'bossDown' ? 1 : .42, radius: e.radius || (e.type === 'bossDown' ? 160 : 35) });
                    const count = this.reduced ? 4 : e.type === 'bossDown' ? 55 : e.type === 'explode' ? 22 : 9;
                    for (let i = 0; i < count && this.particles.length < 240; i++) {
                        const a = i * 2.39996 + this.time, v = 35 + (i % 7) * 26;
                        this.particles.push({ x: e.x, y: e.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: .35 + i % 5 * .12, color, size: e.type === 'bossDown' ? 8 : 2 + i % 3 });
                    }
                    if (!this.reduced && ['explode', 'hurt', 'bossDown'].includes(e.type)) this.shake = e.type === 'bossDown' ? 7 : 3;
                }
                if (!fx) continue;
                if (e.type === 'kill') {
                    const tint = { swarm: '#ff8a9e', charger: '#ff9f6e', shooter: '#ffb36b', guard: '#ffd46c', splitter: '#ff7ad1', shard: '#ff9fb8', boss: '#ffffff' }[e.kind] || '#ff9e9e';
                    fx.burst(e.x, e.y, { kind: 'shard', color: tint, count: e.kind === 'guard' ? 14 : 9, speed: 240, life: .6, size: 2.2 });
                    fx.burst(e.x, e.y, { kind: 'spark', color: '#fff0d8', count: 6, speed: 300, life: .3 });
                    if (e.points) fx.popup(e.x, e.y - 14, '+' + e.points, { color: tint, size: e.kind === 'guard' ? 17 : 14 });
                    fx.shake(e.kind === 'guard' ? .18 : .08);
                } else if (e.type === 'chain' && this.arcs.length) {
                    const last = this.arcs.at(-1).points, end = last.at(-1);
                    fx.popup(end.x, end.y - 30, `CHAIN ×${last.length - 1}`, { color: '#8ff6ff', size: 15 });
                    fx.hitStop(.03);
                } else if (e.type === 'explode') {
                    fx.burst(e.x, e.y, { kind: 'ring', color: '#ffd46c', size: (e.radius || 90) * 1.1, life: .45 }); fx.shake(.22);
                } else if (e.type === 'hurt') {
                    fx.flash('#ff3d63', .22, .22); fx.shake(.5); fx.hitStop(.07);
                } else if (e.type === 'dash') {
                    fx.burst(e.x, e.y, { kind: 'spark', color: '#b68cff', count: 10, speed: 220, life: .35, angle: e.angle + Math.PI, spread: 1.2 });
                } else if (e.type === 'boss') {
                    fx.banner('WARNING', 'BOSS SIGNAL DETECTED', { color: '#ff8466', duration: 1.6 }); fx.shake(.35);
                } else if (e.type === 'overload') {
                    fx.flash('#ff8466', .15, .25); fx.shake(.3);
                } else if (e.type === 'bossDown') {
                    fx.burst(e.x, e.y, { kind: 'shard', color: '#ffd46c', count: 40, speed: 400, life: 1.2 });
                    fx.burst(e.x, e.y, { kind: 'ring', color: '#ffffff', size: 360, life: 1 });
                    fx.flash('#ffffff', .4, .45); fx.shake(1); fx.hitStop(.12); fx.slowMotion(.8, .35);
                } else if (e.type === 'waveClear') {
                    fx.banner('WAVE CLEAR', '選擇強化模組', { color: '#ffd46c', duration: 1.1 });
                } else if (e.type === 'lost') {
                    fx.flash('#ffffff', .3, .4); fx.slowMotion(.8, .3);
                }
            }
            if (this.rings.length > 32) this.rings.splice(0, this.rings.length - 32);
        }
        update(dt) {
            this.time += dt; this.shake = Math.max(0, this.shake - dt * 18); this.fx?.update(dt);
            for (const list of [this.particles, this.arcs, this.rings, this.ghosts]) for (const e of list) { e.life -= dt; if (e.vx !== undefined) { e.x += e.vx * dt; e.y += e.vy * dt; } }
            this.particles = this.particles.filter(e => e.life > 0); this.arcs = this.arcs.filter(e => e.life > 0); this.rings = this.rings.filter(e => e.life > 0); this.ghosts = this.ghosts.filter(e => e.life > 0);
            for (const [id, left] of this.flashes) left - dt <= 0 ? this.flashes.delete(id) : this.flashes.set(id, left - dt);
        }
        line(points, color, width = 1) { const c = this.ctx; c.strokeStyle = color; c.lineWidth = width; c.beginPath(); points.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.stroke(); }
        glowLine(points, color, width = 2) { this.line(points, color + '40', width * 3.2); this.line(points, color, width); }
        polygon(x, y, r, n, angle, color, fill, width = 2) {
            const c = this.ctx; c.beginPath();
            for (let i = 0; i < n; i++) { const a = angle + i * TAU / n; i ? c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r) : c.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
            c.closePath(); if (fill) { c.fillStyle = fill; c.fill(); }
            c.strokeStyle = color + '40'; c.lineWidth = width * 3; c.stroke(); c.strokeStyle = color; c.lineWidth = width; c.stroke();
        }
        circle(x, y, r, color, width = 1) { const c = this.ctx; c.beginPath(); c.arc(x, y, Math.max(0, r), 0, TAU); c.strokeStyle = color; c.lineWidth = width; c.stroke(); }
        mech(x, y, angle, alpha = 1, flicker = 1) {
            const c = this.ctx; c.save(); c.translate(x, y); c.rotate(angle + Math.PI / 2); c.scale(1.2, 1.2); c.globalAlpha *= alpha;
            // Thruster glow under the hull, flickering with time.
            const glow = c.createRadialGradient(0, 16, 0, 0, 16, 16 * flicker);
            glow.addColorStop(0, this.light ? '#7a4dd855' : '#b68cffaa'); glow.addColorStop(1, '#b68cff00');
            c.fillStyle = glow; c.fillRect(-18, 2, 36, 32);
            c.fillStyle = this.light ? '#dff6fc' : '#0d2133';
            c.beginPath(); c.moveTo(0, -21); c.lineTo(12, -8); c.lineTo(10, 14); c.lineTo(-10, 14); c.lineTo(-12, -8); c.closePath(); c.fill();
            c.strokeStyle = this.cyan + '45'; c.lineWidth = 6; c.stroke(); c.strokeStyle = this.cyan; c.lineWidth = 2; c.stroke();
            c.beginPath(); c.moveTo(0, -14); c.lineTo(7, -6); c.lineTo(6, 9); c.lineTo(-6, 9); c.lineTo(-7, -6); c.closePath(); c.strokeStyle = this.cyan + '70'; c.lineWidth = 1; c.stroke();
            c.fillStyle = this.violet; c.fillRect(-20, -5, 7, 17); c.fillRect(13, -5, 7, 17);
            c.fillStyle = this.light ? '#ffffff' : '#ffffffcc'; c.fillRect(-18, -3, 3, 13); c.fillRect(15, -3, 3, 13);
            c.fillStyle = this.cyan; c.fillRect(-3, -13, 6, 12);
            c.fillStyle = this.light ? '#213655' : '#f0ffff'; c.fillRect(-3, 1, 6, 5);
            c.restore();
        }
        // Static backdrop is baked into an offscreen canvas when the DOM is available.
        backdrop(g) {
            const sector = g.config.sector, key = `${sector}:${this.light}:${this.scale}`;
            const doc = globalThis.document;
            if (doc?.createElement) {
                if (this.cacheKey !== key) {
                    const layer = this.cache || doc.createElement('canvas'); layer.width = 720 * this.scale; layer.height = 720 * this.scale;
                    const real = this.ctx; this.ctx = layer.getContext('2d'); this.ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
                    this.paintBackdrop(sector); this.ctx = real; this.cache = layer; this.cacheKey = key;
                }
                this.ctx.drawImage(this.cache, 0, 0, 720, 720);
            } else this.paintBackdrop(sector);
        }
        paintBackdrop(sector) {
            const c = this.ctx;
            c.fillStyle = this.light ? '#eef5fb' : '#070d1c'; c.fillRect(0, 0, 720, 720);
            const grad = c.createRadialGradient(360, 300, 20, 360, 360, 510);
            grad.addColorStop(0, this.light ? '#dce8f4' : ['#17233c', '#201836', '#151b3b'][sector]); grad.addColorStop(1, this.light ? '#f4f8fc' : '#070d1c');
            c.fillStyle = grad; c.fillRect(0, 0, 720, 720);
            c.strokeStyle = this.light ? '#d2dfea' : '#162438'; c.lineWidth = 1; c.beginPath();
            for (let n = 36; n < 720; n += 36) { c.moveTo(n, 18); c.lineTo(n, 702); c.moveTo(18, n); c.lineTo(702, n); }
            c.stroke();
            c.globalAlpha = .3;
            for (const trace of TRACES[sector]) this.line(trace.points, sector === 1 ? this.violet : this.cyan, 2);
            if (sector === 1) for (const r of [155, 225, 285]) this.polygon(360, 360, r, 6, Math.PI / 6, this.violet, null, 1);
            if (sector === 2) for (const r of [100, 190, 280]) this.polygon(360, 360, r, 8, Math.PI / 8, this.cyan, null, 1);
            c.globalAlpha = 1; c.strokeStyle = this.light ? '#91b1c8' : '#395671'; c.lineWidth = 3; c.strokeRect(13, 13, 694, 694);
            c.font = '10px monospace'; c.fillStyle = this.light ? '#6f8399' : '#60788f'; c.textAlign = 'left';
            c.fillText(`SECTOR 0${sector + 1} / ${['POWER WORKS', 'ION REACTOR', 'LOCKDOWN CORE'][sector]}`, 28, 37);
            c.textAlign = 'right'; c.fillText('BOUNDARY // 720 × 720', 692, 688);
        }
        // Live layer: energy pulses running the circuit traces and breathing corner lights.
        ambience(g) {
            const c = this.ctx, sector = g.config.sector, t = this.reduced ? 0 : this.time;
            const color = sector === 1 ? this.violet : this.cyan;
            c.save(); c.globalCompositeOperation = this.light ? 'source-over' : 'lighter';
            TRACES[sector].forEach((trace, i) => {
                for (const offset of [0, .5]) {
                    const [x, y] = along(trace, (t * 120 + i * 97) + offset * trace.total);
                    c.globalAlpha = .75; c.fillStyle = color; c.beginPath(); c.arc(x, y, 2.4, 0, TAU); c.fill();
                    c.globalAlpha = .18; c.beginPath(); c.arc(x, y, 8, 0, TAU); c.fill();
                }
            });
            c.restore();
            const breathe = .55 + Math.sin(t * 2.2) * .3;
            c.globalAlpha = breathe;
            for (const [x, y, sx, sy] of [[13, 13, 1, 1], [707, 13, -1, 1], [13, 707, 1, -1], [707, 707, -1, -1]]) this.glowLine([[x, y + sy * 46], [x, y], [x + sx * 46, y]], this.cyan, 4);
            c.globalAlpha = .4; for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; this.circle(360 + Math.cos(a) * 342, 360 + Math.sin(a) * 342, 18, this.cyan, 2); }
            c.globalAlpha = 1;
        }
        enemy(e, angle) {
            const c = this.ctx, flash = this.flashes.has(e.id), t = this.reduced ? 0 : this.time;
            const first = this.born.get(e.id) ?? (this.born.set(e.id, this.time), this.time);
            const pop = this.reduced ? 1 : outBack((this.time - first) / .28);
            const body = flash ? '#ffffff' : this.light ? '#fae5e5' : '#2a1626', warm = flash ? '#ffffff' : this.warm;
            c.save(); c.translate(e.x, e.y); c.scale(pop, pop);
            if (e.kind === 'swarm') {
                this.polygon(0, 0, e.r, 3, angle, warm, body);
                this.polygon(0, 0, e.r * .45, 3, angle, warm);
                c.globalAlpha = .6 + Math.sin(t * 20 + e.id) * .3; this.line([[Math.cos(angle + Math.PI) * e.r, Math.sin(angle + Math.PI) * e.r], [Math.cos(angle + Math.PI) * (e.r + 7), Math.sin(angle + Math.PI) * (e.r + 7)]], this.gold, 2); c.globalAlpha = 1;
            } else if (e.kind === 'charger') {
                const hot = e.windup > 0;
                this.polygon(0, 0, e.r, 4, angle, hot ? '#ff4d6a' : warm, body);
                for (const side of [-.5, .5]) { const a = angle + side; this.line([[Math.cos(a) * e.r * .8, Math.sin(a) * e.r * .8], [Math.cos(angle) * (e.r + 9), Math.sin(angle) * (e.r + 9)]], hot ? '#ffffff' : warm, 2); }
                c.fillStyle = hot ? '#ffffff' : warm; c.fillRect(-3, -3, 6, 6);
            } else if (e.kind === 'shooter') {
                this.polygon(0, 0, e.r, 4, Math.PI / 4, warm, body);
                c.rotate(t * 1.6); c.setLineDash([5, 5]); this.circle(0, 0, e.r + 5, warm + 'aa', 1.5); c.setLineDash([]); c.rotate(-t * 1.6);
                this.line([[0, 0], [Math.cos(angle) * (e.r + 8), Math.sin(angle) * (e.r + 8)]], warm, 4);
                this.circle(0, 0, 5, flash ? '#ffffff' : this.gold, 3);
            } else if (e.kind === 'guard') {
                this.polygon(0, 0, e.r, 6, angle, warm, body);
                this.polygon(0, 0, e.r - 8, 6, angle, this.gold);
                c.rotate(t * .9);
                for (let i = 0; i < 3; i++) { c.rotate(TAU / 3); c.beginPath(); c.arc(0, 0, e.r + 7, -.5, .5); c.strokeStyle = this.gold; c.lineWidth = 3; c.stroke(); }
            } else if (e.kind === 'splitter') {
                this.polygon(0, 0, e.r, 5, angle, warm, body);
                c.rotate(t * 2.4);
                for (const s of [-1, 1]) this.polygon(s * 5, 0, e.r * .38, 3, s > 0 ? 0 : Math.PI, '#ff7ad1');
            } else {
                c.rotate(t * 7); this.polygon(0, 0, e.r, 3, 0, warm, body);
            }
            c.restore();
            if (e.hp < e.maxHp) { c.fillStyle = this.warm + '40'; c.fillRect(e.x - e.r, e.y - e.r - 9, 2 * e.r, 3); c.fillStyle = this.warm; c.fillRect(e.x - e.r, e.y - e.r - 9, 2 * e.r * e.hp / e.maxHp, 3); }
        }
        draw(g, theme = 'dark') {
            const c = this.ctx; this.light = theme === 'light'; this.cyan = this.light ? '#007f9d' : '#5ceaff'; this.violet = this.light ? '#773dcc' : '#b68cff'; this.warm = this.light ? '#c24637' : '#ff8466'; this.gold = this.light ? '#9b6608' : '#ffd46c';
            c.setTransform(this.scale, 0, 0, this.scale, 0, 0); c.save(); c.beginPath(); c.rect(0, 0, 720, 720); c.clip();
            if (this.shake && !this.reduced) c.translate(Math.sin(this.time * 83) * this.shake, Math.cos(this.time * 71) * this.shake);
            this.fx?.apply(c);
            if (g.state === 'running' && this.waveShown !== g.wave) {
                this.waveShown = g.wave;
                this.fx?.banner(`WAVE ${String(g.wave).padStart(2, '0')}`, g.config.boss || ['能源工廠', '磁暴反應爐', '封鎖核心'][g.config.sector], { color: g.config.boss ? this.warm : this.cyan });
            }
            this.backdrop(g); this.ambience(g);
            for (const t of g.trails) if (g.stats.trail) { c.globalAlpha = t.life / 1.2 * .22; this.circle(t.x, t.y, 19, this.violet, 6); } c.globalAlpha = 1;
            for (const b of g.beams) {
                const end = [b.x + Math.cos(b.angle) * b.length, b.y + Math.sin(b.angle) * b.length];
                c.setLineDash(b.warning > 0 ? [12, 9] : []); c.globalAlpha = b.warning > 0 ? .7 : 1; this.line([[b.x, b.y], end], this.warm, b.warning > 0 ? 3 : b.width); c.setLineDash([]);
                if (b.warning <= 0) this.line([[b.x, b.y], end], this.light ? '#ffdcad' : '#ffe3b0', 3); c.globalAlpha = 1;
            }
            for (const w of g.warnings) {
                // Warp portal: a contracting dashed ring with spinning ticks before the enemy lands.
                const k = Math.max(0, Math.min(1, w.time / .7)), spin = this.reduced ? 0 : this.time * 5;
                c.save(); c.translate(w.x, w.y); c.setLineDash([6, 6]); c.rotate(spin); this.circle(0, 0, 14 + k * 22, this.warm, 2); c.setLineDash([]);
                for (let i = 0; i < 3; i++) { c.rotate(TAU / 3); this.line([[20 + k * 16, 0], [27 + k * 16, 0]], this.warm, 2); } c.restore();
                this.polygon(w.x, w.y, 10, 3, -Math.PI / 2, this.warm); c.fillStyle = this.warm; c.textAlign = 'center'; c.font = 'bold 12px monospace'; c.fillText('!', w.x, w.y + 5);
            }
            for (const p of g.pillars) { this.polygon(p.x, p.y, 23, 6, Math.PI / 6, this.gold, this.light ? '#fff2d7' : '#2a241c'); this.polygon(p.x, p.y, 11, 6, Math.PI / 6 + (this.reduced ? 0 : this.time * .8), this.gold); c.fillStyle = this.gold; c.fillRect(p.x - 2, p.y - 8, 4, 16); }
            for (const e of g.enemies) {
                if (e.windup > 0) { c.setLineDash([10, 8]); this.line([[e.x, e.y], [e.x + e.dx * 250, e.y + e.dy * 250]], this.warm, 3); c.setLineDash([]); }
                if (e.kind === 'boss') {
                    c.save(); c.translate(e.x, e.y); c.rotate(this.reduced ? 0 : this.time * (g.wave === 4 ? .6 : .14));
                    const n = g.wave === 4 ? 12 : g.wave === 8 ? 6 : 8, flash = this.flashes.has(e.id);
                    for (let i = 0; i < n; i++) { const a = i * TAU / n, x = Math.cos(a) * 49, y = Math.sin(a) * 49; this.polygon(x, y, 12, g.wave === 4 ? 3 : 4, a, this.warm, this.light ? '#e4dbea' : '#2e2542'); }
                    this.polygon(0, 0, 46, 8, Math.PI / 8, e.overload ? this.warm : this.violet, flash ? '#ffffff' : this.light ? '#e4dbea' : '#1d1d36', 3);
                    this.polygon(0, 0, 30, 6, 0, this.gold); this.circle(0, 0, 16 + (this.reduced ? 0 : Math.sin(this.time * 6) * 2), e.overload ? this.warm : this.gold, 5); c.restore();
                    if (e.hp / e.maxHp < .65) this.line([[e.x - 28, e.y - 20], [e.x - 12, e.y], [e.x - 25, e.y + 14]], this.warm, 3);
                } else this.enemy(e, Math.atan2(g.player.y - e.y, g.player.x - e.x));
            }
            for (const b of g.bullets) { c.fillStyle = this.warm + '50'; c.beginPath(); c.arc(b.x, b.y, b.r + 4, 0, TAU); c.fill(); c.fillStyle = this.warm; c.beginPath(); c.arc(b.x, b.y, b.r + 1, 0, TAU); c.fill(); c.fillStyle = this.light ? '#fff6d7' : '#fff4d5'; c.fillRect(b.x - 2, b.y - 2, 4, 4); }
            for (const t of this.ghosts) this.mech(t.x, t.y, t.angle, t.life / .28 * .32);
            const p = g.player;
            if (p.shield) { this.circle(p.x, p.y, 31, this.cyan + '40', 6); this.circle(p.x, p.y, 31, this.cyan, 2); }
            if (p.dashTime > 0) this.circle(p.x, p.y, 27, this.violet, 3);
            const alpha = p.invulnerable > 0 && !this.reduced ? .55 + Math.sin(this.time * 30) * .2 : 1;
            this.mech(p.x, p.y, Math.atan2(p.aimY, p.aimX), alpha, this.reduced ? 1 : .8 + Math.sin(this.time * 40) * .2);
            // Aim beam fades out in three steps along the aim direction.
            [[28, 46, .7], [46, 64, .4], [64, 82, .15]].forEach(([from, to, a]) => { c.globalAlpha = a; this.line([[p.x + p.aimX * from, p.y + p.aimY * from], [p.x + p.aimX * to, p.y + p.aimY * to]], this.cyan, 2); });
            c.globalAlpha = 1;
            for (const arc of this.arcs) {
                c.globalAlpha = Math.min(1, arc.life / .08);
                for (let i = 1; i < arc.points.length; i++) {
                    const a = arc.points[i - 1], b = arc.points[i], pts = [[a.x, a.y]], len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
                    for (let j = 1; j < 7; j++) { const off = this.reduced ? 2 : Math.sin(j * 12.7 + this.time * 55) * 9; pts.push([a.x + (b.x - a.x) * j / 7 - (b.y - a.y) / len * off, a.y + (b.y - a.y) * j / 7 + (b.x - a.x) / len * off]); }
                    pts.push([b.x, b.y]);
                    this.line(pts, (i === 1 ? this.cyan : this.violet) + '50', 9); this.line(pts, i === 1 ? this.cyan : this.violet, 4); this.line(pts, this.light ? '#e7fbff' : '#efffff', 1);
                }
            }
            c.globalAlpha = 1;
            for (const e of this.rings) { c.globalAlpha = e.life / e.total; this.circle(e.x, e.y, e.radius * (1 - e.life / e.total), e.color, 3); } c.globalAlpha = 1;
            for (const e of this.particles) { c.globalAlpha = Math.min(1, e.life * 3); c.fillStyle = e.color; c.fillRect(e.x, e.y, e.size, e.size); } c.globalAlpha = 1;
            this.fx?.draw(c, 720, 720);
            if (g.boss && !g.boss.dead) { const b = g.boss; c.fillStyle = this.light ? '#ffffffde' : '#091222dc'; c.fillRect(140, 46, 440, 42); c.fillStyle = this.warm + '40'; c.fillRect(150, 76, 420, 4); c.fillStyle = this.warm; c.fillRect(150, 76, 420 * Math.max(0, b.hp / b.maxHp), 4); c.fillStyle = this.light ? '#402338' : '#ffe2dd'; c.textAlign = 'center'; c.font = 'bold 13px system-ui'; c.fillText(`${g.config.boss}${b.overload ? ' / 過載' : ''}`, 360, 66); }
            c.restore();
            if (!this.light) globalThis.CashArcadeFX?.crt(c, 720, 720, .05);
            if (this.born.size > 200) for (const id of this.born.keys()) { if (!g.enemies.some(e => e.id === id)) this.born.delete(id); }
        }
    }
    globalThis.NeonArenaRenderer = Renderer;
})();
