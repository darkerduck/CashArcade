import { LEVELS, DIRECTIONS, POWERS, key, equal, add, distance } from './levels.mjs';
export { LEVELS, DIRECTIONS, POWERS, key, equal, add, distance };
const clone = value => JSON.parse(JSON.stringify(value));
const vectors = Object.values(DIRECTIONS);
const CELL_FIELDS = ['x', 'y', 'z'];
export const STATES = ['ready', 'running', 'paused', 'failed', 'level-clear', 'won'];

export class SnakeGame {
    constructor(levelIndex = 0, score = 0) {
        if (!LEVELS[levelIndex]) throw new Error('Unknown level');
        this.levelIndex = levelIndex; this.level = LEVELS[levelIndex];
        this.walls = new Set(this.level.walls.map(key));
        this.state = 'ready'; this.score = score; this.startScore = score; this.seed = this.level.seed;
        this.snake = [3, 2, 1, 0].map(x => ({ x, y: 0, z: 1 }));
        this.previous = clone(this.snake); this.direction = clone(DIRECTIONS.right); this.queue = [];
        this.growth = 0; this.collected = 0; this.time = 0; this.moveElapsed = 0; this.remainder = 0;
        this.dessertCycle = 0; this.bombCycle = 0; this.powerCycle = -1;
        this.food = { x: 6, y: 0, z: 1 }; this.dessert = null; this.power = null; this.bombs = [];
        this.bombsRetired = false; this.effects = { shield: false, slow: 0, magnet: 0, emp: 0, immune: 0 };
        this.gates = this.level.gates.map(() => ({ active: false, warning: false }));
        this.events = []; this.revision = 0; this.steps = 0; this.reason = '';
        for (let i = 0; i < this.level.bombs; i++) { const p = this.place(this.safeExclusion(this.peek())); if (p) this.bombs.push(p); }
    }
    inside(p) { return p.x >= 0 && p.x < this.level.width && p.y >= 0 && p.y < this.level.height && p.z >= 0 && p.z < this.level.depth; }
    emit(type, data = {}) { this.events.push({ type, ...data }); this.revision++; }
    drain() { return this.events.splice(0); }
    random() { this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0; return this.seed / 4294967296; }
    start() { if (this.state === 'ready' || this.state === 'paused') { this.state = 'running'; this.revision++; } }
    pause() { if (this.state === 'running') { this.state = 'paused'; this.queue = []; this.revision++; } }
    delay() { return this.level.delay / (this.effects.slow > this.time ? .65 : 1); }
    input(name) {
        if (!['ready', 'running', 'paused'].includes(this.state) || !DIRECTIONS[name] || this.queue.length >= 2) return false;
        const d = DIRECTIONS[name], last = this.queue.at(-1) || this.direction;
        if (equal(d, last) || (d.x === -last.x && d.y === -last.y && d.z === -last.z)) return false;
        this.queue.push(clone(d)); return true;
    }
    portal(p) {
        for (const pair of this.level.portals) {
            if (equal(p, pair.a)) return pair.b;
            if (equal(p, pair.b)) return pair.a;
        }
        return null;
    }
    peek() { const p = add(this.snake[0], this.queue[0] || this.direction); return clone(this.portal(p) || p); }
    gateAt(p) { return this.level.gates.findIndex(g => g.cells.some(c => equal(c, p))); }
    hazard(p) { const i = this.gateAt(p); return i !== -1 && this.gates[i].active && this.effects.emp <= this.time; }
    occupied() {
        return new Set([...this.snake, ...this.bombs, this.food, this.dessert, this.power,
            this.level.exit, ...this.level.portals.flatMap(p => [p.a, p.b]), ...this.level.gates.flatMap(g => g.cells)]
            .filter(Boolean).map(key));
    }
    reachable() {
        const reached = new Set([key(this.snake[0])]), queue = [this.snake[0]];
        const blocked = new Set([...this.walls, ...this.bombs.map(key)]);
        for (let i = 0; i < queue.length; i++) for (const d of vectors) {
            const next = add(queue[i], d), target = this.portal(next) || next, k = key(target);
            if (this.inside(target) && !blocked.has(k) && !reached.has(k)) { reached.add(k); queue.push(target); }
        }
        return reached;
    }
    place(excluded = [], preferredY = null) {
        const occupied = this.occupied(), forbidden = new Set(excluded.map(key)), reachable = this.reachable(), free = [];
        const { width, depth, height } = this.level;
        for (let y = 0; y < height; y++) for (let z = 0; z < depth; z++) for (let x = 0; x < width; x++) {
            const p = { x, y, z }, k = key(p);
            if (!this.walls.has(k) && !occupied.has(k) && !forbidden.has(k) && reachable.has(k)) free.push(p);
        }
        const preferred = preferredY === null ? [] : free.filter(p => p.y === preferredY);
        const candidates = preferred.length ? preferred : free;
        return candidates.length ? clone(candidates[Math.floor(this.random() * candidates.length)]) : null;
    }
    safeExclusion(next) { return [next, ...vectors.map(d => add(next, d))]; }
    updateTimers() {
        if (this.levelIndex >= 1 && this.collected < this.level.quota) {
            const cycle = Math.floor(this.time / 20000);
            if (cycle > this.dessertCycle) {
                this.dessertCycle = cycle; this.dessert = null;
                if (this.time % 20000 < 10000) this.dessert = this.place();
                this.emit('dessert-spawn', { at: this.dessert });
            }
        }
        if (this.dessert && this.time % 20000 >= 10000) { this.dessert = null; this.revision++; }
        const cycle = Math.floor(this.time / 30000);
        if (cycle > this.bombCycle) {
            this.bombCycle = cycle;
            // Even a delayed timer performs at most one relocation per update.
            this.bombs.forEach((old, i) => { this.bombs[i] = this.place([old, ...this.safeExclusion(this.peek())]) || old; });
            this.emit('bomb-shift');
        }
        if (this.power && this.time >= this.power.expires) { this.power = null; this.revision++; }
        const powerCycle = Math.floor((this.time - 5000) / 20000);
        if (this.level.powers.length && powerCycle >= 0 && powerCycle > this.powerCycle) {
            this.powerCycle = powerCycle;
            if (!this.power && this.time < 5000 + powerCycle * 20000 + 10000) {
                const at = this.place();
                const kind = powerCycle === 0 && this.level.newPower ? this.level.newPower : this.level.powers[powerCycle % this.level.powers.length];
                if (at) { this.power = { ...at, kind, expires: 5000 + powerCycle * 20000 + 10000 }; this.emit('power-spawn', { at, kind }); }
            }
        }
        this.level.gates.forEach((gate, i) => {
            const phase = (this.time + gate.offset) % 6000, state = this.gates[i];
            const wanted = phase >= 4000 && this.effects.emp <= this.time;
            const occupied = gate.cells.some(p => this.snake.some(s => equal(s, p)));
            const active = wanted && (state.active || !occupied);
            const warning = this.effects.emp <= this.time && (phase >= 3000 && phase < 4000 || wanted && !active);
            if (warning && !state.warning) this.emit('gate-warning', { at: gate.cells[0] });
            if (active !== state.active) this.revision++;
            state.active = active; state.warning = warning;
        });
    }
    advance(milliseconds) {
        if (this.state !== 'running' || !Number.isFinite(milliseconds) || milliseconds <= 0) return;
        this.remainder += milliseconds;
        while (this.remainder >= 10 && this.state === 'running') {
            this.remainder -= 10; this.time += 10; this.moveElapsed += 10;
            this.updateTimers();
            if (this.moveElapsed + .00001 >= this.delay()) { this.moveElapsed = Math.max(0, this.moveElapsed - this.delay()); this.move(); }
        }
        if (this.state !== 'running') this.remainder = 0;
    }
    fail(reason, at) { this.state = 'failed'; this.reason = reason; this.queue = []; this.emit('lose', { reason, at }); }
    eat(kind, at, magnetic = false) {
        const amount = kind === 'dessert' ? 2 : 1;
        this.score += amount * 10; this.collected += amount; this.growth += amount;
        if (kind === 'dessert') this.dessert = null; else this.food = null;
        this.emit('eat', { kind, at: clone(at), magnetic, amount });
        if (this.collected >= this.level.quota && this.collected - amount < this.level.quota) this.emit('exit-open', { at: this.level.exit });
    }
    collectPower(kind, at) {
        const targets = this.bombs.map(p => clone(p));
        if (kind === 'shield') this.effects.shield = true;
        if (kind === 'slow') this.effects.slow = this.time + 8000;
        if (kind === 'magnet') this.effects.magnet = this.time + 10000;
        if (kind === 'shrink') { this.snake.splice(Math.max(4, this.snake.length - 4)); this.previous = this.previous.slice(0, this.snake.length); }
        if (kind === 'emp') { this.bombs = []; this.bombsRetired = true; this.effects.emp = this.time + 8000; this.gates.forEach(g => { g.active = false; g.warning = false; }); }
        this.emit('power', { kind, at: clone(at), targets });
    }
    move() {
        if (this.state !== 'running') return;
        if (this.queue.length) this.direction = this.queue.shift();
        const entry = add(this.snake[0], this.direction), portal = this.portal(entry), next = clone(portal || entry);
        if (!this.inside(next) || this.walls.has(key(next))) { this.fail('wall', next); return; }
        const directFood = equal(next, this.food) ? 'food' : equal(next, this.dessert) ? 'dessert' : null;
        const growing = this.growth > 0 || !!directFood;
        if (this.snake.slice(0, growing ? this.snake.length : -1).some(p => equal(p, next))) { this.fail('self', next); return; }
        const bomb = this.bombs.findIndex(p => equal(p, next)), laser = this.hazard(next);
        if (bomb !== -1 || laser) {
            if (!this.effects.shield && this.effects.immune <= this.time) { this.fail(bomb !== -1 ? 'bomb' : 'laser', next); return; }
            if (this.effects.immune <= this.time) { this.effects.shield = false; this.effects.immune = this.time + 1000; this.emit('shield-hit', { at: next }); }
            if (bomb !== -1) this.bombs.splice(bomb, 1);
        }
        this.previous = clone(this.snake);
        this.snake.unshift(next);
        if (directFood) this.eat(directFood, next);
        if (this.growth > 0) this.growth--; else this.snake.pop();
        if (portal) this.emit('portal', { at: entry, target: next });
        if (equal(next, this.power)) { const p = this.power; this.power = null; this.collectPower(p.kind, p); }
        if (this.food && this.effects.magnet > this.time && this.food.y === next.y && distance(this.food, next) <= 2 && (this.food.x === next.x || this.food.z === next.z)) {
            const middle = { x: (this.food.x + next.x) / 2, y: next.y, z: (this.food.z + next.z) / 2 };
            const blocked = distance(this.food, next) === 2 && (this.walls.has(key(middle)) || this.snake.some(p => equal(p, middle)) || this.bombs.some(p => equal(p, middle)) || this.hazard(middle));
            if (!blocked) this.eat('food', this.food, true);
        }
        if (!this.food && this.collected < this.level.quota) {
            this.food = this.place([], this.collected % this.level.height);
            if (!this.food) { this.bombs = []; this.bombsRetired = true; this.dessert = null; this.power = null; this.food = this.place(); }
            // A full volume opens the exit; it never bypasses the exit or final victory.
            if (!this.food) { this.collected = this.level.quota; this.emit('exit-open', { at: this.level.exit }); }
        }
        if (this.collected >= this.level.quota && equal(next, this.level.exit)) {
            this.state = this.levelIndex === LEVELS.length - 1 ? 'won' : 'level-clear'; this.emit(this.state, { at: next });
        }
        this.steps++; this.revision++;
    }
    danger() {
        const next = this.peek();
        if (!this.inside(next) || this.walls.has(key(next))) return '前方是實體牆面';
        if (this.snake.slice(0, this.growth > 0 || equal(next, this.food) || equal(next, this.dessert) ? this.snake.length : -1).some(p => equal(p, next))) return '前方是自己的身體';
        if (this.bombs.some(p => equal(p, next))) return '前方有炸彈';
        if (this.hazard(next)) return '前方雷射啟動中';
        const two = add(next, this.queue[0] || this.direction);
        return !this.inside(two) || this.walls.has(key(two)) ? '兩格內接近牆面' : '';
    }
    snapshot() {
        return clone(Object.fromEntries(['levelIndex', 'state', 'score', 'startScore', 'seed', 'snake', 'previous', 'direction', 'queue',
            'growth', 'collected', 'time', 'moveElapsed', 'remainder', 'dessertCycle', 'bombCycle', 'powerCycle', 'food', 'dessert', 'power',
            'bombs', 'bombsRetired', 'effects', 'gates', 'steps', 'reason'].map(k => [k, this[k]])));
    }
    static valid(s) {
        if (!s || !Number.isInteger(s.levelIndex) || !LEVELS[s.levelIndex] || !STATES.includes(s.state)) return false;
        const l = LEVELS[s.levelIndex];
        const cell = p => p && CELL_FIELDS.every(k => Number.isInteger(p[k])) && p.x >= 0 && p.x < l.width && p.y >= 0 && p.y < l.height && p.z >= 0 && p.z < l.depth;
        const dir = d => d && vectors.some(v => equal(v, d));
        const nonnegative = ['score', 'startScore', 'seed', 'growth', 'collected', 'time', 'moveElapsed', 'remainder', 'dessertCycle', 'bombCycle', 'steps'];
        if (!nonnegative.every(k => Number.isFinite(s[k]) && s[k] >= 0) || s.startScore > s.score || s.seed > 0xffffffff || s.growth > 10 || s.remainder >= 10 || s.moveElapsed > 1000) return false;
        if (!Array.isArray(s.snake) || s.snake.length < 4 || s.snake.length > l.width * l.depth * l.height || !s.snake.every(cell) || new Set(s.snake.map(key)).size !== s.snake.length) return false;
        if (!Array.isArray(s.previous) || !s.previous.every(cell) || s.previous.length > s.snake.length + 4 || !dir(s.direction) || !Array.isArray(s.queue) || s.queue.length > 2 || !s.queue.every(dir)) return false;
        if (![s.food, s.dessert, s.power].every(p => p === null || cell(p)) || !Array.isArray(s.bombs) || s.bombs.length > l.bombs || !s.bombs.every(cell)) return false;
        if (s.power && (!POWERS[s.power.kind] || !Number.isFinite(s.power.expires))) return false;
        if (!s.effects || typeof s.effects.shield !== 'boolean' || !['slow', 'magnet', 'emp', 'immune'].every(k => Number.isFinite(s.effects[k]) && s.effects[k] >= 0)) return false;
        if (!Array.isArray(s.gates) || s.gates.length !== l.gates.length || !s.gates.every(g => typeof g.active === 'boolean' && typeof g.warning === 'boolean')) return false;
        return Number.isInteger(s.powerCycle) && s.powerCycle >= -1 && typeof s.bombsRetired === 'boolean' && typeof s.reason === 'string';
    }
    static restore(snapshot) {
        if (!SnakeGame.valid(snapshot)) throw new Error('Invalid campaign checkpoint');
        const game = new SnakeGame(snapshot.levelIndex, snapshot.startScore);
        Object.assign(game, clone(snapshot)); game.events = []; game.revision = 0;
        if (game.state === 'running') game.state = 'paused';
        return game;
    }
}
