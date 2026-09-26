(() => {
    'use strict';
    const { W, H, GROUND } = NeonDefense;
    const COLORS = { normal: '#ff527f', fast: '#ffcf64', split: '#c88aff', armored: '#f69b45', cruiser: '#ff69dd' };
    const ICONS = { rapid: '»', wide: '✦', slow: '◷', shield: '◇', emp: 'ϟ' };
    class Renderer {
        constructor(canvas) {
            this.canvas = canvas; this.c = canvas.getContext('2d'); this.particles = []; this.labels = [];
            this.shake = 0; this.flash = 0; this.reduced = matchMedia('(prefers-reduced-motion: reduce)');
            const dpr = Math.min(devicePixelRatio || 1, 2); canvas.width = W * dpr; canvas.height = H * dpr;
            this.dpr = dpr;
        }
        event(event) {
            const colors = { launch: '#73fff2', damage: '#ff527f', pickup: '#ffdf70', armor: '#ffcc64', bossDeath: '#f28bff' };
            const color = colors[event.type] || '#77fff1';
            const count = event.type === 'launch' ? 5 : event.type === 'bossDeath' ? 140 : 28;
            if (['launch', 'damage', 'pickup', 'armor', 'bossDeath', 'explosion', 'chain', 'shield', 'split'].includes(event.type)) {
                for (let i = 0; i < (this.reduced.matches ? Math.min(count, 8) : count); i++) {
                    const angle = Math.random() * Math.PI * 2, speed = 30 + Math.random() * 210;
                    this.particles.push({ x: event.x, y: event.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
                        life: .3 + Math.random() * .65, color });
                }
                if (this.particles.length > 500) this.particles.splice(0, this.particles.length - 500);
            }
            if (event.type === 'damage' || event.type === 'bossDeath') { this.shake = .3; this.flash = .18; }
            if (event.type === 'chain' && event.depth > 1) this.labels.push({ x: event.x, y: event.y, text: `CHAIN ×${Math.min(event.depth, 4)}`, life: .8 });
            if (this.labels.length > 20) this.labels.shift();
        }
        line(points, color, width = 2, glow = 0) {
            if (!points.length) return;
            const c = this.c; c.beginPath(); c.strokeStyle = color; c.lineWidth = width; c.shadowColor = color; c.shadowBlur = glow;
            points.forEach((p, i) => i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)); c.stroke(); c.shadowBlur = 0;
        }
        circle(x, y, r, color, fill = false, glow = 0) {
            const c = this.c; c.beginPath(); c.arc(x, y, Math.max(0, r), 0, Math.PI * 2); c.shadowColor = color; c.shadowBlur = glow;
            if (fill) { c.fillStyle = color; c.fill(); } else { c.strokeStyle = color; c.lineWidth = 2; c.stroke(); } c.shadowBlur = 0;
        }
        city(city, light) {
            const c = this.c, x = city.x, y = GROUND, hp = city.hp;
            const color = hp === 3 ? (light ? '#006e79' : '#66fff0')
                : hp === 2 ? (light ? '#855600' : '#ffc468')
                    : (light ? '#913a58' : '#ff739c');
            if (hp === 0) {
                c.fillStyle = light ? '#725b70' : '#392a42';
                for (const points of [
                    [[-30, 0], [-30, -9], [-19, -17], [-10, -6], [0, -12], [8, 0]],
                    [[4, 0], [12, -10], [20, -6], [27, -16], [31, 0]],
                ]) {
                    c.beginPath(); points.forEach(([dx, dy], i) => i ? c.lineTo(x + dx, y + dy) : c.moveTo(x + dx, y + dy));
                    c.closePath(); c.fill();
                }
                this.line([{ x: x - 30, y: y - 9 }, { x: x - 19, y: y - 17 }, { x: x - 10, y: y - 6 },
                    { x, y: y - 12 }, { x: x + 8, y }], color, 2);
                this.line([{ x: x + 12, y: y - 10 }, { x: x + 20, y: y - 6 }, { x: x + 27, y: y - 16 },
                    { x: x + 31, y }], color, 2);
                c.fillStyle = light ? '#463e53' : '#171b30';
                c.fillRect(x - 17, y - 5, 8, 4); c.fillRect(x + 17, y - 8, 7, 5);
            } else {
                const outline = hp === 3
                    ? [[-28, 0], [-28, -43], [-10, -43], [-10, -55], [9, -55], [9, -43], [28, -43], [28, 0]]
                    : hp === 2
                        ? [[-28, 0], [-28, -43], [-16, -43], [-11, -35], [-6, -49], [9, -49], [9, -43], [23, -43], [28, -36], [28, 0]]
                        : [[-28, 0], [-28, -24], [-18, -29], [-9, -18], [-2, -35], [7, -27], [14, -31], [22, -17], [28, -21], [28, 0]];
                c.beginPath(); outline.forEach(([dx, dy], i) => i ? c.lineTo(x + dx, y + dy) : c.moveTo(x + dx, y + dy));
                c.closePath(); c.fillStyle = hp === 3 ? (light ? '#d5eef3' : '#10374b')
                    : hp === 2 ? (light ? '#e6d9cb' : '#443447') : (light ? '#b9a9b9' : '#4e2b45');
                c.fill();
                this.line(outline.map(([dx, dy]) => ({ x: x + dx, y: y + dy })), color, 2, light ? 0 : 6);
                if (hp === 3) {
                    c.fillStyle = light ? '#006e79' : '#81fff2';
                    for (const dx of [-18, -5, 8]) for (const dy of [-33, -19]) c.fillRect(x + dx, y + dy, 8, 7);
                } else {
                    c.fillStyle = light ? '#3c4155' : '#141827';
                    for (const [dx, dy] of hp === 2 ? [[-19, -31], [-4, -30], [10, -31], [-18, -17], [8, -17]]
                        : [[-19, -17], [-4, -19], [11, -15]]) c.fillRect(x + dx, y + dy, 8, 7);
                    this.line(hp === 2
                        ? [{ x: x + 9, y: y - 49 }, { x: x + 3, y: y - 35 }, { x: x + 13, y: y - 27 }, { x: x + 7, y: y - 12 }]
                        : [{ x: x - 2, y: y - 35 }, { x: x - 8, y: y - 17 }, { x: x + 4, y: y - 11 }, { x: x - 2, y }],
                    light ? '#65345b' : '#ffd3b3', 2);
                    if (hp === 1) this.line([{ x: x + 22, y: y - 17 }, { x: x + 15, y: y - 3 }], color, 2);
                }
            }
            for (let j = 0; j < 3; j++) {
                c.fillStyle = j < hp ? color : (light ? '#8c91a2' : '#3c435b');
                c.fillRect(x - 23 + j * 17, y + 11, 12, 4);
            }
            if (city.shield && hp) this.circle(x, y - 24, 43, light ? '#6743b0' : '#a993ff', false, 10);
        }
        draw(game, aim, dt = 0) {
            const c = this.c, light = document.documentElement.dataset.theme === 'light', t = game?.time || 0;
            c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); c.clearRect(0, 0, W, H);
            const bg = c.createLinearGradient(0, 0, 0, H);
            bg.addColorStop(0, light ? '#e4eafa' : '#080820'); bg.addColorStop(1, light ? '#c7dddF' : '#071f2e');
            c.fillStyle = bg; c.fillRect(0, 0, W, H);
            for (const [x, y, color] of [[170, 170, '#883dcb'], [780, 270, '#0ebfa9'], [520, 50, '#30368e']]) {
                const haze = c.createRadialGradient(x, y, 0, x, y, 400);
                haze.addColorStop(0, color + (light ? '16' : '35')); haze.addColorStop(1, color + '00');
                c.fillStyle = haze; c.fillRect(0, 0, W, H);
            }
            c.save();
            if (this.shake > 0 && !this.reduced.matches) c.translate(Math.sin(t * 91) * 4, Math.cos(t * 87) * 3);
            const cyan = light ? '#006e79' : '#66fff0';
            c.globalAlpha = light ? .15 : .25;
            for (let i = 0; i < 5; i++) {
                c.beginPath(); c.moveTo(-40, 140 + i * 48);
                const sway = this.reduced.matches ? 0 : Math.sin(t * .25 + i) * 25;
                c.bezierCurveTo(300, 40 + i * 20 + sway, 490, 330 + i * 20 - sway, 1000, 90 + i * 55);
                c.strokeStyle = i % 2 ? '#ad5dec' : '#2dd9d0'; c.lineWidth = 3 + i * 2;
                c.shadowColor = c.strokeStyle; c.shadowBlur = 22; c.stroke(); c.shadowBlur = 0;
            }
            c.globalAlpha = 1;
            for (let i = 0; i < 100; i++) {
                const x = (i * 137.51) % W, y = (i * i * 7.73) % 570;
                c.fillStyle = light ? '#8295ba' : `rgba(178,205,255,${.2 + (i % 4) * .15})`; c.fillRect(x, y, i % 3 ? 1 : 2, 2);
            }
            c.strokeStyle = light ? '#a4c0cc' : '#134351'; c.lineWidth = 1;
            for (let y = GROUND; y < H; y += 14) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
            for (let x = -W; x < W * 2; x += 90) { c.beginPath(); c.moveTo(W / 2 + (x - W / 2) * .55, GROUND); c.lineTo(x, H); c.stroke(); }
            for (let i = 0; i < 44; i++) {
                const bh = 15 + (i * 37) % 70; c.fillStyle = light ? '#9db6c4' : '#11283d'; c.fillRect(i * 24, GROUND - bh, 19, bh);
            }
            this.line([{ x: 0, y: GROUND }, { x: W, y: GROUND }], cyan, 2, 10);
            if (game) {
                for (const city of game.cities) this.city(city, light);
                for (const turret of game.turrets) {
                    const angle = Math.atan2(aim.y - turret.y, aim.x - turret.x);
                    this.circle(turret.x, turret.y, 18, cyan, false, 12);
                    this.line([{ x: turret.x, y: turret.y }, { x: turret.x + Math.cos(angle) * 32, y: turret.y + Math.sin(angle) * 32 }], cyan, 7);
                    c.fillStyle = turret.ready <= t ? cyan : '#596c83'; c.fillRect(turret.x - 25, turret.y + 26, 50 * Math.min(1, Math.max(0, 1 - (turret.ready - t) / game.reload)), 4);
                }
                for (const s of game.shots) { this.line([...s.trail, s], cyan, 3, 9); this.circle(s.x, s.y, 3, '#ffffff', true); }
                for (const e of game.enemies) {
                    const color = COLORS[e.type]; this.line([...e.trail, e], color + '33', 7);
                    this.line([...e.trail, e], color, e.type === 'fast' ? 3 : 2);
                    this.circle(e.x, e.y, e.type === 'armored' ? 8 : 4, color, true, 10);
                    if (e.type === 'armored') { this.circle(e.x, e.y, 12, color); if (e.hp === 1) this.line([{ x: e.x - 8, y: e.y - 8 }, { x: e.x + 8, y: e.y + 8 }], '#fff'); }
                    if (e.type === 'split') this.line([{ x: e.x - 10, y: e.y - 9 }, e, { x: e.x + 10, y: e.y - 9 }], color, 3);
                    if (e.type === 'cruiser') this.line([{ x: e.x - 26, y: e.y }, { x: e.x, y: e.y - 12 }, { x: e.x + 26, y: e.y }, { x: e.x, y: e.y + 8 }, { x: e.x - 26, y: e.y }], color, 3, 8);
                }
                let glowing = 0;
                for (const b of game.blasts) {
                    const color = b.depth ? '#d777ff' : '#55ffef';
                    if (glowing++ >= 32 || this.reduced.matches) {
                        c.globalAlpha = Math.max(0, 1 - b.age); this.circle(b.x, b.y, b.r, light ? '#006f81' : color); c.globalAlpha = 1; continue;
                    }
                    c.save(); if (!light) c.globalCompositeOperation = 'screen';
                    const flare = c.createRadialGradient(b.x, b.y, 0, b.x, b.y, Math.max(1, b.r * 1.5));
                    flare.addColorStop(0, '#efffffaa'); flare.addColorStop(.15, color + '99'); flare.addColorStop(.55, color + '35'); flare.addColorStop(1, color + '00');
                    c.globalAlpha = Math.max(0, 1 - b.age); c.fillStyle = flare; c.fillRect(b.x - b.r * 1.5, b.y - b.r * 1.5, b.r * 3, b.r * 3);
                    this.circle(b.x, b.y, b.r, light ? '#007a88' : color, false, 18);
                    c.globalAlpha *= .7; this.circle(b.x, b.y, b.r * .76, light ? '#5a378c' : '#e5ffff');
                    c.globalAlpha *= .65; this.circle(b.x, b.y, b.radius * (b.age + .5), color); c.restore();
                }
                for (const item of game.items) {
                    this.circle(item.x, item.y, 23, '#ffcf64', false, 12); c.fillStyle = light ? '#7b4300' : '#ffe69d';
                    c.textAlign = 'center'; c.font = 'bold 25px monospace'; c.fillText(ICONS[item.type], item.x, item.y + 8);
                    c.font = '10px monospace'; c.fillText(`${Math.ceil(item.life)}s`, item.x, item.y + 40);
                }
                if (game.boss && !game.boss.dead) this.boss(game.boss, light);
            }
            for (const p of this.particles) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; c.globalAlpha = Math.max(0, Math.min(1, p.life * 2)); c.fillStyle = p.color; c.fillRect(p.x, p.y, 3, 3); }
            this.particles = this.particles.filter(p => p.life > 0); c.globalAlpha = 1;
            for (const label of this.labels) { label.life -= dt; label.y -= dt * 26; c.fillStyle = light ? '#7136a3' : '#edbeff'; c.font = 'bold 16px monospace'; c.textAlign = 'center'; c.fillText(label.text, label.x, label.y); }
            this.labels = this.labels.filter(l => l.life > 0);
            this.circle(aim.x, aim.y, 14, cyan);
            for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) this.line([{ x: aim.x + dx * 19, y: aim.y + dy * 19 }, { x: aim.x + dx * 25, y: aim.y + dy * 25 }], cyan);
            if (this.flash > 0 && !this.reduced.matches) { c.fillStyle = `rgba(249,100,161,${this.flash * .45})`; c.fillRect(0, 0, W, H); }
            this.shake = Math.max(0, this.shake - dt); this.flash = Math.max(0, this.flash - dt); c.restore();
        }
        boss(b, light) {
            const c = this.c, color = b.rage ? '#ff527f' : '#ce8cff';
            c.fillStyle = light ? '#b8a6d1' : '#24183e'; c.beginPath();
            c.moveTo(b.x - 145, b.y); c.lineTo(b.x - 95, b.y - 28); c.lineTo(b.x - 45, b.y - 18);
            c.lineTo(b.x, b.y - 47); c.lineTo(b.x + 45, b.y - 18); c.lineTo(b.x + 95, b.y - 28);
            c.lineTo(b.x + 145, b.y); c.lineTo(b.x + 60, b.y + 30); c.lineTo(b.x - 60, b.y + 30); c.closePath();
            c.fill(); c.strokeStyle = color; c.lineWidth = 3; c.shadowColor = color; c.shadowBlur = 18; c.stroke(); c.shadowBlur = 0;
            b.nodes.forEach((hp, i) => { if (hp) { this.circle(b.x + (i ? 95 : -95), b.y, 22, '#65f8ff', false, 15); c.fillStyle = '#65f8ff'; c.font = 'bold 18px monospace'; c.textAlign = 'center'; c.fillText(hp, b.x + (i ? 95 : -95), b.y + 6); } });
            this.circle(b.x, b.y, 23, b.nodes.some(h => h > 0) ? '#7779a0' : '#ffce74', true, 12);
            c.fillStyle = '#39304b'; c.fillRect(b.x - 110, b.y - 65, 220, 7); c.fillStyle = color; c.fillRect(b.x - 110, b.y - 65, 220 * b.hp / 24, 7);
        }
    }
    globalThis.NeonDefenseRenderer = Renderer;
})();
