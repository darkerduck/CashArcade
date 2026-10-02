(() => {
    'use strict';
    const W = 540, H = 780;
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const LEVELS = Object.freeze([
        { name: '穿越光城', zone: 'LUMEN CITY', duration: 62, boss: '鋼翼哨戒者', color: 'cyan', interval: 4.2 },
        { name: '離子裂谷', zone: 'ION RIFT', duration: 76, boss: '裂谷織網者', color: 'violet', interval: 3.8 },
        { name: '終焉軌道', zone: 'TERMINAL ORBIT', duration: 90, boss: '零界方舟', color: 'gold', interval: 3.4 },
    ].map(Object.freeze));
    const WEAPONS = Object.freeze({ pulse: '脈衝機砲', spread: '散射風暴', laser: '聚束雷射' });
    const ITEMS = Object.freeze({ spread: '散射', laser: '雷射', wing: '僚機', repair: '修復', bomb: '脈衝彈' });
    const clone = v => JSON.parse(JSON.stringify(v));
    function fresh() { return { version: 1, level: 1, score: 0, hp: 5, bombs: 2, weapon: 'pulse', power: 1, wings: 0 }; }
    function valid(c) {
        return !!c && c.version === 1 && Number.isInteger(c.level) && c.level >= 1 && c.level <= 3
            && Number.isInteger(c.score) && c.score >= 0 && c.score <= 1e9
            && Number.isInteger(c.hp) && c.hp >= 1 && c.hp <= 5
            && Number.isInteger(c.bombs) && c.bombs >= 0 && c.bombs <= 3
            && Object.hasOwn(WEAPONS, c.weapon) && Number.isInteger(c.power) && c.power >= 1 && c.power <= 3
            && Number.isInteger(c.wings) && c.wings >= 0 && c.wings <= 2;
    }
    // Distance to the full swept path prevents high-speed shots from tunnelling.
    function segmentDistance(x, y, ax, ay, bx, by) {
        const dx = bx - ax, dy = by - ay, length = dx * dx + dy * dy;
        const t = length ? clamp(((x - ax) * dx + (y - ay) * dy) / length, 0, 1) : 0;
        return Math.hypot(x - ax - t * dx, y - ay - t * dy);
    }
    class Game {
        constructor(checkpoint = fresh()) {
            if (!valid(checkpoint)) throw new Error('Invalid assault checkpoint');
            this.checkpoint = clone(checkpoint); Object.assign(this, clone(checkpoint));
            this.config = LEVELS[this.level - 1]; this.state = 'running'; this.time = 0;
            this.player = { x: W / 2, y: H - 108, r: 7, invulnerable: 2, fire: 0, wingFire: 0, lean: 0 };
            this.enemies = []; this.shots = []; this.bullets = []; this.items = []; this.beams = [];
            this.events = []; this.boss = null; this.wave = 0; this.nextWave = 1.5; this.nextSupply = 6;
            this.supplies = 0; this.kills = 0; this.combo = 0; this.comboTime = 0; this.maxCombo = 0;
            this.id = 0; this.clearTime = 0; this.bombCooldown = 0;
        }
        emit(type, x, y, data = {}) { if (this.events.length < 200) this.events.push({ type, x, y, ...data }); }
        drain() { return this.events.splice(0); }
        spawn(type, x, y = -40, data = {}) {
            if (this.enemies.length >= 55) return null;
            const heavy = type === 'gunship', hp = heavy ? 20 + this.level * 4 : type === 'fighter' ? 5 + this.level : 2 + this.level;
            const e = { id: ++this.id, type, x, y, origin: x, age: 0, hp, maxHp: hp,
                r: heavy ? 28 : 17, speed: heavy ? 57 : type === 'fighter' ? 100 : 130,
                fire: heavy ? 1.8 : 1.2 + (this.id % 5) * .28, dead: false, ...data };
            this.enemies.push(e); return e;
        }
        formation() {
            const pattern = this.wave++ % 5, n = this.level === 3 ? 7 : 5;
            if (pattern === 0 || pattern === 3) {
                for (let i = 0; i < n; i++) this.spawn('scout', 62 + i * (W - 124) / (n - 1), -35 - Math.abs(i - (n - 1) / 2) * 34, { sway: pattern === 3 ? 52 : 18 });
            } else if (pattern === 1) {
                for (let i = 0; i < 5; i++) this.spawn('fighter', this.wave % 2 ? 115 : W - 115, -40 - i * 62, { sway: 78 });
            } else if (pattern === 2) {
                this.spawn('gunship', W / 2, -50);
                this.spawn('fighter', 100, -95, { sway: 25 }); this.spawn('fighter', W - 100, -95, { sway: 25 });
                if (this.level > 1) { this.spawn('scout', 180, -155); this.spawn('scout', 360, -155); }
            } else {
                for (let i = 0; i < 6; i++) this.spawn('fighter', i % 2 ? 95 : W - 95, -50 - Math.floor(i / 2) * 85, { sway: 65 });
            }
        }
        drop(type, x = W / 2, y = -25) {
            if (!Object.hasOwn(ITEMS, type) || this.items.length >= 12) return;
            this.items.push({ type, x: clamp(x, 26, W - 26), y, age: 0 });
        }
        pickup(type) {
            if (!Object.hasOwn(ITEMS, type) || this.state !== 'running') return;
            if (type === 'spread' || type === 'laser') { this.weapon = type; this.power = Math.min(3, this.power + 1); }
            if (type === 'wing') this.wings = Math.min(2, this.wings + 1);
            if (type === 'repair') this.hp = Math.min(5, this.hp + 1);
            if (type === 'bomb') this.bombs = Math.min(3, this.bombs + 1);
            this.score += 100; this.emit('pickup', this.player.x, this.player.y, { item: type });
        }
        shot(x, y, angle = -Math.PI / 2, damage = 2, wing = false) {
            if (this.shots.length >= 180) return;
            this.shots.push({ x, y, vx: Math.cos(angle) * 760, vy: Math.sin(angle) * 760, damage, wing, r: 3 });
        }
        fire() {
            const p = this.player;
            if (this.weapon === 'laser') {
                const width = 8 + this.power * 3;
                this.beams.push({ x: p.x, y: p.y - 20, width, life: .10 });
                for (const e of this.enemies) if (!e.dead && e.y < p.y && Math.abs(e.x - p.x) <= e.r + width / 2) this.damageEnemy(e, 2.1 + this.power * .55);
                this.hitBossRay(p.x, p.y - 20, width, 2.1 + this.power * .55);
            } else {
                const count = this.weapon === 'spread' ? 3 + this.power * 2 : this.power === 1 ? 2 : 4;
                for (let i = 0; i < count; i++) {
                    const offset = i - (count - 1) / 2;
                    this.shot(p.x + offset * (this.weapon === 'spread' ? 3 : 8), p.y - 19,
                        -Math.PI / 2 + (this.weapon === 'spread' ? offset * .115 : 0), this.weapon === 'spread' ? 1.65 : 2);
                }
            }
            this.emit('shoot', p.x, p.y, { weapon: this.weapon });
        }
        bullet(x, y, angle, speed = 185, type = 'round') {
            if (this.bullets.length >= 240) return;
            this.bullets.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, r: type === 'heavy' ? 7 : 5, type });
        }
        fan(x, y, angle, count, gap, speed = 185) {
            for (let i = 0; i < count; i++) this.bullet(x, y, angle + (i - (count - 1) / 2) * gap, speed);
        }
        damageEnemy(e, damage) {
            if (e.dead) return;
            e.hp -= damage; e.flash = .08;
            if (e.hp > 0) return;
            e.dead = true; this.kills++; this.combo++; this.comboTime = 2.8; this.maxCombo = Math.max(this.maxCombo, this.combo);
            const points = (e.type === 'gunship' ? 250 : 80) * Math.min(4, 1 + Math.floor(this.combo / 12));
            this.score += points;
            this.emit('explode', e.x, e.y, { size: e.r, points });
            if (this.kills % 23 === 0) this.drop(this.hp < 4 ? 'repair' : 'bomb', e.x, e.y);
        }
        hurt() {
            if (this.state !== 'running' || this.player.invulnerable > 0) return false;
            this.hp--; this.player.invulnerable = 2; this.combo = 0; this.comboTime = 0;
            this.emit('hurt', this.player.x, this.player.y);
            // Give a visible recovery pocket, without deleting the entire pattern.
            this.bullets = this.bullets.filter(b => Math.hypot(b.x - this.player.x, b.y - this.player.y) > 105);
            if (this.hp <= 0) { this.state = 'lost'; this.emit('lost', this.player.x, this.player.y); }
            return true;
        }
        bomb() {
            if (this.state !== 'running' || this.bombs <= 0 || this.bombCooldown > 0) return false;
            this.bombs--; this.bombCooldown = .6; this.player.invulnerable = Math.max(1.4, this.player.invulnerable);
            this.bullets = [];
            for (const e of this.enemies) this.damageEnemy(e, 35);
            if (this.boss && !this.boss.dead && this.boss.age > 2) {
                const targets = this.boss.nodes.filter(n => n.hp > 0);
                if (targets.length) targets.forEach(n => this.damageNode(n, 24));
                else this.damageCore(36);
            }
            this.emit('bomb', this.player.x, this.player.y); return true;
        }
        spawnBoss() {
            if (this.boss) return;
            this.enemies = []; this.bullets = [];
            const offsets = this.level === 3 ? [-156, -78, 78, 156] : [-112, 112];
            const maxHp = [240, 320, 440][this.level - 1], nodeHp = 32 + this.level * 12;
            this.boss = { x: W / 2, y: -140, age: 0, hp: maxHp, maxHp, phase: 'armor', dead: false,
                fire: 3.7, volley: 0, sweep: null, rage: false, flash: 0,
                nodes: offsets.map((offset, i) => ({ offset, dy: i % 2 ? 18 : 0, hp: nodeHp, maxHp: nodeHp })) };
            this.emit('boss', W / 2, 155, { name: this.config.boss });
        }
        damageNode(n, damage) {
            const b = this.boss;
            if (!b || b.dead || n.hp <= 0) return;
            n.hp = Math.max(0, n.hp - damage); n.flash = .08;
            if (n.hp === 0) {
                this.score += 500; this.emit('part', b.x + n.offset, b.y + n.dy, { side: Math.sign(n.offset) });
                if (b.nodes.every(node => node.hp <= 0)) {
                    b.phase = 'core'; b.fire = 1.8; this.bullets = []; this.emit('phase', b.x, b.y, { phase: 'core' });
                    this.drop('repair', b.x, b.y + 75);
                }
            }
        }
        damageCore(damage) {
            const b = this.boss;
            if (!b || b.dead || b.age < 2 || b.nodes.some(n => n.hp > 0)) return;
            b.hp = Math.max(0, b.hp - damage); b.flash = .08;
            if (b.hp <= b.maxHp * .45 && !b.rage && b.hp > 0) {
                b.rage = true; b.phase = 'rage'; b.fire = 1.8; this.bullets = [];
                this.emit('phase', b.x, b.y, { phase: 'rage' });
            }
            if (b.hp === 0) {
                b.dead = true; this.state = 'clearing'; this.clearTime = 2.6; this.bullets = []; this.enemies = []; this.items = [];
                this.score += 3000 * this.level + this.hp * 200; this.emit('bossDown', b.x, b.y);
            }
        }
        hitBossRay(x, y, width, damage) {
            const b = this.boss;
            if (!b || b.dead || b.age < 2) return false;
            // The beam stops at the nearest live armor module.
            const node = b.nodes.find(n => n.hp > 0 && y > b.y + n.dy - 30 && Math.abs(x - b.x - n.offset) < 27 + width / 2);
            if (node) { this.damageNode(node, damage); return true; }
            if (y > b.y - 40 && Math.abs(x - b.x) < 40 + width / 2) { this.damageCore(damage); return true; }
            return false;
        }
        updateBoss(dt) {
            const b = this.boss; if (!b || b.dead) return;
            b.age += dt; b.y = Math.min(145, b.y + dt * 120);
            b.x = W / 2 + Math.sin(Math.max(0, b.age - 2) * .65) * (this.level === 3 ? 44 : 68);
            b.flash = Math.max(0, b.flash - dt); b.nodes.forEach(n => n.flash = Math.max(0, (n.flash || 0) - dt));
            if (b.age < 2.6) return;
            b.fire -= dt;
            if (b.fire <= 0) {
                const aim = Math.atan2(this.player.y - b.y, this.player.x - b.x);
                if (this.level === 1) {
                    this.fan(b.x, b.y + 44, aim, b.rage ? 7 : 5, .22, b.rage ? 205 : 175);
                    b.nodes.filter(n => n.hp > 0).forEach(n => this.fan(b.x + n.offset, b.y + n.dy + 28, Math.PI / 2, 3, .28, 155));
                } else if (this.level === 2) {
                    // Rotating rings have wide, consistent lanes between projectiles.
                    const count = b.rage ? 18 : 14;
                    for (let i = 0; i < count; i++) this.bullet(b.x, b.y + 28, i * Math.PI * 2 / count + b.volley * .16, b.rage ? 185 : 155);
                    this.fan(b.x, b.y + 55, aim, 3, .2, 210);
                } else {
                    this.fan(b.x - 100, b.y + 40, Math.PI / 2 + Math.sin(b.volley) * .3, 6, .23, 180);
                    this.fan(b.x + 100, b.y + 40, Math.PI / 2 - Math.sin(b.volley) * .3, 6, .23, 180);
                    if (b.rage) this.fan(b.x, b.y + 55, aim, 5, .18, 220);
                }
                b.volley++; b.fire = b.rage ? .95 : 1.55;
                if (this.level >= 2 && b.volley % 3 === 0 && !b.sweep) {
                    b.sweep = { x: clamp(this.player.x, 50, W - 50), age: 0, width: 48 };
                    this.emit('warning', b.sweep.x, H / 2);
                }
            }
            if (b.sweep) {
                b.sweep.age += dt;
                if (b.sweep.age >= 1.3 && b.sweep.age < 1.8 && this.player.y > b.y + 35
                    && Math.abs(this.player.x - b.sweep.x) < b.sweep.width / 2 + this.player.r) this.hurt();
                if (b.sweep.age >= 1.8) b.sweep = null;
            }
            if (Math.abs(this.player.x - b.x) < 48 && Math.abs(this.player.y - b.y) < 55) this.hurt();
            for (const n of b.nodes) if (n.hp > 0 && Math.hypot(this.player.x - b.x - n.offset, this.player.y - b.y - n.dy) < 35) this.hurt();
        }
        nextCheckpoint() {
            if (this.state !== 'stageClear' || this.level >= 3) return null;
            return { version: 1, level: this.level + 1, score: this.score, hp: Math.min(5, this.hp + 1),
                bombs: Math.min(3, this.bombs + 1), weapon: this.weapon, power: this.power, wings: this.wings };
        }
        update(dt, input = {}) {
            if (!['running', 'clearing'].includes(this.state) || !Number.isFinite(dt) || dt <= 0) return;
            dt = Math.min(dt, 1 / 30); this.time += dt;
            this.beams.forEach(b => b.life -= dt); this.beams = this.beams.filter(b => b.life > 0);
            if (this.state === 'clearing') {
                this.clearTime -= dt;
                if (this.clearTime <= 0) { this.state = this.level === 3 ? 'won' : 'stageClear'; this.emit(this.state, W / 2, H / 2); }
                return;
            }
            const p = this.player, oldX = p.x, oldY = p.y;
            if (Number.isFinite(input.x) && Number.isFinite(input.y)) {
                const dx = input.x - p.x, dy = input.y - p.y, d = Math.hypot(dx, dy), travel = Math.min(d, 680 * dt);
                if (d) { p.x += dx / d * travel; p.y += dy / d * travel; }
            } else {
                const dx = Number(input.dx) || 0, dy = Number(input.dy) || 0, d = Math.max(1, Math.hypot(dx, dy));
                p.x += dx / d * (input.focus ? 150 : 320) * dt; p.y += dy / d * (input.focus ? 150 : 320) * dt;
            }
            p.x = clamp(p.x, 22, W - 22); p.y = clamp(p.y, 245, H - 28);
            p.lean += (clamp((p.x - oldX) / dt / 320, -1, 1) - p.lean) * Math.min(1, dt * 12);
            p.invulnerable = Math.max(0, p.invulnerable - dt); this.bombCooldown = Math.max(0, this.bombCooldown - dt);
            this.comboTime = Math.max(0, this.comboTime - dt); if (!this.comboTime) this.combo = 0;
            if (input.bomb) this.bomb();
            p.fire -= dt; p.wingFire -= dt;
            if (p.fire <= 0) { this.fire(); p.fire += this.weapon === 'laser' ? .12 : .145; }
            if (this.wings && p.wingFire <= 0) {
                for (let i = 0; i < this.wings; i++) this.shot(p.x + (i === 0 ? -38 : 38), p.y + 2, -Math.PI / 2, 2.2, true);
                p.wingFire += .19;
            }
            if (!this.boss) {
                if (this.time >= this.config.duration) this.spawnBoss();
                else if (this.time >= this.nextWave && this.time < this.config.duration - 7) { this.formation(); this.nextWave += this.config.interval; }
                if (this.time >= this.nextSupply && this.time < this.config.duration - 5) {
                    const pool = ['spread', 'wing', 'laser', 'repair', 'wing', 'bomb'];
                    this.drop(pool[this.supplies % pool.length], [W / 2, 160, 380][this.supplies % 3]);
                    this.supplies++; this.nextSupply += 10;
                }
            }
            for (const e of this.enemies) {
                if (e.dead) continue;
                e.age += dt; e.y += e.speed * dt; e.x = clamp(e.origin + Math.sin(e.age * 1.7) * (e.sway || 25), 25, W - 25);
                e.flash = Math.max(0, (e.flash || 0) - dt); e.fire -= dt;
                if (e.fire <= 0 && e.y > 10 && e.y < p.y - 110) {
                    const aim = Math.atan2(p.y - e.y, p.x - e.x);
                    this.fan(e.x, e.y + 15, aim, e.type === 'gunship' ? 5 : e.type === 'fighter' && this.level > 1 ? 3 : 1, .25, 160 + this.level * 15);
                    e.fire = e.type === 'gunship' ? 2.1 : 2.7;
                }
                if (segmentDistance(e.x, e.y, oldX, oldY, p.x, p.y) < e.r + p.r) { this.hurt(); e.dead = true; this.emit('explode', e.x, e.y, { size: e.r }); }
                if (e.y > H + 45) e.dead = true;
            }
            if (this.state !== 'running') return;
            this.updateBoss(dt);
            if (this.state !== 'running') return;
            for (const s of this.shots) {
                const ax = s.x, ay = s.y; s.x += s.vx * dt; s.y += s.vy * dt;
                for (const e of this.enemies) if (!e.dead && segmentDistance(e.x, e.y, ax, ay, s.x, s.y) < e.r + s.r) {
                    this.damageEnemy(e, s.damage); s.dead = true; break;
                }
                if (!s.dead && this.boss && !this.boss.dead && this.boss.age >= 2) {
                    const b = this.boss;
                    const n = b.nodes.find(node => node.hp > 0 && segmentDistance(b.x + node.offset, b.y + node.dy, ax, ay, s.x, s.y) < 29);
                    if (n) { this.damageNode(n, s.damage); s.dead = true; }
                    else if (segmentDistance(b.x, b.y, ax, ay, s.x, s.y) < 42) { this.damageCore(s.damage); s.dead = true; }
                }
            }
            for (const b of this.bullets) {
                const ax = b.x, ay = b.y; b.x += b.vx * dt; b.y += b.vy * dt;
                // Relative motion accounts for the player and projectile moving in the same tick.
                if (segmentDistance(0, 0, ax - oldX, ay - oldY, b.x - p.x, b.y - p.y) < p.r + b.r) {
                    if (this.hurt()) b.dead = true;
                }
            }
            for (const item of this.items) {
                item.age += dt; item.y += 83 * dt;
                if (segmentDistance(item.x, item.y, oldX, oldY, p.x, p.y) < 29) { this.pickup(item.type); item.dead = true; }
            }
            this.enemies = this.enemies.filter(e => !e.dead);
            this.shots = this.shots.filter(s => !s.dead && s.y > -40 && s.x > -30 && s.x < W + 30);
            this.bullets = this.bullets.filter(b => !b.dead && b.y < H + 30 && b.y > -60 && b.x > -40 && b.x < W + 40);
            this.items = this.items.filter(i => !i.dead && i.y < H + 30 && i.age < 12);
        }
    }
    globalThis.NeonAssault = Object.freeze({ W, H, LEVELS, WEAPONS, ITEMS, Game, fresh, valid, segmentDistance });
})();
