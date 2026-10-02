(() => {
    'use strict';
    const { W, H } = NeonAssault;
    const palettes = {
        dark: { bg: '#070c1c', panel: '#111e35', deep: '#0b1428', grid: '#193047', ink: '#eefbff', muted: '#648397', cyan: '#5ceaff', violet: '#b68cff', gold: '#ffd46c', danger: '#ff758c', shot: '#bdfff5', core: '#f3e9ff' },
        light: { bg: '#e7f0f7', panel: '#c8dbe9', deep: '#d8e6f0', grid: '#b4cbdc', ink: '#162d4b', muted: '#56758c', cyan: '#007a9b', violet: '#753cd6', gold: '#966000', danger: '#cf304e', shot: '#00725f', core: '#602fc2' },
    };
    class Renderer {
        constructor(canvas) {
            this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.time = 0;
            this.particles = []; this.rings = []; this.labels = []; this.wrecks = []; this.shake = 0; this.pulse = 0;
            this.reduced = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches || false;
            this.motionQuery = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
            this.motionQuery?.addEventListener?.('change', e => { this.reduced = e.matches; this.reset(); });
            this.resize();
        }
        resize() {
            const dpr = Math.min(2, globalThis.devicePixelRatio || 1);
            if (this.canvas.width !== W * dpr || this.canvas.height !== H * dpr) {
                this.canvas.width = W * dpr; this.canvas.height = H * dpr;
            }
            this.dpr = dpr;
        }
        reset() { this.particles = []; this.rings = []; this.labels = []; this.wrecks = []; this.shake = 0; this.pulse = 0; this.time = 0; }
        wreck(x, y, side, core = false) {
            if (!this.reduced && this.wrecks.length < 12) this.wrecks.push({ x, y, side, core, life: 2.2, angle: 0, vy: 25 });
        }
        burst(x, y, size, color, heavy = false) {
            this.rings.push({ x, y, r: 5, life: heavy ? 1 : .5, max: heavy ? 1 : .5, color, speed: heavy ? 200 : 110 });
            if (this.reduced) return;
            const count = heavy ? 32 : 12;
            for (let i = 0; i < count && this.particles.length < 300; i++) {
                const angle = i * Math.PI * 2 / count + this.time, speed = 45 + (i * 73 % 180);
                this.particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
                    life: heavy ? 1.8 : .6, max: heavy ? 1.8 : .6, size: heavy ? 4 + i % 9 : 2 + i % 3,
                    angle, spin: (i % 2 ? 1 : -1) * 2, color, debris: heavy && i % 3 === 0 });
            }
            this.shake = Math.max(this.shake, heavy ? .5 : size > 25 ? .13 : .035);
        }
        consume(events) {
            for (const e of events) {
                if (e.type === 'explode') this.burst(e.x, e.y, e.size, e.size > 25 ? 'violet' : 'cyan');
                if (e.type === 'part') { this.wreck(e.x, e.y, e.side || 1); this.burst(e.x, e.y, 50, 'gold', true); this.label('裝甲擊破 +500', e.x, e.y, 'gold'); }
                if (e.type === 'bossDown') {
                    this.wreck(e.x, e.y, 1, true);
                    for (let i = -2; i <= 2; i++) this.burst(e.x + i * 52, e.y + Math.abs(i) * 15, 90, i % 2 ? 'cyan' : 'violet', true);
                    this.pulse = .3;
                }
                if (e.type === 'bomb') { this.burst(e.x, e.y, 100, 'cyan', true); this.rings.push({ x: e.x, y: e.y, r: 20, life: 1, max: 1, color: 'cyan', speed: 950 }); this.pulse = .12; }
                if (e.type === 'hurt') this.burst(e.x, e.y, 40, 'danger', true);
                if (e.type === 'pickup') { this.burst(e.x, e.y, 15, 'gold'); this.label(NeonAssault.ITEMS[e.item] + '強化', e.x, e.y - 30, 'gold'); }
                if (e.type === 'phase') this.label(e.phase === 'rage' ? '核心過載' : '核心暴露', W / 2, 255, 'danger');
                if (e.type === 'boss') this.label('WARNING / ' + e.name, W / 2, H * .46, 'danger', 2.8);
            }
            this.rings = this.rings.slice(-32); this.labels = this.labels.slice(-8);
        }
        label(text, x, y, color, life = 1.7) { this.labels.push({ text, x, y, color, life, max: life }); }
        update(dt) {
            this.time += dt; this.shake = Math.max(0, this.shake - dt); this.pulse = Math.max(0, this.pulse - dt);
            for (const p of this.particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= Math.exp(-dt * 1.5); p.vy += 36 * dt; p.angle += p.spin * dt; p.life -= dt; }
            for (const r of this.rings) { r.r += r.speed * dt; r.life -= dt; }
            for (const l of this.labels) { if (!this.reduced) l.y -= dt * 13; l.life -= dt; }
            for (const w of this.wrecks) { w.x += w.side * (w.core ? 15 : 70) * dt; w.y += w.vy * dt; w.vy += 80 * dt; w.angle += w.side * dt * .8; w.life -= dt; }
            this.particles = this.particles.filter(p => p.life > 0); this.rings = this.rings.filter(p => p.life > 0); this.labels = this.labels.filter(p => p.life > 0);
            this.wrecks = this.wrecks.filter(w => w.life > 0);
        }
        line(points, color, width = 1, close = false, fill = null) {
            const c = this.ctx; c.beginPath(); points.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y));
            if (close) c.closePath(); if (fill) { c.fillStyle = fill; c.fill(); }
            c.strokeStyle = color; c.lineWidth = width; c.stroke();
        }
        circle(x, y, r, color, width = 1, fill = null) {
            const c = this.ctx; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2);
            if (fill) { c.fillStyle = fill; c.fill(); } c.strokeStyle = color; c.lineWidth = width; c.stroke();
        }
        glow(color, size = 10) { this.ctx.shadowColor = color; this.ctx.shadowBlur = this.reduced || this.light ? 0 : size; }
        text(value, x, y, size, color, align = 'center') {
            const c = this.ctx; c.font = `600 ${size}px ui-monospace, "Microsoft JhengHei", monospace`; c.textAlign = align; c.fillStyle = color; c.fillText(value, x, y);
        }
        background(level) {
            const c = this.ctx, p = this.palette, t = this.reduced ? 0 : this.time;
            c.fillStyle = p.bg; c.fillRect(0, 0, W, H);
            const gradient = c.createRadialGradient(W * .5, H * .25, 10, W * .5, H * .4, H * .8);
            gradient.addColorStop(0, this.light ? '#cddced' : level === 2 ? '#1c163b' : '#102539'); gradient.addColorStop(1, p.bg);
            c.fillStyle = gradient; c.fillRect(0, 0, W, H);
            c.globalAlpha = .5;
            for (let i = 0; i < 64; i++) {
                const x = (i * 137.37) % W, y = (i * 93.19 + t * (18 + i % 3 * 13)) % H;
                c.fillStyle = i % 3 ? p.muted : p.cyan; c.fillRect(x, y, i % 4 === 0 ? 2 : 1, i % 4 === 0 ? 4 : 2);
            }
            c.globalAlpha = .32;
            for (let x = 30; x < W; x += 60) this.line([[x, 0], [x, H]], p.grid);
            for (let y = (t * 48) % 60; y < H; y += 60) this.line([[0, y], [W, y]], p.grid);
            c.globalAlpha = 1;
            if (level === 1) {
                for (let i = 0; i < 12; i++) {
                    const y = (i * 99 + t * 36) % (H + 160) - 160, width = 26 + (i * 17) % 62;
                    for (const x of [0, W - width]) {
                        c.fillStyle = p.deep; c.fillRect(x, y, width, 83); c.strokeStyle = p.grid; c.strokeRect(x, y, width, 83);
                        c.fillStyle = p.grid; for (let j = 8; j < width - 6; j += 12) c.fillRect(x + j, y + 12, 3, 22);
                        this.line([[x, y + 68], [x + width, y + 68]], p.cyan, .5);
                    }
                }
            } else if (level === 2) {
                c.globalAlpha = .25;
                for (let i = 0; i < 5; i++) {
                    const y = (i * 210 + t * 32) % (H + 300) - 150;
                    this.line([[0, y - 60], [95, y], [55, y + 80], [0, y + 115]], p.violet, 2, true, p.deep);
                    this.line([[W, y - 110], [W - 110, y - 10], [W - 50, y + 55], [W, y + 140]], p.violet, 2, true, p.deep);
                }
                c.globalAlpha = 1;
            } else {
                c.save(); c.translate(W / 2, (t * 22) % (H + 540) - 270); c.rotate(.2);
                c.globalAlpha = .35; this.circle(0, 0, 225, p.violet, 2); this.circle(0, 0, 200, p.grid, 16);
                for (let i = 0; i < 12; i++) { c.rotate(Math.PI / 6); this.line([[190, -18], [245, -18], [245, 18], [190, 18]], p.gold, 1, true, p.deep); }
                c.restore();
            }
            c.globalAlpha = .6;
            this.line([[17, 0], [17, H]], p.grid); this.line([[W - 17, 0], [W - 17, H]], p.grid);
            for (let y = 0; y < H; y += 36) { this.line([[9, y], [17, y]], p.muted); this.line([[W - 17, y], [W - 9, y]], p.muted); }
            c.globalAlpha = 1;
        }
        player(ship, wings, invulnerable) {
            const c = this.ctx, p = this.palette, t = this.reduced ? 0 : this.time;
            c.save(); c.translate(ship.x, ship.y); c.rotate(ship.lean * .10);
            if (invulnerable > 0) { c.globalAlpha = .5; this.circle(0, 0, 34, p.cyan, 1.5); c.globalAlpha = 1; }
            for (let i = 0; i < wings; i++) {
                const x = i === 0 ? -38 : 38;
                this.glow(p.violet, 9); this.line([[x, -9], [x + 9, 8], [x, 4], [x - 9, 8]], p.violet, 1.5, true, p.panel);
                this.line([[x, 9], [x, 19 + Math.sin(t * 19) * 3]], p.cyan, 3);
            }
            this.glow(p.cyan, 14);
            const flame = 25 + Math.sin(t * 35) * 5;
            this.line([[-7, 14], [-3, flame + 13], [1, 15]], p.cyan, 1, true, p.cyan);
            this.line([[7, 14], [3, flame + 13], [-1, 15]], p.violet, 1, true, p.violet);
            this.line([[0, -30], [10, -8], [28, 17], [11, 11], [6, 20], [-6, 20], [-11, 11], [-28, 17], [-10, -8]], p.cyan, 2, true, p.panel);
            c.shadowBlur = 0;
            this.line([[0, -20], [5, -4], [0, 7], [-5, -4]], p.ink, 1, true, p.violet);
            this.line([[-20, 11], [-10, 2], [-6, 12]], p.violet, 1.5);
            this.line([[20, 11], [10, 2], [6, 12]], p.violet, 1.5);
            this.circle(0, 0, 3.5, p.ink, 1, p.ink);
            c.restore();
        }
        enemy(e) {
            const c = this.ctx, p = this.palette, color = e.flash > 0 ? p.ink : e.type === 'gunship' ? p.gold : e.type === 'fighter' ? p.violet : p.danger;
            c.save(); c.translate(e.x, e.y); this.glow(color, 6);
            if (e.type === 'gunship') {
                this.line([[-30, -20], [-12, -28], [12, -28], [30, -20], [34, 20], [21, 29], [12, 13], [-12, 13], [-21, 29], [-34, 20]], color, 1.8, true, p.panel);
                this.line([[-18, -14], [18, -14], [18, 4], [-18, 4]], color, 1, true);
                this.circle(0, -6, 7, color, 2, p.deep);
                this.line([[-24, 10], [-24, 25]], p.danger, 4); this.line([[24, 10], [24, 25]], p.danger, 4);
            } else if (e.type === 'fighter') {
                this.line([[0, 23], [8, 5], [25, -4], [18, -18], [8, -8], [0, -14], [-8, -8], [-18, -18], [-25, -4], [-8, 5]], color, 1.6, true, p.panel);
                this.line([[0, -8], [0, 13]], p.danger, 3);
            } else {
                this.line([[0, 19], [19, -12], [7, -6], [0, -17], [-7, -6], [-19, -12]], color, 1.6, true, p.panel);
                this.circle(0, 0, 4, color, 1, color);
            }
            c.shadowBlur = 0;
            if (e.hp < e.maxHp && e.type === 'gunship') { c.fillStyle = p.grid; c.fillRect(-25, -38, 50, 3); c.fillStyle = color; c.fillRect(-25, -38, 50 * Math.max(0, e.hp / e.maxHp), 3); }
            c.restore();
        }
        boss(b, level) {
            if (!b || b.dead) return;
            const c = this.ctx, p = this.palette;
            if (b.sweep) {
                c.save(); const active = b.sweep.age >= 1.3;
                c.globalAlpha = active ? .7 : .18; c.fillStyle = p.danger; c.fillRect(b.sweep.x - 24, b.y + 45, 48, H);
                c.globalAlpha = 1; c.setLineDash(active ? [] : [10, 10]);
                this.line([[b.sweep.x - 24, b.y + 45], [b.sweep.x - 24, H]], p.danger, active ? 3 : 1);
                this.line([[b.sweep.x + 24, b.y + 45], [b.sweep.x + 24, H]], p.danger, active ? 3 : 1);
                if (!active) this.text('避開光束', b.sweep.x, H - 36, 13, p.danger);
                c.restore();
            }
            c.save(); c.translate(b.x, b.y);
            const color = b.flash > 0 ? p.ink : b.rage ? p.danger : p.violet;
            this.glow(color, 15);
            if (level === 2 && b.nodes.some(n => n.hp > 0)) {
                // The rift guardian's rotating field collapses with its armor.
                c.save(); c.rotate(this.reduced ? .2 : this.time * .15);
                this.circle(0, 0, 99, p.violet, 1.5); this.circle(0, 0, 88, p.grid, 6);
                for (let i = 0; i < 6; i++) { c.rotate(Math.PI / 3); this.line([[72, -9], [102, -9], [111, 0], [102, 9], [72, 9]], p.cyan, 1.2, true, p.deep); }
                c.restore();
            }
            if (level === 3) {
                this.line([[-37, -46], [-58, -87], [-25, -71], [0, -106], [25, -71], [58, -87], [37, -46]], p.violet, 2, true, p.panel);
                for (const x of [-22, 22]) { this.line([[x, -76], [x, -110]], p.cyan, 5); this.line([[x, -77], [x, -101]], p.ink, 1); }
            }
            for (const n of b.nodes) if (n.hp > 0) {
                if (level === 1) this.line([[Math.sign(n.offset) * 28, -25], [n.offset, -59], [n.offset + Math.sign(n.offset) * 30, -41], [n.offset, 12]], p.cyan, 1.5, true, p.deep);
                if (level === 3) this.line([[Math.sign(n.offset) * 39, -28], [n.offset, n.dy - 49], [n.offset + Math.sign(n.offset) * 15, n.dy - 12]], p.violet, 2, true, p.deep);
                this.line([[Math.sign(n.offset) * 29, -25], [n.offset, n.dy - 12], [n.offset, n.dy + 12], [Math.sign(n.offset) * 28, 20]], p.violet, 2, true, p.panel);
            }
            this.line([[0, -70], [36, -43], [51, -10], [39, 38], [16, 60], [0, 48], [-16, 60], [-39, 38], [-51, -10], [-36, -43]], color, 2.5, true, p.panel);
            this.line([[-28, -37], [0, -54], [28, -37], [25, -20], [-25, -20]], p.cyan, 1.2, true, p.deep);
            const coreColor = b.phase === 'armor' ? p.violet : p.danger;
            this.circle(0, 3, 24, coreColor, 2, p.deep);
            c.save(); c.translate(0, 3); c.rotate(this.reduced ? 0 : this.time * (b.rage ? 2 : .7));
            this.line([[0, -18], [16, -8], [16, 8], [0, 18], [-16, 8], [-16, -8]], coreColor, 2, true);
            c.restore(); this.circle(0, 3, 9, p.ink, 2, coreColor);
            if (b.phase === 'armor') { c.globalAlpha = .45; this.circle(0, 3, 32, p.cyan, 1); c.globalAlpha = 1; }
            for (const n of b.nodes) {
                const x = n.offset, y = n.dy;
                if (n.hp <= 0) { this.line([[Math.sign(x) * 44, 0], [Math.sign(x) * 63, 5], [Math.sign(x) * 48, 15]], p.danger, 2); continue; }
                const nc = n.flash > 0 ? p.ink : p.gold;
                this.glow(nc, 9);
                this.line([[x - 26, y - 30], [x + 22, y - 30], [x + 34, y - 8], [x + 23, y + 30], [x, y + 43], [x - 24, y + 23], [x - 33, y - 5]], nc, 2, true, p.panel);
                this.line([[x - 13, y - 20], [x + 13, y - 20], [x + 13, y + 17], [x - 13, y + 17]], p.violet, 1, true, p.deep);
                this.circle(x, y, 9, nc, 2, p.deep); this.line([[x - 7, y + 22], [x - 7, y + 40]], nc, 4);
                this.line([[x + 7, y + 22], [x + 7, y + 40]], nc, 4);
                c.shadowBlur = 0; c.fillStyle = p.grid; c.fillRect(x - 26, y - 42, 52, 3); c.fillStyle = nc; c.fillRect(x - 26, y - 42, 52 * n.hp / n.maxHp, 3);
            }
            c.restore();
        }
        draw(game, theme = 'dark') {
            const c = this.ctx; this.light = theme === 'light'; this.palette = palettes[this.light ? 'light' : 'dark']; const p = this.palette;
            c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); c.globalAlpha = 1; c.shadowBlur = 0;
            this.background(game.level);
            c.save();
            if (!this.reduced && this.shake > 0) c.translate(Math.sin(this.time * 131) * this.shake * 9, Math.cos(this.time * 117) * this.shake * 8);
            for (const e of game.enemies) this.enemy(e);
            this.boss(game.boss, game.level);
            for (const s of game.shots) {
                this.glow(s.wing ? p.violet : p.cyan, 7);
                this.line([[s.x, s.y + 13], [s.x + s.vx * .008, s.y - 7]], s.wing ? p.violet : p.shot, s.wing ? 2 : 3);
            }
            for (const beam of game.beams) {
                c.globalAlpha = beam.life / .1; this.glow(p.cyan, 15);
                this.line([[beam.x, beam.y], [beam.x, 0]], p.cyan, beam.width);
                this.line([[beam.x, beam.y], [beam.x, 0]], p.ink, 3);
            }
            c.globalAlpha = 1; c.shadowBlur = 0;
            for (const item of game.items) {
                const colors = { laser: 'cyan', spread: 'violet', wing: 'cyan', repair: 'gold', bomb: 'gold' }, color = p[colors[item.type]];
                c.save(); c.translate(item.x, item.y); this.glow(color, 9);
                const pulse = this.reduced ? 0 : Math.sin(this.time * 5) * 2;
                this.circle(0, 0, 22 + pulse, color, 1);
                this.line([[0, -16], [16, 0], [0, 16], [-16, 0]], color, 1.5, true, p.deep); c.shadowBlur = 0;
                this.text({ laser: 'L', spread: 'S', wing: 'W', repair: '+', bomb: 'B' }[item.type], 0, 5, 15, color);
                this.text(NeonAssault.ITEMS[item.type], 0, 37, 12, color); c.restore();
            }
            if (game.state !== 'lost') this.player(game.player, game.wings, game.player.invulnerable);
            for (const w of this.wrecks) {
                c.save(); c.translate(w.x, w.y); c.rotate(w.angle); c.globalAlpha = Math.min(.8, w.life);
                const points = w.core ? [[0,-56],[30,-34],[43,-8],[32,32],[13,49],[0,38],[-13,49],[-32,32],[-43,-8],[-30,-34]]
                    : [[-26,-30],[22,-30],[34,-8],[23,30],[0,43],[-24,23],[-33,-5]];
                this.line(points, w.core ? p.violet : p.gold, 1.5, true, p.panel);
                this.line([[-13,-17],[8,-5],[-5,12],[11,25]], p.danger, 2);
                this.circle(0, 0, w.core ? 19 : 9, p.danger, 1.5); c.restore();
            }
            // Hostile bullets always render above decorative particles and use a warm outline.
            for (const particle of this.particles) {
                c.save(); c.translate(particle.x, particle.y); c.rotate(particle.angle); c.globalAlpha = particle.life / particle.max;
                if (particle.debris) this.line([[-particle.size, -4], [particle.size, -8], [particle.size * .7, 6], [-particle.size, 9]], p[particle.color], 1, true, p.panel);
                else { c.fillStyle = p[particle.color]; c.fillRect(-particle.size / 2, -particle.size / 2, particle.size, particle.size); }
                c.restore();
            }
            for (const r of this.rings) { c.globalAlpha = r.life / r.max * .8; this.circle(r.x, r.y, r.r, p[r.color], 2); }
            c.globalAlpha = 1;
            for (const b of game.bullets) {
                this.circle(b.x, b.y, b.r + 2, p.bg, 2, p.bg);
                this.circle(b.x, b.y, b.r, p.danger, 2, p.gold);
                c.fillStyle = this.light ? '#fff' : '#fff1d8'; c.fillRect(b.x - 1.5, b.y - 1.5, 3, 3);
            }
            c.restore();
            if (!this.reduced && this.pulse > 0) { c.globalAlpha = Math.min(.10, this.pulse * .4); c.fillStyle = p.cyan; c.fillRect(0, 0, W, H); c.globalAlpha = 1; }
            for (const l of this.labels) { c.globalAlpha = Math.min(1, l.life * 2); this.text(l.text, Math.max(100, Math.min(W - 100, l.x)), l.y, 15, p[l.color]); }
            c.globalAlpha = 1; c.shadowBlur = 0;
            this.text(`${String(game.level).padStart(2, '0')} / ${game.config.zone}`, 31, 32, 11, p.muted, 'left');
            this.text(game.combo >= 3 ? `${game.combo} CHAIN ×${Math.min(4, 1 + Math.floor(game.combo / 12))}` : 'AUTO FIRE', W - 31, 32, 11, game.combo >= 3 ? p.gold : p.muted, 'right');
            if (game.boss && !game.boss.dead) {
                const b = game.boss, total = b.maxHp + b.nodes.reduce((v, n) => v + n.maxHp, 0), hp = b.hp + b.nodes.reduce((v, n) => v + n.hp, 0);
                c.fillStyle = p.deep; c.fillRect(32, 49, W - 64, 7); c.fillStyle = b.rage ? p.danger : p.violet; c.fillRect(32, 49, (W - 64) * hp / total, 7);
                this.text(game.config.boss + ' / ' + ({ armor: '擊破裝甲', core: '核心暴露', rage: '核心過載' }[b.phase]), W / 2, 76, 12, p.ink);
            }
        }
    }
    globalThis.NeonAssaultRenderer = Renderer;
})();
