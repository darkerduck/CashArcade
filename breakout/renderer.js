/* Original procedural neon artwork; all combat decisions remain in engine.js. */
(() => {
    'use strict';
    const api = window.NeonBreakout;
    const { W, H, POWERS, PADDLE_Y } = api;
    const TAU = Math.PI * 2;
    function mix(a, b, amount) {
        const parse = s => [1,3,5].map(i => parseInt(s.slice(i,i+2),16));
        const aa=parse(a),bb=parse(b);return '#'+aa.map((v,i)=>Math.round(v+(bb[i]-v)*amount).toString(16).padStart(2,'0')).join('');
    }
    class Renderer {
        constructor(canvas, { reducedMotion = false } = {}) {
            this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.reduced = reducedMotion;
            this.particles = []; this.rings = []; this.bolts = []; this.trails = new Map(); this.shake = 0; this.lowFX = false;
        }
        accept(events, game) {
            const color = game.level.palette;
            for (const e of events) {
                if (['brick','crack','explosion','power','strong','switch','bossDown','level','win'].includes(e.name)) {
                    const large = ['explosion','bossDown','win'].includes(e.name);
                    this.rings.push({ x: e.x ?? W / 2, y: e.y ?? H / 2, born: game.time, color: e.name === 'power' ? color[2] : color[0], life: large ? 1 : .5, size: large ? 140 : 46 });
                    const count = this.reduced || this.lowFX ? 3 : large ? 42 : e.name === 'crack' ? 7 : 15;
                    for (let k = 0; k < count; k++) {
                        const a = Math.random() * TAU, v = (large ? 170 : 85) * (.4 + Math.random());
                        this.particles.push({ x: e.x ?? W / 2, y: e.y ?? H / 2, vx: Math.cos(a) * v + (e.nx || 0) * 50, vy: Math.sin(a) * v + (e.ny || 0) * 50, born: game.time, life: .4 + Math.random() * .5, color: color[k % 3], size: large ? 3 : 2 });
                    }
                    if (!this.reduced && (large || e.name === 'strong')) this.shake = Math.min(5, this.shake + 2);
                }
                if (e.name === 'lightning') this.bolts.push({ ...e, born: game.time });
                if ((e.combo || 0) > 2) this.rings.push({ x: e.x, y: e.y, born: game.time, life: .6, text: `×${e.combo}`, color: color[2] });
            }
            this.particles = this.particles.slice(this.lowFX ? -100 : -400); this.rings = this.rings.slice(this.lowFX ? -16 : -48); this.bolts = this.bolts.slice(-18);
        }
        glow(color, blur = 10) { this.ctx.strokeStyle = color; this.ctx.fillStyle = color; this.ctx.shadowColor = color; this.ctx.shadowBlur = this.lowFX ? 0 : this.reduced ? Math.min(blur, 5) : blur; }
        rect(x, y, w, h, r = 3) { const c = this.ctx; c.beginPath(); c.roundRect(x, y, w, h, r); }
        line(x, y, tx, ty, color, width = 1) { const c = this.ctx; c.strokeStyle = color; c.lineWidth = width; c.beginPath(); c.moveTo(x, y); c.lineTo(tx, ty); c.stroke(); }
        circle(x, y, r, color, fill = false) { const c = this.ctx; c.beginPath(); c.arc(x, y, Math.max(.1, r), 0, TAU); c[fill ? 'fillStyle' : 'strokeStyle'] = color; c[fill ? 'fill' : 'stroke'](); }
        text(value, x, y, color, size = 12, align = 'center') { const c = this.ctx; c.shadowBlur = 0; c.fillStyle = color; c.font = `600 ${size}px system-ui, sans-serif`; c.textAlign = align; c.fillText(value, x, y); }
        background(g, light) {
            const c = this.ctx, colors = g.level.palette, t = g.time, k = g.levelIndex;
            const bg = c.createLinearGradient(0, 0, W, H); bg.addColorStop(0, light ? '#eef5ff' : '#060a19'); bg.addColorStop(.55, light ? '#fbf5ff' : '#130b26'); bg.addColorStop(1, light ? '#dfeafc' : '#091825');
            c.fillStyle = bg; c.fillRect(0, 0, W, H); c.shadowBlur = 0;
            // Each stage uses its own line vocabulary, with no random gameplay geometry.
            c.save(); c.globalAlpha = light ? .19 : .16; c.strokeStyle = light ? '#3f4e8c' : colors[0]; c.lineWidth = 1;
            for (let i = 0; i < 34; i++) {
                const x = (i * 173 + k * 19) % W, y = (i * 67 + k * 13) % (H - 80);
                c.fillStyle = light ? '#496492' : colors[i % 3]; c.fillRect(x, y, i % 5 ? 1 : 2, i % 5 ? 1 : 2);
            }
            const p = g.level.pattern;
            if (['ripples','magnetic','orbit','nova','shield'].includes(p)) {
                for (let i = 1; i < 9; i++) { c.beginPath(); c.ellipse(W / 2, 220, i * 46, i * (p === 'ripples' ? 24 : 34), t * .015, 0, TAU); c.stroke(); }
            } else if (['honey','lava','forge'].includes(p)) {
                for (let r = 0; r < 9; r++) for (let q = 0; q < 13; q++) { const x = q * 60 + r % 2 * 30, y = r * 49; c.beginPath(); for (let j = 0; j < 6; j++) { const a = j * TAU / 6; c.lineTo(x + Math.cos(a) * 28, y + Math.sin(a) * 28); } c.closePath(); c.stroke(); }
            } else if (['crystal','prism','citadel','crown'].includes(p)) {
                for (let i = 0; i < 10; i++) { const r = 48 + i * 35; c.beginPath(); c.moveTo(W / 2, 230 - r * .7); c.lineTo(W / 2 + r, 230); c.lineTo(W / 2, 230 + r * .7); c.lineTo(W / 2 - r, 230); c.closePath(); c.stroke(); }
            } else if (['river','sand','clouds','invert'].includes(p)) {
                for (let j = 0; j < 9; j++) { c.beginPath(); for (let x = 0; x <= W; x += 12) c.lineTo(x, j * 52 + Math.sin(x / (p === 'sand' ? 100 : 130) + j * .5 + t * .15) * 24); c.stroke(); }
            } else if (['portals','maze','locks','gates','factory','tracks','laser','needles'].includes(p)) {
                for (let i = 0; i < 14; i++) { const x = i * 55; c.beginPath(); c.moveTo(x, H - 60); c.lineTo(x, 65 + i % 3 * 48); c.lineTo(x + 26, 65 + i % 3 * 48); c.lineTo(x + 26, 0); c.stroke(); }
            } else {
                for (let j = 0; j < 16; j++) { const a = j * TAU / 16 + t * .025; c.beginPath(); c.moveTo(W / 2 + Math.cos(a) * 60, 218 + Math.sin(a) * 38); c.lineTo(W / 2 + Math.cos(a + .16) * 520, 218 + Math.sin(a + .16) * 350); c.stroke(); }
            }
            c.restore();
            const floor = c.createLinearGradient(0, 450, 0, H); floor.addColorStop(0, light ? '#bccceb00' : colors[0] + '00'); floor.addColorStop(1, light ? '#a9bada80' : colors[0] + '22'); c.fillStyle = floor; c.fillRect(0, 450, W, 90);
            c.globalAlpha = .2;
            for (let i = -6; i < 18; i++) this.line(W / 2 + (i - 6) * 21, 451, i * 75, H, light ? '#60729b' : colors[0]);
            for (let i = 0; i < 5; i++) this.line(0, 454 + i * i * 5, W, 454 + i * i * 5, light ? '#60729b' : colors[0]);
            c.globalAlpha = 1;
        }
        drawBrick(b, g, light) {
            const c = this.ctx, palette = g.level.palette;
            let color = b.type === 'steel' ? '#7183a2' : ['armor','heavy'].includes(b.type) ? palette[2] : ['repel','directional','emitter'].includes(b.type) ? palette[1] : palette[0];
            if (light) color = b.type === 'steel' ? '#63708a' : ['armor','heavy'].includes(b.type) ? '#986114' : ['repel','directional','emitter'].includes(b.type) ? '#8c337f' : '#077c83';
            const basic = ['normal','fragile','moving'].includes(b.type);
            const phase = (b.id + (this.reduced ? 0 : g.time * .75)) % 3;
            if (basic) { const trio = light ? palette.map(p=>mix(p,'#071538',.58)) : palette; color=mix(trio[Math.floor(phase)],trio[(Math.floor(phase)+1)%3],phase%1); }
            const pulse = this.reduced ? 1 : .82 + .18 * Math.sin(g.time * 3.1 + b.id * .7);
            c.save(); this.glow(color, (b.bossRole ? 19 : 12) * pulse);
            c.globalAlpha = b.hp === -1 ? .8 : .9 + pulse * .1;
            if (b.hex) { c.beginPath(); c.moveTo(b.x + 8, b.y); c.lineTo(b.x + b.w - 8, b.y); c.lineTo(b.x + b.w, b.y + b.h / 2); c.lineTo(b.x + b.w - 8, b.y + b.h); c.lineTo(b.x + 8, b.y + b.h); c.lineTo(b.x, b.y + b.h / 2); c.closePath(); }
            else this.rect(b.x, b.y, b.w, b.h, b.bossRole ? 7 : 3);
            const fill=c.createLinearGradient(b.x,b.y,b.x,b.y+b.h);
            fill.addColorStop(0,color+(light?'55':'cc'));fill.addColorStop(.48,color+(light?'22':'55'));fill.addColorStop(1,color+(light?'44':'99'));
            c.fillStyle = fill; c.fill(); c.lineWidth = b.bossRole ? 2.3 : b.type === 'fragile' ? 1.4 : 1.8; c.stroke();
            c.shadowBlur = 0; this.line(b.x + 5, b.y + 4, b.x + b.w - 5, b.y + 4, color + 'aa');
            if (!this.reduced && b.type !== 'steel') {
                const glint=(g.time*.42+b.id*.173)%1, x=b.x+4+glint*(b.w-8);
                this.line(x-3,b.y+2,x+3,b.y+2,light?'#ffffffb0':'#ffffffdd',1.8);
                this.line(x,b.y-1,x,b.y+5,light?'#ffffff80':'#ffffff99',1);
            }
            if (b.hp > 0 && b.hp < b.maxHp) {
                c.strokeStyle = light ? '#543a52' : '#fff3c9'; c.lineWidth = 1.6; c.beginPath();
                c.moveTo(b.x + b.w * .38, b.y); c.lineTo(b.x + b.w * .48, b.y + b.h * .32); c.lineTo(b.x + b.w * .42, b.y + b.h * .52); c.lineTo(b.x + b.w * .62, b.y + b.h); c.stroke();
            }
            const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
            if(['armor','heavy'].includes(b.type))for(const x of [b.x+4,b.x+b.w-4])for(const y of [b.y+4,b.y+b.h-4])this.circle(x,y,1.5,color,true);
            if (b.type === 'repel') {
                this.glow(color, 8); c.setLineDash([8, 5]); this.circle(cx, cy, 43 + Math.sin(g.time * 3) * 2, color + '77'); c.setLineDash([]); this.text('⊕', cx, cy + 5, color, 15);
            } else if (b.type === 'directional') { this.line(b.x + 3, b.y - 3, b.x + b.w - 3, b.y - 3, color, 3); this.text('▼', cx, cy + 4, color, 10); }
            else if (b.type === 'steel') { for (let x = b.x + 8; x < b.x + b.w; x += 16) this.line(x, b.y + b.h - 3, Math.min(x + 9, b.x + b.w - 3), b.y + 3, color + '77'); }
            else if (b.type === 'emitter') this.text(b.active ? `${6 - b.emitted} ◉` : '◉', cx, cy + 4, color, 10);
            else if (b.type === 'hatch') this.circle(cx, cy, 5, color, true);
            else if (b.type === 'explosive') this.text('✦', cx, cy + 5, color, 14);
            else if (b.type === 'switch') this.text('⚿', cx, cy + 4, color, 14);
            else if (b.type === 'moving') this.text('↔', cx, cy + 4, color, 12);
            if (b.power && b.hp > 0) this.text(POWERS[b.power].icon, b.x + b.w - 9, b.y + b.h - 5, light ? '#485773' : '#ffffff', 10);
            if (b.bossRole) {
                this.rect(b.x, b.y + b.h + 7, b.w, 4, 2); c.fillStyle = color + '33'; c.fill();
                this.rect(b.x, b.y + b.h + 7, Math.max(1, b.w * b.hp / b.maxHp), 4, 2); c.fillStyle = color; c.fill();
                this.text(b.bossRole === 'core' ? `CORE ${b.hp}` : `NODE ${b.hp}`, cx, b.y + b.h + 23, color, 10);
            }
            c.restore();
        }
        fixtures(g, light) {
            const c = this.ctx, colors = g.level.palette;
            for (const z of g.level.zones) {
                c.fillStyle = (light ? '#2c819c' : colors[0]) + '13'; c.fillRect(z.x, z.y, z.w, z.h);
                c.setLineDash([5, 6]); c.strokeStyle = (light ? '#2c819c' : colors[0]) + '55'; c.strokeRect(z.x, z.y, z.w, z.h); c.setLineDash([]);
                for (let k = 0; k < 4; k++) this.text(z.ax < 0 ? '‹' : z.ax > 0 ? '›' : '↑', z.x + 26 + k * (z.w - 40) / 4, z.y + z.h / 2 + 8, light ? '#338293' : colors[0], 28);
            }
            for (const gate of g.level.gates) {
                const opening=gate.open ? Math.min(1,Math.max(0,(g.time-(gate.openedAt??g.time-1.2))/1.2)) : 0;
                c.save(); c.globalAlpha = gate.open ? 1-opening*.85 : 1; this.glow(light ? '#526f93' : colors[1], 12);
                for(let half=0;half<2;half++){this.rect(gate.x+half*gate.w/2+(half?1:-1)*opening*gate.w*.45,gate.y,gate.w/2,gate.h,2);c.fillStyle=(light?'#526f93':colors[1])+'55';c.fill();c.stroke();}
                c.restore();
                const sw = g.bricks.find(b => b.opens === gate.id);
                if (sw?.hp > 0) { c.save(); c.globalAlpha = .32; c.setLineDash([4, 6]); this.line(sw.x + sw.w / 2, sw.y + sw.h / 2, gate.x + gate.w / 2, gate.y, light ? '#634ca2' : colors[1]); c.restore(); }
            }
            for (const port of g.level.portals) {
                const color = light ? (port.color ? '#a32f82' : '#096db5') : port.color ? '#ff75d6' : '#65eaff';
                const enabled=!port.requires||g.level.gates.find(gate=>gate.id===port.requires)?.open;
                c.save(); c.globalAlpha=enabled?1:.24; this.glow(color, enabled?15:0); c.lineWidth = 2;
                this.circle(port.x, port.y, port.r + 4, color + '66'); this.circle(port.x, port.y, port.r, color);
                for (let k = 0; k < 3; k++) { const a = g.time * 2 + k * TAU / 3; this.circle(port.x + Math.cos(a) * port.r, port.y + Math.sin(a) * port.r, 2, color, true); }
                c.globalAlpha = enabled ? .13 : .07; c.setLineDash([3, 8]); this.line(port.x, port.y, port.tx, port.ty, color); c.restore();
                this.line(port.tx, port.ty, port.tx + Math.cos(port.angle) * 25, port.ty + Math.sin(port.angle) * 25, color, 2);
                if(!enabled)this.text('⚿',port.x,port.y+4,light?'#66718c':'#a5b4cd',11);
            }
            for (const r of g.level.rotors) {
                c.save(); c.translate(r.x, r.y); c.rotate(g.time * r.speed + r.phase); this.glow(light ? '#176990' : colors[1], 12); c.lineWidth = 2;
                this.circle(0, 0, r.r, c.strokeStyle);
                for (let k = 0; k < 4; k++) { c.rotate(TAU / 4); c.beginPath(); c.moveTo(0, -3); c.lineTo(r.r, -12); c.lineTo(r.r, 6); c.closePath(); c.fillStyle = c.strokeStyle + '55'; c.fill(); c.stroke(); } c.restore();
            }
        }
        draw(g, { light = false } = {}) {
            const c = this.ctx, t = g.time, colors = g.level.palette;
            c.save(); this.background(g, light);
            if (!this.reduced && g.state === 'running' && this.shake > .1) { c.translate((Math.random() - .5) * this.shake, (Math.random() - .5) * this.shake); this.shake *= .86; }
            this.fixtures(g, light);
            if (g.level.boss) {
                const core = g.bricks.find(b => b.bossRole === 'core'), locked = g.bricks.some(b => b.bossRole === 'node' && b.hp > 0);
                if (core && locked) { c.save(); c.lineWidth = 2; this.glow(light ? '#8b4c88' : colors[1], 15); c.setLineDash([12, 7]); c.beginPath(); c.ellipse(core.x + core.w / 2, core.y + core.h / 2, core.w / 2 + 26, core.h / 2 + 20, 0, 0, TAU); c.stroke(); c.restore(); }
            }
            for (const b of g.bricks) if (b.hp !== 0) this.drawBrick(b, g, light);
            if(g.levelIndex===2)this.text('按住壓板 → 接球時放開 ↑',W/2,400,light?'#6a5198':colors[2],12);
            for (const i of g.items) { const p = POWERS[i.name], color = p.bad ? (light ? '#b91f53' : '#ff6688') : (light ? '#076f60' : '#79ffcd'); c.save(); this.glow(color, 14); this.rect(i.x - 15, i.y - 12, 30, 24, 5); c.fillStyle = light ? '#fff9ee' : '#092727'; c.fill(); c.stroke(); this.text(p.icon, i.x, i.y + 6, color, 17); c.restore(); }
            for (const s of g.shots) { this.glow(light ? '#985188' : '#ff73d7', 10); this.line(s.x, s.y, s.x, s.y + 16, c.strokeStyle, 3); }
            const living = new Set(g.balls.map(b => b.id));
            for (const id of this.trails.keys()) if (!living.has(id)) this.trails.delete(id);
            for (const b of g.balls) {
                let trail = this.trails.get(b.id) || []; if (g.state === 'running') trail.push({ x: b.x, y: b.y }); trail = trail.slice(-(this.reduced || this.lowFX ? 3 : 10)); this.trails.set(b.id, trail);
                const color = b.strongUntil > t ? '#ffdd73' : g.has('fire') ? '#ff936c' : g.has('pierce') ? '#d0a1ff' : light ? '#087f95' : '#aefff6';
                c.save(); this.glow(color, 12);
                for (let j = 1; j < trail.length; j++) { c.globalAlpha = j / trail.length * .55; this.line(trail[j-1].x, trail[j-1].y, trail[j].x, trail[j].y, color, b.r * (j / trail.length)); }
                c.globalAlpha = 1; this.circle(b.x, b.y, b.r, color, true); this.circle(b.x - b.r * .2, b.y - b.r * .2, b.r * .32, light ? '#ffffff' : '#f6ffff', true);
                if (b.strongUntil > t) { c.lineWidth = 1.5; this.circle(b.x, b.y, b.r + 5, color); } c.restore();
            }
            const charge = g.paddle.charging ? Math.min(1, (t - g.paddle.chargeAt) / .45) : 0;
            const release = g.paddle.releaseUntil > t;
            c.save(); this.glow(light ? '#186c83' : release ? colors[2] : colors[0], 15); c.lineWidth = 2;
            this.rect(g.paddle.x, PADDLE_Y + charge * 5, g.paddle.w, 14 - charge * 3, 6); c.fillStyle = light ? '#12617d' : '#0a5061'; c.fill(); c.stroke();
            this.line(g.paddle.x + 6, PADDLE_Y + 4 + charge * 5, g.paddle.x + g.paddle.w - 6, PADDLE_Y + 4 + charge * 5, release ? '#ffed91' : '#94fff3', 2);
            if (charge) { this.rect(g.paddle.x, PADDLE_Y + 21, g.paddle.w * charge, 3, 1); c.fillStyle = light ? '#9b6d1c' : '#ffe18c'; c.fill(); } c.restore();
            if (g.shield) { c.save(); this.glow(light ? '#796b27' : '#ffe89c', 12); this.line(0, H - 15, W, H - 15, c.strokeStyle, 3); this.text(`◇ ${g.shield}`, W - 30, H - 22, c.strokeStyle, 11); c.restore(); }
            this.particles = this.particles.filter(p => t - p.born < p.life);
            c.shadowBlur = 0;
            for (const p of this.particles) { const a = t - p.born; c.globalAlpha = Math.max(0, 1 - a / p.life); c.fillStyle = p.color; c.fillRect(p.x + p.vx * a, p.y + p.vy * a + a * a * 75, p.size * 2, p.size); }
            this.rings = this.rings.filter(r => t - r.born < r.life);
            for (const r of this.rings) { const a = (t - r.born) / r.life; c.globalAlpha = 1 - a; if (r.text) this.text(r.text, r.x, r.y - a * 35, r.color, 18); else { c.lineWidth = 2 * (1 - a); this.circle(r.x, r.y, 6 + a * r.size, r.color); } }
            this.bolts = this.bolts.filter(b => t - b.born < .18);
            for (const b of this.bolts) { c.globalAlpha = 1 - (t - b.born) / .18; this.line(b.x, b.y, (b.x + b.tx) / 2 + 13, (b.y + b.ty) / 2 - 8, light ? '#8754c4' : '#d9b0ff', 2); this.line((b.x + b.tx) / 2 + 13, (b.y + b.ty) / 2 - 8, b.tx, b.ty, light ? '#8754c4' : '#d9b0ff', 2); }
            c.globalAlpha = 1; c.shadowBlur = 0;
            this.text(`${String(g.levelIndex + 1).padStart(2,'0')} / 30  ${g.level.name}${g.level.waves > 1 ? ` · ${g.wave + 1}/3 幕` : ''}`, 16, 25, light ? '#465775' : '#d7e4fa', 12, 'left');
            if (g.level.boss) this.text(`BOSS · ${g.bossPhase + 1}/${g.level.boss.phases}`, W - 16, 25, light ? '#a55570' : colors[1], 11, 'right');
            else this.text(`${g.bricks.filter(b => b.hp > 0).length} TARGETS`, W - 16, 25, light ? '#52718b' : colors[0], 10, 'right');
            c.restore();
        }
    }
    api.Renderer = Renderer;
})();
