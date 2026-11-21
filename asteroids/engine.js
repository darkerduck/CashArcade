(() => {
    'use strict';
    const { size, levels, units, rocks, limits } = NeonAsteroidsData;
    const STEP = 1 / 120;
    const TURN = 210 * Math.PI / 180;
    const THRUST = 180;
    const MAX_SPEED = 360;
    const TAU = Math.PI * 2;
    const wrap = value => ((value % size) + size) % size;
    const delta = (from, to) => wrap(to - from + size / 2) - size / 2;
    const distance = (a, b) => Math.hypot(delta(a.x, b.x), delta(a.y, b.y));
    const direction = (a, b) => Math.atan2(delta(a.y, b.y), delta(a.x, b.x));
    const axis = (angle, speed) => ({ vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed });
    const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
    const hullSize = 10;
    const partLayouts = [
        { weapons: [[-61, 5], [61, 5]], hit: 165, core: 390, radius: 42 },
        { weapons: [[-63, 12], [63, 12], [0, -48]], hit: 190, core: 500, radius: 44 },
        { weapons: [[-91, 17], [91, 17], [-46, -33], [46, -33]], hit: 210, core: 680, radius: 48 }
    ];
    const training = [
        '按住左鍵或右鍵轉動船頭。',
        '按住推進鍵，向船頭方向加速。',
        '放開推進，觀察虛線速度箭頭與船頭的差別。',
        '轉向速度箭頭的反方向，再推進以減速。',
        '按住開火。只有按鍵時主砲才會射擊。'
    ];

    // Sweep the relative movement on a continuous image of the torus.
    // Per-step motion and collision radii are smaller than half the world.
    function contact(a, b, reach) {
        const x = delta(b.px ?? b.x, a.px ?? a.x);
        const y = delta(b.py ?? b.y, a.py ?? a.y);
        const dx = delta(a.px ?? a.x, a.x) - delta(b.px ?? b.x, b.x);
        const dy = delta(a.py ?? a.y, a.y) - delta(b.py ?? b.y, b.y);
        const c = x * x + y * y - reach * reach;
        if (c <= 0) return 0;
        const d = dx * dx + dy * dy;
        const projection = x * dx + y * dy;
        const disc = projection * projection - d * c;
        if (!d || projection >= 0 || disc < 0) return Infinity;
        const t = (-projection - Math.sqrt(disc)) / d;
        return t >= 0 && t <= 1 ? t : Infinity;
    }
    function advance(entity, maximum, dt) {
        entity.px = entity.x;
        entity.py = entity.y;
        const speed = Math.hypot(entity.vx, entity.vy);
        if (speed > maximum) {
            entity.vx *= maximum / speed;
            entity.vy *= maximum / speed;
        }
        entity.x = wrap(entity.x + entity.vx * dt);
        entity.y = wrap(entity.y + entity.vy * dt);
    }
    function attraction(entity, fields, dt) {
        for (const field of fields) {
            const x = delta(entity.x, field.x), y = delta(entity.y, field.y);
            const r = Math.hypot(x, y);
            if (r < 0.001 || r >= field.range) continue;
            const acceleration = field.strength * (1 - r / field.range);
            entity.vx += x / r * acceleration * dt;
            entity.vy += y / r * acceleration * dt;
        }
    }

    class Game {
        constructor(checkpoint, { practice = false } = {}) {
            this.practice = practice;
            this.start(checkpoint);
        }
        start(checkpoint) {
            this.origin = NeonAsteroidsStorage.validate(checkpoint) ?? NeonAsteroidsStorage.fresh(2026);
            const { level, seed, score, hull, weapon, spread, laser, escorts, shield } = this.origin;
            this.level = level;
            this.data = levels[level - 1];
            this.rng = seed;
            this.score = score;
            this.time = 0;
            this.serial = 0;
            this.mode = 'running';
            this.player = { x: 360, y: 540, vx: 0, vy: 0, angle: -Math.PI / 2, radius: hullSize,
                hull, shield, weapon, spread, laser, escorts, invulnerable: 0, cooldown: 0, thrust: false };
            this.enemies = [];
            this.projectiles = [];
            this.loot = [];
            this.warnings = [];
            this.fields = this.practice ? [] : [...this.data.wells];
            this.events = [];
            this.group = 0;
            this.boss = null;
            this.lesson = 0;
            this.lessonTime = 0;
            this.shots = 0;
            this.overload = false;
        }
        random() {
            this.rng = (Math.imul(1664525, this.rng) + 1013904223) >>> 0;
            return this.rng / 4294967296;
        }
        emit(type, obj = {}, detail = {}) {
            if (this.events.length < limits.events) this.events.push({ type, x: obj.x, y: obj.y, ...detail });
        }
        drain() { return this.events.splice(0); }
        retry() { this.start(this.origin); }
        checkpoint() { return { ...this.origin }; }
        nextCheckpoint() {
            if (this.mode !== 'clear') return null;
            const { hull, weapon, spread, laser, escorts, shield } = this.player;
            return { version: 1, level: this.level + 1, seed: this.rng, score: this.score,
                elapsed: this.origin.elapsed + this.time, hull, weapon, spread, laser, escorts, shield };
        }
        queue(type, drop = null, around = null) {
            if (this.enemies.length + this.warnings.length >= limits.enemies - 16) return false;
            const defaultAngle = this.random() * TAU;
            let safest = null;
            for (let i = 0; i < 16; i++) {
                const angle = defaultAngle + i * TAU / 16;
                const center = around ?? this.player;
                const radius = around ? 135 : 292;
                const point = { x: wrap(center.x + Math.cos(angle) * radius), y: wrap(center.y + Math.sin(angle) * radius) };
                const clearance = Math.min(distance(point, this.player) - 180,
                    ...this.fields.map(field => distance(point, field) - field.core - 60));
                if (!safest || clearance > safest.clearance) safest = { ...point, clearance };
            }
            if (safest.clearance < 0) return false;
            this.warnings.push({ ...safest, type, drop, ttl: 1.25 });
            return true;
        }
        addEnemy(type, x, y, options = {}) {
            if (this.enemies.length >= limits.enemies) return null;
            const specs = units[type], angle = this.random() * TAU;
            const enemy = { ...axis(angle, specs.speed), id: ++this.serial, type, x, y, angle,
                radius: specs.radius, hp: specs.hp, maxHp: specs.hp, spin: (this.random() - 0.5) * 1.8,
                grace: 0.36, fire: 1.4 + this.random() * 1.3, ...options };
            this.enemies.push(enemy);
            this.emit('spawn', enemy);
            return enemy;
        }
        deployBoss() {
            const kind = this.data.boss, spec = partLayouts[kind - 1];
            const boss = { x: 360, y: 190, kind, timer: 2, attack: 0, parts: [] };
            function part(id, offset, hp, radius, role) {
                return { id, ox: offset[0], oy: offset[1], x: wrap(boss.x + offset[0]),
                    y: wrap(boss.y + offset[1]), hp, maxHp: hp, radius, role };
            }
            boss.parts = spec.weapons.map(offset => part(++this.serial, offset, spec.hit, 16, 'weapon'));
            boss.core = part(++this.serial, [0, 7], spec.core, spec.radius, 'core');
            if (kind === 3) {
                for (const [i, offset] of [[0, [-118, 80]], [1, [118, 80]], [2, [0, 127]]]) {
                    boss.parts.unshift(part(++this.serial, offset, 140 + i * 20, 19, 'guard'));
                }
            }
            this.boss = boss;
            this.emit('boss', boss);
        }
        get targets() {
            return this.boss ? [...this.enemies, ...this.boss.parts, this.boss.core] : this.enemies;
        }
        locked(part) {
            if (part.role === 'core') return this.boss.parts.some(other => !other.dead);
            if (part.role === 'weapon') return this.boss.parts.some(other => other.role === 'guard' && !other.dead);
            return false;
        }
        addProjectile(source, angle, { speed, damage = 1, hits = 1, ttl = 1.45, hostile = false, type = 'pulse' }) {
            let count = 0;
            for (const projectile of this.projectiles) if (!projectile.dead && projectile.hostile === hostile) count++;
            if (count >= limits[hostile ? 'hostile' : 'friendly']) return;
            const velocity = axis(angle, speed);
            this.projectiles.push({ x: wrap(source.x + Math.cos(angle) * (source.radius + 4)),
                y: wrap(source.y + Math.sin(angle) * (source.radius + 4)),
                vx: velocity.vx + (hostile ? 0 : this.player.vx * 0.35),
                vy: velocity.vy + (hostile ? 0 : this.player.vy * 0.35),
                radius: type === 'laser' ? 4 : 2.5, damage, hits, ttl, hostile, type, struck: new Set() });
        }
        fire() {
            const p = this.player, rank = p[p.weapon] ?? 0;
            const laser = p.weapon === 'laser', spread = p.weapon === 'spread';
            const count = spread ? rank * 2 + 1 : 1;
            for (let i = 0; i < count; i++) {
                this.addProjectile(p, p.angle + (i - (count - 1) / 2) * 0.13, {
                    speed: laser ? 800 : 510, damage: laser ? 29 + rank * 10 : spread ? 18 : 25,
                    hits: laser ? rank + 1 : 1, ttl: laser ? 0.92 : 1.18, type: p.weapon
                });
            }
            for (let i = 0; i < p.escorts; i++) {
                this.addProjectile(this.escort(i), p.angle, { speed: 475, damage: 12, ttl: 1, type: 'escort' });
            }
            p.cooldown = laser ? 0.34 : spread ? 0.29 : 0.23;
            this.shots++;
            this.emit('fire', p, { weapon: p.weapon });
        }
        escort(index) {
            const p = this.player, side = index === 0 ? -1 : 1;
            return { x: wrap(p.x - Math.cos(p.angle) * 19 - Math.sin(p.angle) * side * 23),
                y: wrap(p.y - Math.sin(p.angle) * 19 + Math.cos(p.angle) * side * 23), radius: 6 };
        }
        volley(source, angle, count, spacing, speed) {
            for (let i = 0; i < count; i++) this.addProjectile(source, angle + (i - (count - 1) / 2) * spacing,
                { speed, hostile: true, ttl: 2.8 });
            this.emit('hostile', source);
        }
        spawn(dt) {
            if (this.data.boss && !this.boss && this.time >= 2.8 &&
                distance(this.player, { x: 360, y: 190 }) >= 260) this.deployBoss();
            const group = this.data.groups[this.group];
            if (group && this.time >= group.at) {
                const drops = { 2: ['spread', 'laser'], 4: ['shield', 'escort'], 5: ['repair'],
                    7: ['escort', 'spread'], 8: ['laser', 'shield'] }[this.level] ?? [];
                const drop = drops[this.group];
                if (this.queue(group.types[0], drop)) {
                    for (const type of group.types.slice(1)) this.queue(type);
                    this.group++;
                }
            }
            for (const warning of this.warnings) {
                warning.ttl -= dt;
                if (warning.ttl > 0) continue;
                if (distance(warning, this.player) < 105) {
                    warning.ttl = 0.45;
                    continue;
                }
                warning.dead = true;
                this.addEnemy(warning.type, warning.x, warning.y, { drop: warning.drop });
            }
            this.warnings = this.warnings.filter(warning => !warning.dead);
        }
        updateBoss(dt) {
            const boss = this.boss;
            if (!boss) return;
            boss.x = 360 + Math.sin(this.time * (0.35 + boss.kind * 0.1)) * 118;
            boss.y = 195 + Math.sin(this.time * 0.63) * 41;
            for (const part of [...boss.parts, boss.core]) {
                part.px = part.x;
                part.py = part.y;
                const orbit = part.role === 'guard' ? Math.sin(this.time + part.id) * 20 : 0;
                part.x = wrap(boss.x + part.ox + orbit);
                part.y = wrap(boss.y + part.oy);
            }
            if (boss.kind === 3 && !this.overload && boss.core.hp <= boss.core.maxHp * 0.3) {
                this.overload = true;
                boss.timer = Math.min(boss.timer, 1);
                this.emit('overload', boss);
            }
            boss.timer -= dt;
            if (boss.timer <= 0.72 && !boss.tell) {
                const available = boss.parts.filter(part => !part.dead && !this.locked(part));
                const source = available[boss.attack % Math.max(1, available.length)] ?? boss.core;
                boss.tell = { source, angle: direction(source, this.player), pull: boss.kind === 2 && boss.attack % 2 === 1 };
            }
            if (boss.timer > 0) return;
            const { source, angle, pull } = boss.tell;
            const emitter = source.dead ? boss.core : source;
            const count = this.overload ? 9 : pull ? 5 : 3 + boss.kind * 2;
            this.volley(emitter, angle, count, this.overload ? 0.16 : 0.22, 140 + boss.kind * 14);
            if (pull && this.fields.length < limits.fields) {
                // Attraction remains below thrust and has no lethal core.
                this.fields.push({ x: wrap(emitter.x + Math.cos(angle) * 145), y: wrap(emitter.y + Math.sin(angle) * 145),
                    range: 130, strength: 132, core: 0, ttl: 3.2 });
            }
            if (boss.kind === 3 && boss.attack % 3 === 1 && this.enemies.length + this.warnings.length < 5) {
                this.queue('fighter', null, boss);
                this.queue(this.overload ? 'gunship' : 'fighter', null, boss);
            }
            boss.tell = null;
            boss.attack++;
            boss.timer = this.overload ? 1.9 : boss.kind === 2 ? 3.35 : 2.85;
        }
        swallowed(entity, radius = 0) {
            return this.fields.some(field => field.lethal && contact(entity, field, field.core + radius) !== Infinity);
        }
        hurt() {
            const p = this.player;
            if (p.invulnerable > 0 || this.practice) return;
            p.invulnerable = 1;
            if (p.shield) {
                p.shield = false;
                this.emit('shield', p);
                return;
            }
            p.hull--;
            this.emit('hurt', p);
            if (p.hull === 0) this.lose('damage');
        }
        collide(target) {
            const p = this.player;
            if (p.invulnerable > 0 || this.practice) return;
            const angle = direction(target, p);
            const nx = Math.cos(angle), ny = Math.sin(angle);
            const inward = Math.min(0, p.vx * nx + p.vy * ny);
            p.vx += nx * (86 - inward);
            p.vy += ny * (86 - inward);
            this.hurt();
        }
        lose(reason) {
            this.player.hull = 0;
            this.player.thrust = false;
            this.mode = 'lost';
            this.failure = reason;
            this.emit(reason === 'hole' ? 'swallowed' : 'shipDown', this.player);
        }
        movePlayer(input, dt) {
            const p = this.player;
            const turn = Number(Boolean(input.right)) - Number(Boolean(input.left));
            p.angle = (p.angle + turn * TURN * dt) % TAU;
            p.thrust = Boolean(input.thrust);
            p.invulnerable = Math.max(0, p.invulnerable - dt);
            p.cooldown = Math.max(0, p.cooldown - dt);
            if (p.thrust) {
                p.vx += Math.cos(p.angle) * THRUST * dt;
                p.vy += Math.sin(p.angle) * THRUST * dt;
            }
            attraction(p, this.fields, dt);
            advance(p, MAX_SPEED, dt);
            if (this.swallowed(p, p.radius)) { this.lose('hole'); return; }
            if (input.fire && p.cooldown <= 0) this.fire();
        }
        moveEnemy(enemy, dt) {
            const spec = units[enemy.type];
            enemy.grace = Math.max(0, enemy.grace - dt);
            if (rocks.includes(enemy.type)) enemy.angle += enemy.spin * dt;
            else {
                const angle = direction(enemy, this.player), d = distance(enemy, this.player);
                enemy.angle = angle;
                const heading = d > spec.distance + 25 ? angle : d < spec.distance - 35 ? angle + Math.PI : angle + Math.PI / 2;
                const wanted = axis(heading, spec.speed);
                enemy.vx += (wanted.vx - enemy.vx) * dt * 1.6;
                enemy.vy += (wanted.vy - enemy.vy) * dt * 1.6;
                enemy.fire -= dt;
                if (enemy.fire <= 0) {
                    this.volley(enemy, angle, spec.shots, 0.16, enemy.type === 'fighter' ? 170 : 208);
                    enemy.fire = spec.interval + this.random() * 0.6;
                }
            }
            attraction(enemy, this.fields, dt);
            advance(enemy, 250, dt);
            if (this.swallowed(enemy)) enemy.dead = true;
        }
        moveProjectile(projectile, targets, dt) {
            projectile.ttl -= dt;
            if (projectile.ttl <= 0) { projectile.dead = true; return; }
            attraction(projectile, this.fields, dt);
            advance(projectile, 1000, dt);
            if (this.swallowed(projectile)) { projectile.dead = true; return; }
            if (projectile.hostile) {
                if (contact(projectile, this.player, projectile.radius + this.player.radius) !== Infinity) {
                    projectile.dead = true;
                    this.hurt();
                }
                return;
            }
            const hits = [];
            for (const target of targets) {
                if (target.dead || projectile.struck.has(target.id)) continue;
                const time = contact(projectile, target, target.radius + projectile.radius);
                if (time !== Infinity) hits.push({ target, time });
            }
            hits.sort((a, b) => a.time - b.time || a.target.id - b.target.id);
            for (const { target } of hits) {
                projectile.struck.add(target.id);
                if (!this.locked(target)) {
                    target.hp -= projectile.damage;
                    this.emit('hit', target);
                    if (target.hp <= 0) this.destroy(target);
                } else this.emit('deflect', target);
                if (--projectile.hits <= 0) { projectile.dead = true; break; }
            }
        }
        destroy(target) {
            if (target.dead) return;
            target.dead = true;
            if (target.role) {
                this.score += target.role === 'core' ? 3500 : 550;
                this.emit(target.role === 'core' ? 'bossDown' : 'partDown', target, { radius: target.radius });
                if (target.role === 'core') this.complete();
                return;
            }
            const spec = units[target.type], isRock = rocks.includes(target.type);
            this.score += spec.points;
            this.emit(isRock ? 'shatter' : 'destroy', target, { radius: target.radius, rock: target.type });
            if (spec.split) {
                for (const sign of [-1, 1]) {
                    const angle = target.angle + sign * Math.PI / 2, speed = units[spec.split].speed;
                    const separation = axis(angle, speed * 0.72);
                    const offset = units[spec.split].radius * 0.65;
                    this.addEnemy(spec.split, wrap(target.x + Math.cos(angle) * offset),
                        wrap(target.y + Math.sin(angle) * offset), {
                            vx: target.vx * 0.8 + separation.vx, vy: target.vy * 0.8 + separation.vy, grace: 0.55
                        });
                }
            }
            const chance = isRock ? 0.055 : 0.23;
            const types = ['spread', 'laser', 'escort', 'shield', 'repair'];
            if (!this.practice && this.loot.length < limits.loot) {
                const drop = target.drop ?? (this.random() < chance ? types[Math.floor(this.random() * types.length)] : null);
                if (drop) this.loot.push({ type: drop, x: target.x, y: target.y, vx: target.vx * 0.32, vy: target.vy * 0.32, ttl: 13, radius: 11 });
            }
        }
        collect(type) {
            const p = this.player;
            let surplus = false;
            if (type === 'repair') { surplus = p.hull === 3; p.hull = Math.min(3, p.hull + 1); }
            if (type === 'shield') { surplus = p.shield; p.shield = true; }
            if (type === 'escort') { surplus = p.escorts === 2; p.escorts = Math.min(2, p.escorts + 1); }
            if (type === 'spread' || type === 'laser') {
                surplus = p[type] === 3;
                p.weapon = type;
                p[type] = Math.min(3, p[type] + 1);
            }
            if (surplus) this.score += 150;
            this.emit('pickup', p, { item: type });
        }
        complete() {
            this.player.hull = Math.min(3, this.player.hull + 1);
            this.player.thrust = false;
            this.mode = this.level === levels.length ? 'won' : 'clear';
            this.projectiles = [];
            this.warnings = [];
            this.loot = [];
            this.enemies = [];
            this.emit(this.mode, this.player);
        }
        tutorial(input, dt) {
            const p = this.player, speed = Math.hypot(p.vx, p.vy);
            const condition = [Boolean(input.left) !== Boolean(input.right),
                p.thrust && speed >= 65, !p.thrust && speed >= 55,
                p.thrust && speed <= 45, this.shots > this.lessonShots][this.lesson];
            this.lessonTime = condition ? this.lessonTime + dt : 0;
            if (this.lessonTime < [0.38, 0.18, 0.70, 0.05, 0.03][this.lesson]) return;
            this.lessonTime = 0;
            this.lesson++;
            this.lessonShots = this.shots;
            this.emit('lesson', p);
            if (this.lesson === training.length) this.mode = 'trained';
        }
        update(dt = STEP, input = {}) {
            if (this.mode !== 'running' || !Number.isFinite(dt) || dt <= 0) return;
            dt = Math.min(dt, STEP);
            this.time += dt;
            this.fields = this.fields.filter(field => field.ttl === undefined || (field.ttl -= dt) > 0);
            this.movePlayer(input, dt);
            if (this.mode !== 'running') return;
            if (this.practice) this.tutorial(input, dt);
            else { this.spawn(dt); this.updateBoss(dt); }
            for (const enemy of this.enemies) this.moveEnemy(enemy, dt);
            const targets = this.targets;
            for (const target of targets) {
                if (!target.dead && !target.grace && contact(target, this.player, target.radius + this.player.radius) !== Infinity) this.collide(target);
                if (this.mode === 'lost') return;
            }
            for (const projectile of this.projectiles) {
                this.moveProjectile(projectile, targets, dt);
                if (this.mode === 'lost' || this.mode === 'clear' || this.mode === 'won') return;
            }
            for (const item of this.loot) {
                item.ttl -= dt;
                attraction(item, this.fields, dt);
                advance(item, 200, dt);
                if (this.swallowed(item)) item.ttl = 0;
                if (item.ttl > 0 && contact(item, this.player, item.radius + this.player.radius) !== Infinity) {
                    this.collect(item.type);
                    item.ttl = 0;
                }
            }
            this.loot = this.loot.filter(item => item.ttl > 0);
            this.projectiles = this.projectiles.filter(projectile => !projectile.dead);
            this.enemies = this.enemies.filter(enemy => !enemy.dead);
            if (!this.practice && !this.data.boss && this.group >= this.data.groups.length &&
                !this.warnings.length && !this.enemies.length) this.complete();
        }
    }
    globalThis.NeonAsteroids = Object.freeze({ Game, STEP, THRUST, TURN, MAX_SPEED, wrap, delta, distance, direction, contact, training });
})();
