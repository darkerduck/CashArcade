// 蒸汽前線 COGFRONT — deterministic lane-battle rules at a fixed 120 Hz step. No DOM or audio.
(() => {
    'use strict';
    const D = globalThis.CogfrontData || (typeof require === 'function' ? require('./data.js') : null);
    const { HERO, TROOPS, TROOP_ORDER, ENEMIES, BOSSES, STAGES } = D;
    const STEP = 1 / 120, TRAIN_X = 118, VIEW_AHEAD = 640;
    const LIMITS = Object.freeze({ allies: 40, enemies: 80, shots: 140, telegraphs: 12, events: 400 });
    const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
    const ORDERS = ['follow', 'charge', 'hold'];

    function rng(seed) {
        let a = (seed >>> 0) || 1;
        return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    }

    class Game {
        constructor({ stage = 1, seed = 1, upgrades, unlocked } = {}) {
            this.stageData = STAGES[clamp(Math.floor(stage) || 1, 1, STAGES.length) - 1];
            this.level = this.stageData.id; this.seed = seed >>> 0 || 1; this.random = rng(this.seed);
            this.stats = D.stats(upgrades); this.unlocked = clamp(Math.floor(unlocked ?? this.level), 1, STAGES.length);
            this.length = this.stageData.length;
            this.time = 0; this.acc = 0; this.state = 'running'; this.events = []; this.commands = []; this.serial = 0;
            this.steam = 45; this.coins = 0; this.kills = 0; this.order = 'follow'; this.rallyX = 400; this.firstContact = null; this.stars = 0; this.reward = 0;
            this.cooldowns = Object.fromEntries(TROOP_ORDER.map(k => [k, 0]));
            const s = this.stats;
            this.hero = { x: 250, y: 0, radius: HERO.radius, hp: s.heroHp, maxHp: s.heroHp, facing: 1, alive: true, respawn: 0, move: 0,
                swing: null, combo: -1, comboTimer: 0, dodge: 0, dodgeCd: 0, inv: 0, stun: 0, kx: 0,
                burstCd: 0, chargeCd: 0, charging: 0, chargeHit: null, meter: 0, overdrive: 0, hurt: 0, anim: 0 };
            this.train = { x: TRAIN_X, hp: s.trainHp, maxHp: s.trainHp, hurt: 0 };
            this.gate = this.stageData.gateHp ? { id: ++this.serial, kind: 'gate', x: this.length - 110, hp: this.stageData.gateHp, maxHp: this.stageData.gateHp, radius: 56, heavy: true, hurt: 0 } : null;
            this.allies = []; this.enemies = []; this.shots = []; this.telegraphs = []; this.boss = null;
            this.peakIndex = 0; this.trickleTimer = this.stageData.trickle.every * .6;
            for (const [x, group] of this.stageData.garrisons) this.spawnGroup(x, group, true);
        }
        // ---- commands (queued, applied at the next fixed step so replays are deterministic)
        attack() { this.commands.push(['attack']); }
        skill(name) { this.commands.push(['skill', name]); }
        dodge() { this.commands.push(['dodge']); }
        deploy(kind) { this.commands.push(['deploy', kind]); }
        toggleOrder() { this.commands.push(['order']); }
        emit(type, data = {}) { if (this.events.length < LIMITS.events) this.events.push({ type, ...data }); }
        drain() { return this.events.splice(0); }
        get front() {
            let f = Math.max(this.train.x + 60, this.hero.alive ? this.hero.x : 0);
            for (const a of this.allies) if (a.x > f) f = a.x;
            return f;
        }
        get progress() { return clamp((this.front - 250) / (this.length - 360), 0, 1); }
        unlockedTroop(kind) { return TROOPS[kind] && TROOPS[kind].unlock <= this.unlocked; }

        update(dt, input = {}) {
            if (this.state !== 'running' || !(dt > 0)) return;
            this.hero.move = clamp(Number(input.move) || 0, -1, 1);
            this.acc += Math.min(dt, .1);
            while (this.acc >= STEP && this.state === 'running') { this.step(STEP); this.acc -= STEP; }
        }
        step(dt) {
            this.time += dt;
            const s = this.stats;
            this.steam = Math.min(s.steamMax, this.steam + s.steamRate * dt);
            for (const k of TROOP_ORDER) this.cooldowns[k] = Math.max(0, this.cooldowns[k] - dt);
            for (const [name, arg] of this.commands.splice(0)) this.command(name, arg);
            this.updateHero(dt);
            for (const a of this.allies) this.updateAlly(a, dt);
            for (const e of this.enemies) this.updateEnemy(e, dt);
            if (this.boss) this.updateBoss(this.boss, dt);
            this.updateShots(dt);
            this.updateTelegraphs(dt);
            this.spawns(dt);
            this.allies = this.allies.filter(a => !a.dead);
            this.enemies = this.enemies.filter(e => !e.dead);
            this.train.hurt = Math.max(0, this.train.hurt - dt);
            if (this.gate) this.gate.hurt = Math.max(0, this.gate.hurt - dt);
        }
        command(name, arg) {
            const h = this.hero;
            if (name === 'deploy') return this.spawnTroop(arg);
            if (name === 'order') { this.order = ORDERS[(ORDERS.indexOf(this.order) + 1) % ORDERS.length]; this.rallyX = h.alive ? h.x : this.front; this.emit('order', { order: this.order }); return; }
            if (!h.alive || h.stun > 0) return;
            if (name === 'attack') {
                if (h.charging > 0 || h.dodge > 0) return;
                if (h.swing) { const spec = HERO.combo[h.swing.index]; if (h.swing.t >= spec.active[0] && h.swing.index < 2) h.swing.queued = true; return; }
                this.startSwing(h.comboTimer > 0 && h.combo < 2 ? h.combo + 1 : 0);
            } else if (name === 'dodge') {
                if (h.dodgeCd > 0 || h.charging > 0) return;
                h.swing = null; h.dodge = HERO.dodge.time; h.dodgeCd = HERO.dodge.cooldown; h.inv = Math.max(h.inv, HERO.dodge.invulnerable);
                if (h.move) h.facing = Math.sign(h.move);
                this.emit('dodge', { x: h.x, facing: h.facing });
            } else if (name === 'skill') this.useSkill(arg);
        }
        startSwing(index) {
            const h = this.hero;
            const front = this.targetsNear(h.x, h.facing, HERO.reach + 30, 10).length, back = this.targetsNear(h.x, -h.facing, HERO.reach + 30, 10).length;
            if (!front && back) h.facing = -h.facing;
            h.swing = { index, t: 0, hit: false, queued: false }; h.combo = index;
            this.emit('swing', { x: h.x, facing: h.facing, combo: index });
        }
        useSkill(name) {
            const h = this.hero, sk = HERO.skills, s = this.stats;
            if (name === 'burst' && h.burstCd <= 0) {
                h.burstCd = s.burst.cooldown; h.swing = null;
                const targets = this.targetsNear(h.x, h.facing, sk.burst.reach, 30);
                for (const t of targets) { this.damage(t, sk.burst.damage * s.burst.power * this.heroMultiplier(), sk.burst.knock * h.facing, 'hero'); if (!t.heavy) t.stun = Math.max(t.stun || 0, sk.burst.stun); }
                this.emit('burst', { x: h.x, facing: h.facing, hits: targets.length });
            } else if (name === 'charge' && h.chargeCd <= 0) {
                h.chargeCd = s.charge.cooldown; h.swing = null; h.charging = sk.charge.time; h.chargeHit = new Set(); h.inv = Math.max(h.inv, sk.charge.time + .08);
                if (h.move) h.facing = Math.sign(h.move);
                this.emit('charge', { x: h.x, facing: h.facing });
            } else if (name === 'overdrive' && h.meter >= sk.overdrive.meter && h.overdrive <= 0) {
                h.meter = 0; h.overdrive = s.overdrive; this.emit('overdrive', { x: h.x });
            } else this.emit('denied', { reason: name });
        }
        heroMultiplier() { return this.stats.heroDamage * (this.hero.overdrive > 0 ? HERO.skills.overdrive.damage : 1); }
        // Enemies (plus gate and boss) within `reach` in front of x along `facing`, and `behind` px behind.
        targetsNear(x, facing, reach, behind) {
            const list = [];
            for (const e of this.enemies) if (!e.dead) { const d = (e.x - x) * facing; if (d >= -behind - e.radius && d <= reach + e.radius) list.push(e); }
            for (const t of [this.gate, this.boss]) if (t && t.hp > 0 && t.active !== false) { const d = (t.x - x) * facing; if (d >= -behind - t.radius && d <= reach + t.radius) list.push(t); }
            return list;
        }
        updateHero(dt) {
            const h = this.hero, sk = HERO.skills;
            h.anim += dt; h.hurt = Math.max(0, h.hurt - dt);
            for (const k of ['burstCd', 'chargeCd', 'dodgeCd', 'inv', 'stun', 'comboTimer']) h[k] = Math.max(0, h[k] - dt);
            if (h.overdrive > 0) h.overdrive = Math.max(0, h.overdrive - dt);
            if (!h.alive) {
                h.respawn -= dt;
                if (h.respawn <= 0) { Object.assign(h, { alive: true, hp: h.maxHp, x: this.train.x + 90, inv: 1.6, swing: null, charging: 0, dodge: 0, stun: 0, kx: 0 }); this.emit('heroBack', { x: h.x }); }
                return;
            }
            if (h.kx) { h.x += h.kx * dt; h.kx *= Math.exp(-7 * dt); if (Math.abs(h.kx) < 4) h.kx = 0; }
            if (h.charging > 0) {
                const speed = sk.charge.distance / sk.charge.time;
                h.x += h.facing * speed * dt; h.charging = Math.max(0, h.charging - dt);
                for (const t of this.targetsNear(h.x, h.facing, 18, 18)) if (!h.chargeHit.has(t.id)) {
                    h.chargeHit.add(t.id); this.damage(t, sk.charge.damage * this.stats.charge.power * this.heroMultiplier(), 160 * h.facing, 'hero');
                }
            } else if (h.dodge > 0) {
                h.x += h.facing * HERO.dodge.distance / HERO.dodge.time * dt; h.dodge = Math.max(0, h.dodge - dt);
            } else if (h.stun <= 0) {
                if (h.swing) {
                    const spec = HERO.combo[h.swing.index], rate = h.overdrive > 0 ? sk.overdrive.speed : 1;
                    h.swing.t += dt * rate;
                    if (!h.swing.hit && h.swing.t >= spec.active[0]) {
                        h.swing.hit = true;
                        const targets = this.targetsNear(h.x, h.facing, HERO.reach, 12);
                        for (const t of targets) this.damage(t, spec.damage * this.heroMultiplier(), spec.knock * h.facing, 'hero');
                        if (targets.length) this.emit('slash', { x: h.x + h.facing * 48, facing: h.facing, combo: h.swing.index, hits: targets.length });
                        h.x += h.facing * 6;
                    }
                    if (h.swing.t >= spec.time) {
                        const next = h.swing.queued && h.swing.index < 2 ? h.swing.index + 1 : -1;
                        h.comboTimer = HERO.chain; h.swing = null;
                        if (next >= 0) this.startSwing(next);
                    }
                } else if (h.move) {
                    h.x += h.move * HERO.speed * (h.overdrive > 0 ? 1.12 : 1) * dt; h.facing = Math.sign(h.move);
                }
            }
            // Bound by the train, the gate and a living boss.
            let right = this.length - 70;
            if (this.gate && this.gate.hp > 0) right = Math.min(right, this.gate.x - this.gate.radius - 12);
            if (this.boss && this.boss.hp > 0) right = Math.min(right, this.boss.x - this.boss.radius + 10);
            h.x = clamp(h.x, this.train.x + 40, right);
        }
        spawnTroop(kind) {
            const spec = TROOPS[kind];
            if (!spec) return;
            if (!this.unlockedTroop(kind)) return this.emit('denied', { reason: 'locked', kind });
            if (this.cooldowns[kind] > 0) return this.emit('denied', { reason: 'cooldown', kind });
            if (this.steam < spec.cost) return this.emit('denied', { reason: 'steam', kind });
            if (this.allies.length >= LIMITS.allies) return this.emit('denied', { reason: 'limit', kind });
            this.steam -= spec.cost; this.cooldowns[kind] = spec.cooldown;
            const m = this.stats.troop[kind], r = this.random();
            const offset = spec.ranged ? 150 + r * 90 : kind === 'shield' ? 20 + r * 40 : kind === 'mechanic' ? 120 + r * 50 : 50 + r * 110;
            const a = { id: ++this.serial, kind, x: this.train.x + 40, y: (this.random() - .5) * 34, hp: spec.hp * m, maxHp: spec.hp * m,
                cool: .2 + this.random() * .3, kx: 0, offset, radius: spec.radius, hurt: 0, anim: this.random() * 3, healTimer: 1, attacking: 0, dead: false };
            this.allies.push(a); this.emit('deploy', { kind, x: a.x });
        }
        spawnGroup(x, group, garrison = false) {
            let i = 0;
            for (const [kind, count] of Object.entries(group)) for (let n = 0; n < count; n++) this.spawnEnemy(kind, x + i++ * 30 + this.random() * 14, garrison);
        }
        spawnEnemy(kind, x, garrison = false) {
            if (this.enemies.length >= LIMITS.enemies) return null;
            const spec = ENEMIES[kind], scale = 1 + (this.level - 1) * .12;
            const e = { id: ++this.serial, kind, x: clamp(x, 300, this.length - 40), y: (this.random() - .5) * 30, hp: spec.hp * scale, maxHp: spec.hp * scale,
                radius: spec.radius, heavy: Boolean(spec.heavy), power: scale, cool: .4 + this.random() * .6, kx: 0, stun: 0, idle: garrison, hurt: 0, anim: this.random() * 3, attacking: 0, dead: false };
            this.enemies.push(e); return e;
        }
        nearestAllyTarget(e, aggro) {
            // Enemies look left for the hero, troops or the train; boiler shield-bearers draw attention.
            let best = null, bestD = Infinity;
            const consider = (t, bias = 0) => { const d = e.x - t.x; if (d >= -20 && d <= aggro + (t.radius || 0) && d - bias < bestD) { best = t; bestD = d - bias; } };
            for (const a of this.allies) consider(a, TROOPS[a.kind].taunt ? 120 : 0);
            if (this.hero.alive) consider(this.hero);
            consider(this.train, 0);
            return best;
        }
        updateAlly(a, dt) {
            const spec = TROOPS[a.kind], m = this.stats.troop[a.kind] * (this.hero.overdrive > 0 ? HERO.skills.overdrive.troops : 1);
            a.anim += dt; a.hurt = Math.max(0, a.hurt - dt); a.attacking = Math.max(0, a.attacking - dt);
            if (a.kx) { a.x += a.kx * dt; a.kx *= Math.exp(-7 * dt); if (Math.abs(a.kx) < 4) a.kx = 0; }
            if (spec.heal) {
                a.healTimer -= dt;
                if (a.healTimer <= 0) {
                    a.healTimer = 1.5;
                    const patients = [...this.allies, ...(this.hero.alive ? [this.hero] : [])].filter(t => t !== a && Math.abs(t.x - a.x) <= spec.healRange && t.hp < t.maxHp);
                    patients.sort((p, q) => p.hp / p.maxHp - q.hp / q.maxHp);
                    if (patients[0]) { patients[0].hp = Math.min(patients[0].maxHp, patients[0].hp + spec.heal * m); this.emit('heal', { x: patients[0].x }); }
                    if (Math.abs(this.train.x - a.x) < 180 && this.train.hp < this.train.maxHp) { this.train.hp = Math.min(this.train.maxHp, this.train.hp + spec.heal * 2); this.emit('heal', { x: this.train.x + 40 }); }
                }
            }
            const aggro = spec.ranged ? spec.reach + 40 : this.order === 'charge' ? 320 : 230;
            const target = this.closestEnemy(a.x, aggro);
            if (target && Math.abs(target.x - a.x) <= spec.reach + target.radius) {
                a.cool -= dt;
                if (a.cool <= 0) {
                    a.cool = spec.rate; a.attacking = .22;
                    const dmg = spec.damage * m * (target.heavy && spec.vsHeavy ? spec.vsHeavy : 1);
                    if (spec.ranged) this.fire(a, target, dmg, 'ally');
                    else this.damage(target, dmg, 26, a.kind);
                    this.markContact();
                }
                return;
            }
            let desired;
            if (target) desired = target.x - (spec.reach + target.radius) * .8;
            else if (this.order === 'charge') desired = this.length;
            else if (this.order === 'hold') desired = this.rallyX - a.offset * .35;
            else desired = this.hero.alive ? this.hero.x - a.offset : a.x;
            const gap = desired - a.x;
            if (Math.abs(gap) > 4) a.x += Math.sign(gap) * Math.min(Math.abs(gap), spec.speed * dt);
            let right = this.length - 70;
            if (this.gate && this.gate.hp > 0) right = this.gate.x - this.gate.radius - 6;
            if (this.boss && this.boss.hp > 0) right = Math.min(right, this.boss.x - this.boss.radius + 16);
            a.x = clamp(a.x, this.train.x + 30, right);
        }
        closestEnemy(x, aggro) {
            let best = null, bestD = Infinity;
            for (const e of this.enemies) if (!e.dead) { const d = e.x - x; if (d >= -24 && d <= aggro + e.radius && d < bestD) { best = e; bestD = d; } }
            for (const t of [this.gate, this.boss]) if (t && t.hp > 0 && t.active !== false) { const d = t.x - x; if (d >= -24 && d <= aggro + t.radius && d < bestD) { best = t; bestD = d; } }
            return best;
        }
        updateEnemy(e, dt) {
            const spec = ENEMIES[e.kind];
            e.anim += dt; e.hurt = Math.max(0, e.hurt - dt); e.attacking = Math.max(0, e.attacking - dt);
            if (e.kx) { e.x += e.kx * dt; e.kx *= Math.exp(-7 * dt); if (Math.abs(e.kx) < 4) e.kx = 0; }
            if (e.idle) { if (e.x - this.front < 430) e.idle = false; else return; }
            if (e.stun > 0) { e.stun -= dt; return; }
            const aggro = spec.ranged ? spec.reach + 40 : 240;
            const target = this.nearestAllyTarget(e, aggro);
            const reach = spec.reach + (target ? target === this.train ? 70 : target.radius || 0 : 0);
            if (target && e.x - target.x <= reach) {
                if (spec.blast) return this.explode(e);
                e.cool -= dt;
                if (e.cool <= 0) {
                    e.cool = spec.rate; e.attacking = .25;
                    if (spec.ranged) this.lob(e, target, spec.damage * e.power);
                    else this.damage(target, spec.damage * e.power, -(spec.knock || 20), e.kind);
                    this.markContact();
                }
                return;
            }
            e.x -= spec.speed * dt;
            if (e.x < this.train.x + 40) e.x = this.train.x + 40;
        }
        explode(e) {
            const spec = ENEMIES[e.kind];
            e.dead = true; this.emit('explode', { x: e.x, radius: spec.blast });
            for (const t of [...this.allies, this.hero, this.train]) if ((t !== this.hero || t.alive) && Math.abs(t.x - e.x) <= spec.blast + (t === this.train ? 70 : 0)) this.damage(t, spec.damage, -120, 'beetle');
            this.markContact();
        }
        markContact() { if (this.firstContact === null) { this.firstContact = this.time; this.emit('contact'); } }
        fire(from, target, damage, team) {
            if (this.shots.length >= LIMITS.shots) return;
            this.shots.push({ id: ++this.serial, kind: 'bullet', team, x: from.x + 16, y: from.y, vx: 1000, damage, life: .6 });
            this.emit('shot', { x: from.x + 16, team });
        }
        lob(from, target, damage, aoe = 44, kind = 'shell') {
            if (this.shots.length >= LIMITS.shots) return;
            const to = target.x + (target === this.train ? 40 : 0), dur = clamp(Math.abs(from.x - to) / 420, .45, 1.1);
            this.shots.push({ id: ++this.serial, kind, team: 'enemy', x0: from.x - 10, x: from.x - 10, to, t: 0, dur, damage, aoe, y: from.y });
            this.emit('lob', { x: from.x });
        }
        updateShots(dt) {
            for (const s of this.shots) {
                if (s.kind === 'bullet') {
                    s.x += s.vx * dt; s.life -= dt;
                    const t = this.closestEnemy(s.x - 12, 24);
                    if (t && Math.abs(t.x - s.x) < t.radius + 8) { this.damage(t, s.damage, 18, 'musket'); s.dead = true; }
                    if (s.life <= 0 || s.x > this.length) s.dead = true;
                } else {
                    s.t += dt; s.x = s.x0 + (s.to - s.x0) * Math.min(1, s.t / s.dur);
                    if (s.t >= s.dur) {
                        s.dead = true; this.emit('blast', { x: s.to, radius: s.aoe });
                        for (const t of [...this.allies, this.hero, this.train]) if ((t !== this.hero || t.alive) && Math.abs((t === this.train ? t.x + 40 : t.x) - s.to) <= s.aoe + (t.radius || 30)) this.damage(t, s.damage, -60, 'shell');
                    }
                }
            }
            this.shots = this.shots.filter(s => !s.dead);
        }
        damage(target, amount, knock, source) {
            if (!(amount > 0) || this.state !== 'running') return;
            const h = this.hero;
            if (target === h) {
                if (!h.alive || h.inv > 0) return;
                h.hp -= amount; h.hurt = .25; h.meter = Math.min(HERO.skills.overdrive.meter, h.meter + HERO.skills.overdrive.perHurt);
                h.kx += knock * 1.5; this.emit('heroHit', { x: h.x, amount });
                if (h.hp <= 0) { h.hp = 0; h.alive = false; h.respawn = HERO.respawn; h.swing = null; this.emit('heroDown', { x: h.x }); }
                return;
            }
            if (target === this.train) {
                this.train.hp -= amount; this.train.hurt = .2; this.emit('trainHit', { x: this.train.x + 40, amount });
                if (this.train.hp <= 0) { this.train.hp = 0; this.finish('lost'); }
                return;
            }
            if (target.dead || target.hp <= 0) return;
            // Gates and bosses are armoured against the hero's blade: sieges need troops.
            if (source === 'hero' && (target.kind === 'gate' || target.boss)) amount *= target.boss ? .6 : .4;
            target.hp -= amount; target.hurt = .12;
            if (source === 'hero' && h.overdrive <= 0) h.meter = Math.min(HERO.skills.overdrive.meter, h.meter + HERO.skills.overdrive.perHit);
            const isAlly = this.allies.includes(target);
            // Knockback is an impulse that decays at 7/s: ×3 makes the finisher shove ~80 px.
            if (knock && target.kind !== 'gate' && !target.boss) target.kx = (target.kx || 0) + knock * 3 * (target.heavy ? .25 : 1);
            this.emit('hit', { x: target.x, y: target.y || 0, amount: Math.round(amount), target: target.kind, ally: isAlly, source });
            this.markContact();
            if (target.hp > 0) return;
            target.hp = 0; target.dead = true;
            if (isAlly) { this.emit('allyDown', { kind: target.kind, x: target.x }); return; }
            if (target.kind === 'gate') { this.emit('gateDown', { x: target.x }); this.finish('won'); return; }
            if (target.boss) { this.coins += target.bounty; this.emit('bossDown', { x: target.x, kind: target.kind }); this.finish('won'); return; }
            const spec = ENEMIES[target.kind];
            this.kills++; this.coins += spec.bounty; this.steam = Math.min(this.stats.steamMax, this.steam + (target.heavy ? 6 : 3));
            this.emit('kill', { kind: target.kind, x: target.x, y: target.y, bounty: spec.bounty });
        }
        spawns(dt) {
            const st = this.stageData, front = this.front;
            const spawnX = () => Math.min(this.gate ? this.gate.x - 50 : this.length - 80, Math.max(front + VIEW_AHEAD, 700) + this.random() * 80);
            while (this.peakIndex < st.peaks.length && this.time >= st.peaks[this.peakIndex][0]) {
                const [, group] = st.peaks[this.peakIndex++];
                this.spawnGroup(spawnX(), group); this.emit('wave', { index: this.peakIndex, total: st.peaks.length });
            }
            this.trickleTimer -= dt;
            if (this.trickleTimer <= 0) {
                const hurtGate = this.gate && this.gate.hp < this.gate.maxHp * .5;
                this.trickleTimer = st.trickle.every * (hurtGate ? .7 : 1);
                const kinds = st.trickle.kinds; this.spawnEnemy(kinds[Math.floor(this.random() * kinds.length)], spawnX());
            }
            if (this.gate && this.gate.hp > 0) {
                const g = this.gate; g.fire = (g.fire ?? 2) - dt;
                const target = this.closestFriendly(g.x);
                if (g.fire <= 0 && target && g.x - target.x < 520) { g.fire = 2.6; this.lob({ x: g.x - 30, y: -60 }, target, 20 + this.level * 3, 52, 'mortar'); }
                if (g.x - front < 700) { g.call = (g.call ?? 3) - dt; if (g.call <= 0) { g.call = Math.max(2.2, 4.4 - this.level * .25); this.spawnEnemy(st.trickle.kinds[Math.floor(this.random() * st.trickle.kinds.length)], g.x - 40); } }
            }
            if (st.boss && !this.boss && front >= st.bossAt - 560) {
                const spec = BOSSES[st.boss];
                this.boss = { id: ++this.serial, kind: st.boss, boss: true, x: st.bossAt + 120, y: 0, hp: spec.hp, maxHp: spec.hp, radius: spec.radius, heavy: true,
                    bounty: spec.bounty, timer: 2.2, attack: 0, phase: 1, hurt: 0, anim: 0, active: true, casting: null, venting: 0, ventTick: 0 };
                this.emit('bossEnter', { kind: st.boss, name: spec.name, x: this.boss.x });
            }
        }
        // Bosses telegraph every attack on the ground before it lands.
        updateBoss(b, dt) {
            const spec = BOSSES[b.kind];
            b.anim += dt; b.hurt = Math.max(0, b.hurt - dt);
            if (b.phase === 1 && b.hp <= b.maxHp * spec.overload) { b.phase = 2; this.emit('bossPhase', { kind: b.kind, x: b.x }); }
            const pace = b.phase === 2 ? .7 : 1;
            const lead = b.kind === 'airship' ? 260 : spec.reach - 20;
            const target = this.closestFriendly(b.x);
            if (target && b.x - target.x > lead) b.x = Math.max(this.stageData.bossAt - 900, b.x - spec.speed * (b.phase === 2 ? 1.4 : 1) * dt);
            if (b.venting > 0) {
                b.venting -= dt; b.ventTick -= dt;
                if (b.ventTick <= 0) { b.ventTick = .25; this.hitZone(b.x - 320, b.x - 40, 16, -40); }
            }
            b.timer -= dt;
            if (b.timer > 0 || !target || b.x - target.x > 520) return;
            const attack = spec.attacks[b.attack++ % spec.attacks.length];
            b.timer = (b.kind === 'airship' ? 3.1 : 2.8) * pace;
            if (attack === 'slam') this.telegraph({ kind: 'slam', from: b.x - 270, to: b.x - 40, time: 1.05 * pace, damage: 48, knock: -280, stun: .35 });
            else if (attack === 'vent') this.telegraph({ kind: 'vent', from: b.x - 320, to: b.x - 40, time: .8 * pace });
            else if (attack === 'summon') { for (let i = 0; i < (b.phase === 2 ? 4 : 3); i++) this.spawnEnemy('drone', b.x - 40 - i * 26); this.emit('bossAttack', { kind: 'summon', x: b.x }); }
            else if (attack === 'bombs') {
                const lo = Math.max(this.train.x + 140, target.x - 220), hi = b.x - 120;
                for (let i = 0; i < (b.phase === 2 ? 6 : 4); i++) { const x = lo + this.random() * Math.max(40, hi - lo); this.telegraph({ kind: 'bomb', from: x - 48, to: x + 48, time: 1.2 * pace + i * .12, damage: 40, knock: -90 }); }
            } else if (attack === 'cannon') { this.lob(b, target, 34, 70, 'cannon'); this.emit('bossAttack', { kind: 'cannon', x: b.x }); }
            else if (attack === 'drop') { this.spawnEnemy(b.phase === 2 ? 'brute' : 'beetle', b.x - 60); this.spawnEnemy('beetle', b.x - 90); this.emit('bossAttack', { kind: 'drop', x: b.x }); }
        }
        closestFriendly(x) {
            let best = null;
            for (const t of [...this.allies, ...(this.hero.alive ? [this.hero] : []), this.train]) if (t.x <= x && (!best || t.x > best.x)) best = t;
            return best;
        }
        telegraph(t) {
            if (this.telegraphs.length >= LIMITS.telegraphs) return;
            this.telegraphs.push({ ...t, id: ++this.serial, total: t.time });
            this.emit('telegraph', { kind: t.kind, from: t.from, to: t.to, time: t.time });
        }
        updateTelegraphs(dt) {
            for (const t of this.telegraphs) {
                t.time -= dt;
                if (t.time > 0) continue;
                t.done = true;
                if (t.kind === 'vent' && this.boss) { this.boss.venting = 1.5; this.boss.ventTick = 0; this.emit('bossAttack', { kind: 'vent', x: this.boss.x }); }
                else { this.hitZone(t.from, t.to, t.damage, t.knock, t.stun); this.emit('bossAttack', { kind: t.kind, x: (t.from + t.to) / 2, from: t.from, to: t.to }); }
            }
            this.telegraphs = this.telegraphs.filter(t => !t.done);
        }
        hitZone(from, to, damage, knock = 0, stun = 0) {
            for (const t of [...this.allies, this.hero]) if ((t !== this.hero || t.alive) && t.x >= from - (t.radius || 0) && t.x <= to + (t.radius || 0)) {
                const hadInv = t === this.hero && this.hero.inv > 0;
                this.damage(t, damage, knock, 'boss');
                if (t === this.hero && stun && !hadInv) this.hero.stun = stun;
            }
        }
        finish(result) {
            if (this.state !== 'running') return;
            this.state = result;
            if (result === 'won') {
                this.stars = 1 + Number(this.time <= this.stageData.timeGoal) + Number(this.train.hp >= this.train.maxHp * .7);
                this.reward = this.coins + 100 + this.level * 40 + (this.stars - 1) * 40;
            } else this.reward = Math.round(this.coins * .5);
            this.emit(result, { stars: this.stars, reward: this.reward, time: this.time });
        }
    }
    const api = Object.freeze({ Game, STEP, TRAIN_X, LIMITS, ORDERS, rng });
    globalThis.Cogfront = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
