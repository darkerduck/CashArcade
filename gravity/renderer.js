(function (root) {
    'use strict';
    const { H, CEILING, FLOOR, RADIUS, platformAt, laserState } = root.GravityCourier;
    const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
    class Renderer {
        constructor(canvas) { this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.width = 1000; this.effects = []; }
        event(event, time) { if (['shard', 'flip', 'death', 'delivery'].includes(event.type)) this.effects.push({ ...event, born: time }); }
        render(game, options = {}) {
            const c = this.ctx, light = options.theme === 'light', reduced = options.reducedMotion;
            const rect = this.canvas.getBoundingClientRect(), ratio = Math.min(root.devicePixelRatio || 1, 2);
            const width = clamp(Math.round((rect.width || 1000) / (rect.height || 600) * H), 600, 1100);
            this.width = width;
            if (this.canvas.width !== Math.round(width * ratio) || this.canvas.height !== Math.round(H * ratio)) { this.canvas.width = Math.round(width * ratio); this.canvas.height = Math.round(H * ratio); }
            c.setTransform(ratio, 0, 0, ratio, 0, 0);
            const camera = clamp(game.player.x - width * .25, 0, game.level.length - width);
            const time = reduced ? 0 : game.time;
            this.colors = { cyan: light ? '#007b99' : '#57edff', pink: light ? '#c03071' : '#ff618f', gold: light ? '#966014' : '#ffcf73', text: light ? '#244961' : '#8ca6c2', rail: light ? '#bed0df' : '#172b46', ink: light ? '#e7f1f8' : '#091425' };
            const p = this.colors;
            const bg = c.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, light ? '#d1e3f0' : '#050e1e'); bg.addColorStop(.55, light ? '#e8f1f8' : '#11142e'); bg.addColorStop(1, light ? '#c0d7e8' : '#071a2b'); c.fillStyle = bg; c.fillRect(0, 0, width, H);
            c.save();
            // Layered original vector skyline, station windows and parallax antennae.
            for (let i = -2; i < 18; i++) {
                const x = i * 110 - (camera * .18) % 110, height = 80 + ((i + 24) * 71 % 150);
                c.fillStyle = light ? '#bdcfdf' : '#14203b'; c.fillRect(x, FLOOR - height, 75, height);
                c.fillStyle = light ? '#aabfd3' : '#1c2b48'; c.fillRect(x + 45, FLOOR - height - 28, 15, 28);
                for (let row = 0; row < 5; row++) { c.fillStyle = row % 2 ? (light ? '#95b0c9' : '#294065') : (light ? '#a7b7cf' : '#31325c'); c.fillRect(x + 10, FLOOR - height + 12 + row * 29, 7, 12); c.fillRect(x + 30, FLOOR - height + 12 + row * 29, 7, 12); }
            }
            c.globalAlpha = light ? .18 : .12; c.strokeStyle = p.cyan; c.lineWidth = 1;
            for (let x = -(camera * .45) % 100; x < width; x += 100) { c.beginPath(); c.moveTo(x, CEILING); c.lineTo(x, FLOOR); c.stroke(); }
            for (let y = 120; y < FLOOR; y += 70) { c.beginPath(); c.moveTo(0, y); c.lineTo(width, y); c.stroke(); }
            c.globalAlpha = 1;
            for (let i = -1; i < 5; i++) { const x = i * 390 - (camera * .6) % 390; c.strokeStyle = light ? '#9cb7cd55' : '#26354b88'; c.lineWidth = 9; c.beginPath(); c.moveTo(x, CEILING); c.lineTo(x, 150); c.lineTo(x + 50, 200); c.lineTo(x + 50, 400); c.lineTo(x, 450); c.lineTo(x, FLOOR); c.stroke(); }
            c.restore();
            this.rails(c, width, camera, light);
            c.save(); c.translate(-camera, 0);
            for (let x = 330; x < game.level.length - 300; x += 600) { c.strokeStyle = p.cyan + '44'; c.lineWidth = 2; for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(x + i * 14, 295); c.lineTo(x + 7 + i * 14, 302); c.lineTo(x + i * 14, 309); c.stroke(); } }
            for (const item of game.level.platforms) { if (item.x + item.w < camera || item.x > camera + width) continue; this.platform(c, platformAt(item, game.time), light); }
            for (const item of game.level.spikes) { if (item.x + item.w < camera || item.x > camera + width) continue; this.spikes(c, item, light); }
            for (const item of game.level.lasers) { if (item.x < camera - 30 || item.x > camera + width + 30) continue; this.laser(c, item, laserState(item, game.time), game.time, reduced); }
            game.level.shards.forEach((item, index) => { if (!game.collected.includes(index) && item.x > camera - 25 && item.x < camera + width + 25) this.shard(c, item, time + index); });
            this.gate(c, game.level.length - 100, time, game.state === 'delivered', light);
            if (!reduced) { c.lineCap = 'round'; game.trail.forEach((point, i) => { c.globalAlpha = i / game.trail.length * .35; c.strokeStyle = game.boost > 0 ? p.gold : p.cyan; c.lineWidth = 2 + i / game.trail.length * 8; c.beginPath(); c.moveTo(point.x - 7, point.y); c.lineTo(point.x + 2, point.y); c.stroke(); }); c.globalAlpha = 1; }
            if (game.state !== 'lost') this.courier(c, game.player, game.boost, time, light, reduced);
            this.effects = this.effects.filter(e => game.time - e.born < .65);
            if (!reduced) for (const effect of this.effects) {
                const age = game.time - effect.born, color = effect.type === 'death' ? p.pink : effect.type === 'shard' ? p.gold : p.cyan;
                c.globalAlpha = Math.max(0, 1 - age / .65); c.fillStyle = color;
                for (let i = 0; i < 10; i++) { const angle = i * 2.399, distance = 10 + age * (40 + i * 8); c.fillRect((effect.x || game.player.x) + Math.cos(angle) * distance, (effect.y || game.player.y) + Math.sin(angle) * distance, 3, 3); } c.globalAlpha = 1;
            }
            c.restore();
            // Quiet, embedded navigational details stay legible on touch screens.
            c.fillStyle = p.text; c.font = '600 10px ui-monospace, monospace'; c.textAlign = 'left'; c.fillText(game.level.zone, 22, 33);
            c.textAlign = 'right'; c.fillText('CORE ' + (game.state === 'delivered' ? 'DELIVERED' : 'SECURED') + '  /  ' + Math.round(game.progress * 100) + '%', width - 22, 33);
            if (game.state === 'running') { c.textAlign = 'left'; c.fillStyle = game.boost > 0 ? p.gold : p.cyan; c.font = '600 11px sans-serif'; c.fillText(game.boost > 0 ? '超速配送 +' : game.player.gravity > 0 ? '↓ 重力向下' : '↑ 重力向上', 22, 580); }
            c.textAlign = 'right'; c.fillStyle = p.text; c.font = '10px sans-serif'; c.fillText('目的地 ' + Math.max(0, Math.round((game.level.length - 100 - game.player.x) / 10)) + ' m', width - 22, 580);
            c.textAlign = 'left';
        }
        rails(c, width, camera, light) {
            const p = this.colors; c.fillStyle = p.rail; c.fillRect(0, 41, width, 19); c.fillRect(0, FLOOR, width, 19);
            c.strokeStyle = p.cyan; c.lineWidth = 2; c.beginPath(); c.moveTo(0, CEILING); c.lineTo(width, CEILING); c.moveTo(0, FLOOR); c.lineTo(width, FLOOR); c.stroke();
            for (let x = -(camera % 48); x < width; x += 48) { c.fillStyle = light ? '#90afc5' : '#38506c'; c.fillRect(x + 9, 48, 22, 4); c.fillRect(x + 9, 548, 22, 4); }
            c.fillStyle = light ? '#8ca8c144' : '#030d19aa'; c.fillRect(0, CEILING + 3, width, 7); c.fillRect(0, FLOOR - 10, width, 7);
        }
        spikes(c, item, light) {
            const p = this.colors, down = item.side === 'top'; c.fillStyle = p.pink + (light ? '12' : '14'); c.fillRect(item.x, item.y, item.w, item.h);
            c.fillStyle = light ? '#943654' : '#63203f'; c.strokeStyle = p.pink; c.lineWidth = 2;
            const n = Math.max(3, Math.round(item.w / 30)), base = down ? item.y : item.y + item.h, tip = down ? item.y + item.h : item.y;
            c.beginPath(); c.moveTo(item.x, base);
            for (let i = 0; i < n; i++) { c.lineTo(item.x + (i + .5) * item.w / n, tip); c.lineTo(item.x + (i + 1) * item.w / n, base); }
            c.closePath(); c.fill(); c.stroke();
            c.fillStyle = p.pink; c.fillRect(item.x, down ? base : base - 6, item.w, 6);
            c.globalAlpha = .6; c.font = '700 8px ui-monospace, monospace'; c.textAlign = 'center'; c.fillText('危 險', item.x + item.w / 2, down ? base + 17 : base - 10); c.textAlign = 'left'; c.globalAlpha = 1;
        }
        platform(c, item, light) {
            const p = this.colors; c.fillStyle = light ? '#7fb4c6' : '#174862'; c.fillRect(item.x, item.y, item.w, item.h);
            c.strokeStyle = p.cyan; c.lineWidth = 2; c.strokeRect(item.x, item.y, item.w, item.h);
            c.fillStyle = p.cyan; for (let x = item.x + 12; x < item.x + item.w - 8; x += 28) c.fillRect(x, item.y + 7, 12, 3);
            c.strokeStyle = p.cyan + '55'; c.setLineDash([3, 6]); c.beginPath(); c.moveTo(item.x + item.w / 2, item.y - 33); c.lineTo(item.x + item.w / 2, item.y + item.h + 33); c.stroke(); c.setLineDash([]);
            c.fillStyle = p.cyan; c.beginPath(); c.moveTo(item.x + item.w / 2 - 4, item.y - 23); c.lineTo(item.x + item.w / 2, item.y - 29); c.lineTo(item.x + item.w / 2 + 4, item.y - 23); c.fill();
        }
        laser(c, item, state, time, reduced) {
            const p = this.colors, active = state === 'active', warning = state === 'warning';
            const color = active ? p.pink : warning ? p.gold : p.text;
            c.save(); c.strokeStyle = color; c.fillStyle = color;
            if (active) { c.globalAlpha = .13; c.fillRect(item.x - 13, item.y, 36, item.h); c.globalAlpha = 1; c.lineWidth = 7; c.shadowBlur = reduced ? 0 : 15; c.shadowColor = color; }
            else { c.globalAlpha = warning ? .9 : .22; c.lineWidth = warning ? 2 : 1; c.setLineDash(warning ? [7, 6] : [2, 8]); }
            c.beginPath(); c.moveTo(item.x + 5, item.y); c.lineTo(item.x + 5, item.y + item.h); c.stroke(); c.setLineDash([]); c.shadowBlur = 0; c.globalAlpha = 1;
            for (const y of [item.y, item.y + item.h]) { c.fillStyle = p.rail; c.fillRect(item.x - 7, y - 8, 24, 16); c.strokeStyle = color; c.lineWidth = 2; c.strokeRect(item.x - 7, y - 8, 24, 16); c.fillStyle = color; c.fillRect(item.x - 1, y - 3, 12, 6); }
            // Cycle meter shows upcoming reactivation without requiring sound.
            const phase = ((time + item.phase) % item.period) / item.period;
            c.strokeStyle = color; c.lineWidth = 2; c.beginPath(); c.arc(item.x + 5, item.y + item.h / 2, 18, -Math.PI / 2, -Math.PI / 2 + phase * Math.PI * 2); c.stroke(); c.restore();
        }
        shard(c, item, time) {
            c.save(); c.translate(item.x, item.y); const p = this.colors;
            c.strokeStyle = p.gold + '55'; c.lineWidth = 1; c.beginPath(); c.arc(0, 0, 24 + Math.sin(time * 4) * 2, 0, Math.PI * 2); c.stroke();
            c.rotate(Math.sin(time * 2) * .13); c.fillStyle = p.gold; c.shadowColor = p.gold; c.shadowBlur = 13;
            c.beginPath(); c.moveTo(0, -13); c.lineTo(11, 0); c.lineTo(0, 13); c.lineTo(-11, 0); c.closePath(); c.fill(); c.shadowBlur = 0;
            c.strokeStyle = '#fff7dc'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, -8); c.lineTo(-6, 0); c.stroke(); c.restore();
        }
        gate(c, x, time, delivered, light) {
            const p = this.colors; c.save(); c.translate(x, 0); c.fillStyle = p.cyan + '12'; c.fillRect(-30, CEILING + 10, 60, FLOOR - CEILING - 20);
            c.strokeStyle = p.cyan; c.lineWidth = 5; c.shadowBlur = 16; c.shadowColor = p.cyan;
            c.beginPath(); c.moveTo(20, CEILING + 28); c.lineTo(-14, CEILING + 28); c.lineTo(-28, CEILING + 42); c.lineTo(-28, FLOOR - 42); c.lineTo(-14, FLOOR - 28); c.lineTo(20, FLOOR - 28); c.stroke(); c.shadowBlur = 0;
            c.setLineDash([3, 12]); c.lineWidth = 2; c.beginPath(); c.moveTo(9, CEILING + 48); c.lineTo(9, FLOOR - 48); c.stroke(); c.setLineDash([]);
            c.fillStyle = p.cyan; c.font = '700 11px sans-serif'; c.textAlign = 'center'; c.fillText(delivered ? '已送達' : '配送出口', -1, 302); c.font = '9px ui-monospace, monospace'; c.fillText('DELIVERY', -1, 320); c.restore();
        }
        courier(c, player, boost, time, light, reduced) {
            const p = this.colors; c.save(); c.translate(player.x, player.y); c.scale(1, player.gravity);
            const tilt = player.grounded ? 0 : clamp(player.vy / 2000, -.16, .16); c.rotate(tilt);
            if (boost > 0) { c.fillStyle = p.gold; c.globalAlpha = .7; c.beginPath(); c.moveTo(-13, -5); c.lineTo(-35 - Math.sin(time * 60) * 6, 0); c.lineTo(-13, 5); c.fill(); c.globalAlpha = 1; }
            c.strokeStyle = p.cyan; c.lineWidth = 3; const gait = player.grounded && !reduced ? Math.sin(time * 35) * 3 : 0;
            c.beginPath(); c.moveTo(-7, 8); c.lineTo(-8 - gait, 13); c.moveTo(7, 8); c.lineTo(8 + gait, 13); c.stroke();
            c.fillStyle = light ? '#244863' : '#112d49'; c.strokeStyle = p.cyan; c.lineWidth = 2; c.shadowBlur = reduced ? 0 : 12; c.shadowColor = p.cyan;
            c.beginPath(); c.roundRect(-13, -12, 26, 23, 6); c.fill(); c.stroke(); c.shadowBlur = 0;
            c.fillStyle = '#e4faff'; c.fillRect(2, -7, 7, 3); c.fillStyle = p.gold; c.fillRect(-17, -7, 8, 12); c.fillStyle = '#fff3d0'; c.fillRect(-15, -4, 3, 5);
            c.strokeStyle = p.cyan; c.lineWidth = 1.5; c.beginPath(); c.moveTo(1, -12); c.lineTo(5, -19); c.stroke(); c.fillStyle = p.gold; c.beginPath(); c.arc(5, -19, 2.5, 0, Math.PI * 2); c.fill(); c.restore();
        }
    }
    root.GravityCourierRenderer = { Renderer }; if (typeof module !== 'undefined' && module.exports) module.exports = { Renderer };
})(globalThis);
