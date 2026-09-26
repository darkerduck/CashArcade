(() => {
    'use strict';
    const W = 960, H = 720, GROUND = 650;
    const LEVELS = [
        ['防線啟動', 18, 48, 1.25, ['normal']],
        ['交叉火網', 26, 54, 1.05, ['normal', 'normal']],
        ['極速突襲', 32, 60, .95, ['normal', 'fast', 'normal']],
        ['分裂危機', 38, 66, .9, ['normal', 'split', 'fast']],
        ['重甲壓境', 44, 72, .85, ['armored', 'normal', 'fast']],
        ['空中封鎖', 50, 80, .8, ['normal', 'cruiser', 'fast', 'normal']],
        ['雙翼包圍', 60, 88, .7, ['split', 'fast', 'normal', 'split']],
        ['鋼鐵暴雨', 70, 98, .65, ['armored', 'cruiser', 'normal', 'armored']],
        ['最後防線', 82, 108, .53, ['normal', 'fast', 'split', 'armored', 'cruiser']],
        ['母艦降臨', 20, 108, 1.3, ['fast', 'normal', 'armored', 'split']],
    ].map(([name, count, speed, interval, types]) => ({ name, count, speed, interval, types }));
    const POWERS = ['rapid', 'wide', 'slow', 'shield', 'emp'];
    const cityX = [190, 295, 400, 560, 665, 770];
    const clone = value => JSON.parse(JSON.stringify(value));
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    function fresh() {
        return { version: 1, phase: 'stage', level: 1, score: 0, radius: 64, reload: .65,
            cities: cityX.map(x => ({ x, hp: 3, shield: false })), seed: Math.floor(Math.random() * 2147483646) + 1 };
    }
    function valid(c) {
        return c && c.version === 1 && ['stage', 'upgrade'].includes(c.phase)
            && Number.isInteger(c.level) && c.level >= 1 && c.level <= (c.phase === 'upgrade' ? 9 : 10)
            && Number.isFinite(c.score) && c.score >= 0 && c.score <= 1e8
            && Number.isFinite(c.radius) && c.radius >= 64 && c.radius <= 136
            && Number.isFinite(c.reload) && c.reload >= .28 && c.reload <= .651
            && Number.isInteger(c.seed) && c.seed > 0 && c.seed < 2147483647
            && Array.isArray(c.cities) && c.cities.length === 6
            && c.cities.every((v, i) => v && v.x === cityX[i] && Number.isInteger(v.hp)
                && v.hp >= 0 && v.hp <= 3 && typeof v.shield === 'boolean') && c.cities.some(v => v.hp > 0);
    }
    function upgrade(checkpoint, choice) {
        if (!valid(checkpoint) || checkpoint.phase !== 'upgrade' || !['radius', 'reload', 'repair'].includes(choice)) return null;
        const c = clone(checkpoint);
        if (choice === 'radius') c.radius += 8;
        if (choice === 'reload') c.reload = Math.max(.29, c.reload - .04);
        if (choice === 'repair') {
            const dead = c.cities.find(city => city.hp === 0);
            c.cities.forEach(city => { if (city.hp > 0) city.hp = Math.min(3, city.hp + 1); });
            if (dead) dead.hp = 1;
        }
        c.phase = 'stage'; c.level += 1; c.seed = c.seed % 2147483646 + 1;
        return c;
    }
    class Game {
        constructor(checkpoint) {
            if (!valid(checkpoint) || checkpoint.phase !== 'stage') throw new Error('Invalid stage checkpoint');
            this.checkpoint = clone(checkpoint); this.level = checkpoint.level;
            this.config = LEVELS[this.level - 1]; this.score = checkpoint.score;
            this.cities = clone(checkpoint.cities); this.radius = checkpoint.radius; this.reload = checkpoint.reload;
            this.seed = checkpoint.seed; this.time = 0; this.spawned = 0; this.nextSpawn = 1;
            this.id = 0; this.enemies = []; this.shots = []; this.blasts = []; this.items = []; this.events = [];
            this.effects = { rapid: 0, wide: 0, slow: 0 }; this.drops = 0; this.kills = 0;
            this.turrets = [70, 480, 890].map(x => ({ x, y: GROUND + 15, ready: 0 }));
            this.state = 'running'; this.boss = this.level === 10
                ? { x: W / 2, y: 108, nodes: [6, 6], hp: 24, nextAttack: 3, rage: false, dead: false } : null;
            if (this.boss) this.emit('alarm', this.boss.x, this.boss.y);
        }
        random() { this.seed = this.seed * 16807 % 2147483647; return (this.seed - 1) / 2147483646; }
        emit(type, x = W / 2, y = H / 2, extra = {}) { this.events.push({ type, x, y, ...extra }); }
        drain() { return this.events.splice(0); }
        fire(x, y) {
            if (this.state !== 'running') return false;
            x = clamp(x, 15, W - 15); y = clamp(y, 35, GROUND - 35);
            const turret = this.turrets.filter(t => t.ready <= this.time)
                .sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y))[0];
            if (!turret) return false;
            const rapid = this.effects.rapid > 0;
            turret.ready = this.time + this.reload * (rapid ? .5 : 1);
            this.shots.push({ x: turret.x, y: turret.y, tx: x, ty: y, speed: 620 * (rapid ? 1.35 : 1), trail: [] });
            this.emit('launch', turret.x, turret.y); return true;
        }
        target() { const alive = this.cities.filter(c => c.hp > 0); return alive[Math.floor(this.random() * alive.length)] || this.cities[0]; }
        spawn(type, x, y = -20) {
            const target = this.target();
            const e = { id: ++this.id, type, x: x ?? this.random() * (W - 80) + 40, y, target: target.x,
                hp: type === 'armored' ? 2 : type === 'cruiser' ? 3 : 1,
                speed: this.config.speed * (type === 'fast' ? 1.5 : 1), trail: [], dropAt: this.time + 2.2, dead: false };
            if (type === 'cruiser') { e.x = x ?? (this.spawned % 2 ? -25 : W + 25); e.y = 150; e.vx = e.x < W / 2 ? 85 : -85; }
            this.enemies.push(e); return e;
        }
        explode(x, y, radius = this.radius * (this.effects.wide > 0 ? 1.5 : 1), depth = 0) {
            // Bound simultaneous collision bodies as well as cosmetic particles.
            if (this.blasts.length >= 180) this.blasts.shift();
            this.blasts.push({ id: ++this.id, x, y, radius, age: 0, r: 0, hit: new Set(), depth });
            this.emit(depth ? 'chain' : 'explosion', x, y, { depth, radius });
        }
        destroy(e, depth = 0, chain = true) {
            if (e.dead) return;
            e.dead = true; this.kills += 1;
            this.score += ({ normal: 100, fast: 150, split: 200, armored: 250, cruiser: 400 }[e.type] || 100) * Math.min(4, depth + 1);
            if (chain) this.explode(e.x, e.y, 42, depth + 1);
        }
        pickup(type) {
            if (type === 'rapid' || type === 'wide') this.effects[type] = 10;
            if (type === 'slow') this.effects.slow = 8;
            if (type === 'shield') this.cities.forEach(c => { if (c.hp > 0) c.shield = true; });
            if (type === 'emp') this.enemies.forEach(e => this.destroy(e, 0, false));
            this.emit('pickup', W / 2, 300, { power: type });
        }
        hitCity(e) {
            const city = this.cities.find(c => c.x === e.target);
            if (city && city.hp > 0) {
                if (city.shield) { city.shield = false; this.emit('shield', city.x, GROUND); }
                else { city.hp -= 1; this.emit('damage', city.x, GROUND); }
            }
            e.dead = true;
        }
        update(dt) {
            if (this.state !== 'running') return;
            dt = clamp(dt, 0, .05); this.time += dt;
            for (const key of Object.keys(this.effects)) this.effects[key] = Math.max(0, this.effects[key] - dt);
            const slow = this.effects.slow > 0 ? .6 : 1;
            if (this.spawned < this.config.count && this.time >= this.nextSpawn && !this.boss?.dead) {
                const i = this.spawned++, type = this.config.types[i % this.config.types.length];
                const side = i % 2 ? W - 60 - this.random() * 180 : 60 + this.random() * 180;
                this.spawn(type, type === 'cruiser' ? undefined : this.level === 1 ? undefined : side);
                const group = this.level === 9 ? 21 : this.level === 2 ? 2 : 10;
                this.nextSpawn = this.time + (this.level === 2 && i % 2 === 0 ? .18 : this.config.interval)
                    + (this.spawned % group === 0 ? 2 : 0);
            }
            if (this.drops < 2 && this.time >= (this.boss ? [2, 6] : [4, 12])[this.drops]) {
                this.items.push({ x: 230 + this.random() * 500, y: 230 + this.random() * 130,
                    type: POWERS[(this.level + this.drops * 2 - 1) % POWERS.length], life: 8 }); this.drops += 1;
            }
            if (this.boss && !this.boss.dead) this.updateBoss(dt, slow);
            for (const s of this.shots) {
                s.trail.push({ x: s.x, y: s.y }); if (s.trail.length > 9) s.trail.shift();
                const dx = s.tx - s.x, dy = s.ty - s.y, d = Math.hypot(dx, dy), step = s.speed * dt;
                if (d <= step) { s.dead = true; this.explode(s.tx, s.ty); }
                else { s.x += dx / d * step; s.y += dy / d * step; }
            }
            // Copy the list: newly created chain explosions participate on the following frame.
            for (const b of [...this.blasts]) {
                b.age += dt; b.r = b.radius * Math.min(1, b.age / .2, (1 - b.age) / .3);
                if (b.age >= 1) continue;
                for (const e of this.enemies) {
                    if (e.dead || b.hit.has(e.id) || Math.hypot(e.x - b.x, e.y - b.y) > b.r + 5) continue;
                    b.hit.add(e.id); e.hp -= 1;
                    if (e.hp <= 0) this.destroy(e, b.depth); else this.emit('armor', e.x, e.y);
                }
                for (const item of this.items) {
                    if (!item.dead && Math.hypot(item.x - b.x, item.y - b.y) <= b.r + 15) {
                        item.dead = true; this.pickup(item.type);
                    }
                }
                this.hitBoss(b);
            }
            for (const e of [...this.enemies]) {
                if (e.dead) continue;
                e.trail.push({ x: e.x, y: e.y }); if (e.trail.length > 80) e.trail.shift();
                if (e.type === 'cruiser') {
                    e.x += e.vx * dt * slow;
                    if (this.time >= e.dropAt) { this.spawn('normal', e.x, e.y + 12); e.dropAt = this.time + 2.2; }
                    if (e.x < -50 || e.x > W + 50) e.dead = true;
                } else {
                    const dx = e.target - e.x, dy = GROUND - e.y, d = Math.hypot(dx, dy), step = e.speed * dt * slow;
                    if (d <= step + 4) this.hitCity(e);
                    else { e.x += dx / d * step; e.y += dy / d * step; }
                    if (e.type === 'split' && e.y > 285 && !e.dead) {
                        e.dead = true;
                        for (let n = -1; n <= 1; n++) this.spawn('normal', e.x + n * 12, e.y);
                        this.emit('split', e.x, e.y);
                    }
                }
            }
            this.items.forEach(i => { i.life -= dt; });
            this.items = this.items.filter(i => !i.dead && i.life > 0);
            this.enemies = this.enemies.filter(e => !e.dead);
            this.shots = this.shots.filter(s => !s.dead);
            this.blasts = this.blasts.filter(b => b.age < 1);
            if (!this.cities.some(c => c.hp > 0)) { this.state = 'lost'; this.emit('lose'); }
            else if (this.spawned >= this.config.count && !this.enemies.length && (!this.boss || (this.boss.dead && this.time >= 14))) {
                this.state = this.level === 10 ? 'won' : 'upgrade';
                this.score += this.cities.reduce((sum, c) => sum + c.hp * 100, 0);
                this.emit(this.state === 'won' ? 'win' : 'level');
            }
        }
        updateBoss(dt, slow) {
            const b = this.boss; b.x = W / 2 + Math.sin(this.time * .5) * 190;
            b.nextAttack -= dt * slow;
            if (b.nextAttack <= 0) {
                for (let i = -1; i <= 1; i++) this.spawn(b.rage && i === 0 ? 'split' : 'fast', b.x + i * 75, b.y + 32);
                b.nextAttack = b.rage ? 1.5 : 3;
            }
        }
        hitBoss(blast) {
            const b = this.boss; if (!b || b.dead) return;
            const shielded = b.nodes.some(hp => hp > 0);
            if (shielded) {
                b.nodes.forEach((hp, i) => {
                    const key = `node${i}`, x = b.x + (i ? 95 : -95);
                    if (hp > 0 && !blast.hit.has(key) && Math.hypot(x - blast.x, b.y - blast.y) < blast.r + 21) {
                        blast.hit.add(key); b.nodes[i] -= 1; this.emit('armor', x, b.y);
                    }
                });
            } else if (!blast.hit.has('core') && Math.hypot(b.x - blast.x, b.y - blast.y) < blast.r + 34) {
                blast.hit.add('core'); b.hp -= 1; this.emit('armor', b.x, b.y);
                if (b.hp <= 12 && !b.rage) { b.rage = true; this.emit('alarm', b.x, b.y); }
                if (b.hp <= 0) { b.dead = true; this.spawned = this.config.count; this.score += 5000; this.emit('bossDeath', b.x, b.y); }
            }
        }
        nextCheckpoint() {
            if (this.state !== 'upgrade') return null;
            return { ...clone(this.checkpoint), phase: 'upgrade', score: this.score, cities: clone(this.cities) };
        }
    }
    globalThis.NeonDefense = Object.freeze({ W, H, GROUND, LEVELS, POWERS, Game, fresh, valid, upgrade, clone });
})();
