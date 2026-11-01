(() => {
'use strict';
const WIDTH = 8, HEIGHT = 14, LOCK_DELAY = .45, MAX_LOCK_RESETS = 8;
const DIRS = [[0,-1,1,4],[1,0,2,8],[0,1,4,1],[-1,0,8,2]];
const SHAPES = [[6,12],[3,9],[5,5],[10,10],[3,12],[6,9],[3,6]];
const rotateMask = (mask, dir = 1) => dir === 1 ? ((mask << 1) & 15) | (mask >> 3) : ((mask >> 1) | (mask << 3)) & 15;
function closedCircuits(board) {
    const seen = new Set(), closed = [];
    for (let y = 0; y < HEIGHT; y++) for (let x = 0; x < WIDTH; x++) {
        const key = y * WIDTH + x;
        if (!board[y][x] || seen.has(key)) continue;
        const component = [], queue = [[x,y]];
        let sealed = true;
        seen.add(key);
        while (queue.length) {
            const [cx,cy] = queue.pop(), mask = board[cy][cx];
            component.push([cx,cy]);
            for (const [dx,dy,port,opposite] of DIRS) {
                if (!(mask & port)) continue;
                const nx = cx + dx, ny = cy + dy;
                if (nx < 0 || nx >= WIDTH || ny < 0 || ny >= HEIGHT || !(board[ny][nx] & opposite)) { sealed = false; continue; }
                const k = ny * WIDTH + nx;
                if (!seen.has(k)) { seen.add(k); queue.push([nx,ny]); }
            }
        }
        if (sealed && component.length >= 4) closed.push(component);
    }
    return closed;
}
class Game {
    constructor(seed = 12345) {
        this.seed = seed >>> 0 || 12345;
        this.state = 'ready';
        this.board = Array.from({length:HEIGHT}, () => Array(WIDTH).fill(0));
        this.score = 0; this.loops = 0; this.tiles = 0; this.level = 1; this.bestChain = 0; this.chain = 0;
        this.clock = 0; this.lockTime = 0; this.lockResets = 0; this.clearTime = 0; this.time = 0;
        this.events = []; this.bag = []; this.next = []; this.hold = null; this.usedHold = false; this.piece = null; this.clearing = [];
    }
    random() { this.seed = (Math.imul(this.seed,1664525) + 1013904223) >>> 0; return this.seed / 4294967296; }
    draw() {
        if (!this.bag.length) {
            this.bag = SHAPES.map(shape => shape.slice());
            for (let i = this.bag.length - 1; i > 0; i--) { const j = Math.floor(this.random() * (i + 1)); [this.bag[i],this.bag[j]] = [this.bag[j],this.bag[i]]; }
        }
        return this.bag.pop().slice();
    }
    emit(type, data = {}) { this.events.push({type,...data}); }
    drain() { return this.events.splice(0); }
    start() {
        if (this.state !== 'ready') return;
        this.state = 'running'; this.next = Array.from({length:4}, () => this.draw()); this.next[0] = [6,12];
        this.board[13][3] = 3; this.board[13][4] = 9;
        this.spawn(); this.emit('start');
    }
    spawn(masks) {
        const source = (masks || this.next.shift()).slice();
        this.piece = {x:3,y:0,source,cells:source.map((mask,i) => ({x:i,y:0,mask}))};
        if (!masks) this.next.push(this.draw());
        this.clock = 0; this.lockTime = 0; this.lockResets = 0; this.usedHold = false;
        if (!this.valid(this.piece)) { this.piece = null; this.state = 'finished'; this.emit('lose'); }
    }
    valid(piece) {
        return !!piece && piece.cells.every(cell => {
            const x = piece.x + cell.x, y = piece.y + cell.y;
            return x >= 0 && x < WIDTH && y >= 0 && y < HEIGHT && !this.board[y][x];
        });
    }
    grounded() { return !!this.piece && !this.valid({...this.piece,y:this.piece.y + 1}); }
    resetLock(wasGrounded) {
        // Only eight grounded adjustments may extend a piece's lock delay.
        if (wasGrounded && this.lockResets < MAX_LOCK_RESETS) { this.lockTime = 0; this.lockResets++; }
    }
    move(dx, dy = 0, awardDrop = true) {
        if (this.state !== 'running' || this.clearTime > 0 || !this.piece || !Number.isInteger(dx) || !Number.isInteger(dy) || Math.abs(dx) + Math.abs(dy) !== 1 || dy < 0) return false;
        const piece = {...this.piece,x:this.piece.x + dx,y:this.piece.y + dy};
        if (!this.valid(piece)) return false;
        const wasGrounded = this.grounded();
        this.piece = piece;
        if (dx) this.resetLock(wasGrounded);
        if (dy > 0 && awardDrop) this.score += dy;
        this.emit('move'); return true;
    }
    rotate(dir = 1) {
        if (this.state !== 'running' || this.clearTime > 0 || !this.piece || ![1,-1].includes(dir)) return false;
        const cells = this.piece.cells.map(cell => ({x:-dir * cell.y,y:dir * cell.x,mask:rotateMask(cell.mask,dir)}));
        const wasGrounded = this.grounded();
        for (const [dx,dy] of [[0,0],[-1,0],[1,0],[-2,0],[2,0],[0,-1],[0,1],[-1,-1],[1,-1]]) {
            const piece = {...this.piece,x:this.piece.x + dx,y:this.piece.y + dy,cells};
            if (this.valid(piece)) { this.piece = piece; this.resetLock(wasGrounded); this.emit('rotate'); return true; }
        }
        return false;
    }
    ghost() { if (!this.piece) return null; const piece = {...this.piece}; while (this.valid({...piece,y:piece.y + 1})) piece.y++; return piece; }
    drop() {
        if (this.state !== 'running' || this.clearTime > 0 || !this.piece) return false;
        const piece = this.ghost(); this.score += 2 * (piece.y - this.piece.y); this.piece = piece; this.lock(); return true;
    }
    swap() {
        if (this.state !== 'running' || this.clearTime > 0 || this.usedHold || !this.piece) return false;
        const masks = this.piece.source.slice(), old = this.hold; this.hold = masks;
        this.spawn(old); this.usedHold = true; this.emit('hold'); return true;
    }
    lock() {
        if (this.state !== 'running' || !this.piece || !this.valid(this.piece)) return;
        for (const cell of this.piece.cells) this.board[this.piece.y + cell.y][this.piece.x + cell.x] = cell.mask;
        this.piece = null; this.chain = 0; this.emit('lock'); this.resolve();
    }
    resolve() {
        if (this.clearTime > 0) return;
        const loops = closedCircuits(this.board);
        if (!loops.length) { this.spawn(); return; }
        this.chain++; this.bestChain = Math.max(this.bestChain,this.chain); this.clearing = loops.flat();
        this.loops += loops.length; this.tiles += this.clearing.length;
        this.score += this.clearing.length * this.clearing.length * 25 * this.chain;
        this.level = 1 + Math.floor(this.loops / 4); this.clearTime = .5;
        this.emit('clear',{chain:this.chain,count:this.clearing.length});
    }
    collapse() {
        if (!this.clearing.length) return;
        for (const [x,y] of this.clearing) this.board[y][x] = 0;
        for (let x = 0; x < WIDTH; x++) {
            const col = this.board.map(row => row[x]).filter(Boolean);
            for (let y = HEIGHT - 1; y >= 0; y--) this.board[y][x] = col.pop() || 0;
        }
        this.clearing = []; this.clearTime = 0; this.resolve();
    }
    pause() { if (this.state === 'running') { this.state = 'paused'; this.emit('pause'); } }
    resume() { if (this.state === 'paused') this.state = 'running'; }
    update(dt, soft = false) {
        if (this.state !== 'running' || !Number.isFinite(dt) || dt <= 0) return;
        dt = Math.min(dt,.05); this.time += dt;
        if (this.clearTime > 0) { this.clearTime -= dt; if (this.clearTime <= 0) this.collapse(); return; }
        if (!this.piece) return;
        const interval = soft ? .045 : Math.max(.13,.85 - (this.level - 1) * .055);
        this.clock += dt;
        if (this.clock >= interval) { this.clock %= interval; this.move(0,1,soft); }
        if (this.grounded()) { this.lockTime += dt; if (this.lockTime >= LOCK_DELAY) this.lock(); }
        else if (this.lockResets < MAX_LOCK_RESETS) this.lockTime = 0;
    }
}
globalThis.PrismStack = Object.freeze({Game,WIDTH,HEIGHT,DIRS,SHAPES,rotateMask,closedCircuits,LOCK_DELAY,MAX_LOCK_RESETS});
})();
