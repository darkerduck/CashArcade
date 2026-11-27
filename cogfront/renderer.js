// 蒸汽前線 COGFRONT renderer: hand-drawn silhouette characters with procedural joint animation,
// five-layer steampunk parallax, telegraphs and HUD. Every element first tries a generated CG slot
// (cogfront/art.js) and falls back to Canvas drawing, so the game is complete without image files.
(() => {
    'use strict';
    const { VIEW, HERO, TROOPS, ENEMIES, BOSSES } = CogfrontData;
    const W = VIEW.width, H = VIEW.height, GROUND = VIEW.ground, TAU = Math.PI * 2;
    const INK = '#1a120d';
    const ZONES = [
        { key: 'outskirts', sky: ['#2b1b3d', '#b8604a', '#f4bf7c'], sun: '#ffe1a0', far: '#6e4049', mid: '#4a2c30', near: '#36211f', ground: '#3a2820', dirt: '#5a3f2c', rail: '#9a7650', haze: '#f6b47a', light: '#ffcf8a' },
        { key: 'works', sky: ['#18202c', '#4f5d72', '#a8a497'], sun: '#e6e0cc', far: '#3c4654', mid: '#2b323d', near: '#1f242c', ground: '#2a2928', dirt: '#45403a', rail: '#8a8578', haze: '#c8c0ae', light: '#ffd27a' },
        { key: 'foundry', sky: ['#180909', '#6a1d15', '#e2652d'], sun: '#ffb46a', far: '#4d1b15', mid: '#2e1210', near: '#200b09', ground: '#2a1813', dirt: '#4a2a1c', rail: '#a5603a', haze: '#ff8a4a', light: '#ffb05a' },
    ];
    const TEAM = { cloth: '#2f5d7a', clothLight: '#4f86a8', tin: '#b7b9b0', tinDark: '#7d8078', brass: '#c99a3e', copper: '#b8673a', steel: '#8a949b', steelDark: '#454c52' };
    const FOE = { rust: '#7a3b2a', rustLight: '#a35a3c', iron: '#4a4744', eye: '#ff4a2e', glow: '#ffb347' };
    const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
    const art = () => globalThis.CogfrontArt;

    function ink(c, width = 3) { c.strokeStyle = INK; c.lineWidth = width; c.lineJoin = 'round'; c.lineCap = 'round'; }
    function shape(c, fill, width = 3) { c.fillStyle = fill; c.fill(); ink(c, width); c.stroke(); }
    function limb(c, x, y, angle, length, width, color) {
        const x2 = x + Math.cos(angle) * length, y2 = y + Math.sin(angle) * length;
        c.lineCap = 'round'; c.strokeStyle = INK; c.lineWidth = width + 3; c.beginPath(); c.moveTo(x, y); c.lineTo(x2, y2); c.stroke();
        c.strokeStyle = color; c.lineWidth = width; c.beginPath(); c.moveTo(x, y); c.lineTo(x2, y2); c.stroke();
        return [x2, y2];
    }
    function circle(c, x, y, r, fill, width = 3) { c.beginPath(); c.arc(x, y, r, 0, TAU); shape(c, fill, width); }
    function ellipse(c, x, y, rx, ry, fill, width = 3, rot = 0) { c.beginPath(); c.ellipse(x, y, rx, ry, rot, 0, TAU); shape(c, fill, width); }
    function rect(c, x, y, w, h, fill, width = 3) { c.beginPath(); c.rect(x, y, w, h); shape(c, fill, width); }
    function gear(c, x, y, r, teeth, angle, fill) {
        c.beginPath();
        for (let i = 0; i < teeth * 2; i++) { const a = angle + i * Math.PI / teeth, rr = i % 2 ? r * .78 : r; i ? c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr) : c.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
        c.closePath(); shape(c, fill, 2); circle(c, x, y, r * .3, INK, 1);
    }

    class Renderer {
        constructor(canvas) {
            this.canvas = canvas; this.ctx = canvas.getContext('2d');
            const FX = globalThis.CashArcadeFX;
            this.world = FX?.createFx({ maxParticles: 360, maxShake: 0 }) ?? null;
            this.screen = FX?.createFx({ maxShake: 12, maxParticles: 40 }) ?? null;
            this.camera = 0; this.clock = 0; this.last = 0; this.reduced = false; this.tiles = new Map(); this.ratio = 1;
            this.deaths = []; this.flash = 0;
        }
        get busy() { return Boolean(this.world?.busy || this.screen?.busy || this.deaths.length); }
        timeScale() { return this.screen?.timeScale() ?? 1; }
        reset() { this.world?.clear(); this.screen?.clear(); this.deaths = []; this.camera = 0; }
        setReduced(value) { this.reduced = Boolean(value); this.world?.setReduced(this.reduced); this.screen?.setReduced(this.reduced); }
        // Game events become hand-drawn-style effects: metal shards, steam puffs, sparks and popups.
        consume(events, game) {
            const w = this.world, s = this.screen, y = GROUND - 34;
            for (const e of events) {
                if (e.type === 'kill' || e.type === 'allyDown') this.deaths.push({ kind: e.kind, x: e.x, y: e.y || 0, t: 0, ally: e.type === 'allyDown' });
                if (!w || !s) continue;
                switch (e.type) {
                    case 'slash':
                        w.burst(e.x, y - 6, { kind: 'spark', color: '#ffe0a0', count: 4 + e.hits * 2, speed: 260, life: .28, angle: e.facing > 0 ? 0 : Math.PI, spread: 1.6, size: 2.2 });
                        if (e.combo === 2) { s.hitStop(.07); s.shake(.22); } else s.hitStop(.025);
                        break;
                    case 'hit': if (!e.ally && e.amount >= 8) w.popup(e.x, y - 30 + (e.y || 0) * .5, String(e.amount), { color: e.source === 'hero' ? '#fff1c8' : '#d6ecff', size: e.amount >= 30 ? 17 : 13, life: .6, rise: 30 }); break;
                    case 'kill':
                        w.burst(e.x, y, { kind: 'shard', color: '#9aa1a6', count: 9, speed: 240, life: .7, size: 2.4, gravity: 600 });
                        w.burst(e.x, y, { kind: 'smoke', color: '#8a847a', count: 5, speed: 60, life: .8, size: 7 });
                        w.popup(e.x, y - 50, `+${e.bounty}⚙`, { color: '#ffd27a', size: 13, life: .8 }); break;
                    case 'burst':
                        for (let i = 0; i < 3; i++) w.burst(e.x + e.facing * (40 + i * 45), y, { kind: 'smoke', color: '#e9e4d8', count: 8, speed: 140, life: .7, angle: e.facing > 0 ? 0 : Math.PI, spread: 1.2, size: 9 });
                        s.shake(.35); s.hitStop(.05); break;
                    case 'charge': w.burst(e.x, GROUND, { kind: 'smoke', color: '#b9a98e', count: 10, speed: 120, life: .5, angle: e.facing > 0 ? Math.PI : 0, spread: 1, size: 6 }); s.shake(.15); break;
                    case 'dodge': w.burst(e.x, GROUND, { kind: 'smoke', color: '#b9a98e', count: 5, speed: 80, life: .4, size: 5 }); break;
                    case 'overdrive': s.flash('#ff9a3c', .25, .3); s.banner('OVERDRIVE', '超載 · 全軍強化', { color: '#ffb347', duration: 1.1 }); s.shake(.3); break;
                    case 'heroHit': s.flash('#ff3b2e', .12, .15); s.shake(.18); break;
                    case 'heroDown': s.slowMotion(.6, .35); s.flash('#000000', .25, .5); w.burst(e.x, y, { kind: 'shard', color: TEAM.brass, count: 16, speed: 260, life: 1, gravity: 600 }); break;
                    case 'heroBack': s.banner('黃銅隊長歸隊', 'CAPTAIN BRASS IS BACK', { color: '#ffd27a', duration: .9 }); break;
                    case 'trainHit': s.shake(.08); w.burst(e.x, GROUND - 60, { kind: 'spark', color: '#ffb347', count: 3, speed: 160, life: .3 }); break;
                    case 'explode': case 'blast':
                        w.burst(e.x, GROUND - 10, { kind: 'smoke', color: '#6f665c', count: 12, speed: 150, life: .9, size: 10 });
                        w.burst(e.x, GROUND - 10, { kind: 'spark', color: '#ffb347', count: 12, speed: 320, life: .4 });
                        w.burst(e.x, GROUND - 10, { kind: 'ring', color: '#ffcf8a', size: (e.radius || 50) * 1.6, life: .35 }); s.shake(.25); break;
                    case 'deploy': w.burst(e.x + 20, GROUND - 20, { kind: 'smoke', color: '#e9e4d8', count: 6, speed: 70, life: .7, size: 8 }); break;
                    case 'heal': w.burst(e.x, GROUND - 50, { kind: 'ring', color: '#9ff0a6', size: 30, life: .4 }); break;
                    case 'shot': w.burst(e.x + 8, GROUND - 38, { kind: 'spark', color: '#ffe8a0', count: 3, speed: 200, life: .15, angle: 0, spread: .6 }); break;
                    case 'wave': s.banner(`第 ${e.index} 波攻勢`, '叛軍增援逼近', { color: '#ffcf8a', duration: .9 }); break;
                    case 'bossEnter': s.banner(e.name, 'BOSS · 頭目出現', { color: '#ff8a4a', duration: 1.6 }); s.shake(.4); break;
                    case 'bossPhase': s.banner('過載', '頭目進入狂暴狀態', { color: '#ff5a3a', duration: 1.2 }); s.flash('#ff5a3a', .2, .3); break;
                    case 'bossAttack': if (e.kind === 'slam' || e.kind === 'bomb') { s.shake(e.kind === 'slam' ? .6 : .3); w.burst(e.x, GROUND - 4, { kind: 'smoke', color: '#9a8a74', count: 14, speed: 200, life: .8, size: 9 }); } break;
                    case 'gateDown': case 'bossDown':
                        w.burst(e.x, GROUND - 120, { kind: 'shard', color: '#a5a09a', count: 40, speed: 380, life: 1.4, gravity: 500 });
                        w.burst(e.x, GROUND - 120, { kind: 'smoke', color: '#8a847a', count: 24, speed: 160, life: 1.5, size: 14 });
                        s.flash('#fff3d8', .45, .6); s.shake(1); s.hitStop(.15); s.slowMotion(1, .4); break;
                    case 'order': s.banner({ follow: '跟進', charge: '全軍衝鋒', hold: '固守陣線' }[e.order], { follow: 'FOLLOW THE CAPTAIN', charge: 'CHARGE!', hold: 'HOLD THE LINE' }[e.order], { color: '#ffd27a', duration: .7 }); break;
                }
            }
        }
        render(game, options = {}) {
            const c = this.ctx, now = globalThis.performance?.now?.() ?? 0;
            const dt = options.dt ?? (this.last ? clamp((now - this.last) / 1000, 0, .05) : 0); this.last = now; this.clock += dt;
            this.setReduced(options.reducedMotion);
            this.world?.update(dt); this.screen?.update(dt);
            for (const d of this.deaths) d.t += dt; this.deaths = this.deaths.filter(d => d.t < .9);
            this.ratio = globalThis.CashArcadeFX?.fitCanvas(this.canvas, W, H) ?? 1;
            c.setTransform?.(this.ratio, 0, 0, this.ratio, 0, 0);
            const h = game.hero, target = clamp((h.alive ? h.x : game.front) - W * .36, 0, game.length - W);
            this.camera += (target - this.camera) * (this.reduced ? 1 : 1 - Math.exp(-dt * 6)); if (!Number.isFinite(this.camera)) this.camera = target;
            const zone = ZONES[game.stageData.zoneIndex], cam = this.camera;
            c.save(); this.screen?.apply(c);
            this.sky(c, zone, game); this.far(c, zone, cam); this.mid(c, zone, cam); this.ground(c, zone, cam);
            c.save(); c.translate(-cam, 0);
            for (const t of game.telegraphs) this.telegraph(c, t);
            this.train(c, game); if (game.gate) this.gate(c, game.gate, zone);
            // Depth-sort everyone by lane offset so the crowd overlaps naturally.
            const actors = [...game.allies.map(a => ['ally', a]), ...game.enemies.map(e => ['enemy', e])];
            if (game.hero.alive) actors.push(['hero', game.hero]);
            actors.sort((a, b) => (a[1].y || 0) - (b[1].y || 0));
            if (game.boss && game.boss.kind === 'colossus') this.colossus(c, game.boss, game);
            for (const [type, obj] of actors) { if (obj.x < cam - 120 || obj.x > cam + W + 120) continue; type === 'hero' ? this.hero(c, obj, game) : type === 'ally' ? this.troop(c, obj) : this.enemy(c, obj); }
            if (game.boss && game.boss.kind === 'airship') this.airship(c, game.boss, game);
            for (const d of this.deaths) this.debris(c, d);
            for (const s of game.shots) this.shot(c, s);
            this.world?.draw(c, W, H);
            c.restore();
            this.foreground(c, zone, cam);
            this.hud(c, game, zone);
            this.screen?.draw(c, W, H);
            c.restore();
        }
        // ---------- scenery: sky → far stacks → mid factories → ground → foreground
        tile(key, width, height, paint) {
            const doc = globalThis.document, id = `${key}:${this.ratio}`;
            if (!doc?.createElement) return null;
            if (!this.tiles.has(id)) {
                const t = doc.createElement('canvas'); t.width = Math.ceil(width * this.ratio); t.height = Math.ceil(height * this.ratio);
                const tc = t.getContext('2d'); if (!tc) return null; tc.setTransform?.(this.ratio, 0, 0, this.ratio, 0, 0); paint(tc); this.tiles.set(id, t);
            }
            return this.tiles.get(id);
        }
        strip(c, key, width, height, y, parallax, cam, paint) {
            const t = this.tile(key, width, height, paint);
            let x = -((cam * parallax) % width); if (x > 0) x -= width;
            for (; x < W; x += width) { if (t) c.drawImage(t, x, y, width, height); else { c.save(); c.translate(x, y); paint(c); c.restore(); } }
        }
        sky(c, z, game) {
            if (art()?.drawLayer(c, `bg.${z.key}.sky`, 0, W, H, 0, H)) return;
            const g = c.createLinearGradient(0, 0, 0, GROUND); g.addColorStop(0, z.sky[0]); g.addColorStop(.62, z.sky[1]); g.addColorStop(1, z.sky[2]);
            c.fillStyle = g; c.fillRect(0, 0, W, H);
            const sunX = 700 - this.camera * .02, sunY = 150;
            const halo = c.createRadialGradient(sunX, sunY, 10, sunX, sunY, 180); halo.addColorStop(0, z.sun + 'cc'); halo.addColorStop(1, z.sun + '00');
            c.fillStyle = halo; c.fillRect(sunX - 180, sunY - 180, 360, 360);
            c.beginPath(); c.arc(sunX, sunY, 46, 0, TAU); c.fillStyle = z.sun; c.fill();
            // Drifting cloud bands and distant airships.
            const t = this.reduced ? 0 : this.clock;
            c.fillStyle = z.sky[0] + '55';
            for (let i = 0; i < 5; i++) { const x = ((i * 260 - this.camera * .05 - t * 8) % 1300 + 1300) % 1300 - 160; c.beginPath(); c.ellipse(x, 90 + i * 28, 120, 12, 0, 0, TAU); c.fill(); }
            for (let i = 0; i < 2; i++) {
                const x = ((i * 640 + t * 12 - this.camera * .08) % 1400 + 1400) % 1400 - 200, y = 110 + i * 70;
                c.fillStyle = z.far + 'aa'; c.beginPath(); c.ellipse(x, y, 46, 14, 0, 0, TAU); c.fill(); c.fillRect(x - 14, y + 12, 28, 7);
            }
        }
        far(c, z, cam) {
            if (art()?.drawLayer(c, `bg.${z.key}.far`, cam, W, H, GROUND - 260, 300)) return;
            this.strip(c, `far:${z.key}`, 1200, 260, GROUND - 250, .15, cam, tc => {
                tc.fillStyle = z.far;
                for (let i = 0; i < 18; i++) {
                    const x = i * 70 + (i * 37 % 23), h = 70 + (i * 53 % 110), w = 34 + (i * 17 % 30);
                    tc.fillRect(x, 260 - h, w, h);
                    if (i % 3 === 0) { tc.fillRect(x + w * .35, 260 - h - 60, 10, 60); tc.fillRect(x + w * .35 - 3, 260 - h - 64, 16, 6); }
                    if (i % 4 === 1) { tc.beginPath(); tc.arc(x + w / 2, 260 - h, w / 2, Math.PI, 0); tc.fill(); }
                }
                tc.fillStyle = z.light + '55';
                for (let i = 0; i < 60; i++) tc.fillRect((i * 97) % 1200, 140 + (i * 53) % 110, 3, 4);
            });
            // Smoke plumes from far chimneys, animated.
            if (!this.reduced) { c.fillStyle = z.haze + '22'; for (let i = 0; i < 6; i++) { const x = ((i * 210 - cam * .15) % 1260 + 1260) % 1260 - 30, rise = (this.clock * 14 + i * 40) % 120; c.beginPath(); c.ellipse(x, GROUND - 330 - rise, 22 + rise * .2, 12, 0, 0, TAU); c.fill(); } }
            const haze = c.createLinearGradient(0, GROUND - 160, 0, GROUND); haze.addColorStop(0, z.haze + '00'); haze.addColorStop(1, z.haze + '44'); c.fillStyle = haze; c.fillRect(0, GROUND - 160, W, 160);
        }
        mid(c, z, cam) {
            if (art()?.drawLayer(c, `bg.${z.key}.mid`, cam, W, H, GROUND - 330, 380)) return;
            this.strip(c, `mid:${z.key}`, 1400, 300, GROUND - 290, .45, cam, tc => {
                tc.fillStyle = z.mid; tc.strokeStyle = INK; tc.lineWidth = 2;
                for (let i = 0; i < 6; i++) {
                    const x = i * 240 + 20, h = 150 + (i * 41 % 90), w = 150;
                    tc.fillRect(x, 300 - h, w, h);
                    // saw-tooth factory roof
                    tc.beginPath(); for (let k = 0; k < 4; k++) { tc.moveTo(x + k * 37, 300 - h); tc.lineTo(x + k * 37 + 37, 300 - h - 22); tc.lineTo(x + k * 37 + 37, 300 - h); } tc.fill();
                    tc.fillRect(x + 110, 300 - h - 90, 16, 90); tc.fillRect(x + 106, 300 - h - 96, 24, 8);
                    tc.fillStyle = z.light + '99'; for (let r = 0; r < 3; r++) for (let k = 0; k < 4; k++) if ((i + r + k) % 3) tc.fillRect(x + 14 + k * 34, 300 - h + 26 + r * 34, 16, 18);
                    tc.fillStyle = z.mid;
                    // pipe run
                    tc.fillRect(x + w, 300 - 80 - (i % 3) * 20, 90, 12);
                }
                // water tower
                tc.fillRect(1260, 150, 70, 60); tc.fillRect(1270, 210, 8, 90); tc.fillRect(1314, 210, 8, 90); tc.beginPath(); tc.moveTo(1255, 150); tc.lineTo(1295, 120); tc.lineTo(1335, 150); tc.fill();
            });
            // A few large live gears turning on the factory faces.
            const t = this.reduced ? 0 : this.clock;
            for (let i = 0; i < 3; i++) { const x = ((i * 470 + 150 - cam * .45) % 1410 + 1410) % 1410 - 60; gear(c, x, GROUND - 120 - (i % 2) * 26, 17, 9, t * (i % 2 ? -.6 : .6), z.near); }
        }
        ground(c, z, cam) {
            if (art()?.drawLayer(c, `bg.${z.key}.ground`, cam, W, H, GROUND - 40, H - GROUND + 40)) return;
            c.fillStyle = z.near; c.fillRect(0, GROUND - 42, W, 12);
            const g = c.createLinearGradient(0, GROUND - 30, 0, H); g.addColorStop(0, z.dirt); g.addColorStop(1, z.ground);
            c.fillStyle = g; c.fillRect(0, GROUND - 30, W, H - GROUND + 30);
            // Rails with sleepers; gravel specks.
            c.fillStyle = z.ground;
            for (let x = -(cam % 28); x < W; x += 28) c.fillRect(x, GROUND + 14, 18, 8);
            c.fillStyle = z.rail; c.fillRect(0, GROUND + 12, W, 3); c.fillRect(0, GROUND + 22, W, 3);
            c.fillStyle = z.dirt;
            for (let i = 0; i < 40; i++) { const x = ((i * 113 - cam) % 1100 + 1100) % 1100 - 70; c.fillRect(x, GROUND + 36 + (i * 37 % 60), 4, 3); }
        }
        foreground(c, z, cam) {
            if (art()?.drawLayer(c, `bg.${z.key}.front`, cam, W, H, H - 300, 300)) return;
            for (let x = -((cam * 1.3) % 1500) + 1100; x < W + 80; x += 1500) {
                c.fillStyle = INK; c.fillRect(x, H - 170, 16, 170); c.fillRect(x - 30, H - 150, 80, 10);
                c.fillStyle = z.near; c.fillRect(x + 3, H - 170, 10, 170);
                if (!this.reduced) { const puff = (this.clock * 30) % 60; c.fillStyle = z.haze + '30'; c.beginPath(); c.ellipse(x + 60, H - 200 - puff, 16 + puff * .3, 10, 0, 0, TAU); c.fill(); }
            }
            const v = c.createRadialGradient(W / 2, H / 2, H * .45, W / 2, H / 2, W * .75); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(10,5,2,.55)');
            c.fillStyle = v; c.fillRect(0, 0, W, H);
        }
        // ---------- base and gate
        train(c, game) {
            const tr = game.train, x = tr.x - 110, y = GROUND;
            if (art()?.drawSprite(c, 'train', 0, tr.x, y)) return;
            c.save(); if (tr.hurt > 0) c.translate(Math.sin(this.clock * 90) * 2, 0);
            rect(c, x - 10, y - 108, 78, 74, '#5b3a26'); rect(c, x - 2, y - 100, 30, 26, '#ffd27a', 2);
            rect(c, x - 16, y - 116, 90, 10, '#3a2418');
            ellipse(c, x + 140, y - 64, 92, 32, TEAM.copper); for (const bx of [80, 120, 160, 200]) { c.beginPath(); c.moveTo(x + bx, y - 94); c.lineTo(x + bx, y - 34); ink(c, 2); c.stroke(); }
            rect(c, x + 196, y - 122, 22, 54, '#3a2418'); rect(c, x + 190, y - 130, 34, 10, '#3a2418');
            c.beginPath(); c.moveTo(x + 232, y - 40); c.lineTo(x + 262, y - 6); c.lineTo(x + 222, y - 6); c.closePath(); shape(c, TEAM.steelDark);
            for (const wx of [20, 92, 150, 204]) { circle(c, x + wx, y - 18, wx === 20 ? 16 : 22, '#2a1d16'); circle(c, x + wx, y - 18, 6, TEAM.brass, 2); }
            c.beginPath(); c.moveTo(x + 40, y - 130); c.lineTo(x + 40, y - 170); ink(c, 3); c.stroke(); c.beginPath(); c.moveTo(x + 40, y - 170); c.lineTo(x + 76, y - 160); c.lineTo(x + 40, y - 150); c.closePath(); shape(c, TEAM.cloth, 2);
            if (!this.reduced) { c.fillStyle = '#e9e4d8aa'; for (let i = 0; i < 4; i++) { const k = (this.clock * .8 + i / 4) % 1; c.beginPath(); c.ellipse(x + 207 - k * 40, y - 136 - k * 90, 10 + k * 22, 8 + k * 14, 0, 0, TAU); c.fill(); } }
            c.restore();
        }
        gate(c, g, z) {
            const x = g.x, y = GROUND, broken = g.hp < g.maxHp * .5;
            if (art()?.drawSprite(c, broken ? 'gate.damaged' : 'gate', 0, x, y)) return;
            c.save(); if (g.hurt > 0) c.translate(Math.sin(this.clock * 80) * 2, 0);
            rect(c, x - 90, y - 250, 40, 250, FOE.iron); rect(c, x + 50, y - 250, 40, 250, FOE.iron);
            for (const tx of [-70, 70]) { c.beginPath(); c.moveTo(x + tx - 26, y - 250); c.lineTo(x + tx, y - 284); c.lineTo(x + tx + 26, y - 250); c.closePath(); shape(c, FOE.rust); }
            rect(c, x - 52, y - 210, 104, 210, '#3a2a22');
            const glow = c.createLinearGradient(0, y - 200, 0, y); glow.addColorStop(0, z.light + '00'); glow.addColorStop(1, z.light + 'aa');
            c.fillStyle = glow; for (let i = 0; i < 5; i++) c.fillRect(x - 44 + i * 20, y - 190, 8, 180);
            c.strokeStyle = INK; c.lineWidth = 3; for (let i = 0; i < 6; i++) { c.beginPath(); c.moveTo(x - 52, y - 200 + i * 36); c.lineTo(x + 52, y - 200 + i * 36); c.stroke(); }
            gear(c, x, y - 150, 30, 10, this.reduced ? 0 : this.clock * .4, FOE.rustLight); circle(c, x, y - 150, 8, FOE.eye, 2);
            rect(c, x - 30, y - 286, 60, 30, FOE.iron); c.beginPath(); c.moveTo(x - 10, y - 276); c.lineTo(x - 58, y - 300); ink(c, 8); c.stroke();
            if (broken) { c.strokeStyle = '#ffb347'; c.lineWidth = 2; c.beginPath(); c.moveTo(x - 30, y - 200); c.lineTo(x - 8, y - 140); c.lineTo(x - 22, y - 90); c.moveTo(x + 18, y - 170); c.lineTo(x + 34, y - 110); c.stroke(); }
            c.restore();
        }
        // ---------- characters (feet at GROUND + lane offset; procedural joints)
        hero(c, h, game) {
            const y = GROUND + h.y * .6, f = h.facing;
            const anim = h.swing ? `slash${h.swing.index + 1}` : h.charging > 0 ? 'charge' : h.dodge > 0 ? 'dodge' : h.hurt > .15 ? 'hurt' : h.move ? 'run' : 'idle';
            const t = h.swing ? h.swing.t : h.anim;
            const blink = h.inv > 0 && !this.reduced && Math.sin(this.clock * 40) > .4;
            if (art()?.drawSprite(c, `hero.${anim}`, t, h.x, y, f, .78, blink ? .55 : 1)) { this.overdriveAura(c, h, y); return; }
            c.save(); c.translate(h.x, y); c.scale(f * 1.45, 1.45); if (blink) c.globalAlpha = .55;
            this.overdriveAura(c, { ...h, x: 0 }, 0, true);
            if (h.dodge > 0) { const k = 1 - h.dodge / HERO.dodge.time; c.translate(0, -18); c.rotate(k * TAU); c.translate(0, 18); }
            if (h.charging > 0) c.rotate(.25);
            if (h.hurt > .15) c.rotate(-.18);
            const run = h.move && !h.swing ? Math.sin(h.anim * 13) : 0, bob = h.move ? Math.abs(run) * 2 : Math.sin(h.anim * 2.4) * 1.2;
            // legs
            limb(c, -5, -30 - bob, Math.PI / 2 + run * .7, 16, 7, TEAM.steelDark); limb(c, 5, -30 - bob, Math.PI / 2 - run * .7, 16, 7, TEAM.steelDark);
            // cape
            const sway = this.reduced ? 0 : Math.sin(this.clock * 6) * 3 + (h.move ? -6 : 0);
            c.beginPath(); c.moveTo(-8, -58 - bob); c.quadraticCurveTo(-30 + sway, -44, -24 + sway, -20 - bob); c.lineTo(-6, -30 - bob); c.closePath(); shape(c, '#9b2f2a');
            // boiler backpack with chimney
            rect(c, -22, -64 - bob, 12, 28, TEAM.copper, 2.5); rect(c, -21, -74 - bob, 6, 10, TEAM.steelDark, 2);
            // boiler chest
            ellipse(c, 0, -44 - bob, 13, 16, TEAM.brass);
            c.strokeStyle = INK; c.lineWidth = 2; c.beginPath(); c.moveTo(-12, -40 - bob); c.lineTo(12, -40 - bob); c.stroke();
            c.fillStyle = '#ffcf8a'; c.beginPath(); c.arc(4, -50 - bob, 3, 0, TAU); c.fill();
            // helmet and goggle
            circle(c, 2, -68 - bob, 10, TEAM.steel); rect(c, -6, -80 - bob, 14, 5, '#9b2f2a', 2);
            circle(c, 8, -68 - bob, 4, h.overdrive > 0 ? '#ff9a3c' : '#ffcf6a', 2);
            // arm and steam blade
            let arm = .95;
            if (h.swing) {
                const spec = HERO.combo[h.swing.index], k = clamp(h.swing.t / spec.time, 0, 1);
                const from = h.swing.index === 2 ? -2.6 : h.swing.index === 1 ? 1.3 : -2.1, to = h.swing.index === 2 ? 1.1 : h.swing.index === 1 ? -1.6 : 1;
                arm = from + (to - from) * clamp((k - .05) / .45, 0, 1);
                if (k > .2 && k < .7) this.slashArc(c, from, arm, h.swing.index);
            } else if (h.charging > 0) arm = .2; else if (game.time - (h.lastBurst || -9) < .3) arm = 0;
            const [hx, hy] = limb(c, 6, -54 - bob, arm, 15, 6, TEAM.brass);
            c.save(); c.translate(hx, hy); c.rotate(arm);
            rect(c, -3, -4, 8, 8, TEAM.copper, 2);
            c.beginPath(); c.moveTo(5, -4); c.lineTo(40, -6); c.lineTo(46, 0); c.lineTo(40, 5); c.lineTo(5, 4); c.closePath(); shape(c, h.overdrive > 0 ? '#ffcf9a' : '#dfe4e6', 2.5);
            c.strokeStyle = h.overdrive > 0 ? '#ff9a3c' : '#8a949b'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(10, 0); c.lineTo(38, 0); c.stroke();
            c.restore();
            c.restore();
        }
        overdriveAura(c, h, y, local = false) {
            if (!(h.overdrive > 0)) return;
            const x = local ? 0 : h.x, pulse = this.reduced ? 1 : 1 + Math.sin(this.clock * 12) * .08;
            const g = c.createRadialGradient(x, (local ? 0 : y) - 40, 6, x, (local ? 0 : y) - 40, 60 * pulse); g.addColorStop(0, '#ffb34766'); g.addColorStop(1, '#ffb34700');
            c.fillStyle = g; c.fillRect(x - 70, (local ? 0 : y) - 110, 140, 130);
        }
        slashArc(c, from, to, index) {
            c.save(); c.globalCompositeOperation = 'lighter';
            const r = index === 2 ? 62 : 54;
            c.strokeStyle = index === 2 ? '#ffd27a' : '#fff4d8'; c.globalAlpha = .75; c.lineWidth = index === 2 ? 10 : 7; c.lineCap = 'round';
            c.beginPath(); c.arc(6, -54, r, Math.min(from, to), Math.max(from, to)); c.stroke();
            c.globalAlpha = .35; c.lineWidth = 18; c.stroke(); c.restore();
        }
        troop(c, a) {
            const spec = TROOPS[a.kind], y = GROUND + a.y * .6, attacking = a.attacking > 0;
            if (art()?.drawSprite(c, `troop-${a.kind}.${attacking ? 'attack' : 'walk'}`, attacking ? .22 - a.attacking : a.anim, a.x, y, 1, a.kind === 'shield' ? .78 : .68)) return this.hpBar(c, a, y - 74);
            c.save(); c.translate(a.x, y); if (a.hurt > 0) c.translate(-2, 0);
            const big = a.kind === 'shield' ? 1.18 : 1, step = Math.sin(a.anim * 11) * .6;
            c.scale(big * 1.4, big * 1.4);
            limb(c, -3, -16, Math.PI / 2 + step, 10, 4, TEAM.tinDark); limb(c, 3, -16, Math.PI / 2 - step, 10, 4, TEAM.tinDark);
            ellipse(c, 0, -26, 8, 11, a.hurt > 0 ? '#ffffff' : TEAM.tin, 2.5);
            c.fillStyle = TEAM.cloth; c.fillRect(-7, -28, 14, 4);
            circle(c, 1, -42, 6.5, TEAM.tin, 2.5); c.fillStyle = INK; c.fillRect(2, -43, 5, 2);
            // wind-up key on the back, turning
            c.save(); c.translate(-9, -27); c.rotate(this.reduced ? 0 : a.anim * 4); rect(c, -1, -5, 2, 10, TEAM.brass, 1.5); rect(c, -5, -6, 10, 3, TEAM.brass, 1.5); c.restore();
            const thrust = attacking ? Math.sin((1 - a.attacking / .22) * Math.PI) * 8 : 0;
            if (a.kind === 'sword') { const ang = attacking ? -.9 + (1 - a.attacking / .22) * 1.8 : .5; const [x, yy] = limb(c, 4, -30, ang, 8, 3.5, TEAM.tin); c.save(); c.translate(x, yy); c.rotate(ang); rect(c, 0, -2, 16, 4, '#dfe4e6', 2); c.restore(); }
            else if (a.kind === 'lancer') { limb(c, 3, -30, .2, 8, 3.5, TEAM.tin); c.beginPath(); c.moveTo(-10 + thrust, -30); c.lineTo(40 + thrust, -34); ink(c, 3); c.stroke(); c.beginPath(); c.moveTo(40 + thrust, -38); c.lineTo(50 + thrust, -34); c.lineTo(40 + thrust, -30); c.closePath(); shape(c, '#dfe4e6', 2); }
            else if (a.kind === 'musket') { rect(c, -2, -36, 30, 5, '#5b3a26', 2); rect(c, 22, -37, 12, 3, TEAM.steelDark, 1.5); if (attacking && a.attacking > .15) { c.fillStyle = '#ffe8a0'; c.beginPath(); c.arc(38, -35, 6, 0, TAU); c.fill(); } }
            else if (a.kind === 'shield') { ellipse(c, 10, -28, 6, 16, TEAM.copper, 3); circle(c, 11, -28, 3, TEAM.brass, 1.5); }
            else if (a.kind === 'mechanic') { rect(c, -14, -34, 7, 12, TEAM.copper, 2); const ang = attacking ? -.5 : .4; const [x, yy] = limb(c, 4, -30, ang, 8, 3.5, TEAM.tin); c.save(); c.translate(x, yy); c.rotate(ang); rect(c, 0, -1.5, 12, 3, TEAM.steel, 1.5); circle(c, 13, 0, 3.5, TEAM.steel, 1.5); c.restore(); }
            c.restore();
            this.hpBar(c, a, y - 74 * big);
        }
        enemy(c, e) {
            const spec = ENEMIES[e.kind], y = GROUND + e.y * .6, attacking = e.attacking > 0, flash = e.hurt > 0;
            const scale = { drone: .65, saw: .7, brute: .75, walker: .72, beetle: .6 }[e.kind];
            if (art()?.drawSprite(c, `enemy-${e.kind}.${attacking ? 'attack' : 'walk'}`, attacking ? .25 - e.attacking : e.anim, e.x, y, -1, scale)) return this.hpBar(c, e, y - 100);
            c.save(); c.translate(e.x, y); c.scale(-1.4, 1.4);
            if (e.idle) c.globalAlpha = .92;
            const body = flash ? '#ffffff' : FOE.rust, t = this.reduced ? 0 : e.anim;
            if (e.kind === 'drone') {
                const hover = -44 + Math.sin(t * 5) * 4; c.translate(0, hover);
                ellipse(c, 0, 0, 12, 10, body); circle(c, 5, 0, 3.5, FOE.eye, 1.5);
                c.beginPath(); c.moveTo(0, -10); c.lineTo(0, -16); ink(c, 2); c.stroke(); ellipse(c, 0, -17, 14 * Math.abs(Math.cos(t * 30)) + 2, 2.5, FOE.iron, 1.5);
                limb(c, -4, 8, 1.9, 7, 2, FOE.iron); limb(c, 4, 8, 1.2, 7, 2, FOE.iron);
                c.fillStyle = '#00000033'; c.beginPath(); c.ellipse(0, -hover, 12, 3, 0, 0, TAU); c.fill();
            } else if (e.kind === 'saw') {
                circle(c, 0, -9, 9, FOE.iron); c.save(); c.translate(0, -9); c.rotate(t * 10); for (let i = 0; i < 4; i++) { c.rotate(Math.PI / 4); c.beginPath(); c.moveTo(-8, 0); c.lineTo(8, 0); ink(c, 1.5); c.stroke(); } c.restore();
                rect(c, -7, -36, 14, 22, body, 2.5); circle(c, 0, -42, 6, FOE.iron, 2.5); c.fillStyle = FOE.eye; c.fillRect(1, -44, 5, 2);
                const reach = attacking ? 8 : 0; c.save(); c.translate(14 + reach, -28); c.rotate(t * 18); gear(c, 0, 0, 9, 12, 0, '#c9ccc8'); c.restore();
            } else if (e.kind === 'brute') {
                const step = Math.sin(t * 6) * .4;
                limb(c, -8, -24, Math.PI / 2 + step, 16, 9, FOE.iron); limb(c, 8, -24, Math.PI / 2 - step, 16, 9, FOE.iron);
                c.beginPath(); c.moveTo(-22, -26); c.quadraticCurveTo(-26, -66, 0, -70); c.quadraticCurveTo(24, -64, 20, -26); c.closePath(); shape(c, body);
                for (const [rx, ry] of [[-12, -40], [0, -52], [10, -38]]) circle(c, rx, ry, 2, FOE.iron, 1);
                circle(c, 10, -62, 7, FOE.iron, 2.5); c.fillStyle = FOE.eye; c.fillRect(12, -64, 5, 3);
                const swing = attacking ? -1.6 + (1 - e.attacking / .25) * 2.6 : .6;
                const [hx, hy] = limb(c, 14, -52, swing, 16, 6, FOE.iron); c.save(); c.translate(hx, hy); c.rotate(swing); rect(c, 10, -10, 16, 20, FOE.iron, 3); rect(c, 0, -2, 14, 4, '#5b3a26', 2); c.restore();
            } else if (e.kind === 'walker') {
                for (let i = 0; i < 3; i++) { const a = Math.PI / 2 + (i - 1) * .55 + Math.sin(t * 5 + i * 2) * .15; limb(c, 0, -34, a, 34, 3, FOE.iron); }
                ellipse(c, 0, -40, 18, 12, body); c.save(); c.translate(6, -46); c.rotate(-.35); rect(c, 0, -5, 30, 10, FOE.iron, 2.5); c.restore();
                circle(c, -6, -40, 3.5, FOE.eye, 1.5);
                if (attacking && e.attacking > .18) { c.fillStyle = '#ffe8a0'; c.beginPath(); c.arc(34, -58, 7, 0, TAU); c.fill(); }
            } else if (e.kind === 'beetle') {
                for (let i = 0; i < 3; i++) { const k = Math.sin(t * 16 + i) * .3; limb(c, -6 + i * 6, -6, Math.PI / 2 + k + .4, 7, 2, FOE.iron); }
                c.beginPath(); c.arc(0, -8, 13, Math.PI, 0); c.closePath(); shape(c, flash ? '#ffffff' : '#5c4a2a');
                c.beginPath(); c.moveTo(0, -21); c.lineTo(0, -8); ink(c, 1.5); c.stroke();
                const blink = Math.sin(t * (6 + (1 - e.hp / e.maxHp) * 10)) > 0; circle(c, 6, -24, 3, blink ? FOE.eye : FOE.iron, 1.5);
            }
            c.restore();
            if (!e.idle) this.hpBar(c, e, y - ({ drone: 98, saw: 78, brute: 112, walker: 100, beetle: 46 }[e.kind]), true);
        }
        hpBar(c, u, y, foe = false) {
            if (u.hp >= u.maxHp) return;
            const w = Math.max(18, u.radius * 1.8), k = clamp(u.hp / u.maxHp, 0, 1);
            c.fillStyle = '#000000aa'; c.fillRect(u.x - w / 2 - 1, y - 1, w + 2, 5);
            c.fillStyle = foe ? '#e2533a' : '#8fd06a'; c.fillRect(u.x - w / 2, y, w * k, 3);
        }
        debris(c, d) {
            // Fallen machines collapse into spinning gears and bolts.
            const k = d.t / .9, y = GROUND + d.y * .6;
            c.save(); c.globalAlpha = 1 - k;
            for (let i = 0; i < 4; i++) {
                const a = i * 1.7 + 1, x = d.x + Math.cos(a) * k * 40 * (i % 2 ? 1 : -1), yy = y - 20 - Math.sin(k * Math.PI) * (30 + i * 8) + k * 16;
                gear(c, x, yy, 6 + i * 1.5, 6, k * 8 + i, d.ally ? TEAM.brass : '#8a8f92');
            }
            c.restore();
        }
        colossus(c, b, game) {
            const y = GROUND, slam = game.telegraphs.find(t => t.kind === 'slam'), vent = b.venting > 0 || game.telegraphs.some(t => t.kind === 'vent');
            const anim = slam ? 'slam' : vent ? 'vent' : 'idle';
            if (art()?.drawSprite(c, `boss-colossus.${anim}`, slam ? slam.total - slam.time : b.anim, b.x, y, -1, .62)) return;
            c.save(); c.translate(b.x, y); c.scale(-1, 1); if (b.hurt > 0) c.translate(-3, 0);
            const t = this.reduced ? 0 : b.anim, body = b.hurt > .09 ? '#c98a72' : b.phase === 2 ? '#8a3a24' : FOE.rust;
            rect(c, -48, -90, 34, 90, FOE.iron, 4); rect(c, 14, -90, 34, 90, FOE.iron, 4);
            c.beginPath(); c.moveTo(-74, -90); c.quadraticCurveTo(-84, -250, 0, -262); c.quadraticCurveTo(84, -250, 74, -90); c.closePath(); shape(c, body, 4);
            for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(-70, -120 - i * 34); c.lineTo(70, -120 - i * 34); ink(c, 3); c.stroke(); }
            const mouth = c.createRadialGradient(10, -150, 4, 10, -150, 44); mouth.addColorStop(0, '#fff1b0'); mouth.addColorStop(.5, '#ff8a2a'); mouth.addColorStop(1, '#5a1a0a');
            c.beginPath(); c.ellipse(10, -150, 34, 24, 0, 0, TAU); c.fillStyle = mouth; c.fill(); ink(c, 4); c.stroke();
            for (const sx of [-40, 30]) { rect(c, sx, -300, 18, 50, FOE.iron, 3); if (!this.reduced) { c.fillStyle = '#5a504899'; const k = ((t * .7 + sx / 100) % 1 + 1) % 1; c.beginPath(); c.ellipse(sx + 9, -310 - k * 60, 14 + k * 20, 10, 0, 0, TAU); c.fill(); } }
            circle(c, 30, -232, 16, FOE.iron, 3); c.fillStyle = FOE.eye; c.fillRect(34, -236, 14, 5);
            const raise = slam ? clamp(1 - slam.time / slam.total, 0, 1) : 0, arm = slam ? -1.9 * raise + .5 : .6 + Math.sin(t * 2) * .05;
            const [hx, hy] = limb(c, 60, -190, arm, 70, 16, FOE.iron); circle(c, hx, hy, 26, FOE.iron, 4); circle(c, hx, hy, 10, body, 2);
            c.restore();
            this.bossBar(c, b);
        }
        airship(c, b, game) {
            const y = GROUND, bombing = game.telegraphs.some(t => t.kind === 'bomb');
            if (art()?.drawSprite(c, `boss-airship.${bombing ? 'bombs' : 'idle'}`, b.anim, b.x, y, -1, .7)) return;
            c.save(); c.translate(b.x, y); c.scale(-1, 1); const t = this.reduced ? 0 : b.anim, bob = Math.sin(t * 1.6) * 6;
            c.translate(0, bob);
            ellipse(c, 0, -330, 200, 74, b.hurt > .09 ? '#9a5a44' : b.phase === 2 ? '#7a2a20' : '#6a3a2a', 4);
            for (let i = -3; i <= 3; i++) { c.beginPath(); c.ellipse(0, -330, Math.abs(i) * 60 + 6, 74, 0, -Math.PI / 2, Math.PI / 2); ink(c, 2); c.stroke(); }
            c.beginPath(); c.moveTo(-190, -330); c.lineTo(190, -330); ink(c, 2); c.stroke();
            for (const rx of [-60, 60]) { c.beginPath(); c.moveTo(rx, -258); c.lineTo(rx * .6, -110); ink(c, 2); c.stroke(); }
            rect(c, -80, -112, 160, 70, FOE.iron, 4); for (let i = 0; i < 5; i++) rect(c, -66 + i * 28, -96, 16, 18, '#ffb34799', 2);
            for (const cy of [-70, -52]) rect(c, 76, cy - 5, 34, 10, FOE.iron, 2.5);
            c.save(); c.translate(-210, -330); c.rotate(t * 20); for (let i = 0; i < 3; i++) { c.rotate(TAU / 3); ellipse(c, 0, -18, 6, 18, '#8a8f92', 2); } c.restore();
            c.restore();
            this.bossBar(c, b);
        }
        bossBar(c, b) { /* drawn in HUD */ }
        telegraph(c, t) {
            const k = clamp(1 - t.time / t.total, 0, 1), y = GROUND;
            c.save();
            c.fillStyle = `rgba(226,60,40,${.12 + k * .25})`; c.fillRect(t.from, y - 8, t.to - t.from, 30);
            c.strokeStyle = '#ff5a3a'; c.lineWidth = 2; c.setLineDash([8, 6]); c.strokeRect(t.from, y - 8, t.to - t.from, 30); c.setLineDash([]);
            c.fillStyle = '#ffb347'; c.fillRect(t.from, y + 24, (t.to - t.from) * k, 4);
            if (t.kind === 'bomb') { c.fillStyle = '#00000066'; c.beginPath(); c.ellipse((t.from + t.to) / 2, y + 6, (t.to - t.from) / 2 * (1 - k * .5), 8, 0, 0, TAU); c.fill(); }
            c.restore();
        }
        shot(c, s) {
            if (s.kind === 'bullet') { c.strokeStyle = '#ffe8a0'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(s.x - 18, GROUND - 36 + s.y * .6); c.lineTo(s.x, GROUND - 36 + s.y * .6); c.stroke(); return; }
            const k = clamp(s.t / s.dur, 0, 1), arc = s.kind === 'cannon' ? 220 : s.kind === 'mortar' ? 200 : 140;
            const y = GROUND - 40 - Math.sin(k * Math.PI) * arc - (s.kind === 'mortar' ? (1 - k) * 200 : 0);
            circle(c, s.x, y, s.kind === 'cannon' ? 9 : 6, '#2b2522', 2);
            if (!this.reduced) { c.fillStyle = '#8a847a55'; c.beginPath(); c.arc(s.x + 8, y - 4, 5, 0, TAU); c.fill(); }
        }
        // ---------- HUD
        hud(c, game, zone) {
            const h = game.hero;
            c.save(); c.textBaseline = 'middle';
            // Front-line map.
            const mx = 300, mw = 360, my = 22;
            c.fillStyle = '#100b08cc'; c.fillRect(mx - 8, my - 10, mw + 16, 20);
            c.fillStyle = '#5a4634'; c.fillRect(mx, my - 1, mw, 2);
            const at = x => mx + clamp(x / game.length, 0, 1) * mw;
            c.fillStyle = '#ffd27a'; c.fillRect(at(game.train.x) - 4, my - 6, 8, 12);
            if (game.gate) { c.fillStyle = '#e2533a'; c.fillRect(at(game.gate.x) - 4, my - 7, 8, 14); }
            for (const a of game.allies) { c.fillStyle = '#8fc6e8'; c.fillRect(at(a.x) - 1, my - 3, 2, 6); }
            for (const e of game.enemies) if (!e.idle) { c.fillStyle = '#e2533a'; c.fillRect(at(e.x) - 1, my - 3, 2, 6); }
            if (game.boss) { c.fillStyle = '#ff8a4a'; c.beginPath(); c.arc(at(game.boss.x), my, 6, 0, TAU); c.fill(); }
            if (h.alive) { c.fillStyle = '#ffffff'; c.beginPath(); c.moveTo(at(h.x), my - 8); c.lineTo(at(h.x) + 5, my); c.lineTo(at(h.x), my + 8); c.lineTo(at(h.x) - 5, my); c.fill(); }
            c.strokeStyle = '#c99a3e88'; c.strokeRect(at(game.camera ?? this.camera), my - 9, W / game.length * mw, 18);
            // Gate / boss health.
            const foe = game.boss || game.gate;
            if (foe) {
                const label = game.boss ? BOSSES[game.boss.kind].name : '叛軍鑄造閘門';
                c.fillStyle = '#100b08cc'; c.fillRect(W / 2 - 200, 40, 400, 22);
                c.fillStyle = '#4a1a12'; c.fillRect(W / 2 - 194, 52, 388, 6); c.fillStyle = '#e2533a'; c.fillRect(W / 2 - 194, 52, 388 * clamp(foe.hp / foe.maxHp, 0, 1), 6);
                c.fillStyle = '#ffe3c2'; c.font = '700 10px ui-monospace, monospace'; c.textAlign = 'center'; c.fillText(label, W / 2, 46);
            }
            // Hero panel.
            c.fillStyle = '#100b08cc'; c.fillRect(14, H - 66, 250, 52);
            c.fillStyle = '#ffe3c2'; c.font = '700 11px ui-monospace, monospace'; c.textAlign = 'left';
            c.fillText(h.alive ? '黃銅隊長' : `重新出擊 ${Math.ceil(h.respawn)}`, 24, H - 54);
            c.fillStyle = '#3a1a12'; c.fillRect(24, H - 44, 228, 8); c.fillStyle = '#8fd06a'; c.fillRect(24, H - 44, 228 * clamp(h.hp / h.maxHp, 0, 1), 8);
            c.fillStyle = '#2a1a0a'; c.fillRect(24, H - 30, 228, 6); c.fillStyle = h.overdrive > 0 ? '#ff9a3c' : '#ffcf6a'; c.fillRect(24, H - 30, 228 * (h.overdrive > 0 ? h.overdrive / game.stats.overdrive : h.meter / 100), 6);
            c.fillStyle = '#c9b89a'; c.font = '600 9px ui-monospace, monospace'; c.fillText(h.overdrive > 0 ? '超載中' : h.meter >= 100 ? '壓力滿 · 按 U 超載' : '壓力槽', 24, H - 18);
            // Train health.
            c.fillStyle = '#100b08cc'; c.fillRect(14, 40, 180, 22); c.fillStyle = '#ffe3c2'; c.font = '700 10px ui-monospace, monospace'; c.fillText('蒸汽列車', 22, 46);
            c.fillStyle = '#3a1a12'; c.fillRect(22, 52, 164, 6); c.fillStyle = '#ffd27a'; c.fillRect(22, 52, 164 * clamp(game.train.hp / game.train.maxHp, 0, 1), 6);
            // Skill dials.
            const skills = [['K', '衝擊', h.burstCd, game.stats.burst.cooldown], ['L', '突進', h.chargeCd, game.stats.charge.cooldown], ['U', '超載', h.meter >= 100 ? 0 : 1, 1], ['␣', '翻滾', h.dodgeCd, HERO.dodge.cooldown]];
            skills.forEach(([key, name, cd, max], i) => {
                const x = W - 210 + i * 50, y = H - 40, k = clamp(cd / max, 0, 1);
                circle(c, x, y, 19, k > 0 ? '#2a1d16' : '#5b3a26', 2.5);
                if (k > 0) { c.fillStyle = '#000000aa'; c.beginPath(); c.moveTo(x, y); c.arc(x, y, 17, -Math.PI / 2, -Math.PI / 2 + k * TAU); c.closePath(); c.fill(); }
                c.fillStyle = k > 0 ? '#9a8a74' : '#ffe3c2'; c.textAlign = 'center'; c.font = '800 12px ui-monospace, monospace'; c.fillText(key, x, y - 3);
                c.font = '600 8px system-ui, sans-serif'; c.fillText(name, x, y + 9);
            });
            c.fillStyle = '#ffe3c2'; c.font = '700 10px system-ui, sans-serif'; c.textAlign = 'right';
            c.fillText(`Q 陣形：${{ follow: '跟進', charge: '衝鋒', hold: '固守' }[game.order]}`, W - 16, H - 76);
            c.restore();
        }
    }
    globalThis.CogfrontRenderer = Object.freeze({ Renderer });
    if (typeof module !== 'undefined' && module.exports) module.exports = globalThis.CogfrontRenderer;
})();
