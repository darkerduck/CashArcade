(function (root) {
    'use strict';
    const { H, CEILING, FLOOR, platformAt, laserState } = root.GravityCourier;
    const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
    const TAU = Math.PI * 2;
    // Deterministic neon sign colours for the far skyline.
    const SIGNS = ['#ff618f', '#57edff', '#ffcf73', '#b98cff'];
    class Renderer {
        constructor(canvas) {
            this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.width = 1000; this.effects = [];
            const FX = root.CashArcadeFX;
            // World effects scroll with the camera; screen effects (shake, flash, banner) do not.
            this.world = FX?.createFx({ maxParticles: 320 }) ?? null;
            this.screen = FX?.createFx({ maxShake: 10 }) ?? null;
            this.flipAt = -1; this.clock = 0; this.last = 0;
        }
        get busy() { return Boolean(this.world?.busy || this.screen?.busy); }
        event(event, time) {
            if (['shard', 'flip', 'death', 'delivery'].includes(event.type)) this.effects.push({ ...event, born: time });
            const w = this.world, s = this.screen, p = this.colors || { cyan: '#57edff', pink: '#ff618f', gold: '#ffcf73' };
            if (event.type === 'flip') this.flipAt = this.clock;
            if (!w || !s) return;
            if (event.type === 'flip') w.burst(event.x, event.y, { kind: 'spark', color: p.cyan, count: 8, speed: 180, life: .3, size: 2 });
            else if (event.type === 'shard') {
                w.burst(event.x, event.y, { kind: 'ring', color: p.gold, size: 70, life: .45 });
                w.burst(event.x, event.y, { kind: 'spark', color: p.gold, count: 14, speed: 260, life: .5 });
                w.popup(event.x, event.y - 30, 'BOOST!', { color: p.gold, size: 16 });
                s.flash(p.gold, .1, .14); s.shake(.12);
            } else if (event.type === 'death') {
                w.burst(event.x, event.y, { kind: 'shard', color: p.pink, count: 26, speed: 340, life: 1, size: 2.6 });
                w.burst(event.x, event.y, { kind: 'spark', color: '#ffffff', count: 16, speed: 420, life: .5 });
                w.burst(event.x, event.y, { kind: 'ring', color: p.pink, size: 150, life: .6 });
                s.flash('#ff3d6a', .3, .35); s.shake(.85);
            } else if (event.type === 'delivery') {
                w.burst(event.x || 0, event.y || H / 2, { kind: 'ring', color: p.cyan, size: 260, life: .9 });
                s.banner('DELIVERED', `${'★'.repeat(event.stars || 1)}${'☆'.repeat(3 - (event.stars || 1))}`, { color: p.cyan, duration: 1.4 });
            } else if (event.type === 'start') {
                s.banner(this.levelName || 'ROUTE START', this.zone || '', { color: p.cyan, duration: 1 });
            }
        }
        render(game, options = {}) {
            const c = this.ctx, light = options.theme === 'light', reduced = options.reducedMotion;
            const now = root.performance?.now?.() ?? 0, dt = options.dt ?? (this.last ? clamp((now - this.last) / 1000, 0, .05) : 0);
            this.last = now; this.clock += dt;
            this.world?.setReduced(reduced); this.screen?.setReduced(reduced);
            this.world?.update(dt); this.screen?.update(dt);
            this.levelName = game.level.name; this.zone = game.level.zone;
            const rect = this.canvas.getBoundingClientRect(), ratio = Math.min(root.devicePixelRatio || 1, 2);
            const width = clamp(Math.round((rect.width || 1000) / (rect.height || 600) * H), 600, 1100);
            this.width = width;
            if (this.canvas.width !== Math.round(width * ratio) || this.canvas.height !== Math.round(H * ratio)) { this.canvas.width = Math.round(width * ratio); this.canvas.height = Math.round(H * ratio); }
            c.setTransform(ratio, 0, 0, ratio, 0, 0);
            const camera = clamp(game.player.x - width * .25, 0, game.level.length - width);
            const time = reduced ? 0 : game.time;
            this.colors = { cyan: light ? '#007b99' : '#57edff', pink: light ? '#c03071' : '#ff618f', gold: light ? '#966014' : '#ffcf73', text: light ? '#244961' : '#8ca6c2', rail: light ? '#bed0df' : '#172b46', ink: light ? '#e7f1f8' : '#091425' };
            const p = this.colors;
            c.save();
            this.screen?.apply(c);
            const bg = c.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, light ? '#d1e3f0' : '#040b19'); bg.addColorStop(.55, light ? '#e8f1f8' : '#120f2c'); bg.addColorStop(1, light ? '#c0d7e8' : '#06192a'); c.fillStyle = bg; c.fillRect(-20, -20, width + 40, H + 40);
            this.skyline(c, width, camera, light, time);
            this.midground(c, width, camera, light);
            this.rails(c, width, camera, light);
            if (!reduced && !light && game.state === 'running') this.speedLines(c, width, game);
            c.save(); c.translate(-camera, 0);
            for (let x = 330; x < game.level.length - 300; x += 600) { c.strokeStyle = p.cyan + '44'; c.lineWidth = 2; for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(x + i * 14, 295); c.lineTo(x + 7 + i * 14, 302); c.lineTo(x + i * 14, 309); c.stroke(); } }
            for (const item of game.level.platforms) { if (item.x + item.w < camera || item.x > camera + width) continue; this.platform(c, platformAt(item, game.time), light, time); }
            for (const item of game.level.spikes) { if (item.x + item.w < camera || item.x > camera + width) continue; this.spikes(c, item, light, time); }
            for (const item of game.level.lasers) { if (item.x < camera - 30 || item.x > camera + width + 30) continue; this.laser(c, item, laserState(item, game.time), game.time, reduced); }
            game.level.shards.forEach((item, index) => { if (!game.collected.includes(index) && item.x > camera - 25 && item.x < camera + width + 25) this.shard(c, item, time + index); });
            this.gate(c, game.level.length - 100, time, game.state === 'delivered', light);
            if (!reduced) { c.lineCap = 'round'; game.trail.forEach((point, i) => { c.globalAlpha = i / game.trail.length * .4; c.strokeStyle = game.boost > 0 ? p.gold : p.cyan; c.lineWidth = 2 + i / game.trail.length * 10; c.beginPath(); c.moveTo(point.x - 7, point.y); c.lineTo(point.x + 2, point.y); c.stroke(); }); c.globalAlpha = 1; }
            if (game.state !== 'lost') this.courier(c, game.player, game.boost, time, light, reduced);
            this.effects = this.effects.filter(e => game.time - e.born < .65);
            if (!this.world && !reduced) for (const effect of this.effects) {
                const age = game.time - effect.born, color = effect.type === 'death' ? p.pink : effect.type === 'shard' ? p.gold : p.cyan;
                c.globalAlpha = Math.max(0, 1 - age / .65); c.fillStyle = color;
                for (let i = 0; i < 10; i++) { const angle = i * 2.399, distance = 10 + age * (40 + i * 8); c.fillRect((effect.x || game.player.x) + Math.cos(angle) * distance, (effect.y || game.player.y) + Math.sin(angle) * distance, 3, 3); } c.globalAlpha = 1;
            }
            this.world?.draw(c, width, H);
            c.restore();
            this.foreground(c, width, camera, light);
            // Quiet, embedded navigational details stay legible on touch screens.
            c.fillStyle = p.text; c.font = '600 10px ui-monospace, monospace'; c.textAlign = 'left'; c.fillText(game.level.zone, 22, 33);
            c.textAlign = 'right'; c.fillText('CORE ' + (game.state === 'delivered' ? 'DELIVERED' : 'SECURED') + '  /  ' + Math.round(game.progress * 100) + '%', width - 22, 33);
            if (game.state === 'running') { c.textAlign = 'left'; c.fillStyle = game.boost > 0 ? p.gold : p.cyan; c.font = '600 11px sans-serif'; c.fillText(game.boost > 0 ? '超速配送 +' : game.player.gravity > 0 ? '↓ 重力向下' : '↑ 重力向上', 22, 580); }
            c.textAlign = 'right'; c.fillStyle = p.text; c.font = '10px sans-serif'; c.fillText('目的地 ' + Math.max(0, Math.round((game.level.length - 100 - game.player.x) / 10)) + ' m', width - 22, 580);
            c.textAlign = 'left';
            this.screen?.draw(c, width, H);
            c.restore();
            if (!light) root.CashArcadeFX?.crt(c, width, H, .05);
        }
        // Far layer: tower silhouettes with twinkling windows and rooftop neon signs.
        skyline(c, width, camera, light, time) {
            const p = this.colors;
            for (let i = -2; i < 18; i++) {
                const base = i + Math.floor(camera * .18 / 110), x = i * 110 - (camera * .18) % 110, height = 80 + ((base + 24) * 71 % 150 + 150) % 150;
                c.fillStyle = light ? '#bdcfdf' : '#111a33'; c.fillRect(x, FLOOR - height, 75, height);
                c.fillStyle = light ? '#aabfd3' : '#18233f'; c.fillRect(x + 45, FLOOR - height - 28, 15, 28);
                c.strokeStyle = light ? '#9db6cc' : '#2a3a63'; c.lineWidth = 1; c.strokeRect(x + .5, FLOOR - height + .5, 74, height);
                for (let row = 0; row < 5; row++) for (const col of [10, 30, 52]) {
                    const seed = (base * 31 + row * 7 + col) % 11, lit = seed < 4 && (light || Math.sin(time * .7 + seed * 3 + base) > -.6);
                    c.fillStyle = lit ? (light ? '#7d9cc0' : seed % 2 ? '#ffd98a55' : '#7ee8ff55') : (light ? '#a7b7cf' : '#202a4d');
                    c.fillRect(x + col, FLOOR - height + 12 + row * 29, 7, 12);
                }
                if (!light && ((base % 4) + 4) % 4 === 1) {
                    // Rooftop sign: a glowing bar with a soft halo line.
                    const color = SIGNS[((base % 4) + 4) % 4 === 1 ? ((base >> 2) % 4 + 4) % 4 : 0];
                    c.fillStyle = color + '33'; c.fillRect(x + 4, FLOOR - height - 16, 40, 10);
                    c.fillStyle = color; c.fillRect(x + 8, FLOOR - height - 13, 32, 4);
                }
            }
        }
        // Mid layer: an elevated maglev track and support pipes at 0.45–0.6 camera speed.
        midground(c, width, camera, light) {
            const p = this.colors;
            c.globalAlpha = light ? .18 : .1; c.strokeStyle = p.cyan; c.lineWidth = 1;
            for (let x = -(camera * .45) % 100; x < width; x += 100) { c.beginPath(); c.moveTo(x, CEILING); c.lineTo(x, FLOOR); c.stroke(); }
            for (let y = 120; y < FLOOR; y += 70) { c.beginPath(); c.moveTo(0, y); c.lineTo(width, y); c.stroke(); }
            c.globalAlpha = 1;
            const trackY = 372;
            c.fillStyle = light ? '#a8c0d4' : '#0e1c33'; c.fillRect(0, trackY, width, 9);
            c.fillStyle = light ? '#6d8fae' : '#57edff55'; c.fillRect(0, trackY, width, 2);
            for (let x = -(camera * .5) % 160; x < width; x += 160) { c.fillStyle = light ? '#b5c9da' : '#0f1d34'; c.fillRect(x, trackY + 9, 10, FLOOR - trackY - 9); c.fillStyle = light ? '#8fb0c9' : '#ff618f66'; c.fillRect(x + 3, trackY + 14, 4, 4); }
            for (let i = -1; i < 5; i++) { const x = i * 390 - (camera * .6) % 390; c.strokeStyle = light ? '#9cb7cd55' : '#26354b88'; c.lineWidth = 9; c.beginPath(); c.moveTo(x, CEILING); c.lineTo(x, 150); c.lineTo(x + 50, 200); c.lineTo(x + 50, 400); c.lineTo(x, 450); c.lineTo(x, FLOOR); c.stroke(); }
        }
        // Foreground pillars pass faster than the player for depth; kept dark and thin to stay out of the way.
        foreground(c, width, camera, light) {
            const p = this.colors;
            for (let x = -(camera * 1.35) % 820 + 600; x < width + 60; x += 820) {
                c.fillStyle = light ? '#9db4c866' : '#02060dcc'; c.fillRect(x, 0, 26, H);
                c.fillStyle = p.cyan + (light ? '55' : '66'); c.fillRect(x + 24, 0, 2, H);
            }
        }
        speedLines(c, width, game) {
            const fast = game.boost > 0, n = fast ? 16 : 7, color = fast ? this.colors.gold : this.colors.cyan;
            c.save(); c.globalCompositeOperation = 'lighter';
            for (let i = 0; i < n; i++) {
                const y = CEILING + 20 + ((i * 137 + Math.floor(game.time * 7) * 53) % (FLOOR - CEILING - 40));
                const x = width - ((game.time * (fast ? 1600 : 900) + i * 211) % (width + 300));
                c.globalAlpha = fast ? .35 : .14; c.strokeStyle = color; c.lineWidth = 1.5;
                c.beginPath(); c.moveTo(x, y); c.lineTo(x + (fast ? 140 : 80), y); c.stroke();
            }
            c.restore();
        }
        rails(c, width, camera, light) {
            const p = this.colors; c.fillStyle = p.rail; c.fillRect(0, 41, width, 19); c.fillRect(0, FLOOR, width, 19);
            c.strokeStyle = p.cyan + '40'; c.lineWidth = 6; c.beginPath(); c.moveTo(0, CEILING); c.lineTo(width, CEILING); c.moveTo(0, FLOOR); c.lineTo(width, FLOOR); c.stroke();
            c.strokeStyle = p.cyan; c.lineWidth = 2; c.beginPath(); c.moveTo(0, CEILING); c.lineTo(width, CEILING); c.moveTo(0, FLOOR); c.lineTo(width, FLOOR); c.stroke();
            for (let x = -(camera % 48); x < width; x += 48) { c.fillStyle = light ? '#90afc5' : '#38506c'; c.fillRect(x + 9, 48, 22, 4); c.fillRect(x + 9, 548, 22, 4); }
            c.fillStyle = light ? '#8ca8c144' : '#030d19aa'; c.fillRect(0, CEILING + 3, width, 7); c.fillRect(0, FLOOR - 10, width, 7);
        }
        spikes(c, item, light, time) {
            const p = this.colors, down = item.side === 'top';
            c.fillStyle = p.pink + (light ? '12' : '18'); c.fillRect(item.x, item.y, item.w, item.h);
            const n = Math.max(3, Math.round(item.w / 30)), base = down ? item.y : item.y + item.h, tip = down ? item.y + item.h : item.y;
            c.beginPath(); c.moveTo(item.x, base);
            for (let i = 0; i < n; i++) { c.lineTo(item.x + (i + .5) * item.w / n, tip); c.lineTo(item.x + (i + 1) * item.w / n, base); }
            c.closePath();
            const fill = c.createLinearGradient(0, base, 0, tip); fill.addColorStop(0, light ? '#943654' : '#7a1f47'); fill.addColorStop(1, light ? '#c86184' : '#2a0c20');
            c.fillStyle = fill; c.fill();
            c.strokeStyle = p.pink + '45'; c.lineWidth = 6; c.stroke(); c.strokeStyle = p.pink; c.lineWidth = 2; c.stroke();
            // Base plate with running warning lights.
            c.fillStyle = light ? '#c7d5e2' : '#1b0d1c'; c.fillRect(item.x - 4, down ? base : base - 8, item.w + 8, 8);
            c.fillStyle = p.pink; c.fillRect(item.x - 4, down ? base + 6 : base - 8, item.w + 8, 2);
            const lights = Math.max(3, Math.floor(item.w / 24));
            for (let i = 0; i < lights; i++) { const on = Math.floor(time * 6 + i) % lights === 0; c.fillStyle = on ? '#ffffff' : p.pink + '88'; c.fillRect(item.x + 6 + i * (item.w - 12) / Math.max(1, lights - 1) - 2, down ? base + 2 : base - 5, 4, 3); }
            c.globalAlpha = .6; c.font = '700 8px ui-monospace, monospace'; c.textAlign = 'center'; c.fillStyle = p.pink; c.fillText('危 險', item.x + item.w / 2, down ? base + 19 : base - 12); c.textAlign = 'left'; c.globalAlpha = 1;
        }
        platform(c, item, light, time) {
            const p = this.colors;
            c.fillStyle = light ? '#7fb4c6' : '#0f3550'; c.fillRect(item.x, item.y, item.w, item.h);
            c.strokeStyle = p.cyan + '40'; c.lineWidth = 6; c.strokeRect(item.x, item.y, item.w, item.h);
            c.strokeStyle = p.cyan; c.lineWidth = 2; c.strokeRect(item.x, item.y, item.w, item.h);
            c.fillStyle = p.cyan; for (let x = item.x + 12; x < item.x + item.w - 8; x += 28) c.fillRect(x, item.y + 7, 12, 3);
            // Hover thrusters flicker under each end.
            for (const x of [item.x + 18, item.x + item.w - 18]) { const flame = 6 + Math.sin(time * 30 + x) * 2; c.fillStyle = p.cyan + '66'; c.beginPath(); c.moveTo(x - 5, item.y + item.h); c.lineTo(x, item.y + item.h + flame); c.lineTo(x + 5, item.y + item.h); c.fill(); }
            c.strokeStyle = p.cyan + '55'; c.setLineDash([3, 6]); c.beginPath(); c.moveTo(item.x + item.w / 2, item.y - 33); c.lineTo(item.x + item.w / 2, item.y + item.h + 33); c.stroke(); c.setLineDash([]);
            c.fillStyle = p.cyan; c.beginPath(); c.moveTo(item.x + item.w / 2 - 4, item.y - 23); c.lineTo(item.x + item.w / 2, item.y - 29); c.lineTo(item.x + item.w / 2 + 4, item.y - 23); c.fill();
        }
        laser(c, item, state, time, reduced) {
            const p = this.colors, active = state === 'active', warning = state === 'warning';
            const color = active ? p.pink : warning ? p.gold : p.text;
            c.save(); c.strokeStyle = color; c.fillStyle = color;
            if (active) {
                const jitter = reduced ? 0 : Math.sin(time * 90) * 1.5;
                c.globalAlpha = .16; c.fillRect(item.x - 13, item.y, 36, item.h); c.globalAlpha = .35; c.lineWidth = 16;
                c.beginPath(); c.moveTo(item.x + 5 + jitter, item.y); c.lineTo(item.x + 5 - jitter, item.y + item.h); c.stroke();
                c.globalAlpha = 1; c.lineWidth = 5; c.beginPath(); c.moveTo(item.x + 5, item.y); c.lineTo(item.x + 5, item.y + item.h); c.stroke();
                c.strokeStyle = '#ffffff'; c.lineWidth = 1.5;
            } else { c.globalAlpha = warning ? .9 : .22; c.lineWidth = warning ? 2 : 1; c.setLineDash(warning ? [7, 6] : [2, 8]); }
            c.beginPath(); c.moveTo(item.x + 5, item.y); c.lineTo(item.x + 5, item.y + item.h); c.stroke(); c.setLineDash([]); c.globalAlpha = 1;
            for (const y of [item.y, item.y + item.h]) { c.fillStyle = p.rail; c.fillRect(item.x - 7, y - 8, 24, 16); c.strokeStyle = color; c.lineWidth = 2; c.strokeRect(item.x - 7, y - 8, 24, 16); c.fillStyle = color; c.fillRect(item.x - 1, y - 3, 12, 6); }
            // Cycle meter shows upcoming reactivation without requiring sound.
            const phase = ((time + item.phase) % item.period) / item.period;
            c.strokeStyle = color; c.lineWidth = 2; c.beginPath(); c.arc(item.x + 5, item.y + item.h / 2, 18, -Math.PI / 2, -Math.PI / 2 + phase * TAU); c.stroke(); c.restore();
        }
        shard(c, item, time) {
            c.save(); c.translate(item.x, item.y + Math.sin(time * 3) * 3); const p = this.colors;
            c.strokeStyle = p.gold + '55'; c.lineWidth = 1; c.beginPath(); c.arc(0, 0, 24 + Math.sin(time * 4) * 2, 0, TAU); c.stroke();
            c.rotate(time * 1.2); c.strokeStyle = p.gold + '88'; c.setLineDash([4, 6]); c.beginPath(); c.arc(0, 0, 18, 0, TAU); c.stroke(); c.setLineDash([]); c.rotate(-time * 1.2);
            c.rotate(Math.sin(time * 2) * .13); c.fillStyle = p.gold;
            c.beginPath(); c.moveTo(0, -13); c.lineTo(11, 0); c.lineTo(0, 13); c.lineTo(-11, 0); c.closePath(); c.fill();
            c.strokeStyle = p.gold + '50'; c.lineWidth = 6; c.stroke();
            c.strokeStyle = '#fff7dc'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, -8); c.lineTo(-6, 0); c.stroke(); c.restore();
        }
        gate(c, x, time, delivered, light) {
            const p = this.colors; c.save(); c.translate(x, 0);
            c.fillStyle = p.cyan + '12'; c.fillRect(-30, CEILING + 10, 60, FLOOR - CEILING - 20);
            // Energy curtain: bright bands rising through the doorway.
            for (let i = 0; i < 6; i++) { const y = FLOOR - 40 - ((time * 140 + i * 72) % (FLOOR - CEILING - 80)); c.fillStyle = p.cyan + '30'; c.fillRect(-24, y, 48, 3); }
            c.strokeStyle = p.cyan + '45'; c.lineWidth = 14;
            c.beginPath(); c.moveTo(20, CEILING + 28); c.lineTo(-14, CEILING + 28); c.lineTo(-28, CEILING + 42); c.lineTo(-28, FLOOR - 42); c.lineTo(-14, FLOOR - 28); c.lineTo(20, FLOOR - 28); c.stroke();
            c.strokeStyle = p.cyan; c.lineWidth = 5; c.stroke();
            c.setLineDash([3, 12]); c.lineWidth = 2; c.beginPath(); c.moveTo(9, CEILING + 48); c.lineTo(9, FLOOR - 48); c.stroke(); c.setLineDash([]);
            c.fillStyle = p.cyan; c.font = '700 11px sans-serif'; c.textAlign = 'center'; c.fillText(delivered ? '已送達' : '配送出口', -1, 302); c.font = '9px ui-monospace, monospace'; c.fillText('DELIVERY', -1, 320); c.restore();
        }
        courier(c, player, boost, time, light, reduced) {
            const p = this.colors; c.save(); c.translate(player.x, player.y);
            // Flip: the courier squashes through zero height and stretches out the other side.
            const k = reduced || this.flipAt < 0 ? 1 : clamp((this.clock - this.flipAt) / .14, 0, 1);
            const flipScale = player.gravity * (k < 1 ? Math.cos(Math.PI * (1 - k)) * -1 : 1);
            c.scale(1.15 * (1 + Math.sin(Math.PI * k) * .25), 1.15 * (Math.abs(flipScale) < .2 ? .2 * Math.sign(flipScale || player.gravity) : flipScale));
            const tilt = player.grounded ? 0 : clamp(player.vy / 2000, -.16, .16); c.rotate(tilt);
            if (boost > 0) { c.fillStyle = p.gold; c.globalAlpha = .7; c.beginPath(); c.moveTo(-15, -6); c.lineTo(-40 - Math.sin(time * 60) * 7, 0); c.lineTo(-15, 6); c.fill(); c.globalAlpha = 1; }
            c.strokeStyle = p.cyan; c.lineWidth = 3; c.lineCap = 'round'; const gait = player.grounded && !reduced ? Math.sin(time * 35) * 3 : 0;
            c.beginPath(); c.moveTo(-6, 9); c.lineTo(-7 - gait, 14); c.moveTo(6, 9); c.lineTo(7 + gait, 14); c.stroke();
            // Parcel backpack with a glowing core.
            c.fillStyle = light ? '#8a5a12' : '#2a1d08'; c.fillRect(-19, -9, 10, 15); c.strokeStyle = p.gold; c.lineWidth = 1.5; c.strokeRect(-19, -9, 10, 15);
            c.fillStyle = p.gold; c.fillRect(-16, -5, 4, 7);
            // Helmet body, double-stroked, with a bright visor band.
            c.fillStyle = light ? '#244863' : '#0d2740'; c.beginPath(); c.roundRect(-12, -13, 24, 23, 8); c.fill();
            c.strokeStyle = p.cyan + '45'; c.lineWidth = 5; c.stroke(); c.strokeStyle = p.cyan; c.lineWidth = 2; c.stroke();
            c.fillStyle = light ? '#cfefff' : '#9ff6ff'; c.beginPath(); c.roundRect(0, -8, 11, 6, 3); c.fill();
            c.fillStyle = '#ffffff'; c.fillRect(6, -7, 3, 2);
            c.strokeStyle = p.cyan; c.lineWidth = 1.5; c.beginPath(); c.moveTo(-2, -13); c.lineTo(2, -21); c.stroke(); c.fillStyle = p.gold; c.beginPath(); c.arc(2, -21, 2.5, 0, TAU); c.fill(); c.restore();
        }
    }
    root.GravityCourierRenderer = { Renderer }; if (typeof module !== 'undefined' && module.exports) module.exports = { Renderer };
})(globalThis);
