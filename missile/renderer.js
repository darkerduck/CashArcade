(() => {
    'use strict';
    const { W, H, GROUND } = NeonDefense;
    const COLORS = { normal: '#ff527f', fast: '#ffcf64', split: '#c88aff', armored: '#f69b45', cruiser: '#ff69dd' };
    const ICONS = { rapid: '»', wide: '✦', slow: '◷', shield: '◇', emp: 'ϟ' };
    const POWER_COLORS = { rapid: '#63fff5', wide: '#ff66dc', slow: '#9691ff', shield: '#65bdff', emp: '#dd9cff' };
    const HULLS = Object.freeze({
        missile: [[14,0],[3,-4],[-8,-4],[-13,-9],[-11,-2],[-11,2],[-13,9],[-8,4],[3,4]],
        armor: [[16,0],[4,-7],[-8,-7],[-14,-11],[-12,0],[-14,11],[-8,7],[4,7]],
        plane: [[34,0],[19,-5],[4,-5],[-9,-15],[-24,-13],[-13,-4],[-27,-4],[-32,-10],[-33,0],[-32,10],[-27,4],[-13,4],[-24,13],[-9,15],[4,5],[19,5]],
        base: [[-36,20],[-31,2],[-21,-5],[21,-5],[31,2],[36,20],[27,28],[-27,28]],
    });
    class Renderer {
        constructor(canvas) {
            this.canvas = canvas; this.c = canvas.getContext('2d');
            this.reduced = matchMedia('(prefers-reduced-motion: reduce)'); this.glows = new Map();
            this.quality = 1; this.frameCost = 0; this.reset();
            const dpr = Math.min(devicePixelRatio || 1, 2); canvas.width = W * dpr; canvas.height = H * dpr;
            this.dpr = dpr;
        }
        reset() {
            this.particles=[]; this.labels=[]; this.vfx=[]; this.debris=[]; this.clock=0;
            this.shake=0; this.flash=0; this.shock=null; this.cooldowns={};
        }
        kick(duration, amplitude, kind) {
            if (this.reduced.matches || (this.cooldowns[kind] ?? -10) > this.clock) return;
            this.cooldowns[kind]=this.clock+.22;
            if (!this.shock || this.shock.end <= this.clock) this.shock={start:this.clock,end:this.clock+duration,amplitude};
            else {
                // One bounded impulse window, not an indefinitely refreshed camera shake.
                this.shock.end=Math.min(this.shock.start+.9,Math.max(this.shock.end,this.clock+duration));
                this.shock.amplitude=Math.min(24,Math.max(this.shock.amplitude,amplitude));
            }
            this.shake=Math.max(0,this.shock.end-this.clock);
        }
        offset() {
            if (!this.shock || this.reduced.matches || this.shock.end <= this.clock) return {x:0,y:0};
            const s=this.shock, age=this.clock-s.start, duration=s.end-s.start;
            const envelope=Math.min(1,age/.018)*Math.pow(Math.max(0,1-age/duration),1.35);
            const a=s.amplitude*envelope;
            const x=Math.sin(this.clock*103+1.2)*a,y=Math.sin(this.clock*137+.7)*a*.72;
            const scale=Math.min(1,s.amplitude/(Math.hypot(x,y) || 1));
            return {x:x*scale,y:y*scale};
        }
        burst(x,y,color,count=26,speed=220) {
            count=Math.ceil(count*this.quality*(this.reduced.matches ? .18 : 1));
            for (let i=0;i<count;i++) {
                const angle=Math.random()*Math.PI*2,v=30+Math.random()*speed,life=.35+Math.random()*.75;
                this.particles.push({x,y,vx:Math.cos(angle)*v,vy:Math.sin(angle)*v,life,maxLife:life,color,size:1+Math.random()*2});
            }
            if (this.particles.length > 480) this.particles.splice(0,this.particles.length-480);
        }
        effect(kind,x,y,duration,color,extra={}) {
            this.vfx.push({kind,x,y,age:0,duration,color,...extra});
            if (this.vfx.length > 48) this.vfx.shift();
        }
        fragments(x,y,width,count=9) {
            for (let i=0;i<count;i++) this.debris.push({x:x+(i/(count-1)-.5)*width,y,
                vx:(i/(count-1)-.5)*160,vy:-40-Math.random()*140,angle:Math.random()*6,
                spin:Math.random()*4-2,size:8+Math.random()*15,life:1.6+Math.random(),maxLife:2.6});
            if (this.debris.length > 48) this.debris.splice(0,this.debris.length-48);
        }
        event(e) {
            const color=e.type === 'pickup' ? POWER_COLORS[e.power] :
                ({launch:'#73fff2',damage:'#ff527f',armor:'#ffcc64',bossDeath:'#f28bff',breakup:'#ff69dd',shield:'#65bdff'}[e.type] || '#77fff1');
            if (['launch','damage','pickup','armor','bossDeath','explosion','chain','shield','split','breakup'].includes(e.type))
                this.burst(e.x,e.y,color,e.type === 'launch' ? 6 : e.type === 'bossDeath' ? 120 : e.type === 'breakup' ? 60 : 26);
            if (e.type === 'damage') {
                this.kick(e.destroyed ? .65 : .4,e.destroyed ? 18 : 12,'city');
                this.effect('impact',e.x,e.y,1.1,color,{radius:e.destroyed ? 125 : 85});
                this.flash=this.reduced.matches ? 0 : .10;
                if (e.destroyed) this.fragments(e.x,e.y-25,60,7);
            }
            if (e.type === 'shield') {
                this.kick(.18,3,'shield'); this.effect('shieldHit',e.x,e.y-24,.65,color,{radius:43});
            }
            if (e.type === 'explosion' && e.boosted) this.kick(.22,5,'overload');
            if (e.type === 'chain' && e.depth >= 3) this.kick(.3,7,'chain');
            if (e.type === 'breakup') {
                this.kick(.3,6,'plane'); this.fragments(e.x,e.y,65,8); this.effect('impact',e.x,e.y,1,color,{radius:90});
            }
            if (e.type === 'bossPhase') {
                this.kick(e.phase === 'rage' ? .65 : .35,e.phase === 'rage' ? 16 : 8,'bossPhase');
                this.effect('phase',e.x,e.y,1.6,e.phase === 'rage' ? '#ff497e' : '#ffd27b',{radius:360});
                this.labels=this.labels.filter(l => l.kind !== 'phase');
                this.labels.push({kind:'phase',x:480,y:270,text:e.phase === 'rage' ? '⚠ REACTOR OVERDRIVE' : 'CORE EXPOSED',life:1.8});
            }
            if (e.type === 'bossDeath') {
                this.labels=this.labels.filter(l => l.kind !== 'phase');
                this.kick(.9,22,'bossDeath'); this.fragments(e.x,e.y,e.width || 300,20);
                this.effect('bossDeath',e.x,e.y,2.4,color,{radius:550}); this.flash=this.reduced.matches ? 0 : .14;
            }
            if (e.type === 'pickup') {
                const targets=e.power === 'emp' ? (e.targets || []).slice(0,32) : e.power === 'shield' ? e.cities : e.turrets;
                this.effect(e.power,e.x,e.y,e.power === 'emp' ? 1.35 : 1.15,color,{targets:targets || [],radius:e.power === 'emp' ? 1100 : 400});
                if (e.power === 'emp') for (const target of (e.targets || []).slice(0,32)) this.burst(target.x,target.y,color,9,120);
            }
            if (e.type === 'chain' && e.depth > 1) this.labels.push({x:e.x,y:e.y,text:`CHAIN ×${Math.min(e.depth,9)}`,life:.8});
            if (e.type === 'wave') this.labels.push({x:e.x,y:e.y,text:`WAVE ${e.wave} / ${e.total}`,life:1.5});
            if (this.labels.length > 20) this.labels.splice(0,this.labels.length-20);
        }
        line(points, color, width = 2, glow = 0) {
            if (!points.length) return;
            const c = this.c; c.beginPath(); c.strokeStyle = color; c.lineWidth = width; c.shadowColor = color; c.shadowBlur = glow;
            points.forEach((p, i) => i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)); c.stroke(); c.shadowBlur = 0;
        }
        circle(x, y, r, color, fill = false, glow = 0) {
            const c = this.c; c.beginPath(); c.arc(x, y, Math.max(0, r), 0, Math.PI * 2); c.shadowColor = color; c.shadowBlur = glow;
            if (fill) { c.fillStyle = color; c.fill(); } else { c.strokeStyle = color; c.lineWidth = 2; c.stroke(); } c.shadowBlur = 0;
        }
        polygon(points, fill, edge, width=1.5, glow=0) {
            const c=this.c; c.beginPath();
            points.forEach(([x,y],i) => i ? c.lineTo(x,y) : c.moveTo(x,y)); c.closePath();
            if (fill) { c.fillStyle=fill; c.fill(); }
            if (edge) { c.strokeStyle=edge; c.lineWidth=width; c.shadowColor=edge; c.shadowBlur=glow; c.stroke(); c.shadowBlur=0; }
        }
        glow(x,y,r,color,alpha=1) {
            if (r <= 0) return;
            if (this.glowBudget !== undefined && this.glowBudget-- <= 0) return;
            const c=this.c; let cached=this.glows.get(color);
            // Tiny reusable bloom textures, rather than a radial gradient for every blast/frame.
            if (!cached && typeof document !== 'undefined' && document.createElement) {
                cached=document.createElement('canvas'); cached.width=128; cached.height=128;
                const g=cached.getContext('2d'), flare=g.createRadialGradient(64,64,0,64,64,64);
                flare.addColorStop(0,'#ffffffdd'); flare.addColorStop(.12,color+'bb');
                flare.addColorStop(.42,color+'44'); flare.addColorStop(1,color+'00');
                g.fillStyle=flare; g.fillRect(0,0,128,128); this.glows.set(color,cached);
            }
            c.save(); c.globalAlpha*=alpha;
            if (cached) c.drawImage(cached,x-r,y-r,r*2,r*2);
            else this.circle(x,y,r*.3,color,true);
            c.restore();
        }
        arcLink(a,b,color,phase=0,width=2) {
            const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy) || 1;
            const points=[];
            for (let i=0;i<=9;i++) {
                const p=i/9, jitter=i && i < 9 && !this.reduced.matches ? Math.sin(i*19+phase*13)*15*Math.sin(p*Math.PI) : 0;
                points.push({x:a.x+dx*p-dy/d*jitter,y:a.y+dy*p+dx/d*jitter});
            }
            this.line(points,color,width,this.quality > .6 ? 8 : 0);
            this.line(points,'#e6ffff',.65);
        }
        turret(t,aim,game,light) {
            const c=this.c, cyan=light ? '#006e79' : '#65fff0', rapid=game.effects.rapid > 0;
            const age=game.time-t.fired, recoil=Math.max(0,1-age/.16)*7;
            const angle=Math.atan2(aim.y-t.y,aim.x-t.x);
            c.save(); c.translate(t.x,t.y);
            this.glow(0,5,rapid ? 68 : 44,'#43dcca',light ? .25 : .45);
            this.polygon(HULLS.base,light ? '#7893aa' : '#172a43',cyan,1.4);
            this.polygon([[-27,16],[-22,3],[-12,-2],[12,-2],[22,3],[27,16]],light ? '#c9d8e4' : '#304960','#7494b2');
            c.fillStyle=light ? '#2f465c' : '#0a162b'; c.fillRect(-21,16,42,9);
            for (const x of [-18,-12,-6,0,6,12,18]) this.line([{x,y:18},{x:x-2,y:23}],cyan,.8);
            this.circle(0,-3,17,'#7893b0',true); this.circle(0,-3,14,cyan,false,8);
            this.circle(0,-3,9,light ? '#425776' : '#0f1730',true);
            c.save(); c.translate(0,-3); c.rotate(angle); c.translate(-recoil,0);
            this.polygon([[-9,-9],[17,-8],[22,-5],[38,-5],[38,5],[22,5],[17,8],[-9,9]],light ? '#768da5' : '#273e5a',cyan);
            c.fillStyle=light ? '#daeef6' : '#91afc7'; c.fillRect(6,-6,24,3);
            c.fillStyle='#0c1830'; c.fillRect(10,-2,25,4); c.fillRect(36,-7,5,14);
            this.line([{x:39,y:-6},{x:39,y:6}],rapid ? '#eeffff' : cyan,2,8);
            for (const x of [9,14,19]) this.line([{x,y:2},{x:x+2,y:5}],'#52718b',1);
            if (age < .14 && !this.reduced.matches) {
                this.glow(44,0,rapid ? 42 : 28,'#6effef',1-age/.14);
                this.polygon([[41,-4],[rapid ? 74 : 61,0],[41,4]],'#edffff',cyan,1.5,12);
            }
            c.restore();
            if (rapid) {
                c.save(); c.rotate(game.time*5); c.setLineDash([8,5]); this.circle(0,-3,25,cyan,false,8); c.restore();
            }
            const ready=Math.min(1,Math.max(0,1-(t.ready-game.time)/(game.reload*(rapid ? .5 : 1))));
            for (let i=0;i<5;i++) { c.fillStyle=i/5 < ready ? cyan : '#344459'; c.fillRect(-21+i*9,30,6,3); }
            c.restore();
        }
        missile(e,light,t,ghost=false) {
            const c=this.c, color=COLORS[e.type], angle=Math.atan2(GROUND-e.y,e.target-e.x);
            c.save(); c.translate(e.x,e.y); c.rotate(angle);
            if (!ghost) {
                const flicker=this.reduced.matches ? 1 : 1+Math.sin(t*37+e.id)*.18;
                this.glow(-19,0,19,color,light ? .35 : .8);
                this.polygon([[-10,-3],[-(e.type === 'fast' ? 34 : 24)*flicker,0],[-10,3]],color,null);
                this.polygon([[-10,-1.5],[-20*flicker,0],[-10,1.5]],'#fff4ca',null);
            }
            this.polygon(e.type === 'armored' ? HULLS.armor : HULLS.missile,
                ghost ? null : light ? '#526679' : '#243345',light ? ({normal:'#9c1740',fast:'#7a4d00',split:'#7336a4',armored:'#98510c'}[e.type]) : color,1.3,ghost ? 0 : 5);
            if (!ghost) {
                this.line([{x:-6,y:-2},{x:7,y:-2}],'#d8e6f7',1.4);
                this.line([{x:7,y:-3},{x:12,y:0},{x:7,y:3}],color,2);
                if (e.type === 'armored') {
                    this.polygon([[-5,-5],[4,-5],[8,0],[4,5],[-5,5]],'#62523a','#ffcf77');
                    if (e.hp === 1) this.line([{x:-5,y:-5},{x:0,y:0},{x:-3,y:3},{x:4,y:5}],'#fff6cf',1.5);
                }
                if (e.type === 'split') {
                    this.line([{x:-6,y:-6},{x:1,y:-6},{x:6,y:0},{x:1,y:6},{x:-6,y:6}],color,1.5);
                    this.circle(0,0,2,'#f2d6ff',true);
                }
            }
            c.restore();
        }
        plane(e,light,t,ghost=false) {
            const c=this.c, color=light ? '#8c2268' : '#ff80de';
            c.save(); c.translate(e.x,e.y); c.scale(Math.sign(e.vx),1);
            for (const y of [-9,9]) {
                if (!ghost) {
                    this.glow(-29,y,22,'#ff72dc',light ? .25 : .7);
                    this.polygon([[-27,y-2],[-47-(this.reduced.matches ? 0 : Math.sin(t*45)*3),y],[-27,y+2]],'#ff94e5',null);
                }
            }
            this.polygon(HULLS.plane,ghost ? null : light ? '#7e869f' : '#322d4c',color,1.4,ghost ? 0 : 5);
            if (!ghost) {
                this.polygon([[-8,-5],[14,-4],[27,0],[14,4],[-8,5]],light ? '#acbaca' : '#60516f','#ab9caf');
                this.polygon([[10,-3],[19,-2],[23,0],[19,2],[10,3]],'#9dfcff','#49d9ec',.8,5);
                for (const y of [-9,9]) {
                    this.polygon([[-25,y-3],[-11,y-3],[-9,y+3],[-25,y+3]],'#18293f','#98a5bb',.8);
                    this.line([{x:-26,y:y-2},{x:-26,y:y+2}],'#ffd2f5',2,6);
                }
                this.line([{x:-15,y:-12},{x:2,y:-5}],color,1);
                this.line([{x:-15,y:12},{x:2,y:5}],color,1);
                c.fillStyle='#0b1325'; c.fillRect(-8,-2,11,4);
                this.line([{x:-7,y:0},{x:2,y:0}],this.clock%1 < .5 ? '#ffafdf' : '#f4d687',1);
                if (e.hp < 3) {
                    this.line([{x:-10,y:-9},{x:-2,y:-3},{x:-5,y:2},{x:6,y:5}],'#ffc090',1.5);
                    this.glow(-12,-6,10,'#ff7439',.65);
                    for (let i=0;i<3;i++) {
                        this.circle(-23-i*7-Math.sin(t*3+i)*3,-5-i*3,4+i,light ? '#575c68' : '#807183',true);
                    }
                    if (e.hp === 1) this.line([{x:-22,y:10},{x:-10,y:7},{x:-18,y:4}],'#ffda90',2,7);
                }
            }
            c.restore();
        }
        city(city, light) {
            const c = this.c, x = city.x, y = GROUND, hp = city.hp;
            const color = hp === 3 ? (light ? '#006e79' : '#66fff0')
                : hp === 2 ? (light ? '#855600' : '#ffc468')
                    : (light ? '#913a58' : '#ff739c');
            if (hp === 0) {
                c.fillStyle = light ? '#725b70' : '#392a42';
                for (const points of [
                    [[-30, 0], [-30, -9], [-19, -17], [-10, -6], [0, -12], [8, 0]],
                    [[4, 0], [12, -10], [20, -6], [27, -16], [31, 0]],
                ]) {
                    c.beginPath(); points.forEach(([dx, dy], i) => i ? c.lineTo(x + dx, y + dy) : c.moveTo(x + dx, y + dy));
                    c.closePath(); c.fill();
                }
                this.line([{ x: x - 30, y: y - 9 }, { x: x - 19, y: y - 17 }, { x: x - 10, y: y - 6 },
                    { x, y: y - 12 }, { x: x + 8, y }], color, 2);
                this.line([{ x: x + 12, y: y - 10 }, { x: x + 20, y: y - 6 }, { x: x + 27, y: y - 16 },
                    { x: x + 31, y }], color, 2);
                c.fillStyle = light ? '#463e53' : '#171b30';
                c.fillRect(x - 17, y - 5, 8, 4); c.fillRect(x + 17, y - 8, 7, 5);
            } else {
                const outline = hp === 3
                    ? [[-28, 0], [-28, -43], [-10, -43], [-10, -55], [9, -55], [9, -43], [28, -43], [28, 0]]
                    : hp === 2
                        ? [[-28, 0], [-28, -43], [-16, -43], [-11, -35], [-6, -49], [9, -49], [9, -43], [23, -43], [28, -36], [28, 0]]
                        : [[-28, 0], [-28, -24], [-18, -29], [-9, -18], [-2, -35], [7, -27], [14, -31], [22, -17], [28, -21], [28, 0]];
                c.beginPath(); outline.forEach(([dx, dy], i) => i ? c.lineTo(x + dx, y + dy) : c.moveTo(x + dx, y + dy));
                c.closePath(); c.fillStyle = hp === 3 ? (light ? '#d5eef3' : '#10374b')
                    : hp === 2 ? (light ? '#e6d9cb' : '#443447') : (light ? '#b9a9b9' : '#4e2b45');
                c.fill();
                this.line(outline.map(([dx, dy]) => ({ x: x + dx, y: y + dy })), color, 2, light ? 0 : 6);
                // Panel seams, recessed facade, rooftop equipment and small window banks.
                c.fillStyle=light ? '#91a8b8' : '#1d263c'; c.fillRect(x+19,y-(hp === 1 ? 15 : 34),7,hp === 1 ? 15 : 34);
                this.line([{x:x-27,y:y-3},{x:x+27,y:y-3}],color,1);
                for (const dy of hp === 1 ? [-8] : [-8,-23,-38]) this.line([{x:x-26,y:y+dy},{x:x+18,y:y+dy}],light ? '#708da5' : '#466276',.7);
                if (hp === 3) {
                    c.fillStyle=light ? '#4a6980' : '#778ba4'; c.fillRect(x-7,y-53,5,4); c.fillRect(x+2,y-53,4,4);
                    this.line([{x:x+7,y:y-55},{x:x+7,y:y-64}],color,1,4);
                    this.circle(x+7,y-65,1.8,color,true,4);
                }
                if (hp === 3) {
                    c.fillStyle = light ? '#006e79' : '#81fff2';
                    for (const dx of [-22,-16,-8,-2,6,12]) for (const dy of [-33,-28,-19,-14,-8]) c.fillRect(x+dx,y+dy,3,3);
                } else {
                    c.fillStyle = light ? '#3c4155' : '#141827';
                    for (const [dx, dy] of hp === 2 ? [[-19, -31], [-4, -30], [10, -31], [-18, -17], [8, -17]]
                        : [[-19, -17], [-4, -19], [11, -15]]) c.fillRect(x + dx, y + dy, 8, 7);
                    this.line(hp === 2
                        ? [{ x: x + 9, y: y - 49 }, { x: x + 3, y: y - 35 }, { x: x + 13, y: y - 27 }, { x: x + 7, y: y - 12 }]
                        : [{ x: x - 2, y: y - 35 }, { x: x - 8, y: y - 17 }, { x: x + 4, y: y - 11 }, { x: x - 2, y }],
                    light ? '#65345b' : '#ffd3b3', 2);
                    if (hp === 1) this.line([{ x: x + 22, y: y - 17 }, { x: x + 15, y: y - 3 }], color, 2);
                }
            }
            for (let j = 0; j < 3; j++) {
                c.fillStyle = j < hp ? color : (light ? '#8c91a2' : '#3c435b');
                c.fillRect(x - 23 + j * 17, y + 11, 12, 4);
            }
            if (city.shield && hp) {
                const shield=light ? '#314cac' : '#80c9ff';
                this.circle(x,y-24,43,shield,false,10);
                const points=Array.from({length:9},(_,i) => [x+Math.cos(i/8*Math.PI*2)*43,y-24+Math.sin(i/8*Math.PI*2)*43]);
                this.polygon(points,null,shield,.8);
                this.line([{x:x-30,y:y-54},{x,y:y-66},{x:x+30,y:y-54}],shield,.8);
                this.line([{x:x-39,y:y-7},{x,y:y-45},{x:x+39,y:y-7}],shield,.8);
            }
        }
        advance(dt, game) {
            this.clock+=dt;
            const factor=game?.effects.slow > 0 ? .65 : 1;
            for (const p of this.particles) {
                p.life-=dt; p.x+=p.vx*dt*factor; p.y+=p.vy*dt*factor; p.vy+=30*dt;
            }
            this.particles=this.particles.filter(p => p.life > 0);
            for (const p of this.debris) {
                p.life-=dt; p.x+=p.vx*dt; p.y+=p.vy*dt; p.vy+=200*dt; p.angle+=p.spin*dt;
            }
            this.debris=this.debris.filter(p => p.life > 0);
            for (const fx of this.vfx) fx.age+=dt;
            this.vfx=this.vfx.filter(fx => fx.age < fx.duration);
            for (const l of this.labels) { l.life-=dt; l.y-=dt*22; }
            this.labels=this.labels.filter(l => l.life > 0);
            this.shake=Math.max(0,(this.shock?.end || 0)-this.clock);
            this.flash=Math.max(0,this.flash-dt);
        }
        background(game,light,t) {
            const c=this.c, bg=c.createLinearGradient(0,0,0,H);
            bg.addColorStop(0,light ? '#dae4f5' : '#06071c');
            bg.addColorStop(.65,light ? '#d6e7ed' : '#0c1836');
            bg.addColorStop(1,light ? '#b5ccd5' : '#071823');
            c.fillStyle=bg; c.fillRect(-24,-24,W+48,H+48);
            c.save();
            if (game?.effects.slow > 0 && !this.reduced.matches) {
                c.translate(Math.sin(t*2)*4,Math.cos(t*1.4)*3);
                c.transform(1,Math.sin(t)*.004,Math.cos(t*.7)*.006,1,0,0);
            }
            for (const [x,y,color] of [[170,170,'#883dcb'],[780,270,'#0ebfa9'],[520,50,'#30368e']])
                this.glow(x,y,440,color,light ? .09 : .24);
            c.globalAlpha=light ? .17 : .3;
            for (let i=0;i<5;i++) {
                c.beginPath(); c.moveTo(-40,140+i*48);
                const sway=this.reduced.matches ? 0 : Math.sin(t*.25+i)*25;
                c.bezierCurveTo(300,40+i*20+sway,490,330+i*20-sway,1000,90+i*55);
                c.strokeStyle=i%2 ? '#b56df6' : '#36e9db'; c.lineWidth=3+i*2;
                c.shadowColor=c.strokeStyle; c.shadowBlur=18; c.stroke(); c.shadowBlur=0;
            }
            c.globalAlpha=1;
            for (let i=0;i<100;i++) {
                c.fillStyle=light ? '#8295ba' : 'rgba(178,205,255,'+(.2+(i%4)*.15)+')';
                c.fillRect((i*137.51)%W,(i*i*7.73)%570,i%3 ? 1 : 2,2);
            }
            if (game?.effects.slow > 0) {
                for (let i=0;i<4;i++) {
                    const radius=90+((this.reduced.matches ? i*.6 : t*.4+i*.6)%2.4)*160;
                    c.globalAlpha=.12; this.circle(480,300,radius,light ? '#544699' : '#a094ff');
                }
                c.globalAlpha=1;
                this.glow(480,300,480,'#8a6dff',light ? .08 : .15);
            }
            c.restore();
            c.strokeStyle=light ? '#92b0c2' : '#16485c'; c.lineWidth=1;
            for (let y=GROUND;y<H;y+=14) { c.beginPath(); c.moveTo(0,y); c.lineTo(W,y); c.stroke(); }
            for (let x=-W;x<W*2;x+=90) {
                c.beginPath(); c.moveTo(W/2+(x-W/2)*.55,GROUND); c.lineTo(x,H); c.stroke();
            }
            for (let i=0;i<44;i++) {
                const bh=15+(i*37)%70; c.fillStyle=light ? '#91aebf' : '#101e37';
                c.fillRect(i*24,GROUND-bh,19,bh);
                c.fillStyle=light ? '#7897af' : '#23435c';
                for (let j=10;j<bh;j+=12) c.fillRect(i*24+4,GROUND-j,3,3);
            }
            this.line([{x:0,y:GROUND},{x:W,y:GROUND}],light ? '#006e79' : '#66fff0',2,10);
            if (game?.boss?.rage) {
                this.glow(game.boss.x,120,500,'#ff246f',light ? .1 : .21);
                c.fillStyle=light ? '#94274e' : '#ff6688'; c.font='10px monospace'; c.textAlign='left';
                c.fillText('WARNING / REACTOR OVERDRIVE',20,32);
            }
        }
        blast(b,light,glowing) {
            const c=this.c, color=b.boosted ? '#ff61d2' : b.depth ? '#d777ff' : '#55ffef';
            c.save(); c.globalAlpha=Math.max(0,1-b.age);
            if (!light) c.globalCompositeOperation='screen';
            const fancy=glowing < Math.floor(24*this.quality) && !this.reduced.matches;
            if (fancy) this.glow(b.x,b.y,b.r*1.7,color,.9);
            this.circle(b.x,b.y,b.r,light ? (b.boosted ? '#923774' : '#007484') : color,false,fancy ? 10 : 0);
            c.globalAlpha*=.65; this.circle(b.x,b.y,b.r*.76,light ? '#596992' : '#dcffff');
            this.circle(b.x,b.y,b.radius*(.35+b.age*1.1),color);
            if (fancy) {
                this.glow(b.x,b.y,Math.max(6,b.r*.3),'#e0ffff',Math.max(0,1-b.age*2));
                const arcs=b.boosted ? 7 : 4;
                for (let i=0;i<arcs;i++) {
                    const angle=i/arcs*Math.PI*2+b.id;
                    this.arcLink({x:b.x+Math.cos(angle)*b.r*.7,y:b.y+Math.sin(angle)*b.r*.7},
                        {x:b.x+Math.cos(angle+.32)*b.r,y:b.y+Math.sin(angle+.32)*b.r},color,b.age+b.id,.9);
                }
            }
            c.restore();
        }
        drawEffects(light) {
            const c=this.c;
            for (const fx of this.vfx) {
                const p=fx.age/fx.duration, fade=1-p;
                c.save(); c.globalAlpha=fade*.85;
                if (!light) c.globalCompositeOperation='screen';
                if (['rapid','wide','shield'].includes(fx.kind)) {
                    for (const target of fx.targets) {
                        const dx=target.x-fx.x,dy=target.y-fx.y;
                        this.arcLink(fx,target,fx.color,fx.age,1.6);
                        const u=Math.min(1,p*2);
                        this.glow(fx.x+dx*u,fx.y+dy*u,28,fx.color,.8);
                        this.circle(target.x,target.y,12+p*65,fx.color);
                    }
                    this.circle(fx.x,fx.y,30+p*120,fx.color);
                } else if (fx.kind === 'emp') {
                    const r=fx.radius*Math.min(1,p*1.5);
                    this.circle(fx.x,fx.y,r,light ? '#5b36a0' : fx.color,false,this.reduced.matches ? 0 : 12);
                    this.circle(fx.x,fx.y,r*.92,light ? '#6331a8' : '#e1dcff');
                    this.glow(fx.x,fx.y,150,'#bc87ff',fade*.8);
                    for (const target of fx.targets) {
                        this.arcLink(fx,target,light ? '#54368e' : fx.color,fx.age,2.5);
                        const mid={x:(fx.x+target.x)/2,y:(fx.y+target.y)/2};
                        this.arcLink(mid,{x:target.x+20,y:target.y-30},fx.color,fx.age+1,1);
                        this.glow(target.x,target.y,35,fx.color,.7);
                    }
                } else if (fx.kind === 'slow') {
                    this.circle(fx.x,fx.y,35+p*400,light ? '#58438f' : fx.color,false,8);
                    this.circle(fx.x,fx.y,20+p*280,fx.color);
                    c.save(); c.translate(fx.x,fx.y); c.rotate(this.reduced.matches ? 0 : -p*2);
                    c.setLineDash([12,18]); this.circle(0,0,65+p*130,fx.color); c.restore();
                } else if (fx.kind === 'shieldHit') {
                    this.circle(fx.x,fx.y,43+p*80,fx.color);
                    for (let i=0;i<6;i++) {
                        const a=i/6*Math.PI*2;
                        this.arcLink({x:fx.x+Math.cos(a)*18,y:fx.y+Math.sin(a)*18},
                            {x:fx.x+Math.cos(a+.2)*43,y:fx.y+Math.sin(a+.2)*43},fx.color,fx.age,1.5);
                    }
                } else {
                    const death=fx.kind === 'bossDeath', radius=fx.radius*(death ? Math.min(1,p*1.7) : p);
                    this.circle(fx.x,fx.y,radius,light ? '#844368' : fx.color,false,8);
                    this.circle(fx.x,fx.y,radius*.83,fx.color);
                    this.glow(fx.x,fx.y,death ? 220*(1-p)+20 : 80*(1-p)+5,fx.color,fade);
                    if (death && !this.reduced.matches) {
                        for (let i=0;i<7;i++) {
                            const a=i*2.39;
                            this.glow(fx.x+Math.cos(a)*(35+p*150),fx.y+Math.sin(a)*40,40*(1-p),i%2 ? '#ffbd75' : '#e2b3ff',.9);
                        }
                    }
                }
                c.restore();
            }
            for (const p of this.debris) {
                c.save(); c.translate(p.x,p.y); c.rotate(p.angle); c.globalAlpha=Math.min(1,p.life);
                this.polygon([[-p.size,-4],[p.size,-6],[p.size*.5,5],[-p.size*.6,4]],light ? '#7a738d' : '#302b4c','#ff94d5',1);
                this.glow(-p.size,0,15,'#ff893d',.5); c.restore();
            }
            c.save(); if (!light) c.globalCompositeOperation='screen';
            for (const p of this.particles) {
                c.globalAlpha=Math.max(0,Math.min(1,p.life/p.maxLife));
                this.line([{x:p.x-p.vx*.018,y:p.y-p.vy*.018},{x:p.x,y:p.y}],light ? '#6971a4' : p.color,p.size);
            }
            c.restore();
            for (const label of this.labels) {
                c.globalAlpha=Math.min(1,label.life*2); c.fillStyle=light ? '#7136a3' : '#edbeff';
                c.font='bold 16px monospace'; c.textAlign='center'; c.fillText(label.text,label.x,label.y);
            }
            c.globalAlpha=1;
        }
        draw(game,aim,dt=0) {
            const start=typeof performance !== 'undefined' ? performance.now() : 0;
            const c=this.c, light=document.documentElement.dataset.theme === 'light', t=game?.time || 0;
            this.glowBudget=Math.floor(96*this.quality);
            this.advance(dt,game);
            c.setTransform(this.dpr,0,0,this.dpr,0,0); c.clearRect(0,0,W,H);
            c.save(); const offset=this.offset(); c.translate(offset.x,offset.y);
            this.background(game,light,t);
            const cyan=light ? '#006e79' : '#66fff0';
            if (game) {
                for (const city of game.cities) this.city(city,light);
                for (const turret of game.turrets) this.turret(turret,aim,game,light);
                for (const s of game.shots) {
                    this.line(s.trail,cyan+'35',s.rapid ? 8 : 5);
                    this.line([...s.trail,s],cyan,s.rapid ? 3 : 2,6);
                    this.glow(s.x,s.y,s.rapid ? 18 : 12,'#58ffee',.8);
                    this.circle(s.x,s.y,2.5,light ? '#006775' : '#ffffff',true);
                }
                for (const e of game.enemies) {
                    const color=COLORS[e.type];
                    this.line(e.trail,color+'33',e.type === 'fast' ? 6 : 4);
                    this.line(e.trail,light ? '#8f4c71' : color,e.type === 'fast' ? 2.2 : 1.2);
                    const paint=e.type === 'cruiser' ? this.plane : this.missile;
                    if (game.effects.slow > 0 && !this.reduced.matches) {
                        c.save(); c.globalAlpha=.25;
                        for (const n of [8,17]) {
                            c.save(); c.translate(e.type === 'cruiser' ? -Math.sign(e.vx)*n : -n*.4,-n);
                            paint.call(this,e,light,t,true); c.restore();
                        }
                        c.restore();
                    }
                    paint.call(this,e,light,t);
                }
                let glowing=0; for (const b of game.blasts) this.blast(b,light,glowing++);
                for (const item of game.items) {
                    const color=POWER_COLORS[item.type], r=24;
                    this.glow(item.x,item.y,45,color,light ? .2 : .5);
                    c.save(); c.translate(item.x,item.y); c.rotate(this.reduced.matches ? 0 : t*.6);
                    this.polygon([[0,-r],[r,0],[0,r],[-r,0]],light ? '#e3e6ef' : '#131e36',light ? '#6554a0' : color,1.6,8); c.restore();
                    c.fillStyle=light ? '#534181' : color; c.textAlign='center'; c.font='bold 24px monospace';
                    c.fillText(ICONS[item.type],item.x,item.y+8); c.font='10px monospace';
                    c.fillText(Math.ceil(item.life)+'s',item.x,item.y+40);
                }
                if (game.boss && !game.boss.dead) this.boss(game.boss,light,t);
            }
            this.drawEffects(light);
            if (this.flash > 0 && !this.reduced.matches) {
                c.fillStyle='rgba(255,110,161,'+this.flash+')'; c.fillRect(-24,-24,W+48,H+48);
            }
            c.restore();
            // Reticle and combat information never inherit the battlefield shake/warp.
            if (game?.boss && !game.boss.dead) this.bossHud(game.boss,light);
            this.circle(aim.x,aim.y,14,cyan);
            for (const [dx,dy] of [[-1,0],[1,0],[0,-1],[0,1]])
                this.line([{x:aim.x+dx*19,y:aim.y+dy*19},{x:aim.x+dx*25,y:aim.y+dy*25}],cyan);
            if (game) {
                c.font='11px monospace'; c.textAlign='right'; c.fillStyle=light ? '#426276' : '#91bacc';
                c.fillText('WAVE '+game.wave+' / '+game.config.waves+' · '+game.spawned+' / '+game.config.count, W-20,H-17);
            }
            if (start) {
                const cost=performance.now()-start;
                this.frameCost=this.frameCost*.95+cost*.05;
                this.quality=this.frameCost > 18 ? .55 : this.frameCost < 11 ? 1 : this.quality;
            }
        }
        boss(b,light,t=0) {
            const c=this.c, final=b.variant === 'ark', color=b.rage ? '#ff527f' : '#bd90ff';
            const edge=light ? (b.rage ? '#9b2253' : '#65528d') : color;
            const shielded=b.nodes.some(h => h > 0), age=Math.max(0,t-b.transitionAt);
            const open=shielded ? 0 : Math.min(1,age/.8), spread=open*(final ? 15 : 9);
            c.save(); c.translate(b.x,b.y);
            this.glow(0,0,final ? 280 : 200,color,light ? .12 : .35);
            // Layered swept armor wings, reactor conduits and engine arrays.
            for (const side of [-1,1]) {
                c.save(); c.scale(side,1); c.translate(spread,0);
                const wing=final ? [[24,-22],[78,-47],[144,-26],[196,-36],[231,-1],[183,29],[116,39],[38,21]]
                    : [[22,-19],[68,-31],[101,-27],[150,0],[112,25],[57,32],[24,18]];
                this.polygon(wing,light ? '#79849e' : '#211f3c',edge,2,10);
                this.polygon(final ? [[54,-19],[84,-36],[139,-17],[181,-23],[207,-2],[166,16],[98,23]]
                    : [[49,-13],[75,-23],[104,-17],[129,-1],[102,14],[57,20]],
                    light ? '#c1bfd1' : '#45405f','#9387ac',1);
                this.polygon(final ? [[117,-12],[168,-16],[189,-2],[154,6],[119,10]]
                    : [[69,-9],[105,-11],[116,-1],[98,7],[72,12]],'#151e37',edge,1);
                for (let i=0;i<(final ? 5 : 3);i++) {
                    const x=54+i*29,y=final ? 15+Math.sin(i)*6 : 13;
                    this.polygon([[x-9,y],[x+8,y],[x+9,y+16],[x-9,y+16]],light ? '#4d5971' : '#11192e','#8e87a4',.8);
                    const flame=shielded ? 20 : b.rage ? 62 : 35;
                    this.polygon([[x-7,y+14],[x+7,y+14],[x,y+flame+(this.reduced.matches ? 0 : Math.sin(t*27+i)*6)]],
                        b.rage ? '#ff6894' : '#bc93ff',null);
                    this.glow(x,y+20,b.rage ? 30 : 20,b.rage ? '#ff4678' : '#b083ff',light ? .25 : .7);
                    this.line([{x:x-6,y:y+13},{x:x+6,y:y+13}],'#f0d8ff',2,5);
                }
                for (let i=0;i<6;i++) {
                    const x=40+i*15;
                    this.line([{x,y:-21},{x:x+7,y:-17}],edge,1);
                    c.fillStyle=light ? '#4e5271' : '#afa0ce'; c.fillRect(x,-8,4,2);
                }
                c.restore();
            }
            // Armored reactor housing opens visibly when the shield nodes fall.
            this.polygon([[0,-55],[-39,-29],[-40,22],[-22,43],[22,43],[40,22],[39,-29]],
                light ? '#8b8caa' : '#34304f',edge,2,12);
            for (const side of [-1,1]) {
                c.save(); c.translate(side*open*25,0);
                this.polygon([[side*5,-40],[side*27,-25],[side*29,19],[side*6,32]],
                    light ? '#c3c3d2' : '#615b7b','#c3b9da',1.1);
                c.restore();
            }
            this.circle(0,0,28,shielded ? '#576584' : edge,true,10);
            this.circle(0,0,23,light ? '#192c49' : '#101028',true);
            c.save(); c.rotate(this.reduced.matches ? 0 : t*(b.rage ? 1.9 : .6));
            const ring=Array.from({length:7},(_,i) => [Math.cos(i*Math.PI/3)*22,Math.sin(i*Math.PI/3)*22]);
            this.polygon(ring,null,shielded ? '#5f9aaa' : '#ffcb91',1.5,10);
            c.restore();
            const coreColor=shielded ? '#73a6c6' : b.rage ? '#fff1b8' : '#ffd787';
            this.glow(0,0,shielded ? 20 : b.rage ? 55 : 37,shielded ? '#5996c0' : '#ff8557',.8);
            this.circle(0,0,shielded ? 8 : 12,coreColor,true,12);
            if (b.charge) {
                const charge=Math.max(0,1-b.nextAttack/.7);
                for (let i=0;i<4;i++) {
                    const a=i/4*Math.PI*2+t;
                    this.arcLink({x:Math.cos(a)*70,y:Math.sin(a)*45},{x:0,y:0},color,t+i,1.2);
                }
                this.circle(0,0,32+charge*20,color,false,10);
            }
            b.nodes.forEach((hp,i) => {
                const x=b.offsets[i];
                if (hp) {
                    this.arcLink({x,y:0},{x:0,y:0},light ? '#316da3' : '#77dfff',t+i,.8);
                    this.circle(x,0,21,light ? '#344773' : '#152342',true);
                    this.circle(x,0,21,light ? '#316da3' : '#65f8ff',false,12);
                    c.save(); c.translate(x,0); c.rotate(this.reduced.matches ? 0 : -t*.8);
                    this.polygon([[-13,-13],[13,-13],[13,13],[-13,13]],null,'#a8eaff',1);
                    c.restore();
                    this.glow(x,0,22,'#60dfff',hp/b.maxNodeHp*.8);
                    c.fillStyle=light ? '#174e83' : '#d0ffff'; c.font='bold 13px monospace'; c.textAlign='center'; c.fillText(hp,x,5);
                } else {
                    this.circle(x,0,15,light ? '#685568' : '#462b46',true);
                    this.line([{x:x-10,y:-8},{x:x+4,y:3},{x:x-3,y:10}],'#b9566b',1.5);
                }
            });
            c.restore();
            // Stable, screen-space boss bar: maximum health is supplied by game data.
        }
        bossHud(b,light) {
            const c=this.c, final=b.variant === 'ark', shielded=b.nodes.some(h => h > 0);
            const edge=light ? (b.rage ? '#9b2253' : '#65528d') : (b.rage ? '#ff527f' : '#bd90ff');
            const width=final ? 360 : 250, x=W/2-width/2, y=42;
            c.fillStyle=light ? '#9596b2' : '#342c4a'; c.fillRect(x,y,width,6);
            c.fillStyle=edge; c.fillRect(x,y,width*Math.max(0,b.hp)/b.maxHp,6);
            c.font='11px monospace'; c.textAlign='center'; c.fillStyle=light ? '#5a356e' : '#e5c5ff';
            c.fillText((final ? 'ARK / ' : 'MOTHERSHIP / ')+(shielded ? 'SHIELD ARRAY' : b.rage ? 'OVERDRIVE' : 'CORE EXPOSED')+' · '+b.hp+'/'+b.maxHp,W/2,y-10);
        }
    }
    globalThis.NeonDefenseRenderer = Renderer;
})();
