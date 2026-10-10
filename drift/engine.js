(() => {
    'use strict';

    const W = 1000, H = 760, SESSION_SECONDS = 90;
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
        constructor(index = 0) {
            this.trackIndex = Number.isInteger(index) ? clamp(index, 0, TRACKS.length - 1) : 0;
            this.track = TRACKS[this.trackIndex];
            this._reset();
        }

        _reset() {
            const start = this.track.start;
            this.car = { x: start.x, y: start.y, angle: start.angle, vx: 0, vy: 0, speed: 0 };
            this.state = 'ready'; this.time = 0; this.timeLeft = SESSION_SECONDS;
            this.score = 0; this.laps = 0; this.bestLap = null; this.lapTime = 0;
            this.boost = 0; this.charge = 0; this.combo = 0; this.maxCombo = 0;
            this.drifting = false; this.offroad = false; this.events = [];
            this.progress = 0; this.checkpoint = 0;
            this._score = 0; this._holdingDrift = false; this._driftTime = 0; this._comboHold = 0;
            this._lapStarted = 0; this._nextCheckpoint = 1; this._legalDistance = 0;
            this._lastX = start.x; this._lastY = start.y; this._invalidLap = false;
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
            const steps = Math.ceil(duration / (1 / 120)), step = duration / steps;
            input = input && typeof input === 'object' ? input : {};
            const steer = finite(input.steer) ? clamp(input.steer, -1, 1) : 0;
            const handbrake = input.drift === true;
            for (let i = 0; i < steps && this.state === 'running'; i++) this._step(step, steer, handbrake);
            return this;
        }

        _step(dt, steer, handbrake) {
            const car = this.car, track = this.track;
            // Detect external relocations as well as discontinuous route projections.
            // Re-entering at the start line can begin a fresh legitimate lap.
            if (Math.hypot(car.x - this._lastX, car.y - this._lastY) > 1) this._invalidLap = true;
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
            const targetSpeed = this.offroad ? 82 : boosted ? 345 : handbrake ? 168 : 215;
            const acceleration = targetSpeed > car.speed ? (boosted ? 4.4 : 2.8) : 5;
            car.speed += (targetSpeed - car.speed) * (1 - Math.exp(-acceleration * dt));
            const turnRate = handbrake ? 3.4 : 3.1;
            car.angle = wrapAngle(car.angle + steer * turnRate * (.35 + .65 * Math.min(car.speed / 210, 1.25)) * dt);
            const grip = this.offroad ? 5.5 : handbrake ? 4.5 : 10;
            const alignment = 1 - Math.exp(-grip * dt);
            car.vx += (Math.cos(car.angle) * car.speed - car.vx) * alignment;
            car.vy += (Math.sin(car.angle) * car.speed - car.vy) * alignment;
            const oldX = car.x, oldY = car.y;
            car.x += car.vx * dt; car.y += car.vy * dt;
            const x = clamp(car.x, 12, W - 12), y = clamp(car.y, 12, H - 12);
            if (x !== car.x || y !== car.y) {
                if (x !== car.x) car.vx = 0;
                if (y !== car.y) car.vy = 0;
                car.x = x; car.y = y; car.speed *= .985;
                this.charge = 0; this.boost = 0;
            }
            if (boosted) this.boost = Math.max(0, this.boost - dt / 1.65);

            const projection = nearestPoint(car.x, car.y, track);
            this.offroad = projection.distance > track.width / 2;
            if (this.offroad && !wasOffroad) this.emit('offroad');
            this.time = Math.min(SESSION_SECONDS, this.time + dt);
            this.timeLeft = Math.max(0, SESSION_SECONDS - this.time);
            this.lapTime = this.time - this._lapStarted;
            this._advanceLap(projection, Math.hypot(car.x - oldX, car.y - oldY));
            this._lastX = car.x; this._lastY = car.y;
            if (this.timeLeft <= 1e-8) {
                this.time = SESSION_SECONDS; this.timeLeft = 0; this.state = 'finished';
                this.drifting = false; this.emit('finish', { score: this.score, laps: this.laps, bestLap: this.bestLap });
            }
        }

        _advanceLap(projection, movement) {
            const previous = this.progress, current = projection.progress;
            let delta = current - previous;
            if (delta > .5) delta -= 1;
            if (delta < -.5) delta += 1;
            // At the inside edge of a hairpin, a nearest-point projection can
            // legitimately jump across the bend while the entire car stays on road.
            const plausible = Math.abs(delta) < .08
                && Math.abs(delta * this.track.length) <= Math.max(this.track.width * .8, movement * 3);
            const onroad = !this.offroad;
            if (!plausible) this._invalidLap = true;
            if (plausible && onroad) this._legalDistance = Math.max(0, this._legalDistance + delta * this.track.length);

            if (plausible && delta > 0 && onroad) {
                const gate = this._nextCheckpoint / 8;
                const end = previous + delta;
                if (this._nextCheckpoint < 8 && previous < gate && end >= gate) {
                    this.checkpoint = this._nextCheckpoint++;
                    this.emit('checkpoint', { checkpoint: this.checkpoint });
                }
                if (previous > .875 && current < .125) {
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
                    this._legalDistance = current * this.track.length; this._invalidLap = false;
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

    globalThis.NeonDrift = Object.freeze({ Game, TRACKS, W, H, SESSION_SECONDS, nearestPoint, pointAt, wrapAngle, clamp });
})();
