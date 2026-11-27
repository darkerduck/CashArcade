(() => {
'use strict';
const {WIDTH,HEIGHT,DIRS} = PrismStack;
const W = 368, H = 620;
const DARK = {background:'#070e1c',a:'#0b2437',b:'#180f2b',grid:'#183246',tile:'#0e2436',bevelHi:'#2b6a86',bevelLo:'#061420',edge:'#245067',pipe:'#57f1e3',halo:'#57f1e33a',active:'#ffeb89',activeHalo:'#ffeb8955',center:'#d8fffb',text:'#86b7ca',frame:'#57f1e3',bolt:'#ff9ad5',trace:'#57f1e3'};
const LIGHT = {background:'#e5eff5',a:'#f3fbff',b:'#e6e5f4',grid:'#c6d8e3',tile:'#f7fcff',bevelHi:'#ffffff',bevelLo:'#b7cbd8',edge:'#9ebacb',pipe:'#008778',halo:'#0087782a',active:'#8b5100',activeHalo:'#8b510033',center:'#124e60',text:'#35596c',frame:'#4f8ea6',bolt:'#a8467f',trace:'#7aa9bd'};
const outBack = t => { const x = Math.min(1,Math.max(0,t)) - 1; return 1 + 2.70158 * x ** 3 + 1.70158 * x ** 2; };
class Renderer {
    constructor(canvas) {
        this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.palette = DARK;
        this.fx = globalThis.CashArcadeFX?.createFx({maxParticles:260}) ?? null;
        this.vis = null; this.pieceRef = null; this.last = 0; this.clock = 0;
        this.prevBoard = null; this.prevClearing = []; this.fall = null; this.fallAge = 0; this.clearAge = 0;
    }
    // Beveled neon tile: inset body, light/dark bevel strips, a soft halo pipe and a bright core.
    tile(x,y,mask,size,alpha = 1,glow = false,reducedMotion = false,lit = 1) {
        const c = this.ctx, p = this.palette;
        c.save(); if (alpha !== 1) c.globalAlpha = alpha; c.translate(x,y);
        c.fillStyle = p.tile; c.fillRect(2,2,size - 4,size - 4);
        c.fillStyle = p.bevelHi; c.fillRect(2,2,size - 4,2); c.fillRect(2,2,2,size - 4);
        c.fillStyle = p.bevelLo; c.fillRect(2,size - 4,size - 4,2); c.fillRect(size - 4,2,2,size - 4);
        c.strokeStyle = glow ? p.active : p.edge; c.lineWidth = 1; c.strokeRect(2.5,2.5,size - 5,size - 5);
        c.lineCap = 'round';
        const core = glow ? p.active : p.pipe, halo = glow ? p.activeHalo : p.halo;
        for (const [width,color] of [[Math.max(7,size * .3),halo],[Math.max(3,size * .11) * lit,core]]) {
            c.strokeStyle = color; c.lineWidth = width;
            for (const [dx,dy,bit] of DIRS) if (mask & bit) { c.beginPath(); c.moveTo(size / 2,size / 2); c.lineTo(size / 2 + dx * size / 2,size / 2 + dy * size / 2); c.stroke(); }
        }
        c.fillStyle = glow ? p.active : p.center; c.beginPath(); c.arc(size / 2,size / 2,size * .09,0,Math.PI * 2); c.fill();
        c.strokeStyle = glow ? p.active : p.pipe; c.lineWidth = 1.2; c.strokeRect(size * .34,size * .34,size * .32,size * .32);
        c.restore();
    }
    // Track board changes between frames to drive spawn tweening, clear bursts and eased collapse.
    observe(game,size,ox,oy,dt,reducedMotion) {
        const fx = this.fx, p = this.palette;
        if (game.piece !== this.pieceRef) { this.pieceRef = game.piece; this.vis = game.piece ? {x:game.piece.x,y:game.piece.y} : null; }
        else if (game.piece && this.vis) {
            const k = reducedMotion ? 1 : 1 - Math.exp(-dt * 30);
            this.vis.x += (game.piece.x - this.vis.x) * k; this.vis.y += (game.piece.y - this.vis.y) * k;
            if (Math.abs(this.vis.x - game.piece.x) < .01) this.vis.x = game.piece.x;
            if (Math.abs(this.vis.y - game.piece.y) < .01) this.vis.y = game.piece.y;
        }
        const clearing = game.clearing;
        if (clearing.length && !this.prevClearing.length) {
            this.clearAge = 0;
            if (fx) {
                fx.popup(W / 2,H / 2 - 40,'+' + clearing.length * clearing.length * 25 * game.chain,{color:p.active,size:18});
                fx.shake(Math.min(.5,.12 + clearing.length * .02)); fx.flash(p.pipe,.08,.18);
            }
        }
        if (!clearing.length && this.prevClearing.length && this.prevBoard) {
            // Collapse just happened: burst every cleared cell and compute how far each tile fell.
            const gone = new Set(this.prevClearing.map(([x,y]) => y * WIDTH + x));
            for (const [x,y] of this.prevClearing) fx?.burst(ox + (x + .5) * size,oy + (y + .5) * size,{kind:'shard',color:p.active,count:4,speed:150,life:.55,size:1.8});
            this.fall = Array.from({length:HEIGHT},() => new Array(WIDTH).fill(0));
            for (let x = 0; x < WIDTH; x++) {
                const old = []; for (let y = HEIGHT - 1; y >= 0; y--) if (this.prevBoard[y][x] && !gone.has(y * WIDTH + x)) old.push(y);
                let row = HEIGHT - 1;
                for (const from of old) { this.fall[row][x] = row - from; row--; }
            }
            this.fallAge = 0;
        }
        this.prevClearing = clearing.slice();
        this.prevBoard = game.board.map(row => row.slice());
        this.clearAge += dt; this.fallAge += dt;
        if (this.fall && this.fallAge > .26) this.fall = null;
    }
    render(game,reducedMotion = false,light = false) {
        this.palette = light ? LIGHT : DARK;
        const now = globalThis.performance?.now?.() ?? 0, dt = this.last ? Math.min(.05,Math.max(0,(now - this.last) / 1000)) : 0; this.last = now; this.clock += dt;
        const ratio = globalThis.CashArcadeFX?.fitCanvas(this.canvas,W,H) ?? 1;
        const c = this.ctx, p = this.palette, w = W, h = H;
        if (typeof c.setTransform === 'function') c.setTransform(ratio,0,0,ratio,0,0);
        this.fx?.setReduced(reducedMotion); this.fx?.update(dt);
        const size = Math.min((w - 48) / WIDTH,(h - 60) / HEIGHT), ox = (w - WIDTH * size) / 2, oy = 28;
        this.observe(game,size,ox,oy,dt,reducedMotion);
        c.fillStyle = p.background; c.fillRect(0,0,w,h);
        c.save(); this.fx?.apply(c);
        // Cabinet frame: double border, corner bolts and side light strips.
        c.fillStyle = p.frame + '30'; c.fillRect(ox - 14,oy - 14,WIDTH * size + 28,HEIGHT * size + 28);
        c.fillStyle = p.background; c.fillRect(ox - 11,oy - 11,WIDTH * size + 22,HEIGHT * size + 22);
        c.strokeStyle = p.frame; c.lineWidth = 2; c.strokeRect(ox - 9,oy - 9,WIDTH * size + 18,HEIGHT * size + 18);
        c.fillStyle = p.bolt; for (const [bx,by] of [[ox - 9,oy - 9],[ox + WIDTH * size + 9,oy - 9],[ox - 9,oy + HEIGHT * size + 9],[ox + WIDTH * size + 9,oy + HEIGHT * size + 9]]) c.fillRect(bx - 3,by - 3,6,6);
        const gradient = c.createLinearGradient(0,0,w,h); gradient.addColorStop(0,p.a); gradient.addColorStop(1,p.b);
        c.fillStyle = gradient; c.fillRect(ox - 8,oy - 8,WIDTH * size + 16,HEIGHT * size + 16);
        // Live circuit traces run down the board columns behind the tiles.
        if (!reducedMotion) for (let x = 0; x < WIDTH; x++) {
            const y = (this.clock * (40 + x * 9) + x * 97) % (HEIGHT * size);
            c.fillStyle = p.trace + '55'; c.fillRect(ox + (x + .5) * size - 1,oy + y,2,size * .8);
        }
        const clearing = game.clearing, order = new Map(clearing.map(([x,y],i) => [y * WIDTH + x,i]));
        const run = reducedMotion ? clearing.length : Math.ceil(clearing.length * Math.min(1,this.clearAge / .2));
        const ease = this.fall && !reducedMotion ? 1 - Math.min(1,this.fallAge / .26) ** 2 : 0;
        for (let y = 0; y < HEIGHT; y++) for (let x = 0; x < WIDTH; x++) {
            c.strokeStyle = p.grid; c.lineWidth = .6; c.strokeRect(ox + x * size,oy + y * size,size,size);
            const mask = game.board[y][x], index = order.get(y * WIDTH + x), clear = index !== undefined;
            // Clearing: light races around the loop in path order.
            const lit = clear && index < run;
            const offset = this.fall ? this.fall[y][x] * ease : 0;
            if (mask) this.tile(ox + x * size,oy + (y - offset) * size,mask,size,1,lit,reducedMotion,lit && !reducedMotion ? 1.3 : 1);
        }
        if (game.piece) {
            const ghost = game.ghost(), vx = this.vis ? this.vis.x : game.piece.x, vy = this.vis ? this.vis.y : game.piece.y;
            if (ghost && ghost.y !== game.piece.y) for (const cell of ghost.cells) this.tile(ox + (ghost.x + cell.x) * size,oy + (ghost.y + cell.y) * size,cell.mask,size,.28,false,reducedMotion);
            for (const cell of game.piece.cells) this.tile(ox + (vx + cell.x) * size,oy + (vy + cell.y) * size,cell.mask,size,1,true,reducedMotion);
        }
        this.fx?.draw(c,w,h);
        c.restore();
        c.fillStyle = p.text; c.font = '11px monospace'; c.textAlign = 'center'; c.fillText('CONNECT · CLOSE · CASCADE',w / 2,h - 12);
        if (game.clearTime > 0) {
            const pop = reducedMotion ? 1 : outBack(this.clearAge / .25);
            c.fillStyle = p.active; c.font = `bold ${Math.round(28 * pop)}px monospace`; c.fillText('CIRCUIT ×' + game.chain,w / 2,h / 2);
        }
        if (!light) globalThis.CashArcadeFX?.crt(c,w,h,.05);
    }
    preview(canvas,masks) {
        const ctx = canvas.getContext('2d'); ctx.clearRect(0,0,canvas.width,canvas.height);
        if (!masks) return;
        const old = this.ctx; this.ctx = ctx;
        try { masks.forEach((mask,i) => this.tile(i * 32 + 8,8,mask,32)); } finally { this.ctx = old; }
    }
}
globalThis.PrismRenderer = Object.freeze({Renderer});
})();
