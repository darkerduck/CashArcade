(() => {
    'use strict';

    const W = 1000, H = 760, SESSION_SECONDS = 90, CAR_RADIUS = 18.5;
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    const wrapAngle = angle => Math.atan2(Math.sin(angle), Math.cos(angle));
    const wrapProgress = value => ((value % 1) + 1) % 1;
    const finite = value => typeof value === 'number' && Number.isFinite(value);

    function makeTrack(id, name, zone, color, controls) {
        const points = [];
        // Closed Catmull–Rom splines have a continuous tangent at the start line.
        for (let i = 0; i < controls.length; i++) {
            const a = controls[(i + controls.length - 1) % controls.length];
            const b = controls[i], c = controls[(i + 1) % controls.length];
            const d = controls[(i + 2) % controls.length];
            for (let j = 0; j < 20; j++) {
                const t = j / 20, t2 = t * t, t3 = t2 * t;
                const axis = k => .5 * (2 * b[k] + (-a[k] + c[k]) * t
                    + (2 * a[k] - 5 * b[k] + 4 * c[k] - d[k]) * t2
                    + (-a[k] + 3 * b[k] - 3 * c[k] + d[k]) * t3);
                points.push(Object.freeze({ x: axis(0), y: axis(1) }));
            }
        }
        let length = 0;
        const segments = points.map((p, i) => {
            const q = points[(i + 1) % points.length], dx = q.x - p.x, dy = q.y - p.y;
            const size = Math.hypot(dx, dy), start = length;
            length += size;
            return Object.freeze({ x: p.x, y: p.y, dx, dy, size, start, angle: Math.atan2(dy, dx) });
        });
        const track = { id, name, zone, color, width: 114, points: Object.freeze(points),
            segments: Object.freeze(segments), length };
        track.start = Object.freeze(pointAt(0, track));
        track.checkpoints = Object.freeze(Array.from({ length: 8 }, (_, i) => Object.freeze(pointAt(i / 8, track))));
        return Object.freeze(track);
    }

    function pointAt(progress, track) {
        const p = wrapProgress(finite(progress) ? progress : 0), distance = p * track.length;
        let lo = 0, hi = track.segments.length - 1;
        while (lo < hi) {
            const mid = (lo + hi + 1) >> 1;
            if (track.segments[mid].start <= distance) lo = mid;
            else hi = mid - 1;
        }
        const s = track.segments[lo], t = clamp((distance - s.start) / s.size, 0, 1);
        return { x: s.x + s.dx * t, y: s.y + s.dy * t, angle: s.angle,
            nx: -s.dy / s.size, ny: s.dx / s.size, progress: p, index: lo };
    }

    function nearestPoint(x, y, track) {
        if (!finite(x) || !finite(y)) return { ...pointAt(0, track), distance: Infinity };
        let best = Infinity, result = null;
        for (let i = 0; i < track.segments.length; i++) {
            const s = track.segments[i];
            const t = clamp(((x - s.x) * s.dx + (y - s.y) * s.dy) / (s.size * s.size), 0, 1);
            const px = s.x + s.dx * t, py = s.y + s.dy * t;
            const squared = (x - px) ** 2 + (y - py) ** 2;
            if (squared < best) {
                best = squared;
                result = { x: px, y: py, distance: Math.sqrt(squared), index: i, angle: s.angle,
                    nx: -s.dy / s.size, ny: s.dx / s.size,
                    progress: ((s.start + t * s.size) / track.length) % 1 };
            }
        }
        return result;
    }

    const TRACKS = Object.freeze([
        makeTrack('neon-loop', '霓虹環線', 'NEON DISTRICT', '#31e7ff', [
            [500, 150], [755, 165], [850, 300], [815, 515], [675, 610],
            [350, 610], [175, 485], [165, 285], [300, 170],
        ]),
        makeTrack('harbor-flow', '港灣流光', 'HARBOR CIRCUIT', '#ba88ff', [
            [500, 135], [775, 160], [865, 320], [800, 520], [660, 600],
            [520, 490], [365, 595], [195, 565], [140, 370], [240, 185],
        ]),
        makeTrack('midnight-ridge', '午夜山道', 'MIDNIGHT RIDGE', '#ffb45e', [
            [470, 145], [745, 155], [845, 280], [765, 405], [830, 535],
            [650, 610], [460, 545], [260, 600], [155, 465], [215, 345], [175, 220], [300, 150],
        ]),
    ]);

    class Game {
        constructor(index = 0, rival = false) {
            this.isRival = rival;
            this.trackIndex = Number.isInteger(index) ? clamp(index, 0, TRACKS.length - 1) : 0;
            this.track = TRACKS[this.trackIndex];
            this._reset();
        }

        _reset() {
            const start = this.track.start;
            this.car = { x: start.x, y: start.y, angle: start.angle, vx: 0, vy: 0, speed: 0 };
            this.health = 100; this.collisions = 0; this.hitCooldown = 0; this.impactFlash = 0;
            this.rank = 1; this.won = false; this.result = null;
            this.rivals = this.isRival ? [] : [new Game(this.trackIndex, true), new Game(this.trackIndex, true)];
            this.rivals.forEach((r, i) => {
                const p = pointAt(-(i + 1) * 40 / this.track.length, this.track);
                Object.assign(r.car, { x: p.x, y: p.y, angle: p.angle });
                r.progress = p.progress; r._lastX = p.x; r._lastY = p.y;
                r._invalidLap = true; r.pace = 190 + i * 8; r.name = ['VIOLET', 'AMBER'][i];
                r.state = 'running';
            });
            this.state = 'ready'; this.time = 0; this.timeLeft = SESSION_SECONDS;
            this.score = 0; this.laps = 0; this.bestLap = null; this.lapTime = 0;
            this.boost = 0; this.charge = 0; this.combo = 0; this.maxCombo = 0;
            this.drifting = false; this.offroad = false; this.events = [];
            this.progress = 0; this.checkpoint = 0;
            this._score = 0; this._holdingDrift = false; this._driftTime = 0; this._comboHold = 0;
            this._lapStarted = 0; this._nextCheckpoint = 1; this._legalDistance = 0;
            this._lastX = start.x; this._lastY = start.y; this._invalidLap = false; this._gateBlocked = false;
            return this;
        }

        start() {
            this._reset(); this.state = 'running'; this.emit('start');
            return this;
        }
        pause() { if (this.state === 'running') this.state = 'paused'; return this; }
        resume() { if (this.state === 'paused') this.state = 'running'; return this; }
        emit(type, extra = {}) {
            if (this.events.length < 128) this.events.push({ type, x: this.car.x, y: this.car.y, ...extra });
        }
        drain() { return this.events.splice(0); }
        _addScore(amount) { this._score += amount; this.score = Math.floor(this._score); }

        update(dt, input = {}) {
            if (this.state !== 'running' || !finite(dt) || dt <= 0) return this;
            // A background-tab wake never fast-forwards a race or teleports its car.
            const duration = Math.min(dt, .1, this.timeLeft);
            const speed = Math.max(345, Math.hypot(this.car.vx, this.car.vy));
            const steps = Math.ceil(duration / Math.min(1 / 120, 2 / speed)), step = duration / steps;
            input = input && typeof input === 'object' ? input : {};
            const steer = finite(input.steer) ? clamp(input.steer, -1, 1) : 0;
            const handbrake = input.drift === true;
            for (let i = 0; i < steps && this.state === 'running'; i++) {
                for (const rival of this.rivals) {
                    const input = rivalInput(rival);
                    if (rival.state === 'running') rival._step(step, input.steer, false);
                    rival.drain();
                }
                this._step(step, steer, handbrake);
                this.rank = this.standings().findIndex(entry => entry.racer === this) + 1;
                if (this.state === 'finished') {
                    this.won = this.health > 0 && this.rank === 1 && this.laps > 0 && !this._invalidLap;
                    this.result = this.won ? 'win' : 'loss';
                }
            }
            return this;
        }

        _step(dt, steer, handbrake) {
            const car = this.car, track = this.track;
            this.hitCooldown = Math.max(0, this.hitCooldown - dt);
            this.impactFlash = Math.max(0, this.impactFlash - dt);
            // Detect external relocations as well as discontinuous route projections.
            // Re-entering at the start line can begin a fresh legitimate lap.
            this._gateBlocked = Math.hypot(car.x - this._lastX, car.y - this._lastY) > 1;
            if (this._gateBlocked) this._invalidLap = true;
            const before = nearestPoint(car.x, car.y, track);
            const wasOffroad = this.offroad;
            this.offroad = before.distance > track.width / 2;

            if (!handbrake && this._holdingDrift) {
                if (this.charge >= .08 && !this.offroad) {
                    const amount = this.charge;
                    this.boost = Math.max(this.boost, amount);
                    this._addScore(Math.round(amount * 240));
                    this.emit('boost', { amount });
                }
                this.charge = 0;
            }
            this._holdingDrift = handbrake;
            this.drifting = handbrake && Math.abs(steer) > .12 && car.speed > 75 && !this.offroad;
            if (this.drifting) {
                if (this._comboHold <= 0) this.emit('drift');
                this._driftTime += dt;
                this.combo = Math.min(8, 1 + Math.floor(this._driftTime / .9));
                this.maxCombo = Math.max(this.maxCombo, this.combo);
                this._comboHold = .65;
                this.charge = Math.min(1, this.charge + dt * (.25 + Math.abs(steer) * .17));
                this._addScore(dt * (45 + Math.abs(steer) * 35) * this.combo);
            } else {
                this._comboHold = Math.max(0, this._comboHold - dt);
                if (!this._comboHold) { this.combo = 0; this._driftTime = 0; }
                if (this.offroad) {
                    this.charge = Math.max(0, this.charge - dt * .8);
                    this.boost = Math.max(0, this.boost - dt * .9);
                    this.combo = 0; this._driftTime = 0; this._comboHold = 0;
                }
            }

            const boosted = this.boost > 0 && !handbrake && !this.offroad;
            const targetSpeed = this.offroad ? 82 : boosted ? 345 : handbrake ? 168 : (this.pace || 215);
            const acceleration = targetSpeed > car.speed ? (boosted ? 4.4 : 2.8) : 5;
            car.speed += (targetSpeed - car.speed) * (1 - Math.exp(-acceleration * dt));
            const turnRate = handbrake ? 3.4 : 3.1;
            car.angle = wrapAngle(car.angle + steer * turnRate * (.35 + .65 * Math.min(car.speed / 210, 1.25)) * dt);
            const grip = this.offroad ? 5.5 : handbrake ? 4.5 : 10;
            const alignment = 1 - Math.exp(-grip * dt);
            car.vx += (Math.cos(car.angle) * car.speed - car.vx) * alignment;
            car.vy += (Math.sin(car.angle) * car.speed - car.vy) * alignment;
            const oldX = car.x, oldY = car.y;
            this._move(dt);
            if (boosted) this.boost = Math.max(0, this.boost - dt / 1.65);

            const projection = nearestPoint(car.x, car.y, track);
            this.offroad = projection.distance > track.width / 2;
            if (this.offroad && !wasOffroad) this.emit('offroad');
            this.time = Math.min(SESSION_SECONDS, this.time + dt);
            this.timeLeft = Math.max(0, SESSION_SECONDS - this.time);
            this.lapTime = this.time - this._lapStarted;
            this._advanceLap(projection, Math.hypot(car.x - oldX, car.y - oldY));
            this._lastX = car.x; this._lastY = car.y;
            if (this.health <= 0) {
                this.state = 'destroyed'; this.result = 'exploded'; this.won = false;
                this.drifting = false; this.car.speed = 0; this.car.vx = 0; this.car.vy = 0;
                this.emit('explosion');
            } else if (this.timeLeft <= 1e-8) {
                this.time = SESSION_SECONDS; this.timeLeft = 0; this.state = 'finished';
                this.drifting = false; this.emit('finish', { score: this.score, laps: this.laps, bestLap: this.bestLap });
            }
        }

        // The car's enclosing disk is contained in the road tube. Sweep in
        // <=2px increments and bisect the first exit, so a boost cannot cross
        // either rail or skip the infield. Contact retains tangential velocity.
        _move(dt) {
            const c = this.car, limit = this.track.width / 2 - CAR_RADIUS;
            const inside = (x, y) => nearestPoint(x, y, this.track).distance <= limit;
            if (!inside(c.x, c.y)) {
                // Defensive recovery from malformed/external positions; invalidate
                // progress before correcting. Normal driving never uses relocation.
                const p = nearestPoint(c.x, c.y, this.track);
                const d = Math.hypot(c.x - p.x, c.y - p.y) || 1;
                c.x = p.x + (c.x - p.x) / d * (limit - .5);
                c.y = p.y + (c.y - p.y) / d * (limit - .5);
                this._invalidLap = true; this._gateBlocked = true;
            }
            const dx = c.vx * dt, dy = c.vy * dt;
            const count = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 2));
            for (let i = 0; i < count; i++) {
                const x = c.x + c.vx * dt / count, y = c.y + c.vy * dt / count;
                if (inside(x, y)) { c.x = x; c.y = y; continue; }
                let lo = 0, hi = 1;
                for (let j = 0; j < 12; j++) {
                    const t = (lo + hi) / 2;
                    if (inside(c.x + (x - c.x) * t, c.y + (y - c.y) * t)) lo = t; else hi = t;
                }
                c.x += (x - c.x) * lo; c.y += (y - c.y) * lo;
                const p = nearestPoint(c.x, c.y, this.track);
                const d = Math.hypot(c.x - p.x, c.y - p.y) || 1;
                const nx = (c.x - p.x) / d, ny = (c.y - p.y) / d;
                const impact = Math.max(0, c.vx * nx + c.vy * ny);
                c.x -= nx * .15; c.y -= ny * .15;
                if (impact > 0) { c.vx -= nx * impact * 1.12; c.vy -= ny * impact * 1.12; }
                c.speed = Math.min(c.speed, Math.max(55, Math.hypot(c.vx, c.vy)));
                this.charge = 0; this.boost = 0; this.combo = 0; this._driftTime = 0;
                this._comboHold = 0; this.drifting = false;
                if (impact >= 35 && this.hitCooldown <= 0) {
                    const damage = clamp(impact * .09, 5, 24);
                    this.health = Math.max(0, this.health - damage);
                    this.collisions++; this.hitCooldown = .9; this.impactFlash = .3;
                    this.emit('collision', { damage, impact });
                }
            }
        }

        raceDistance() {
            if (this.health <= 0) return -1;
            // Invalid attempts never retain a shortcut's apparent progress.
            return this.laps * this.track.length + (this._invalidLap ? 0 :
                Math.min(Math.max(0, this._legalDistance), (this.checkpoint + 1) * this.track.length / 8));
        }
        standings() {
            return [this, ...this.rivals].map((racer, id) => ({ racer, id, distance: racer.raceDistance() }))
                .sort((a, b) => b.distance - a.distance || b.racer.health - a.racer.health || b.id - a.id);
        }

        _crossedGate(index) {
            // A relocation or defensive recovery is not a physical sweep.
            // Never treat the segment from the old position to that new
            // position as checkpoint proof, including finish-line recovery.
            if (this._gateBlocked) return false;
            const gate = this.track.checkpoints[index];
            const tx = Math.cos(gate.angle), ty = Math.sin(gate.angle);
            const before = (this._lastX - gate.x) * tx + (this._lastY - gate.y) * ty;
            const after = (this.car.x - gate.x) * tx + (this.car.y - gate.y) * ty;
            if (before > 0 || after <= 0) return false;
            const t = -before / (after - before);
            const x = this._lastX + (this.car.x - this._lastX) * t - gate.x;
            const y = this._lastY + (this.car.y - this._lastY) * t - gate.y;
            return Math.abs(x * gate.nx + y * gate.ny) <= this.track.width / 2 - CAR_RADIUS + .01;
        }

        _advanceLap(projection, movement) {
            const previous = this.progress, current = projection.progress;
            let delta = current - previous;
            if (delta > .5) delta -= 1;
            if (delta < -.5) delta += 1;
            // The nearest point can switch between adjacent sides of a tight
            // bend even when a <=2px physical sweep stays entirely inside the
            // road. Arc-distance / movement is therefore not a valid speed
            // test. Ordered physical gate crossings below validate the route;
            // external relocations are invalidated before the sweep in _step.
            const plausible = Math.abs(delta) < .08;
            const onroad = !this.offroad;
            if (!plausible) this._invalidLap = true;
            if (plausible && onroad) this._legalDistance = Math.max(0, this._legalDistance + delta * this.track.length);

            if (plausible && onroad) {
                if (this._nextCheckpoint < 8 && this._crossedGate(this._nextCheckpoint)) {
                    this.checkpoint = this._nextCheckpoint++;
                    this.emit('checkpoint', { checkpoint: this.checkpoint });
                }
                if ((previous > .875 || this._nextCheckpoint === 8) && this._crossedGate(0)) {
                    if (this._nextCheckpoint === 8 && !this._invalidLap
                        && this._legalDistance >= this.track.length * .9 && this.lapTime > 3) {
                        this.laps++;
                        const lap = this.lapTime;
                        const best = this.bestLap === null || lap < this.bestLap;
                        if (best) this.bestLap = lap;
                        this._addScore(1000 + Math.max(0, Math.round((30 - lap) * 20)));
                        this.emit('lap', { laps: this.laps, lapTime: lap, best });
                    }
                    this._lapStarted = this.time; this.lapTime = 0;
                    this._nextCheckpoint = 1; this.checkpoint = 0;
                    this._legalDistance = current < .125 ? current * this.track.length : 0; this._invalidLap = false;
                }
            }
            // Crossing the line backwards cannot complete or preserve a lap attempt.
            if (delta < 0 && previous < .125 && current > .875) {
                this._nextCheckpoint = 1; this.checkpoint = 0;
                this._legalDistance = 0; this._invalidLap = true;
            }
            this.progress = current;
        }
    }

    function rivalInput(game) {
        const p = nearestPoint(game.car.x, game.car.y, game.track);
        const target = pointAt(p.progress + 65 / game.track.length, game.track);
        return { steer: clamp(wrapAngle(Math.atan2(target.y - game.car.y, target.x - game.car.x) - game.car.angle) * 2.7, -1, 1) };
    }

    globalThis.NeonDrift = Object.freeze({ Game, TRACKS, W, H, SESSION_SECONDS, CAR_RADIUS, rivalInput, nearestPoint, pointAt, wrapAngle, clamp });
})();
