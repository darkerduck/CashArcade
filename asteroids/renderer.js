(() => {
    'use strict';
    const { size, rocks } = NeonAsteroidsData;
    const { wrap } = NeonAsteroids;
    const TAU = Math.PI * 2;
    const icons = { spread: 'Ｓ', laser: 'Ｌ', escort: '◇', shield: '⬡', repair: '+' };
    const themes = [
        { glow: '44,122,202', rock: '#c09bf6', label: 'MINERAL BELT' },
        { glow: '121,60,207', rock: '#b29fff', label: 'GRAVITY NEBULA' },
        { glow: '112,53,126', rock: '#eba3bd', label: 'FLEET GRAVEYARD' }
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
    class Renderer {
        constructor(canvas) {
            this.canvas = canvas;
            this.ctx = canvas.getContext('2d', { alpha: false });
            this.back = document.createElement('canvas');
            this.back.width = this.back.height = size;
            this.particles = [];
            this.rings = [];
            this.reduced = false;
            this.shake = 0;
        }
        reset() {
            this.particles.length = this.rings.length = 0;
            this.shake = 0;
        }
        consume(events) {
            for (const event of events) {
                const blast = ['shatter', 'destroy', 'partDown', 'bossDown', 'shipDown', 'swallowed'].includes(event.type);
                if (!blast && !['hit', 'hurt', 'shield', 'pickup'].includes(event.type)) continue;
                const rock = event.type === 'shatter', major = event.type === 'bossDown';
                const color = rock ? '#c9a3ff' : event.type === 'pickup' ? '#ffe399' : blast ? '#ff9e79' : '#8df4ff';
                const count = this.reduced ? 0 : major ? 78 : blast ? 16 : 4;
                for (let i = 0; i < count && this.particles.length < 240; i++) {
                    const angle = i * 2.39996, speed = 40 + (i % 7) * (major ? 31 : 17);
                    this.particles.push({ x: event.x, y: event.y, vx: Math.cos(angle) * speed,
                        vy: Math.sin(angle) * speed, life: 0.25 + (i % 9) * (major ? 0.15 : 0.055),
                        radius: major ? 4 + i % 8 : 2 + i % 3, angle, color });
                }
                if (blast && this.rings.length < 24) this.rings.push({
                    x: event.x, y: event.y, color, radius: event.radius ?? 16, life: major ? 0.85 : 0.33
                });
                if (!this.reduced && (major || event.type === 'hurt' || event.type === 'shipDown')) this.shake = major ? 0.33 : 0.14;
            }
        }
        update(dt) {
            this.shake = Math.max(0, this.shake - dt);
            for (const particle of this.particles) {
                particle.x = wrap(particle.x + particle.vx * dt);
                particle.y = wrap(particle.y + particle.vy * dt);
                particle.angle += 2 * dt;
                particle.life -= dt;
            }
            for (const flash of this.rings) { flash.radius += 120 * dt; flash.life -= dt; }
            this.particles = this.particles.filter(particle => particle.life > 0);
            this.rings = this.rings.filter(flash => flash.life > 0);
        }
        background(sector, light) {
            const key = sector + ':' + light;
            if (key === this.backKey) return;
            this.backKey = key;
            const c = this.back.getContext('2d'), palette = themes[sector];
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
            const soft = light ? '#46628925' : '#a9bff027';
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
            copies(this.ctx, enemy, enemy.radius + 6, c => {
                c.rotate(enemy.angle);
                const r = enemy.radius;
                const corners = Array.from({ length: 9 }, (_, i) => {
                    const angle = i / 9 * TAU, edge = r * (0.80 + ((i * 13 + enemy.id * 7) % 11) * 0.02);
                    return [Math.cos(angle) * edge, Math.sin(angle) * edge];
                });
                polygon(c, corners, light ? '#d7c5ef' : '#272241', color, 2);
                polygon(c, [[-r * .53, -r * .4], [r * .7, -r * .38], [r * .2, r * .35]], color + '32');
                c.beginPath(); c.moveTo(-r * .6, r * .46); c.lineTo(0, r * .1); c.lineTo(r * .34, -r * .42);
                c.strokeStyle = color + '95'; c.lineWidth = 1.2; c.stroke();
                if (enemy.grace) { c.setLineDash([3, 4]); ring(c, 0, 0, r + 4, color, 1); }
            });
        }
        ship(obj, angle, light, kind, thrust = false) {
            const player = kind === 'player' || kind === 'escort';
            const color = player ? (light ? '#00638d' : '#80f4ff') : (light ? '#a13d54' : '#ffa08a');
            copies(this.ctx, obj, thrust ? 100 : 60, c => {
                c.rotate(angle);
                c.scale(obj.radius / 12, obj.radius / 12);
                if (thrust) {
                    const flame = c.createLinearGradient(-48, 0, -8, 0);
                    flame.addColorStop(0, '#ad6aff00'); flame.addColorStop(0.65, '#9f68ff'); flame.addColorStop(1, '#d7ffff');
                    polygon(c, [[-11, -5], [-47, 0], [-11, 5]], flame);
                }
                if (obj.invulnerable > 0 && !this.reduced) c.globalAlpha = 0.82;
                const bulky = kind === 'gunship' || kind === 'frigate' || kind === 'transport';
                const points = bulky ? [[14, -8], [9, -11], [-10, -11], [-14, -5], [-14, 5], [-10, 11], [9, 11], [14, 8]]
                    : [[19, 0], [2, -6], [-9, -12], [-14, -7], [-8, 0], [-14, 7], [-9, 12], [2, 6]];
                polygon(c, points, light ? (player ? '#b3edf4' : '#f7d0c8') : (player ? '#103748' : '#381f37'), color);
                polygon(c, [[8, 0], [-6, -3], [-6, 3]], color);
                if (obj.shield) ring(c, 0, 0, 24, light ? '#007c9e' : '#7eeaff', 1.6);
                if (kind === 'player') {
                    c.beginPath(); c.moveTo(23, 0); c.lineTo(35, 0); c.strokeStyle = color; c.stroke();
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
            this.background(game.data.sector, light);
            c.drawImage(this.back, 0, 0);
            c.save();
            const jitter = this.reduced ? 0 : this.shake * 8;
            c.translate(Math.sin(game.time * 220) * jitter, Math.cos(game.time * 260) * jitter);
            for (const field of game.fields) this.field(field, game.time, light);
            for (const warning of game.warnings) copies(c, warning, 26, ctx => {
                ctx.setLineDash([5, 4]);
                ring(ctx, 0, 0, 13 + warning.ttl * 8, light ? '#ad441e' : '#ffb06e', 2);
                polygon(ctx, [[0, -10], [9, 7], [-9, 7]], '#fbb47742', light ? '#ad441e' : '#ffb06e');
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
                ctx.globalAlpha = item.ttl < 3 ? 0.7 : 1;
                if (item.ttl < 3) ctx.setLineDash([3, 3]);
                ring(ctx, 0, 0, 15, gold, 2);
                ctx.font = 'bold 16px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillStyle = gold; ctx.fillText(icons[item.type], 0, 1);
            });
            for (const bullet of game.projectiles) copies(c, bullet, 23, ctx => {
                ctx.rotate(Math.atan2(bullet.vy, bullet.vx));
                ctx.strokeStyle = bullet.hostile ? (light ? '#c4482d' : '#ff9d68') :
                    bullet.type === 'laser' ? (light ? '#6f32b7' : '#d3a7ff') : color;
                ctx.lineWidth = bullet.type === 'laser' ? 4 : 2.6;
                ctx.beginPath(); ctx.moveTo(bullet.type === 'laser' ? -19 : -7, 0); ctx.lineTo(4, 0); ctx.stroke();
            });
            if (p.hull > 0) {
                const speed = Math.hypot(p.vx, p.vy);
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
            for (const flash of this.rings) copies(c, flash, flash.radius, ctx => {
                ctx.globalAlpha = Math.min(0.65, flash.life); ring(ctx, 0, 0, flash.radius, flash.color, 2);
            });
            if (!this.reduced) for (const particle of this.particles) copies(c, particle, 14, ctx => {
                ctx.globalAlpha = Math.min(0.85, particle.life * 2);
                ctx.rotate(particle.angle);
                polygon(ctx, [[particle.radius, 0], [-particle.radius, 3], [-particle.radius * 0.6, -2]], particle.color);
            });
            c.restore();
            c.strokeStyle = light ? '#38607a' : '#7ce5ff85';
            c.lineWidth = 2;
            c.strokeRect(1, 1, size - 2, size - 2);
        }
    }
    globalThis.NeonAsteroidsRenderer = Renderer;
})();
