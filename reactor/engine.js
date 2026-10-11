/* Reactor Pinball: deterministic, fixed-step physics. No DOM, clock, audio or randomness. */
((root) => {
    'use strict';
    const W = 600, H = 920, BALL_R = 9, STEP = 1 / 120, GRAVITY = 790, MAX_SPEED = 1900;
    const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
    const BUMPERS = Object.freeze([
        Object.freeze({ x: 212, y: 222, r: 28, color: '#63efff', label: 'I' }),
        Object.freeze({ x: 371, y: 226, r: 28, color: '#b193ff', label: 'II' }),
        Object.freeze({ x: 291, y: 319, r: 30, color: '#ff75ad', label: 'III' }),
    ]);
    const CORE = Object.freeze({ x: 291, y: 463, r: 38 });
    const RAILS = Object.freeze([
        Object.freeze({ x: 85, y: 260, r: 30, side: -1 }),
        Object.freeze({ x: 491, y: 260, r: 25, side: 1 }),
    ]);
    const WALLS = [];
    function wall(a, b, kind = 'wall') { WALLS.push(Object.freeze({ ax: a[0], ay: a[1], bx: b[0], by: b[1], kind, r: kind === 'sling' ? 5 : 4 })); }
    const shell = [[42, 823], [30, 680], [28, 200], [45, 115], [104, 55], [180, 35], [498, 35], [578, 126], [578, 884], [526, 884], [526, 220]];
    for (let i = 1; i < shell.length; i++) wall(shell[i - 1], shell[i]);
    wall([40, 692], [90, 754]); wall([90, 754], [177, 805]);
    wall([513, 688], [470, 754]); wall([470, 754], [401, 805]);
    wall([132, 422], [129, 309], 'rail'); wall([129, 309], [157, 185], 'rail');
    wall([454, 422], [448, 307], 'rail'); wall([448, 307], [420, 184], 'rail');
    // Slingshots face the centre lane. Their reverse sides are ordinary rubber.
    wall([88, 588], [159, 741], 'sling'); wall([88, 588], [98, 704]); wall([98, 704], [159, 741]);
    wall([490, 588], [419, 741], 'sling'); wall([490, 588], [480, 704]); wall([480, 704], [419, 741]);
    // Inlane separators preserve two dangerous outlanes and a true centre drain.
    wall([59, 573], [63, 689]); wall([63, 689], [141, 790]);
    wall([515, 573], [511, 689]); wall([511, 689], [436, 790]);
    Object.freeze(WALLS);
    const MISSIONS = Object.freeze([
        Object.freeze({ name: '點亮三座電容', detail: '命中三個不同的上方彈力環', target: 3, type: 'bumper' }),
        Object.freeze({ name: '接通能量軌道', detail: '穿越兩次左右外側的能量軌道', target: 2, type: 'rail' }),
        Object.freeze({ name: '擊穿反應爐核心', detail: '命中中央反應爐三次', target: 3, type: 'core' }),
    ]);
    function closest(x, y, ax, ay, bx, by) {
        const dx = bx - ax, dy = by - ay, d = dx * dx + dy * dy;
        const u = d ? clamp(((x - ax) * dx + (y - ay) * dy) / d, 0, 1) : 0;
        return { x: ax + u * dx, y: ay + u * dy, u };
    }
    function flipper(side) {
        const left = side === 'left';
        return { side, x: left ? 177 : 401, y: 805, length: 99, r: 10,
            rest: left ? .37 : Math.PI - .37, active: left ? -.57 : Math.PI + .57,
            angle: left ? .37 : Math.PI - .37, omega: 0, rising: false };
    }
    function flipperEnd(f) { return { x: f.x + Math.cos(f.angle) * f.length, y: f.y + Math.sin(f.angle) * f.length }; }

    class Game {
        constructor() { this.reset(); }
        reset() {
            this.state = 'ready'; this.time = 0; this.score = 0; this.ballsRemaining = 3;
            this.balls = []; this.nextBallId = 1; this.flippers = [flipper('left'), flipper('right')];
            this.energy = 0; this.overload = 0; this.overloads = 0; this.multiballs = 0; this.maxBalls = 1;
            this.missionIndex = 0; this.missionProgress = 0; this.missions = 0; this.missionCycle = 0;
            this.litBumpers = [false, false, false]; this.railHits = [0, 0]; this.coreHits = 0;
            this.events = []; this.plungerCharge = 0; this._plungerHeld = false;
            this._accumulator = 0; this._saveUntil = 0; this._freshServe = true;
            this.lastHit = ''; this.combo = 0; this.comboUntil = 0;
            this._serve(true); return this;
        }
        start() { if (this.state === 'ready') this.state = 'running'; return this; }
        restart() { return this.reset().start(); }
        pause() { if (this.state === 'running') { this.state = 'paused'; this.clearInput(); } }
        resume() { if (this.state === 'paused') { this.state = 'running'; this._accumulator = 0; } }
        clearInput() { this._plungerHeld = false; this.plungerCharge = 0; this._accumulator = 0; }
        get mission() { return MISSIONS[this.missionIndex]; }
        get multiplier() { return this.overload > 0 ? 3 : 1; }
        get ballSave() { return Math.max(0, this._saveUntil - this.time); }
        get staged() { return this.balls.find(b => b.staged); }
        _event(type, values = {}) { this.events.push({ type, time: this.time, ...values }); if (this.events.length > 200) this.events.shift(); }
        takeEvents() { return this.events.splice(0); }
        _ball(x, y, vx = 0, vy = 0, staged = false) {
            const ball = { id: this.nextBallId++, x, y, vx, vy, staged, cooldowns: Object.create(null), trail: [] };
            this.balls.push(ball); return ball;
        }
        _serve(fresh) {
            this._freshServe = fresh; this.plungerCharge = 0; this._plungerHeld = false;
            this._ball(552, 828, 0, 0, true); this._event('serve', { saved: !fresh });
        }
        launch(strength = this.plungerCharge) {
            if (this.state !== 'running' || !this.staged) return false;
            const ball = this.staged;
            ball.staged = false; ball.vy = -(1220 + clamp(Number.isFinite(strength) ? strength : 0, 0, 1) * 410);
            // The one-way return gate engages only once a launched ball leaves the chute.
            ball.inField = false;
            if (this._freshServe) this._saveUntil = this.time + 9;
            this._freshServe = false; this.plungerCharge = 0; this._plungerHeld = false;
            this._event('launch', { x: ball.x, y: ball.y }); return true;
        }
        _award(points, x, y, label) {
            const amount = Math.round(points * this.multiplier); this.score += amount;
            this._event('score', { points: amount, x, y, label }); return amount;
        }
        _charge(amount) {
            if (this.overload > 0) return;
            this.energy = clamp(this.energy + amount, 0, 100);
            if (this.energy >= 100) this._overload();
        }
        _overload() {
            this.energy = 0; this.overload = 22; this.overloads++; this.multiballs++;
            this._saveUntil = Math.max(this._saveUntil, this.time + 8);
            this._award(2500, CORE.x, CORE.y, '反應爐過載');
            const missing = Math.max(0, 3 - this.balls.length);
            for (let i = 0; i < missing; i++) this._ball(i % 2 ? 364 : 213, 131, i % 2 ? 245 : -245, 150 + i * 90);
            this.maxBalls = Math.max(this.maxBalls, this.balls.length);
            this._event('overload', { x: CORE.x, y: CORE.y, balls: this.balls.length });
        }
        _mission(type, index) {
            if (type !== this.mission.type) return;
            if (type === 'bumper') {
                this.litBumpers[index] = true; this.missionProgress = this.litBumpers.filter(Boolean).length;
            } else this.missionProgress++;
            if (this.missionProgress < this.mission.target) return;
            const completed = this.missionIndex;
            this.missions++; this._award(1800 + completed * 1000, 291, 555, '任務完成');
            this._event('mission', { index: completed, name: this.mission.name });
            this.missionIndex = (completed + 1) % MISSIONS.length; this.missionProgress = 0;
            if (this.missionIndex === 0) {
                this.missionCycle++; this.litBumpers = [false, false, false];
                this.ballsRemaining = Math.min(5, this.ballsRemaining + 1);
                this._event('extraBall');
            }
            // Finishing the full mission sequence guarantees reactor overload.
            this._charge(this.missionIndex === 0 ? 100 : 20);
        }
        _hit(ball, key, delay) {
            if ((ball.cooldowns[key] || 0) > this.time) return false;
            ball.cooldowns[key] = this.time + delay; return true;
        }
        _bumper(ball, item, index, core = false) {
            const dx = ball.x - item.x, dy = ball.y - item.y, min = BALL_R + item.r;
            const d = Math.hypot(dx, dy); if (d >= min) return;
            const nx = d > .00001 ? dx / d : 0, ny = d > .00001 ? dy / d : -1;
            ball.x = item.x + nx * (min + .05); ball.y = item.y + ny * (min + .05);
            const inward = ball.vx * nx + ball.vy * ny;
            if (inward < 0) { ball.vx -= 1.7 * inward * nx; ball.vy -= 1.7 * inward * ny; }
            const key = core ? 'core' : 'bumper' + index;
            if (!this._hit(ball, key, .18)) return;
            const outward = ball.vx * nx + ball.vy * ny;
            const kick = Math.max(0, (core ? 620 : 720) - outward);
            ball.vx += nx * kick; ball.vy += ny * kick;
            this.combo = this.time < this.comboUntil ? Math.min(8, this.combo + 1) : 1; this.comboUntil = this.time + 2.4;
            this.lastHit = core ? '反應爐核心' : '電容 ' + item.label;
            if (core) this.coreHits++;
            this._award(core ? (this.overload > 0 ? 1800 : 500) : 150 + this.combo * 25, item.x, item.y, core ? '核心' : '電容');
            this._event(core ? 'core' : 'bumper', { index, x: item.x, y: item.y, color: item.color });
            this._mission(core ? 'core' : 'bumper', index); this._charge(core ? 15 : 8);
        }
        _segment(ball, s, surface = null) {
            const p = closest(ball.x, ball.y, s.ax, s.ay, s.bx, s.by), dx = ball.x - p.x, dy = ball.y - p.y;
            const distance = Math.hypot(dx, dy), min = BALL_R + s.r; if (distance >= min) return;
            let nx, ny;
            if (distance > .00001) { nx = dx / distance; ny = dy / distance; }
            else { const len = Math.hypot(s.bx - s.ax, s.by - s.ay) || 1; nx = -(s.by - s.ay) / len; ny = (s.bx - s.ax) / len; if (ball.vx * nx + ball.vy * ny > 0) { nx = -nx; ny = -ny; } }
            ball.x = p.x + nx * (min + .02); ball.y = p.y + ny * (min + .02);
            const sx = surface ? -surface.omega * (p.y - surface.y) : 0;
            const sy = surface ? surface.omega * (p.x - surface.x) : 0;
            const vn = (ball.vx - sx) * nx + (ball.vy - sy) * ny;
            if (vn >= 0) return;
            const bounce = surface ? .63 : .78;
            ball.vx -= (1 + bounce) * vn * nx; ball.vy -= (1 + bounce) * vn * ny;
            if (surface && surface.rising && ny < .35 && this._hit(ball, surface.side, .09)) {
                const tip = .35 + p.u * .65;
                // Tip speed and contact position matter. Holding a raised bat never repeats this impulse.
                ball.vy -= 220 * tip; ball.vx += (surface.side === 'left' ? 1 : -1) * 125 * tip;
                this._event('flipper', { x: p.x, y: p.y, side: surface.side });
            } else if (!surface && s.kind === 'sling' && ny < .65 && this._hit(ball, 'sling' + s.ax, .3)) {
                ball.vx += nx * 170; ball.vy += ny * 210 - 100;
                this._award(75, p.x, p.y, '彈射'); this._event('sling', { x: p.x, y: p.y });
            } else if (!surface && Math.abs(vn) > 140 && this._hit(ball, 'wall', .1)) this._event('wall', { x: p.x, y: p.y });
        }
        _rail(ball, rail, index) {
            if (Math.hypot(ball.x - rail.x, ball.y - rail.y) > rail.r || !this._hit(ball, 'rail' + index, 1.8)) return;
            this.railHits[index]++; this.lastHit = index ? '右能量軌道' : '左能量軌道';
            ball.vy = Math.min(ball.vy, -830); ball.vx += rail.side * -65;
            this._award(650, rail.x, rail.y, '能量軌道'); this._event('rail', { index, x: rail.x, y: rail.y });
            this._mission('rail', index); this._charge(18);
        }
        _cap(ball) {
            const speed = Math.hypot(ball.vx, ball.vy);
            if (speed > MAX_SPEED) { ball.vx *= MAX_SPEED / speed; ball.vy *= MAX_SPEED / speed; }
        }
        _step(input) {
            this.time += STEP;
            if (this.overload > 0) { this.overload = Math.max(0, this.overload - STEP); if (!this.overload) this._event('overloadEnd'); }
            if (this.comboUntil < this.time) this.combo = 0;
            if (this.staged) {
                if (input.plunger) { this.plungerCharge = Math.min(1, this.plungerCharge + STEP * .95); this._plungerHeld = true; }
                else if (this._plungerHeld) this.launch();
            }
            // Bounded adaptive substeps: neither the ball nor a moving flipper tip travels
            // more than 0.42 ball radii per collision pass, including 1,900 px/s shots.
            for (const b of this.balls) this._cap(b);
            const speed = Math.max(1, ...this.balls.filter(b => !b.staged).map(b => Math.hypot(b.vx, b.vy) + GRAVITY * STEP));
            const substeps = Math.ceil(Math.max(speed, 99 * 15) * STEP / (BALL_R * .42));
            const dt = STEP / substeps;
            for (let n = 0; n < substeps; n++) {
                for (const f of this.flippers) {
                    const target = input[f.side] ? f.active : f.rest, before = f.angle;
                    const delta = clamp(target - f.angle, -15 * dt, 15 * dt); f.angle += delta; f.omega = delta / dt;
                    f.rising = !!input[f.side] && Math.abs(before - target) > .00001;
                }
                for (const ball of this.balls) {
                    if (ball.staged) continue;
                    ball.vy += GRAVITY * dt; ball.vx *= 1 - dt * .035;
                    ball.x += ball.vx * dt; ball.y += ball.vy * dt;
                    for (const s of WALLS) this._segment(ball, s);
                    if (ball.x < 512 && ball.y < 214) ball.inField = true;
                    // One-way gate closes the shooter lane after first entering the table.
                    if (ball.inField) this._segment(ball, { ax: 526, ay: 162, bx: 526, by: 225, r: 3, kind: 'wall' });
                    BUMPERS.forEach((b, i) => this._bumper(ball, b, i)); this._bumper(ball, CORE, 0, true);
                    RAILS.forEach((r, i) => this._rail(ball, r, i));
                    for (const f of this.flippers) { const e = flipperEnd(f); this._segment(ball, { ax: f.x, ay: f.y, bx: e.x, by: e.y, r: f.r }, f); }
                    this._cap(ball);
                }
                for (let i = 0; i < this.balls.length; i++) for (let j = i + 1; j < this.balls.length; j++) {
                    const a = this.balls[i], b = this.balls[j]; if (a.staged || b.staged) continue;
                    const dx = b.x - a.x, dy = b.y - a.y, distance = Math.hypot(dx, dy);
                    if (distance >= BALL_R * 2 || distance < .0001) continue;
                    const nx = dx / distance, ny = dy / distance, overlap = (BALL_R * 2 - distance + .01) / 2;
                    a.x -= nx * overlap; a.y -= ny * overlap; b.x += nx * overlap; b.y += ny * overlap;
                    const vn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
                    if (vn < 0) { a.vx += vn * .93 * nx; a.vy += vn * .93 * ny; b.vx -= vn * .93 * nx; b.vy -= vn * .93 * ny; }
                }
            }
            const drained = this.balls.filter(b => b.y > H + 25 || b.y < -100 || b.x < -80 || b.x > W + 80);
            if (drained.length) {
                this.balls = this.balls.filter(b => !drained.includes(b));
                drained.forEach(b => this._event('drain', { x: b.x, y: H - 20, remaining: this.balls.length }));
                if (!this.balls.length) {
                    if (this.ballSave > 0) { this._serve(false); this._event('save'); }
                    else {
                        this.ballsRemaining--; this.combo = 0; this.overload = 0;
                        if (this.ballsRemaining > 0) this._serve(true);
                        else { this.state = 'over'; this._event('gameover', { score: this.score }); }
                    }
                }
            }
        }
        update(delta, input = {}) {
            if (this.state !== 'running' || !Number.isFinite(delta) || delta <= 0) return;
            this._accumulator += Math.min(delta, .25);
            while (this._accumulator + 1e-10 >= STEP && this.state === 'running') { this._accumulator -= STEP; this._step(input); }
        }
    }
    const api = { W, H, BALL_R, STEP, GRAVITY, MAX_SPEED, BUMPERS, CORE, RAILS, WALLS, MISSIONS, Game, closest, flipperEnd };
    root.ReactorPinball = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
