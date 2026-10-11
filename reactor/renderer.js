((root) => {
    'use strict';
    const { W, H, BALL_R, WALLS, BUMPERS, CORE, RAILS, flipperEnd } = root.ReactorPinball;
    const TAU = Math.PI * 2;
    function line(ctx, points, color, width = 1) {
        ctx.beginPath(); points.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
        ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
    }
    function circle(ctx, x, y, r, fill, stroke, width = 1) {
        ctx.beginPath(); ctx.arc(x, y, Math.max(.1, r), 0, TAU);
        if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(); }
    }
    function polygon(ctx, points, fill, stroke, width = 1) {
        ctx.beginPath(); points.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath();
        if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(); }
    }
    function text(ctx, value, x, y, size, color, weight = 600, align = 'center') {
        ctx.font = `${weight} ${size}px "Trebuchet MS", "Noto Sans TC", sans-serif`; ctx.fillStyle = color; ctx.textAlign = align; ctx.fillText(value, x, y);
    }
    class Renderer {
        constructor(canvas) {
            this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.elapsed = 0;
            this.particles = []; this.pulses = []; this.labels = []; this.trails = new Map(); this.cache = null; this.shake = 0;
            this.reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
        }
        reset() { this.particles.length = 0; this.pulses.length = 0; this.labels.length = 0; this.trails.clear(); this.shake = 0; }
        consume(events) {
            for (const e of events) {
                if (e.type === 'nudge') {
                    if (!this.reduced) this.shake = .22;
                    this.pulses.push({ x: 291, y: 720, life: .5, color: '#ffd08b', big: false });
                }
                if (e.type === 'score') {
                    this.labels.push({ x: e.x || 290, y: e.y || 460, text: '+' + e.points, life: .9, color: e.points >= 1800 ? '#ffc875' : '#c2f8ff' });
                }
                if (['bumper', 'core', 'rail', 'flipper', 'sling', 'overload'].includes(e.type)) {
                    const color = e.type === 'overload' ? '#ffc875' : e.color || '#61efff';
                    this.pulses.push({ x: e.x, y: e.y, life: .5, color, big: e.type === 'overload' });
                    if (!this.reduced) for (let i = 0; i < (e.type === 'overload' ? 30 : 9); i++) {
                        const a = i * 2.39996 + this.elapsed, speed = 65 + i % 5 * 28;
                        this.particles.push({ x: e.x, y: e.y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, life: .4 + i % 3 * .12, color });
                    }
                }
            }
            this.particles = this.particles.slice(-140); this.labels = this.labels.slice(-14); this.pulses = this.pulses.slice(-20);
        }
        background(theme) {
            if (this.cache && this.theme === theme) return this.cache;
            this.theme = theme;
            const c = document.createElement('canvas'); c.width = W; c.height = H; const ctx = c.getContext('2d');
            const bg = ctx.createLinearGradient(0, 0, W, H); bg.addColorStop(0, '#11253e'); bg.addColorStop(.5, '#081323'); bg.addColorStop(1, '#16142e');
            ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
            // The playfield is built from layered metal, etched circuits and rubber rails.
            polygon(ctx, [[20, 918], [12, 196], [33, 100], [90, 39], [174, 19], [511, 19], [594, 119], [594, 918]], '#030912', '#2b4964', 2);
            polygon(ctx, [[45, 913], [41, 198], [57, 126], [113, 68], [182, 48], [491, 48], [563, 133], [563, 912]], bg, '#1b4e60', 2);
            ctx.save(); ctx.globalAlpha = .21;
            for (let y = 58; y < 920; y += 29) line(ctx, [[35, y], [569, y]], '#256079', .5);
            for (let x = 45; x < 575; x += 29) line(ctx, [[x, 48], [x, 916]], '#256079', .5);
            ctx.restore();
            // Symmetrical traces frame the shot routes rather than obscuring the ball.
            for (const side of [-1, 1]) {
                const X = x => 291 + side * x;
                for (let i = 0; i < 6; i++) {
                    line(ctx, [[X(26 + i * 12), 116], [X(26 + i * 12), 143 + i * 8], [X(107 + i * 9), 196 + i * 8], [X(107 + i * 9), 398 + i * 12], [X(63 + i * 7), 479 + i * 12], [X(63 + i * 7), 615]], i % 2 ? '#24304c' : '#174452', 1.2);
                    circle(ctx, X(63 + i * 7), 619, 2.5, '#254c60');
                }
                line(ctx, [[X(120), 531], [X(77), 576], [X(77), 645], [X(31), 696]], '#183d50', 5);
                line(ctx, [[X(120), 531], [X(77), 576], [X(77), 645], [X(31), 696]], '#3b7582', 1);
            }
            text(ctx, 'R E A C T O R', 291, 89, 26, '#e1f6ff', 800);
            text(ctx, 'P I N B A L L   /   S E C T O R   0 7', 291, 109, 9, '#6b95aa', 600);
            text(ctx, 'ORBIT', 78, 401, 8, '#4bdce8', 700); text(ctx, 'ORBIT', 491, 401, 8, '#a88beb', 700);
            // Orbital rail channels.
            for (let i = 0; i < RAILS.length; i++) {
                const r = RAILS[i], left = i === 0;
                const points = left ? [[87, 390], [77, 289], [89, 182], [144, 121]] : [[489, 390], [494, 289], [480, 181], [438, 121]];
                line(ctx, points, '#0b1122', 24); line(ctx, points, left ? '#173f50' : '#302951', 19);
                line(ctx, points, left ? '#286777' : '#645082', 1);
                for (let j = 0; j < 5; j++) {
                    const y = 222 + j * 29, x = left ? 82 : 492;
                    line(ctx, [[x - 6, y + 4], [x, y - 2], [x + 6, y + 4]], left ? '#58cbd7' : '#a88adb', 1.8);
                }
                circle(ctx, r.x, r.y, 21, null, left ? '#38a8ba40' : '#a488db40', 1);
            }
            // Rubber rails with offset cast shadows and a polished edge.
            ctx.lineCap = 'round';
            for (const s of WALLS) {
                line(ctx, [[s.ax + 4, s.ay + 7], [s.bx + 4, s.by + 7]], '#000813', s.r * 2 + 7);
                line(ctx, [[s.ax, s.ay], [s.bx, s.by]], '#1c2940', s.r * 2 + 5);
                line(ctx, [[s.ax, s.ay - 1], [s.bx, s.by - 1]], s.kind === 'sling' ? '#ff6ea7' : s.kind === 'rail' ? '#5fdae5' : '#7596a8', s.r * 2);
                line(ctx, [[s.ax, s.ay - 3], [s.bx, s.by - 3]], s.kind === 'sling' ? '#ffb5d0' : '#b2d2dc', 1.3);
            }
            // The open left outlane passes behind the guide, outside flipper reach.
            for (const y of [751, 781, 811]) line(ctx, [[47, y - 3], [51, y + 2], [55, y - 3]], '#a37f5a', 1.2);
            text(ctx, 'OUT', 54, 850, 7, '#bb9161', 700);
            // Slingshot aprons.
            polygon(ctx, [[89, 604], [100, 698], [143, 726]], '#321c38', '#9c416a', 1.3);
            polygon(ctx, [[489, 604], [478, 698], [435, 726]], '#231e40', '#7a538f', 1.3);
            line(ctx, [[107, 645], [113, 691], [127, 707]], '#ff69a5', 2);
            line(ctx, [[471, 645], [465, 691], [451, 707]], '#b78eff', 2);
            text(ctx, 'HOLD YOUR NERVE', 291, 718, 9, '#4f7186', 700);
            text(ctx, 'TIMING IS EVERYTHING', 291, 737, 7, '#39576d', 600);
            for (const [x, y] of [[62, 116], [107, 70], [501, 57], [563, 133], [50, 453], [553, 453], [63, 805], [501, 805]]) {
                circle(ctx, x, y, 4, '#0b1523', '#617887', 1); line(ctx, [[x - 1.5, y - 1.5], [x + 1.5, y + 1.5]], '#8eabb7', 1);
            }
            // Shooter lane spring housing.
            polygon(ctx, [[537, 716], [567, 716], [567, 881], [537, 881]], '#060d1c', '#385474', 1);
            text(ctx, 'LAUNCH', 552, 701, 7, '#8ea8c9', 700);
            text(ctx, 'D R A I N', 291, 901, 9, '#725276', 700);
            line(ctx, [[215, 879], [367, 879]], '#4b2c47', 1);
            this.cache = c; return c;
        }
        bumper(ctx, item, i, game) {
            const lit = game.litBumpers[i] || game.overload > 0, t = this.elapsed, color = item.color;
            circle(ctx, item.x + 4, item.y + 8, item.r + 8, '#020a13');
            const metal = ctx.createLinearGradient(item.x, item.y - item.r, item.x, item.y + item.r);
            metal.addColorStop(0, '#6a869c'); metal.addColorStop(.18, '#293953'); metal.addColorStop(1, '#111726');
            circle(ctx, item.x, item.y, item.r + 6, metal, '#69869b', 1.5);
            ctx.save(); ctx.shadowColor = color; ctx.shadowBlur = lit ? 18 : 8;
            circle(ctx, item.x, item.y - 3, item.r, '#0c2133', color, lit ? 3.5 : 2);
            ctx.restore();
            const inner = ctx.createRadialGradient(item.x - 9, item.y - 13, 2, item.x, item.y - 2, item.r);
            inner.addColorStop(0, lit ? '#bddde7' : '#345f75'); inner.addColorStop(.42, '#18364f'); inner.addColorStop(1, '#0b172b');
            circle(ctx, item.x, item.y - 4, item.r - 6, inner, '#648b9f', .7);
            for (let j = 0; j < 6; j++) {
                const a = j * TAU / 6 + (this.reduced ? 0 : t * .18), r = item.r + 10;
                line(ctx, [[item.x + Math.cos(a) * r, item.y + Math.sin(a) * r], [item.x + Math.cos(a) * (r + 4), item.y + Math.sin(a) * (r + 4)]], color, 2);
            }
            text(ctx, item.label, item.x, item.y + 1, 13, lit ? '#ffffff' : color, 800);
            circle(ctx, item.x, item.y + item.r + 20, 4, lit ? color : '#193344', color, .8);
        }
        core(ctx, game) {
            const { x, y, r } = CORE, hot = game.overload > 0, color = hot ? '#ffc46a' : '#8b93ff';
            circle(ctx, x + 5, y + 9, r + 13, '#020a14');
            const points = Array.from({ length: 6 }, (_, i) => [x + Math.cos(i * TAU / 6 + Math.PI / 6) * 57, y + Math.sin(i * TAU / 6 + Math.PI / 6) * 57]);
            polygon(ctx, points, '#162439', '#516682', 2); circle(ctx, x, y, r + 8, '#080f21', '#69769c', 3);
            for (let i = 0; i < 12; i++) {
                const a = i * TAU / 12 - Math.PI / 2;
                ctx.beginPath(); ctx.arc(x, y, r + 17, a + .06, a + .43); ctx.strokeStyle = i < Math.ceil(game.energy / 100 * 12) || hot ? color : '#26304a'; ctx.lineWidth = 5; ctx.stroke();
            }
            const glow = ctx.createRadialGradient(x - 9, y - 9, 1, x, y, r);
            glow.addColorStop(0, hot ? '#fff4ba' : '#a3daff'); glow.addColorStop(.25, hot ? '#f3a538' : '#7c6fdb'); glow.addColorStop(.68, hot ? '#91522b' : '#283b7d'); glow.addColorStop(1, '#11152d');
            ctx.save(); ctx.shadowColor = color; ctx.shadowBlur = 20 + (this.reduced ? 0 : Math.sin(this.elapsed * 3) * 5);
            circle(ctx, x, y, r, glow, color, 2); ctx.restore();
            for (let i = 0; i < 3; i++) {
                const a = i * TAU / 3 - (this.reduced ? 0 : this.elapsed * (hot ? 1.7 : .4));
                ctx.save(); ctx.translate(x, y); ctx.rotate(a); polygon(ctx, [[0, -26], [9, -8], [0, -12], [-9, -8]], '#daf8ffac'); ctx.restore();
            }
            circle(ctx, x, y, 8, '#f4ffff', color, 2);
            text(ctx, hot ? 'OVERLOAD · ×3' : 'FUSION CORE', x, y + 82, 11, color, 800);
            text(ctx, hot ? Math.ceil(game.overload) + ' SEC' : 'CHARGE ' + Math.floor(game.energy) + '%', x, y + 98, 8, '#708ca9', 700);
        }
        draw(game, delta = 0, theme = 'dark') {
            const dt = Math.max(0, Math.min(.04, delta)); if (game.state === 'running') this.elapsed += dt;
            const ctx = this.ctx; ctx.clearRect(0, 0, W, H); ctx.save();
            if (game.state === 'running' && this.shake > 0) {
                this.shake = Math.max(0, this.shake - dt);
                ctx.translate(Math.sin(this.elapsed * 75) * this.shake * 14, -Math.sin(this.shake / .22 * Math.PI) * 3);
            }
            ctx.drawImage(this.background(theme), 0, 0);
            BUMPERS.forEach((b, i) => this.bumper(ctx, b, i, game)); this.core(ctx, game);
            // A dotted route ties each mission to its corresponding mechanism.
            const active = game.missionIndex;
            for (const [i, x, y] of [[0, 291, 161], [1, 83, 440], [1, 491, 440], [2, 291, 588]]) {
                const isActive = active === i;
                circle(ctx, x, y, 9, isActive ? '#5ce4e6' : '#132536', isActive ? '#a7ffff' : '#335369', 1);
                text(ctx, String(i + 1), x, y + 3, 9, isActive ? '#052330' : '#678897', 800);
            }
            for (const f of game.flippers) {
                const end = flipperEnd(f), raised = Math.abs(f.angle - f.active) < .1, color = f.side === 'left' ? '#70efff' : '#bf9bff';
                line(ctx, [[f.x + 4, f.y + 8], [end.x + 4, end.y + 8]], '#020714', 27);
                line(ctx, [[f.x, f.y], [end.x, end.y]], '#26364e', 24);
                ctx.save(); ctx.shadowColor = color; ctx.shadowBlur = raised ? 15 : 5;
                line(ctx, [[f.x, f.y - 2], [end.x, end.y - 2]], color, 19); ctx.restore();
                line(ctx, [[f.x, f.y - 4], [end.x, end.y - 4]], '#e4faff', 3);
                line(ctx, [[f.x + (end.x - f.x) * .17, f.y + (end.y - f.y) * .17 + 1], [end.x, end.y + 1]], '#28576f', 5);
                circle(ctx, f.x, f.y - 2, 10, '#19283b', '#acbfce', 1.5); circle(ctx, f.x, f.y - 2, 3, color);
            }
            // Plunger spring compresses visibly while held.
            const pull = game.plungerCharge * 29;
            const spring = [];
            for (let i = 0; i < 18; i++) spring.push([552 + (i % 2 ? 8 : -8), 851 + pull + i * (27 - pull * .7) / 18]);
            line(ctx, spring, '#8b9cb7', 2); line(ctx, [[541, 849 + pull], [563, 849 + pull]], '#d6ddeb', 5);
            ctx.fillStyle = '#252d48'; ctx.fillRect(544, 891, 16, 14); ctx.fillStyle = '#ffca77'; ctx.fillRect(546, 892, 12, 3);
            if (game.staged) {
                ctx.save(); ctx.globalAlpha = this.reduced ? .8 : .55 + Math.sin(this.elapsed * 4) * .25;
                for (let i = 0; i < 4; i++) line(ctx, [[547, 782 - i * 18], [552, 776 - i * 18], [557, 782 - i * 18]], '#ffd08d', 2);
                ctx.restore();
            }
            const ids = new Set(game.balls.map(b => b.id));
            for (const id of this.trails.keys()) if (!ids.has(id)) this.trails.delete(id);
            for (const ball of game.balls) {
                let trail = this.trails.get(ball.id); if (!trail) { trail = []; this.trails.set(ball.id, trail); }
                if (game.state === 'running' && dt > 0) { trail.push({ x: ball.x, y: ball.y }); if (trail.length > 9) trail.shift(); }
                if (!this.reduced && !ball.staged) for (let i = 0; i < trail.length - 1; i++) {
                    ctx.save(); ctx.globalAlpha = i / trail.length * .25;
                    line(ctx, [[trail[i].x, trail[i].y], [trail[i + 1].x, trail[i + 1].y]], game.overload ? '#ffc77a' : '#83e9ff', i / trail.length * 13); ctx.restore();
                }
                circle(ctx, ball.x + 4, ball.y + 6, BALL_R + 1, '#000813b0');
                const shine = ctx.createRadialGradient(ball.x - 3.5, ball.y - 4, 1, ball.x + 1, ball.y + 2, BALL_R + 1);
                shine.addColorStop(0, '#ffffff'); shine.addColorStop(.28, '#d8f7ff'); shine.addColorStop(.53, '#91afc3'); shine.addColorStop(.8, '#385271'); shine.addColorStop(1, '#e6f8ff');
                ctx.save(); ctx.shadowColor = game.overload ? '#ffc877' : '#acf5ff'; ctx.shadowBlur = 11;
                circle(ctx, ball.x, ball.y, BALL_R, shine, '#c4f5ff', .6); ctx.restore();
                circle(ctx, ball.x - 3, ball.y - 3.5, 2, '#fff');
            }
            const animate = game.state === 'running' ? dt : 0;
            for (const p of this.pulses) {
                p.life -= animate; ctx.save(); ctx.globalAlpha = Math.max(0, p.life * 1.4);
                circle(ctx, p.x, p.y, (1 - p.life / .5) * (p.big ? 180 : 60) + 20, null, p.color, p.big ? 3 : 1.5); ctx.restore();
            }
            this.pulses = this.pulses.filter(p => p.life > 0);
            for (const p of this.particles) {
                p.life -= animate; p.x += p.vx * animate; p.y += p.vy * animate; p.vy += 70 * animate;
                ctx.save(); ctx.globalAlpha = Math.max(0, p.life * 1.5); line(ctx, [[p.x, p.y], [p.x - p.vx * .035, p.y - p.vy * .035]], p.color, 1.8); ctx.restore();
            }
            this.particles = this.particles.filter(p => p.life > 0);
            for (const label of this.labels) { label.life -= animate; label.y -= animate * 29; ctx.save(); ctx.globalAlpha = Math.max(0, Math.min(1, label.life * 2)); text(ctx, label.text, label.x, label.y, 14, label.color, 800); ctx.restore(); }
            this.labels = this.labels.filter(label => label.life > 0);
            if (game.tilted) {
                text(ctx, 'TILT', 291, 680, 28, '#ff789b', 800);
                text(ctx, 'FLIPPERS OFF · WAIT FOR DRAIN', 291, 704, 9, '#ffc0d0', 700);
            }
            if (game.ballSave > 0 && !game.staged) text(ctx, 'BALL SAVE  ·  ' + Math.ceil(game.ballSave), 291, 865, 10, '#7de8ba', 700);
            else if (game.balls.length > 1) text(ctx, 'MULTIBALL  ·  ' + game.balls.length, 291, 865, 10, '#ffcc83', 700);
            ctx.restore();
        }
    }
    root.ReactorPinballRenderer = { Renderer };
})(typeof globalThis !== 'undefined' ? globalThis : window);
