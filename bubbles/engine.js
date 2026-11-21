(() => {
    'use strict';
    const { levels, colors, tools } = LightbubbleLevels;
    const W = 404, H = 565, R = 18, D = R * 2, ROW = R * Math.sqrt(3);
    const LEFT = 22, RIGHT = W - LEFT, TOP = 55, LINE = 442;
    const ORIGIN = Object.freeze({ x: W / 2, y: 499 });
    const MAX_ANGLE = 75 * Math.PI / 180;
    const MAX_ROWS = 14, MAX_BOUNCES = 6;
    const EPS = 0.00001;
    const names = Object.keys(colors);
    const key = (r, c) => r * 11 + c;
    const inGrid = (r, c) => r >= 0 && r < MAX_ROWS && c >= 0 && c < 11 - r % 2;
    const clampAngle = radians => Math.min(MAX_ANGLE, Math.max(-MAX_ANGLE, radians));
    const aimAt = (x, y) => clampAngle(Math.atan2(x - ORIGIN.x, Math.max(1, ORIGIN.y - y)));
    const position = (r, c, descent = 0) => ({
        x: LEFT + D * (c + (r % 2) / 2), y: TOP + (r + descent) * ROW
    });
    function neighbors(r, c) {
        const offset = r % 2;
        return [[r, c - 1], [r, c + 1], [r - 1, c - 1 + offset], [r - 1, c + offset],
            [r + 1, c - 1 + offset], [r + 1, c + offset]].filter(([row, col]) => inGrid(row, col));
    }
    function rayCircle(x, y, vx, vy, center, r) {
        const dx = center.x - x, dy = center.y - y;
        const axial = dx * vx + dy * vy;
        const disc = axial * axial - (dx * dx + dy * dy - r * r);
        if (disc < 0 || axial + Math.sqrt(disc) < EPS) return Infinity;
        return Math.max(0, axial - Math.sqrt(disc));
    }
    function nearestCell(board, hit, x, y, descent) {
        const candidates = hit ? neighbors(hit.r, hit.c) :
            Array.from({ length: 11 }, (_, col) => [0, col]);
        let picked = null, best = Infinity;
        for (const [r, c] of candidates) {
            if (board.has(key(r, c))) continue;
            const point = position(r, c, descent);
            const d = (x - point.x) ** 2 + (y - point.y) ** 2;
            if (d < best) { picked = { r, c, ...point }; best = d; }
        }
        return best <= (D * 1.18) ** 2 ? picked : null;
    }
    function trace(board, descent, angle, kind = 'normal') {
        const a = clampAngle(Number.isFinite(angle) ? angle : 0);
        let { x, y } = ORIGIN;
        let vx = Math.sin(a), vy = -Math.cos(a), bounces = 0;
        const points = [{ x, y, distance: 0 }], pierced = [];
        const cells = [...board].map(([id, bubble]) => ({ id, bubble, ...position(bubble.r, bubble.c, descent) }));
        const ceiling = TOP + descent * ROW;
        let hit = null, distance = 0;
        for (let segments = 0; segments < MAX_BOUNCES + 5; segments++) {
            const wall = vx > EPS ? (RIGHT - x) / vx : vx < -EPS ? (LEFT - x) / vx : Infinity;
            const roof = (ceiling - y) / vy;
            let time = Math.min(wall, roof);
            let next = null;
            for (const cell of cells) {
                if (pierced.includes(cell.id)) continue;
                const contact = rayCircle(x, y, vx, vy, cell, D);
                if (contact < time - EPS) { next = cell; time = contact; }
            }
            x += vx * time;
            y += vy * time;
            distance += time;
            if (next) {
                if (kind === 'drill' && pierced.length < 3) {
                    pierced.push(next.id);
                    points.push({ x, y, distance, pierce: true });
                    continue;
                }
                hit = next.bubble;
                points.push({ x, y, distance });
                break;
            }
            if (wall < roof && bounces < MAX_BOUNCES) {
                bounces++;
                vx *= -1;
                points.push({ x, y, distance, bounce: true });
                continue;
            }
            points.push({ x, y, distance });
            break;
        }
        return { points, distance, hit, pierced, cell: nearestCell(board, hit, x, y, descent), bounces };
    }
    function flood(board, roots, accepts) {
        const output = new Set(), pending = [...roots];
        while (pending.length) {
            const id = pending.pop(), bubble = board.get(id);
            if (output.has(id) || !bubble || !accepts(bubble)) continue;
            output.add(id);
            for (const [r, c] of neighbors(bubble.r, bubble.c)) pending.push(key(r, c));
        }
        return output;
    }
    function colorAt(board, cell, fallback) {
        const candidates = new Map();
        for (const [r, c] of neighbors(cell.r, cell.c)) {
            const id = key(r, c), value = board.get(id)?.type;
            if (!colors[value] || candidates.has(value)) continue;
            const roots = neighbors(cell.r, cell.c).map(([row, col]) => key(row, col));
            candidates.set(value, flood(board, [id, ...roots], bubble => bubble.type === value).size);
        }
        return [...candidates].sort((a, b) => b[1] - a[1])[0]?.[0] ?? fallback;
    }
    function pointAt(path, travel) {
        for (let i = 1; i < path.points.length; i++) {
            const b = path.points[i];
            if (travel > b.distance) continue;
            const a = path.points[i - 1], f = (travel - a.distance) / Math.max(EPS, b.distance - a.distance);
            return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
        }
        return path.points.at(-1);
    }
    class Game {
        constructor(level = 1) {
            this.level = levels[level - 1] ?? levels[0];
            this.board = new Map();
            this.level.rows.forEach((row, r) => [...row].forEach((type, c) => {
                if (inGrid(r, c) && (colors[type] || type === 'L' || type === 'X')) {
                    this.board.set(key(r, c), { r, c, type, hp: type === 'X' ? 2 : 1 });
                }
            }));
            this.inventory = { ...this.level.kit };
            this.selected = null;
            this.score = this.shots = this.misses = this.descent = this.chain = this.bestChain = this.rescued = this.unlocked = 0;
            this.stockIndex = 0;
            this.events = [];
            this.projectile = null;
            this.mode = 'ready';
            this.current = this.pick();
            this.next = this.pick();
        }
        clone() {
            const copy = Object.assign(Object.create(Game.prototype), this);
            copy.board = new Map([...this.board].map(([id, value]) => [id, { ...value }]));
            copy.inventory = { ...this.inventory };
            copy.events = [];
            return copy;
        }
        count(type) { return [...this.board.values()].filter(bubble => bubble.type === type).length; }
        get remaining() {
            if (this.level.goal === 'rescue') return this.count('L');
            if (this.level.goal === 'unlock') return this.count('X');
            return this.board.size;
        }
        pick() {
            const active = new Set([...this.board.values()].map(bubble => bubble.type).filter(color => colors[color]));
            const order = this.level.order;
            for (let i = 0; i < order.length; i++) {
                const value = order[this.stockIndex++ % order.length];
                if (!active.size || active.has(value)) return value;
            }
            return [...active][0] ?? names[0];
        }
        get loaded() { return this.selected ?? this.current; }
        swap() {
            if (this.mode !== 'ready' || this.selected) return false;
            [this.current, this.next] = [this.next, this.current];
            return true;
        }
        select(kind) {
            if (!tools[kind] || this.mode !== 'ready' || !this.inventory[kind]) return false;
            this.selected = this.selected === kind ? null : kind;
            return true;
        }
        preview(angle) { return trace(this.board, this.descent, angle, this.selected ?? 'normal'); }
        shoot(angle) {
            if (this.mode !== 'ready' || !Number.isFinite(angle)) return false;
            const type = this.loaded;
            const path = this.preview(angle);
            if (this.selected) this.inventory[this.selected]--;
            this.selected = null;
            this.mode = 'flight';
            this.shots++;
            this.projectile = { type, path, traveled: 0, ...ORIGIN };
            this.events.push({ type: 'launch' });
            return true;
        }
        update(dt) {
            if (!this.projectile || !Number.isFinite(dt) || dt <= 0) return;
            const shot = this.projectile, distance = shot.traveled + 850 * Math.min(.05, dt);
            for (const node of shot.path.points) {
                if (node.bounce && node.distance > shot.traveled && node.distance <= distance) {
                    this.events.push({ type: 'bounce', x: node.x, y: node.y });
                }
            }
            shot.traveled = distance;
            Object.assign(shot, pointAt(shot.path, distance));
            if (distance >= shot.path.distance) this.settle();
        }
        settle() {
            const shot = this.projectile;
            if (!shot) return;
            this.projectile = null;
            const { path, type } = shot;
            const placed = path.cell, impact = path.points.at(-1);
            const removed = new Set(), damaged = new Set();
            const erupt = type === 'pulse' || type === 'drill';
            if (!placed && !erupt) {
                this.mode = 'lost';
                this.events.push({ type: 'lost' });
                return;
            }
            if (erupt) {
                const hit = path.hit;
                const anchor = type === 'pulse' ? (hit ?? placed) : hit;
                const direct = [...path.pierced];
                if (anchor) {
                    direct.push(key(anchor.r, anchor.c));
                    if (type === 'pulse') {
                        for (const [r, c] of neighbors(anchor.r, anchor.c)) direct.push(key(r, c));
                    }
                }
                for (const id of direct) {
                    const item = this.board.get(id);
                    if (item?.type === 'X') damaged.add(id);
                    else if (item) removed.add(id);
                }
                this.events.push({ type: type, x: impact.x, y: impact.y });
            } else {
                const id = key(placed.r, placed.c);
                const actual = type === 'rainbow' ? colorAt(this.board, placed, this.current) : type;
                this.board.set(id, { r: placed.r, c: placed.c, type: actual, hp: 1 });
                const group = flood(this.board, [id], bubble => bubble.type === actual);
                if (group.size >= 3) for (const member of group) removed.add(member);
                this.events.push({ type: 'attach', ...placed });
            }
            for (const id of removed) {
                const item = this.board.get(id);
                for (const [r, c] of neighbors(item.r, item.c)) {
                    const adjacent = key(r, c);
                    if (this.board.get(adjacent)?.type === 'X') damaged.add(adjacent);
                }
            }
            for (const id of damaged) {
                const crystal = this.board.get(id);
                crystal.hp--;
                if (!crystal.hp) removed.add(id);
            }
            if (removed.size || damaged.size) {
                this.chain++;
                this.bestChain = Math.max(this.bestChain, this.chain);
                this.remove(removed, 'pop', 100);
                const ceiling = [...this.board].filter(([, item]) => item.r === 0).map(([id]) => id);
                const rooted = flood(this.board, ceiling, () => true);
                this.remove([...this.board.keys()].filter(id => !rooted.has(id)), 'drop', 180);
                if (damaged.size) this.events.push({ type: 'crack', x: impact.x, y: impact.y });
            } else {
                this.chain = 0;
                this.misses++;
                if (this.misses >= this.level.missLimit) {
                    this.descent++;
                    this.misses = 0;
                    this.events.push({ type: 'descend' });
                }
            }
            if (!this.remaining) {
                this.mode = 'won';
                this.events.push({ type: 'won' });
                return;
            }
            if ([...this.board.values()].some(b => position(b.r, b.c, this.descent).y + R >= LINE)) {
                this.mode = 'lost';
                this.events.push({ type: 'lost' });
                return;
            }
            const present = new Set([...this.board.values()].map(item => item.type).filter(color => colors[color]));
            if (!tools[type]) {
                this.current = this.next;
                this.next = this.pick();
            }
            if (present.size && !present.has(this.current)) this.current = this.pick();
            if (present.size && !present.has(this.next)) this.next = this.pick();
            this.mode = 'ready';
        }
        remove(ids, effect, base) {
            const bubbles = [];
            for (const id of ids) {
                const bubble = this.board.get(id);
                if (!bubble) continue;
                this.board.delete(id);
                this.score += base + Math.min(this.chain - 1, 5) * 20;
                if (bubble.type === 'L') { this.rescued++; this.score += 250; }
                if (bubble.type === 'X') { this.unlocked++; this.score += 150; }
                bubbles.push({ ...bubble, ...position(bubble.r, bubble.c, this.descent) });
            }
            if (bubbles.length) this.events.push({ type: effect, bubbles, combo: this.chain });
        }
        drain() { return this.events.splice(0); }
    }
    globalThis.Lightbubble = Object.freeze({ W, H, R, ROW, ORIGIN, LINE, LEFT, RIGHT, TOP, MAX_ANGLE, key, position, neighbors, trace, aimAt, Game });
})();
