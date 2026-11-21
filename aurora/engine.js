(() => {
    'use strict';
    const { ROAD_HALF, LANES, levels, roadAt, tunnelAt } = AuroraRoutes;
    const STEP = 1 / 120;
    const LIMITS = Object.freeze({ cruise: 48, nitro: 68, brake: 18, shoulder: 27, chargeDrain: .30, passCharge: .12 });
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    const approach = (value, target, rate, dt) => value + (target - value) * (1 - Math.exp(-rate * dt));
    const smooth = v => v * v * (3 - 2 * v);
    const bodies = {
        car: { width: .92, length: 2.15 }, truck: { width: 1.26, length: 4.1 },
        barrier: { width: 1.36, length: .95 }, cell: { width: .76, length: .7 }
    };
    const carBody = { width: .90, length: 2.1 };

    function slab(a, b, range) {
        const d = b - a;
        if (Math.abs(d) < 1e-9) return Math.abs(a) <= range ? [0, 1] : [Infinity, -Infinity];
        const start = (-range - a) / d, end = (range - a) / d;
        return [Math.min(start, end), Math.max(start, end)];
    }
    function contact(px, pz, x, z, object) {
        const bounds = bodies[object.type];
        const horizontal = slab(px - object.px, x - object.x, carBody.width + bounds.width);
        const longitudinal = slab(pz - object.pz, z - object.z, carBody.length + bounds.length);
        const entry = Math.max(0, horizontal[0], longitudinal[0]);
        return entry <= Math.min(1, horizontal[1], longitudinal[1]) ? entry : Infinity;
    }
    class Game {
        constructor(id = 1) { this.reset(id); }
        reset(id = this.level?.id ?? 1) {
            this.level = levels[id - 1] ?? levels[0];
            this.mode = 'ready';
            this.x = this.distance = this.speed = this.lateral = this.time = this.score = this.passes = this.hits = 0;
            this.timeLeft = this.level.limit;
            this.nitro = .42;
            this.boosting = this.braking = this.offroad = this.inTunnel = false;
            this.recovery = this.shoulderLock = 0;
            this.objects = [];
            this.cursor = 0;
            this.events = [];
            this.spawn();
        }
        emit(type, detail = {}) {
            if (this.events.length < 100) this.events.push({ type, ...detail });
        }
        drain() { return this.events.splice(0); }
        start() {
            if (this.mode !== 'ready') return false;
            this.mode = 'running';
            this.emit('start');
            return true;
        }
        spawn() {
            const schedule = this.level.traffic;
            while (this.cursor < schedule.length && schedule[this.cursor].at <= this.distance) {
                const entry = schedule[this.cursor++], x = LANES[entry.lane];
                this.objects.push({ ...entry, px: x, pz: entry.z, x, age: 0, signal: 0, passed: false,
                    collided: false, collected: false });
            }
        }
        moveObject(object, dt) {
            object.px = object.x;
            object.pz = object.z;
            object.age += dt;
            object.z += object.speed * dt;
            if (!object.change) return;
            const { lane, delay } = object.change;
            const change = object.age - delay;
            object.signal = change >= -1 && change < 1.25 ? Math.sign(lane - object.lane) : 0;
            object.x = LANES[object.lane] + (LANES[lane] - LANES[object.lane]) * smooth(clamp(change / 1.25, 0, 1));
        }
        hit(object = null) {
            if (this.recovery > 0) return;
            const driver = object?.type === 'car' || object?.type === 'truck';
            this.speed = Math.min(this.speed, driver ? object.speed * .76 : object ? 9 : 16);
            this.nitro = clamp(this.nitro - .09, 0, 1);
            this.recovery = .93;
            this.boosting = false;
            this.hits++;
            this.emit('hit', { kind: object?.type ?? 'rail', x: this.x, z: this.distance });
        }
        step(dt, input) {
            const previousX = this.x, previousZ = this.distance, wasBoosting = this.boosting;
            this.recovery = Math.max(0, this.recovery - dt);
            this.shoulderLock = Math.max(0, this.shoulderLock - dt);
            const steer = clamp(Number.isFinite(input.steer) ? input.steer : 0, -1, 1);
            this.braking = Boolean(input.brake);
            this.offroad = Math.abs(this.x) > ROAD_HALF - .45;
            this.boosting = Boolean(input.nitro) && this.nitro > 0 && !this.braking && !this.offroad && this.recovery < .50;
            if (this.boosting && !wasBoosting) this.emit('boost');
            const target = this.braking ? LIMITS.brake : this.offroad ? LIMITS.shoulder :
                this.boosting ? LIMITS.nitro : LIMITS.cruise;
            const rate = this.braking ? 3.2 : this.recovery > .50 ? .78 : this.boosting ? 2.3 : 1.6;
            this.speed = approach(this.speed, target, rate, dt);
            if (this.boosting) this.nitro = Math.max(0, this.nitro - dt * LIMITS.chargeDrain);
            const turn = roadAt(this.level, this.distance).curve;
            const drift = turn * this.speed ** 2 * .00105;
            this.lateral = approach(this.lateral, steer * (3.2 + this.speed * .113) - drift, this.braking ? 10 : 7, dt);
            this.x += this.lateral * dt;
            if (Math.abs(this.x) > ROAD_HALF + .44) {
                this.x = Math.sign(this.x) * (ROAD_HALF + .44);
                this.lateral = 0;
                if (!this.shoulderLock) { this.hit(); this.shoulderLock = .70; }
            }
            this.distance += this.speed * dt;
            const traveled = this.distance - previousZ;
            this.distance = Math.min(this.distance, this.level.length);
            const portion = traveled > 0 ? (this.distance - previousZ) / traveled : 1;
            this.time = Math.min(this.level.limit, this.time + dt * portion);
            this.timeLeft = Math.max(0, this.level.limit - this.time);
            const inTunnel = tunnelAt(this.level, this.distance);
            if (inTunnel !== this.inTunnel) {
                this.inTunnel = inTunnel;
                if (inTunnel) this.emit('tunnel');
            }
            for (const object of this.objects) this.moveObject(object, dt * portion);
            this.interact(previousX, previousZ);
            this.objects = this.objects.filter(object => !object.collected && object.z >= this.distance - 20);
            this.spawn();
            if (this.distance >= this.level.length) {
                this.mode = 'won';
                this.boosting = false;
                this.score += 500 + Math.floor(this.timeLeft * 18);
                this.emit('won');
            } else if (this.timeLeft <= 1e-9) {
                this.mode = 'lost';
                this.boosting = false;
                this.emit('lost');
            }
        }
        interact(previousX, previousZ) {
            for (const object of this.objects) {
                const dx = this.x - object.x, dz = this.distance - object.z;
                const near = Math.abs(dz) <= 9 || Math.abs(previousZ - object.pz) <= 9;
                if (!near) continue;
                if (!object.collided && contact(previousX, previousZ, this.x, this.distance, object) !== Infinity) {
                    if (object.type === 'cell') {
                        object.collected = true;
                        this.nitro = Math.min(1, this.nitro + .27);
                        this.score += 80;
                        this.emit('cell');
                    } else {
                        object.collided = true;
                        if (!this.recovery) this.hit(object);
                    }
                }
                const clearDistance = carBody.length + bodies[object.type].length;
                if ((object.type === 'car' || object.type === 'truck') && !object.passed && !object.collided &&
                    previousZ - object.pz < clearDistance && dz >= clearDistance) {
                    object.passed = true;
                    const close = Math.abs(dx) < 3.25;
                    this.passes++;
                    this.score += close ? 160 : 100;
                    this.nitro = Math.min(1, this.nitro + LIMITS.passCharge + (close ? .045 : 0));
                    this.emit('pass', { close });
                }
            }
        }
        update(dt, input = {}) {
            if (this.mode !== 'running' || !Number.isFinite(dt) || dt <= 0) return;
            let pending = Math.min(dt, .05);
            while (pending > 1e-8 && this.mode === 'running') {
                const slice = Math.min(STEP, pending, this.timeLeft);
                if (slice <= 1e-9) { this.mode = 'lost'; this.boosting = false; this.emit('lost'); break; }
                this.step(slice, input);
                pending -= slice;
            }
        }
    }
    globalThis.AuroraSprint = Object.freeze({ Game, STEP, LIMITS, bodies, contact });
})();
