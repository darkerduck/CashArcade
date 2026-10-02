/* Deterministic gameplay. No DOM, audio, payment or wall-clock dependencies. */
(() => {
    'use strict';
    const api = typeof module !== 'undefined' && module.exports ? require('./levels.js') : window.NeonBreakout;
    const { W, H, createLevel, POWERS, TOTAL_LEVELS } = api;
    const STEP = 1 / 120, PADDLE_Y = 500, MAX_BALLS = 24;
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const copy = value => JSON.parse(JSON.stringify(value));

    function sweepBox(x, y, dx, dy, r, box) {
        const left = box.x - r, right = box.x + box.w + r, top = box.y - r, bottom = box.y + box.h + r;
        const tx1 = dx ? (left - x) / dx : -Infinity, tx2 = dx ? (right - x) / dx : Infinity;
        const ty1 = dy ? (top - y) / dy : -Infinity, ty2 = dy ? (bottom - y) / dy : Infinity;
        if ((!dx && (x < left || x > right)) || (!dy && (y < top || y > bottom))) return null;
        const nx = Math.min(tx1, tx2), ny = Math.min(ty1, ty2);
        const enter = Math.max(nx, ny), exit = Math.min(Math.max(tx1, tx2), Math.max(ty1, ty2));
        if (enter > exit || exit < 0 || enter > 1) return null;
        if (enter < -1e-7) return null; // Existing overlap is resolved separately after resizing/teleporting.
        return { t: Math.max(0, enter), nx: nx > ny ? (dx > 0 ? -1 : 1) : 0, ny: nx > ny ? 0 : (dy > 0 ? -1 : 1) };
    }
    function sweepCircle(x, y, dx, dy, cx, cy, radius) {
        const ox = x - cx, oy = y - cy, a = dx * dx + dy * dy;
        if (!a || ox * dx + oy * dy >= 0) return null;
        const b = 2 * (ox * dx + oy * dy), c = ox * ox + oy * oy - radius * radius;
        const discriminant = b * b - 4 * a * c;
        if (c < 0 || discriminant < 0) return null;
        const t = (-b - Math.sqrt(discriminant)) / (2 * a);
        if (t < 0 || t > 1) return null;
        const nx = (ox + dx * t) / radius, ny = (oy + dy * t) / radius;
        return { t, nx, ny };
    }
    class Game {
        constructor({ levelIndex = 0, score = 0, lives = 3, seed = 739391 } = {}) {
            this.levelIndex = levelIndex; this.score = score; this.lives = lives; this.seed = seed >>> 0;
            this.time = 0; this.id = 0; this.wave = 0; this.bossPhase = 0; this.state = 'ready';
            this.effects = {}; this.shield = 0; this.balls = []; this.items = []; this.shots = []; this.events = [];
            this.paddle = { x: W / 2 - 58, w: 116, vx: 0, charging: false, chargeAt: 0, releaseUntil: 0, releasePower: 0, cooldownUntil: 0 };
            this.nextRain = 0; this.nextLaser = 0; this.accumulator = 0; this.combo = 0; this.lastHit = -10;
            this.loadLevel(); this.attachBall();
        }
        loadLevel() { this.level = createLevel(this.levelIndex, this.wave); this.bricks = this.level.bricks; this.animateMechanisms(); }
        random() { this.seed ^= this.seed << 13; this.seed ^= this.seed >>> 17; this.seed ^= this.seed << 5; return (this.seed >>> 0) / 4294967296; }
        emit(name, data = {}) { this.events.push({ name, time: this.time, ...data }); if (this.events.length > 300) this.events.shift(); }
        drainEvents() { const e = this.events; this.events = []; return e; }
        has(name) { return (this.effects[name] || 0) > this.time; }
        size() { return this.has('big') ? 13 : this.has('small') ? 5 : 8; }
        damage() { return this.has('big') ? 4 : this.has('small') ? 1 : 2; }
        paddleWidth() { return this.has('full') ? W : 116 * (this.has('wide') ? 1.5 : this.has('narrow') ? .65 : 1); }
        spawnBall(x, y, vx = 0, vy = 150, attached = false) {
            if (this.balls.length >= MAX_BALLS) return null;
            const ball = { id: ++this.id, x, y, vx, vy, attached, strongUntil: 0, portalUntil: 0, r: this.size() };
            this.balls.push(ball); return ball;
        }
        attachBall() { if (!this.balls.length) this.spawnBall(this.paddle.x + this.paddle.w / 2, PADDLE_Y - this.size() - 2, 0, 0, true); }
        launch() {
            if (!['ready', 'life-lost', 'running'].includes(this.state)) return false;
            const attached = this.balls.filter(b => b.attached);
            if (!attached.length) return false;
            this.state = 'running';
            for (const b of attached) { b.attached = false; b.vx = 120; b.vy = -530; }
            this.emit('start', { x: this.paddle.x + this.paddle.w / 2, y: PADDLE_Y }); return true;
        }
        movePaddle(center, dt = STEP) {
            const old = this.paddle.x; this.paddle.w = this.paddleWidth();
            this.paddle.x = clamp(center - this.paddle.w / 2, 0, W - this.paddle.w);
            this.paddle.vx = clamp((this.paddle.x - old) / Math.max(STEP, dt), -650, 650);
        }
        beginCharge() {
            if (!['ready', 'life-lost', 'running'].includes(this.state) || this.paddle.charging || this.time < this.paddle.cooldownUntil) return;
            this.paddle.charging = true; this.paddle.chargeAt = this.time; this.emit('charge');
        }
        releaseCharge() {
            if (!this.paddle.charging) return;
            this.paddle.charging = false;
            this.paddle.releasePower = clamp((this.time - this.paddle.chargeAt) / .45, 0, 1);
            this.paddle.releaseUntil = this.time + .12; this.paddle.cooldownUntil = this.time + .28;
            this.emit('impulse', { x: this.paddle.x + this.paddle.w / 2, y: PADDLE_Y, power: this.paddle.releasePower });
        }
        cancelInput() { this.paddle.charging = false; this.paddle.releaseUntil = 0; this.paddle.vx = 0; }
        pause(manual = false) {
            if (this.state !== 'running') return;
            this.state = 'paused'; this.cancelInput(); if (manual) this.emit('pause');
        }
        resume(manual = false) { if (this.state === 'paused') { this.state = 'running'; if (manual) this.emit('resume'); } }
        tick(dt, direction = 0) {
            if (this.state !== 'running') return;
            this.accumulator += clamp(dt, 0, .1);
            while (this.accumulator >= STEP && this.state === 'running') {
                this.accumulator -= STEP; this.step(STEP, direction);
            }
        }
        animateMechanisms() {
            const nodes = this.bricks.filter(b => b.bossRole === 'node' && b.hp > 0).length;
            for (const b of [...this.bricks, ...this.level.gates]) {
                b.x = b.bx; b.y = b.by;
                if (!b.motion) continue;
                const m = b.motion, multiplier = b.bossRole && nodes < 2 ? 1.6 : 1;
                const a = this.time * m.speed * multiplier + m.phase;
                if (m.axis === 'orbit') { b.x = b.bx + Math.cos(a) * (m.amp + (3 - nodes) * 14); b.y = b.by + Math.sin(a) * m.amp * .6; }
                else b[m.axis] += Math.sin(a) * m.amp;
            }
        }
        step(dt, direction) {
            this.time += dt;
            for (const name of Object.keys(this.effects)) if (this.effects[name] <= this.time) delete this.effects[name];
            const center = this.paddle.x + this.paddle.w / 2;
            this.movePaddle(center + direction * 510 * dt, dt);
            this.animateMechanisms(); this.updateItems(dt); this.updateGenerators(); this.updateShots(dt);
            for (const ball of [...this.balls]) {
                ball.r = this.size();
                if (ball.attached) { ball.x = this.paddle.x + this.paddle.w / 2; ball.y = PADDLE_Y - ball.r - 2; continue; }
                this.resolveOverlap(ball);
                let ax = 0, ay = this.has('antigravity') ? -260 : 260;
                for (const z of this.level.zones) if (ball.x > z.x && ball.x < z.x + z.w && ball.y > z.y && ball.y < z.y + z.h) { ax += z.ax; ay += z.ay; }
                for (const brick of this.bricks) if (brick.type === 'repel' && brick.hp > 0 && ball.strongUntil <= this.time) {
                    const dx = ball.x - (brick.x + brick.w / 2), dy = ball.y - (brick.y + brick.h / 2), d = Math.hypot(dx, dy);
                    if (d > 1 && d < 83) { ax += dx / d * 400; ay += dy / d * 400; }
                }
                ball.vx = clamp(ball.vx + ax * dt, -1100, 1100); ball.vy = clamp(ball.vy + ay * dt, -1100, 1100);
                this.moveBall(ball, dt * (this.has('slow') ? .7 : 1));
                if (ball.y > H + 22) this.balls = this.balls.filter(b => b !== ball);
            }
            this.checkComplete();
            if (this.state === 'running' && !this.balls.length && !this.has('rain')) this.loseLife();
        }
        resolveOverlap(ball) {
            ball.x = clamp(ball.x, ball.r + .1, W - ball.r - .1); ball.y = Math.max(ball.r + .1, ball.y);
            // A size expiration or moving obstacle may enclose a ball. Eject to the nearest free face.
            const solids=[...this.bricks.filter(b => b.hp !== 0), ...this.level.gates.filter(g => !g.open)];
            const overlaps=(x,y,b)=>x>b.x-ball.r&&x<b.x+b.w+ball.r&&y>b.y-ball.r&&y<b.y+b.h+ball.r;
            if(!solids.some(b=>overlaps(ball.x,ball.y,b)))return;
            const faces=[];
            for(const b of solids)faces.push({x:b.x-ball.r-.2,y:ball.y},{x:b.x+b.w+ball.r+.2,y:ball.y},{x:ball.x,y:b.y-ball.r-.2},{x:ball.x,y:b.y+b.h+ball.r+.2});
            faces.sort((a,b)=>Math.hypot(a.x-ball.x,a.y-ball.y)-Math.hypot(b.x-ball.x,b.y-ball.y));
            const free=faces.find(p=>p.x>=ball.r&&p.x<=W-ball.r&&p.y>=ball.r&&p.y<PADDLE_Y&&!solids.some(b=>overlaps(p.x,p.y,b)));
            if(free){ball.x=free.x;ball.y=free.y;}
        }
        moveBall(ball, dt) {
            let remaining = dt; const pierced = new Set();
            for (let iteration = 0; iteration < 12 && remaining > .00001; iteration++) {
                const dx = ball.vx * remaining, dy = ball.vy * remaining;
                let hit = null;
                const offer = (candidate, kind, target) => { if (candidate && candidate.t >= 0 && candidate.t <= 1 && (!hit || candidate.t < hit.t)) hit = { ...candidate, kind, target }; };
                if (dx < 0) offer({ t: (ball.r - ball.x) / dx, nx: 1, ny: 0 }, 'wall');
                if (dx > 0) offer({ t: (W - ball.r - ball.x) / dx, nx: -1, ny: 0 }, 'wall');
                if (dy < 0) offer({ t: (ball.r - ball.y) / dy, nx: 0, ny: 1 }, 'wall');
                if (dy > 0) {
                    offer(sweepBox(ball.x, ball.y, dx, dy, ball.r, { x: this.paddle.x, y: PADDLE_Y, w: this.paddle.w, h: 14 }), 'paddle');
                    if (this.shield) offer({ t: (H - 15 - ball.r - ball.y) / dy, nx: 0, ny: -1 }, 'shield');
                }
                for (const brick of this.bricks) if (brick.hp !== 0 && !pierced.has(brick.id)) {
                    if (brick.type === 'repel' && ball.strongUntil <= this.time) offer(sweepCircle(ball.x, ball.y, dx, dy, brick.x + brick.w / 2, brick.y + brick.h / 2, 43 + ball.r), 'repel', brick);
                    offer(sweepBox(ball.x, ball.y, dx, dy, ball.r, brick), 'brick', brick);
                }
                for (const gate of this.level.gates) if (!gate.open) offer(sweepBox(ball.x, ball.y, dx, dy, ball.r, gate), 'gate', gate);
                for (const rotor of this.level.rotors) offer(sweepCircle(ball.x, ball.y, dx, dy, rotor.x, rotor.y, rotor.r + ball.r), 'rotor', rotor);
                if (ball.portalUntil <= this.time) for (const port of this.level.portals) if(!port.requires || this.level.gates.find(g=>g.id===port.requires)?.open) offer(sweepCircle(ball.x, ball.y, dx, dy, port.x, port.y, port.r + ball.r), 'portal', port);
                if (!hit) { ball.x += dx; ball.y += dy; break; }
                ball.x += dx * hit.t; ball.y += dy * hit.t; remaining *= 1 - hit.t;
                if (hit.kind === 'portal') {
                    const p = hit.target, speed = Math.max(450, Math.hypot(ball.vx, ball.vy));
                    ball.x = p.tx + Math.cos(p.angle) * (p.r + ball.r + 3); ball.y = p.ty + Math.sin(p.angle) * (p.r + ball.r + 3);
                    ball.vx = Math.cos(p.angle) * speed; ball.vy = Math.sin(p.angle) * speed; ball.portalUntil = this.time + .35;
                    this.emit('portal', { x: ball.x, y: ball.y, fromX: p.x, fromY: p.y }); this.resolveOverlap(ball); continue;
                }
                if (hit.kind === 'paddle') { this.bouncePaddle(ball); ball.y = PADDLE_Y - ball.r - .2; continue; }
                let reflect = true;
                if (hit.kind === 'brick') {
                    const strong = ball.strongUntil > this.time;
                    const damaged = this.hitBrick(hit.target, this.damage() + (strong ? 2 : 0), { nx: hit.nx, ny: hit.ny, strong, ball });
                    if (damaged && strong) ball.strongUntil = 0;
                    if (damaged && this.has('pierce') && !['steel', 'repel', 'directional'].includes(hit.target.type)) { reflect = false; pierced.add(hit.target.id); }
                } else if (hit.kind === 'repel') this.emit('magnetic', { x: ball.x, y: ball.y });
                else if (hit.kind === 'shield') { this.shield--; this.emit('shield', { x: ball.x, y: ball.y }); }
                else this.emit('wall', { x: ball.x, y: ball.y });
                if (reflect) {
                    const dot = ball.vx * hit.nx + ball.vy * hit.ny;
                    ball.vx -= 2 * dot * hit.nx; ball.vy -= 2 * dot * hit.ny;
                    if (hit.kind === 'rotor') { ball.vx += -hit.ny * hit.target.speed * 60; ball.vy += hit.nx * hit.target.speed * 60; }
                    ball.x += hit.nx * .2; ball.y += hit.ny * .2;
                } else { const len = Math.hypot(dx, dy) || 1; ball.x += dx / len * .3; ball.y += dy / len * .3; }
            }
        }
        bouncePaddle(ball) {
            const offset = clamp((ball.x - (this.paddle.x + this.paddle.w / 2)) / (this.paddle.w / 2), -1, 1);
            const empowered = this.paddle.releaseUntil > this.time;
            const boost = empowered ? 1 + .4 * this.paddle.releasePower : 1;
            ball.vx = (offset * 380 + this.paddle.vx * .16) * boost;
            ball.vy = -Math.min(980, (515 + Math.min(50, this.levelIndex * 1.6)) * boost);
            if (empowered && this.paddle.releasePower > .15) ball.strongUntil = this.time + 6;
            this.emit(empowered ? 'strong' : 'paddle', { x: ball.x, y: PADDLE_Y, size: ball.r });
        }
        hitBrick(brick, damage, { nx = 0, ny = -1, strong = false, ball = null, secondary = false } = {}) {
            if (!brick || brick.hp <= 0) return false;
            if (brick.bossRole === 'core' && this.bricks.some(b => b.bossRole === 'node' && b.hp > 0)) { this.emit('magnetic', { x: brick.x + brick.w / 2, y: brick.y }); return false; }
            if (brick.type === 'repel' && !strong) return false;
            if (brick.type === 'directional' && ny !== -1) { this.emit('wall', { x: brick.x, y: brick.y }); return false; }
            if (brick.type === 'emitter' && !brick.active) { brick.active = true; brick.nextEmission = this.time + .6; }
            const before = brick.hp;
            let floor = 0;
            if (brick.bossRole === 'core' && this.level.boss?.kind === 'nova') floor = Math.max(0, 40 - this.bossPhase * 20);
            brick.hp = Math.max(floor, brick.hp - damage);
            const removed = before - brick.hp;
            if (!removed) return false;
            this.score += removed * 5;
            this.combo = this.time - this.lastHit < .6 ? this.combo + 1 : 1; this.lastHit = this.time;
            this.emit(brick.hp ? 'crack' : 'brick', { x: brick.x + brick.w / 2, y: brick.y + brick.h / 2, nx, ny, type: brick.type, size: ball?.r || 8, combo: this.combo, damage: removed });
            if (!brick.hp) {
                this.score += 10;
                if (brick.power) this.dropPower(brick.power, brick);
                else if (this.random() < .18) this.dropPower(this.level.powerPool[Math.floor(this.random() * this.level.powerPool.length)], brick);
                if (brick.type === 'hatch') this.spawnBall(brick.x + brick.w / 2, brick.y + brick.h + 12, 80 * (this.random() - .5), 150);
                if (brick.type === 'switch') { const gate = this.level.gates.find(g => g.id === brick.opens); if (gate) { gate.open = true; gate.openedAt = this.time; } this.emit('switch', { x: brick.x, y: brick.y, opens: brick.opens }); }
                if (brick.type === 'explosive') this.explode(brick);
                if (brick.bossRole === 'core') this.emit('bossDown', { x: brick.x + brick.w / 2, y: brick.y + brick.h / 2 });
            }
            if (!secondary && ball) {
                const near = this.bricks.filter(b => b !== brick && b.hp > 0 && !b.bossRole && b.type !== 'repel' && Math.hypot(b.x - brick.x, b.y - brick.y) < (this.has('fire') ? 74 : 125));
                if (this.has('fire')) { for (const b of near.filter(b => Math.hypot(b.x - brick.x, b.y - brick.y) < 74)) this.hitBrick(b, 1, { ny, secondary: true }); this.emit('fire', { x: brick.x + brick.w / 2, y: brick.y + brick.h / 2 }); }
                if (this.has('lightning')) for (const b of near.slice(0, 3)) { this.hitBrick(b, 2, { ny, secondary: true }); this.emit('lightning', { x: brick.x + brick.w / 2, y: brick.y + brick.h / 2, tx: b.x + b.w / 2, ty: b.y + b.h / 2 }); }
            }
            if (brick.bossRole === 'core' && floor && brick.hp === floor) this.advanceBoss();
            return true;
        }
        explode(source) {
            // Explicit queue: explosive chains may continue, but fire/lightning effects never recurse.
            const queue = [source], visited = new Set([source.id]);
            while (queue.length) {
                const s = queue.shift(); this.emit('explosion', { x: s.x + s.w / 2, y: s.y + s.h / 2 });
                for (const b of this.bricks) if (b.hp > 0 && !b.bossRole && b.type !== 'repel' && Math.hypot(b.x - s.x, b.y - s.y) < 67) {
                    if (b.type === 'explosive' && !visited.has(b.id)) { visited.add(b.id); b.hp = 0; this.score += b.maxHp * 5 + 10; if (b.power) this.dropPower(b.power, b); queue.push(b); this.emit('brick', { x: b.x + b.w / 2, y: b.y + b.h / 2, type: b.type }); }
                    else this.hitBrick(b, 3, { secondary: true });
                }
            }
        }
        advanceBoss() {
            this.bossPhase++; this.level.boss.phase = this.bossPhase;
            const phase = this.bossPhase;
            for (let k = 0; k < 2; k++) {
                const bx = phase === 2 ? 130 + k * 400 : 185 + k * 310, by = phase === 2 ? 115 : 280;
                this.bricks.push({ id: 1000 + phase * 10 + k, x: bx, y: by, bx, by, w: 64, h: 30, hp: 8, maxHp: 8, type: phase === 1 ? 'repel' : 'directional', bossRole: 'node', motion: phase === 1 ? { axis: 'y', amp: 38, speed: 1, phase: k * Math.PI } : null });
            }
            if (phase === 2) this.level.portals = [{ id: 'novaA', x: 65, y: 350, tx: 562, ty: 66, r: 18, angle: Math.PI / 2, color: 0 }, { id: 'novaB', x: 655, y: 350, tx: 162, ty: 66, r: 18, angle: Math.PI / 2, color: 1 }];
            this.emit('boss', { phase });
        }
        dropPower(name, brick) {
            if (!POWERS[name]) return;
            this.items.push({ id: ++this.id, name, x: brick.x + brick.w / 2, y: brick.y + brick.h / 2 });
        }
        collect(name) {
            const p = POWERS[name]; if (!p) return;
            if (['big', 'small'].includes(name)) { delete this.effects.big; delete this.effects.small; }
            if (['wide', 'narrow', 'full'].includes(name)) { delete this.effects.wide; delete this.effects.narrow; delete this.effects.full; }
            if (p.duration) this.effects[name] = this.time + p.duration;
            if (name === 'multi') for (const b of [...this.balls].filter(b => !b.attached)) for (const angle of [-.28, .28]) {
                this.spawnBall(b.x, b.y, b.vx * Math.cos(angle) - b.vy * Math.sin(angle), b.vx * Math.sin(angle) + b.vy * Math.cos(angle));
            }
            if (name === 'rain') this.nextRain = this.time;
            if (name === 'laser') this.nextLaser = this.time;
            if (name === 'shield') this.shield = 2;
            if (name === 'life') this.lives = Math.min(5, this.lives + 1);
            this.emit('power', { power: name, x: this.paddle.x + this.paddle.w / 2, y: PADDLE_Y });
        }
        updateItems(dt) {
            for (const item of this.items) {
                item.y += 105 * dt;
                if (this.has('magnet')) item.x += clamp(this.paddle.x + this.paddle.w / 2 - item.x, -230 * dt, 230 * dt);
                if (item.y > PADDLE_Y - 12 && item.y < PADDLE_Y + 26 && item.x >= this.paddle.x - 12 && item.x <= this.paddle.x + this.paddle.w + 12) { this.collect(item.name); item.taken = true; }
            }
            this.items = this.items.filter(i => !i.taken && i.y < H + 22);
        }
        updateGenerators() {
            if (this.has('rain') && this.time >= this.nextRain) { this.spawnBall(45 + this.random() * (W - 90), 455, (this.random() - .5) * 200, -560); this.nextRain = this.time + .4; }
            for (const b of this.bricks) if (b.type === 'emitter' && b.active && b.hp > 0 && b.emitted < 6 && this.time >= b.nextEmission) {
                if (this.spawnBall(b.x + b.w / 2, b.y + b.h + 12, (this.random() - .5) * 150, 130)) b.emitted++;
                b.nextEmission = this.time + 1.2;
            }
            if (this.has('laser') && this.time >= this.nextLaser) {
                for (const x of [this.paddle.x + 12, this.paddle.x + this.paddle.w - 12]) this.shots.push({ id: ++this.id, x, y: PADDLE_Y - 10 });
                this.nextLaser = this.time + .3; this.emit('laser');
            }
        }
        updateShots(dt) {
            for (const shot of this.shots) {
                const dy = -850 * dt; let hit = null;
                for (const b of [...this.bricks.filter(b => b.hp !== 0), ...this.level.gates.filter(g => !g.open)]) {
                    const c = sweepBox(shot.x, shot.y, 0, dy, 2, b); if (c && (!hit || c.t < hit.t)) hit = { ...c, brick: b };
                }
                if (hit) { if (hit.brick.hp > 0) this.hitBrick(hit.brick, 2, { ny: 1 }); shot.gone = true; }
                shot.y += dy;
            }
            this.shots = this.shots.filter(s => !s.gone && s.y > -10);
        }
        checkComplete() {
            if (this.state !== 'running') return;
            const done = this.level.boss ? !this.bricks.some(b => b.bossRole === 'core' && b.hp > 0) : !this.bricks.some(b => b.hp > 0);
            if (!done) return;
            if (this.wave + 1 < this.level.waves) { this.wave++; this.loadLevel(); this.emit('wave', { wave: this.wave }); return; }
            this.lives = Math.min(5, this.lives + 1); this.cancelInput();
            this.state = this.levelIndex === TOTAL_LEVELS - 1 ? 'won' : 'level-clear';
            this.emit(this.state === 'won' ? 'win' : 'level', { x: W / 2, y: H / 2 });
        }
        nextLevel() {
            if (this.state !== 'level-clear') return false;
            this.levelIndex++; this.wave = 0; this.bossPhase = 0; this.effects = {}; this.shield = 0; this.items = []; this.shots = []; this.balls = [];
            this.loadLevel(); this.movePaddle(W / 2); this.attachBall(); this.state = 'ready'; return true;
        }
        loseLife() {
            this.lives--; this.cancelInput(); this.effects = {}; this.shield = 0; this.items = []; this.shots = []; this.balls = [];
            this.movePaddle(W / 2); this.state = this.lives ? 'life-lost' : 'over';
            if (this.lives) this.attachBall(); this.emit(this.lives ? 'life' : 'lose');
        }
        snapshot() {
            return copy({ version: 2, levelIndex: this.levelIndex, score: this.score, lives: this.lives, seed: this.seed, time: this.time, id: this.id, wave: this.wave, bossPhase: this.bossPhase, state: this.state, paddle: this.paddle, effects: this.effects, shield: this.shield, balls: this.balls, items: this.items, shots: this.shots, bricks: this.bricks, gates: this.level.gates, portals: this.level.portals, nextRain: this.nextRain, nextLaser: this.nextLaser, combo: this.combo, lastHit: this.lastHit });
        }
        static restore(data) {
            const game = new Game({ levelIndex: data.levelIndex });
            for (const key of ['score','lives','seed','time','id','wave','bossPhase','state','paddle','effects','shield','balls','items','shots','nextRain','nextLaser','combo','lastHit']) game[key] = copy(data[key]);
            game.loadLevel(); game.bricks = copy(data.bricks); game.level.bricks = game.bricks;
            game.level.gates = copy(data.gates); game.level.portals = copy(data.portals);
            if (game.level.boss) game.level.boss.phase = game.bossPhase;
            if (game.state === 'running') game.state = 'paused';
            game.cancelInput(); game.events = []; return game;
        }
    }
    Object.assign(api, { Game, STEP, PADDLE_Y, MAX_BALLS, sweepBox, sweepCircle });
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
