(() => {
'use strict';
const {WIDTH,HEIGHT,DIRS} = PrismStack;
const DARK = {background:'#070e1c',a:'#0b2437',b:'#180f2b',grid:'#183246',tile:'#10283b',edge:'#245067',pipe:'#57f1e3',active:'#ffeb89',center:'#d8fffb',text:'#86b7ca'};
const LIGHT = {background:'#e5eff5',a:'#f3fbff',b:'#e6e5f4',grid:'#c6d8e3',tile:'#f7fcff',edge:'#9ebacb',pipe:'#008778',active:'#8b5100',center:'#124e60',text:'#35596c'};
class Renderer {
    constructor(canvas) { this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.palette = DARK; }
    tile(x,y,mask,size,alpha = 1,glow = false,reducedMotion = false) {
        const c = this.ctx, p = this.palette;
        c.save(); c.globalAlpha = alpha; c.translate(x,y);
        c.fillStyle = p.tile; c.strokeStyle = p.edge; c.lineWidth = 1;
        c.fillRect(2,2,size - 4,size - 4); c.strokeRect(2,2,size - 4,size - 4);
        c.strokeStyle = glow ? p.active : p.pipe; c.lineWidth = Math.max(3,size * .11); c.lineCap = 'round';
        if (glow && !reducedMotion) { c.shadowColor = p.pipe; c.shadowBlur = 12; }
        for (const [dx,dy,bit] of DIRS) if (mask & bit) {
            c.beginPath(); c.moveTo(size / 2,size / 2); c.lineTo(size / 2 + dx * size / 2,size / 2 + dy * size / 2); c.stroke();
        }
        c.fillStyle = glow ? p.active : p.center; c.beginPath(); c.arc(size / 2,size / 2,size * .07,0,Math.PI * 2); c.fill(); c.restore();
    }
    render(game,reducedMotion = false,light = false) {
        this.palette = light ? LIGHT : DARK;
        const c = this.ctx, p = this.palette, w = this.canvas.width, h = this.canvas.height;
        const size = Math.min((w - 48) / WIDTH,(h - 60) / HEIGHT), ox = (w - WIDTH * size) / 2, oy = 28;
        c.fillStyle = p.background; c.fillRect(0,0,w,h);
        const gradient = c.createLinearGradient(0,0,w,h); gradient.addColorStop(0,p.a); gradient.addColorStop(1,p.b);
        c.fillStyle = gradient; c.fillRect(ox - 8,oy - 8,WIDTH * size + 16,HEIGHT * size + 16);
        const clearing = new Set(game.clearing.map(([x,y]) => y * WIDTH + x));
        for (let y = 0; y < HEIGHT; y++) for (let x = 0; x < WIDTH; x++) {
            c.strokeStyle = p.grid; c.lineWidth = .6; c.strokeRect(ox + x * size,oy + y * size,size,size);
            const mask = game.board[y][x], clear = clearing.has(y * WIDTH + x);
            const alpha = clear && !reducedMotion ? .78 + .22 * Math.cos(game.clearTime * 18) : 1;
            if (mask) this.tile(ox + x * size,oy + y * size,mask,size,alpha,clear,reducedMotion);
        }
        if (game.piece) {
            const ghost = game.ghost();
            if (ghost && ghost.y !== game.piece.y) for (const cell of ghost.cells) this.tile(ox + (ghost.x + cell.x) * size,oy + (ghost.y + cell.y) * size,cell.mask,size,.28,false,reducedMotion);
            for (const cell of game.piece.cells) this.tile(ox + (game.piece.x + cell.x) * size,oy + (game.piece.y + cell.y) * size,cell.mask,size,1,true,reducedMotion);
        }
        c.fillStyle = p.text; c.font = '11px monospace'; c.textAlign = 'center'; c.fillText('CONNECT · CLOSE · CASCADE',w / 2,h - 12);
        if (game.clearTime > 0) { c.fillStyle = p.active; c.font = 'bold 28px monospace'; c.fillText('CIRCUIT ×' + game.chain,w / 2,h / 2); }
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
