(() => {
    'use strict';
    const W = 720, H = 540, GROUND = 510, BIRD_X = 160, GATE_W = 76;
    const TAU = Math.PI * 2;
    const palettes = {
        dark: { sky: ['#080f25','#172649','#255063'], mist: '#70dedd', moon: '#c4f7ee', far: '#273650', near: '#122b40',
            metal: '#122c41', panel: '#244e60', edge: '#45808e', rim: '#75f5d6', core: '#30e8bd', shadow: '#061622', spark: '#a1fff1' },
        light: { sky: ['#afd8eb','#d5edf0','#f4e8d2'], mist: '#fff8e6', moon: '#fff9dd', far: '#8caebc', near: '#557f90',
            metal: '#285368', panel: '#477c8a', edge: '#83b3bb', rim: '#c7ffe8', core: '#08a888', shadow: '#17384c', spark: '#127973' },
    };

    class Renderer {
        constructor(canvas, preview) {
            this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.preview = preview;
            this.motion = matchMedia('(prefers-reduced-motion: reduce)');
            this.backdrop = document.createElement('canvas'); this.backdrop.width = W; this.backdrop.height = H;
            this.backdropTheme = null; this.ratio = 0; this.reset();
        }
        reset() { this.particles = []; this.rings = []; this.flapAge = 1; this.clock = 0; }
        get reduced() { return this.motion.matches; }
        advance(delta) {
            this.clock += delta; this.flapAge += delta;
            this.particles.forEach(p => { p.life -= delta; p.x += p.vx * delta; p.y += p.vy * delta; p.vy += 18 * delta; });
            this.rings.forEach(r => { r.life -= delta; });
            this.particles = this.particles.filter(p => p.life > 0);
            this.rings = this.rings.filter(r => r.life > 0);
        }
        burst(x, y, count, kind) {
            if (this.reduced) return;
            for (let i = 0; i < count; i++) {
                const a = i * 2.39996 + this.clock, speed = 24 + (i % 5) * 13;
                this.particles.push({ x, y, vx: Math.cos(a) * speed - 30, vy: Math.sin(a) * speed,
                    life: .45 + (i % 4) * .09, max: .72, size: 1.3 + (i % 3) * .8, kind });
            }
            this.particles = this.particles.slice(-64);
        }
        flap(y) { this.flapAge = 0; this.burst(BIRD_X - 19, y + 7, 5, 'feather'); }
        pass(x, y) {
            if (!this.reduced) { this.rings.push({ x, y, life: .65, max: .65 }); this.rings = this.rings.slice(-6); }
            this.burst(x, y, 14, 'pass');
        }
        lose(y) { this.burst(BIRD_X, y, 20, 'hit'); }
        gradient(ctx, x1, y1, x2, y2, colors) {
            const g = ctx.createLinearGradient(x1, y1, x2, y2);
            colors.forEach((color, i) => g.addColorStop(i / (colors.length - 1), color)); return g;
        }
        polygon(ctx, points, fill, stroke, width = 1) {
            ctx.beginPath(); points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath();
            if (fill) { ctx.fillStyle = fill; ctx.fill(); }
            if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(); }
        }
        ellipse(ctx, x, y, rx, ry, fill, angle = 0) {
            ctx.beginPath(); ctx.ellipse(x, y, rx, ry, angle, 0, TAU); ctx.fillStyle = fill; ctx.fill();
        }
        line(ctx, points, color, width = 1) {
            ctx.beginPath(); points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
            ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
        }
        makeBackdrop(light) {
            if (this.backdropTheme === light) return;
            this.backdropTheme = light;
            const c = this.backdrop.getContext('2d'), p = palettes[light ? 'light' : 'dark'];
            c.fillStyle = this.gradient(c, 0, 0, 0, H, p.sky); c.fillRect(0, 0, W, H);
            const halo = c.createRadialGradient(530, 116, 12, 530, 116, 220);
            halo.addColorStop(0, light ? '#fff2cf99' : '#72ead524'); halo.addColorStop(1, '#80dfdf00');
            c.fillStyle = halo; c.fillRect(0, 0, W, H);
            c.save(); c.translate(530, 116); c.rotate(-.25);
            this.ellipse(c, 0, 0, 43, 43, p.moon);
            c.globalAlpha = light ? .09 : .12;
            for (const [x,y,r] of [[-15,-8,9],[14,18,12],[18,-14,7],[-12,24,5]]) this.ellipse(c,x,y,r,r,p.far);
            c.globalAlpha = .3; c.beginPath(); c.ellipse(0,0,74,12,-.2,0,TAU); c.strokeStyle=p.moon; c.lineWidth=1; c.stroke(); c.restore();
            // Soft aurora bands and clouds are cached, not re-blurred every frame.
            c.save(); c.globalAlpha = light ? .28 : .09;
            for (let i=0; i<5; i++) {
                c.beginPath(); c.moveTo(-80, 100+i*13);
                c.bezierCurveTo(170, -10+i*17, 300, 235+i*12, 780, 45+i*18);
                c.strokeStyle = i % 2 ? '#bba2ff' : p.mist; c.lineWidth = 15-i*2; c.stroke();
            }
            c.restore();
        }
        background(light, time, speed) {
            const c=this.ctx, p=palettes[light?'light':'dark']; this.makeBackdrop(light);
            c.drawImage(this.backdrop,0,0,W,H);
            const t=this.reduced?0:time;
            c.save();
            for(let i=0;i<44;i++) {
                const x=((i*107.3-t*(3+i%4))%W+W)%W, y=22+(i*53)%340;
                c.globalAlpha=(light?.14:.35)+(Math.sin(t*1.2+i)*.08);
                this.ellipse(c,x,y,i%7===0?1.5:.8,i%7===0?1.5:.8,light?'#38677d':'#cdfcff');
                if(i%11===0)this.line(c,[[x-4,y],[x+4,y]],p.moon,.6);
            }
            c.globalAlpha=1;
            for(let layer=0;layer<3;layer++) {
                const base=390+layer*43, step=layer===0?180:104;
                const offset=t*speed*(.025+layer*.018)%step;
                c.globalAlpha=layer===0?.45:.72;
                for(let i=-1;i<9;i++) {
                    const x=i*step-offset, peak=45+(i+9)%4*17;
                    this.polygon(c,[[x,base],[x+step*.3,base-peak],[x+step*.47,base-peak+22],[x+step*.65,base-peak-15],[x+step,base],[x+step,H],[x,H]],layer===0?p.far:p.near);
                    if(layer===2) {
                        c.fillStyle=p.near; c.fillRect(x+21,base-90,15,70); c.fillRect(x+22,base-104,2,14);
                        this.ellipse(c,x+23,base-107,1.3,1.3,p.rim);
                        c.fillStyle=light?'#bfdfd6':'#679f9b';
                        for(let row=0;row<5;row++) { c.fillRect(x+25,base-81+row*11,2,4); c.fillRect(x+31,base-81+row*11,2,4); }
                    }
                }
            }
            // Low fog separates the silhouetted skyline from playable obstacles.
            c.globalAlpha=light?.24:.08;
            for(let i=0;i<7;i++) {
                const x=((i*173-t*11)%(W+240)+W+240)%(W+240)-120;
                this.ellipse(c,x,376+(i%3)*33,140,14,p.mist);
            }
            c.restore();
        }
        pillar(x, top, bottom, isTop, p, time) {
            const c=this.ctx, cap=isTop?bottom-20:top, innerTop=isTop?top:top+20, innerBottom=isTop?bottom-20:bottom;
            c.fillStyle=this.gradient(c,x,0,x+GATE_W,0,[p.shadow,p.panel,p.metal]); c.fillRect(x,top,GATE_W,bottom-top);
            this.line(c,[[x+.8,top],[x+.8,bottom]],p.edge,1.5);
            this.line(c,[[x+GATE_W-1,top],[x+GATE_W-1,bottom]],p.shadow,2);
            c.fillStyle=p.shadow; c.fillRect(x+26,innerTop,24,innerBottom-innerTop);
            c.save(); c.beginPath(); c.rect(x+3,innerTop,GATE_W-6,innerBottom-innerTop); c.clip();
            // Recessed energy rails, cross braces, seam lines and inset fasteners.
            for(let y=Math.floor(innerTop/52)*52;y<innerBottom;y+=52) {
                this.polygon(c,[[x+7,y+3],[x+23,y+13],[x+23,y+42],[x+7,y+49]],p.metal,p.edge,.65);
                this.polygon(c,[[x+53,y+13],[x+69,y+3],[x+69,y+49],[x+53,y+42]],p.metal,p.edge,.65);
                this.line(c,[[x+8,y+8],[x+18,y+14]],p.rim,.7);
                for(const dx of [12,64])this.ellipse(c,x+dx,y+28,1.5,1.5,p.edge);
            }
            c.fillStyle=p.core; c.globalAlpha=.65; c.fillRect(x+31,innerTop,3,innerBottom-innerTop); c.fillRect(x+42,innerTop,3,innerBottom-innerTop);
            c.globalAlpha=1;
            const scroll=this.reduced?0:time*32%34;
            for(let y=innerTop-34+scroll;y<innerBottom;y+=34)this.line(c,[[x+35,y],[x+38,y+4],[x+41,y]],p.rim,1.2);
            c.restore();
            // The cap silhouette matches the existing 92×20 collision rectangle.
            this.polygon(c,[[x-8,cap+4],[x-4,cap],[x+GATE_W+4,cap],[x+GATE_W+8,cap+4],[x+GATE_W+8,cap+16],[x+GATE_W+4,cap+20],[x-4,cap+20],[x-8,cap+16]],
                this.gradient(c,0,cap,0,cap+20,[p.edge,p.metal,p.shadow]),p.rim,1.2);
            const edgeY=isTop?cap+18:cap+2;
            c.save(); c.shadowColor=p.core; c.shadowBlur=this.reduced?0:8;
            this.line(c,[[x-3,edgeY],[x+GATE_W+3,edgeY]],p.rim,2.2); c.restore();
            for(let i=0;i<4;i++) {
                const dx=x+8+i*17;
                this.polygon(c,[[dx+4,cap+6],[dx+7,cap+6],[dx+2,cap+14],[dx-1,cap+14]],'#f6ce77');
            }
            for(const dx of [-2,GATE_W+2])this.ellipse(c,x+dx,cap+10,2,2,p.shadow);
        }
        gate(g,light,time) {
            if(g.x>W+8||g.x+GATE_W<-8)return;
            const p=palettes[light?'light':'dark'];
            this.pillar(g.x,0,g.gapTop,true,p,time);
            this.pillar(g.x,g.gapBottom,GROUND,false,p,time);
        }
        ground(light,time,speed) {
            const c=this.ctx,p=palettes[light?'light':'dark'];
            c.fillStyle=this.gradient(c,0,GROUND,0,H,[p.panel,p.shadow]); c.fillRect(0,GROUND,W,H-GROUND);
            this.line(c,[[0,GROUND+.8],[W,GROUND+.8]],p.rim,1.6);
            this.line(c,[[0,GROUND+6],[W,GROUND+6]],p.edge,1);
            const offset=(this.reduced?0:time*speed)%48;
            for(let x=-offset;x<W;x+=48) {
                this.line(c,[[x,GROUND+8],[x-13,H]],p.shadow,1);
                c.fillStyle=p.edge;c.fillRect(x+8,GROUND+12,14,3);
            }
        }
        wing(c, angle, far=false) {
            c.save(); c.translate(-6,-4); c.rotate(angle);
            const fill=this.gradient(c,-25,-13,0,12,far?['#91ecff','#425fad']:['#b6fff4','#27c7ce','#395bc0']);
            c.beginPath(); c.moveTo(6,1); c.bezierCurveTo(-2,-12,-20,-15,-34,-9);
            c.quadraticCurveTo(-31,-3,-26,-2); c.lineTo(-35,0); c.quadraticCurveTo(-29,6,-23,4);
            c.lineTo(-29,9); c.quadraticCurveTo(-21,13,-15,8); c.quadraticCurveTo(-1,14,6,1);
            c.fillStyle=fill;c.fill();c.strokeStyle='#174568';c.lineWidth=1.1;c.stroke();
            this.line(c,[[-27,-7],[-13,-3],[-2,2]],'#d8fff8',1.2);
            this.line(c,[[-27,1],[-15,2],[-5,5]],'#148393',.8);
            this.line(c,[[-21,7],[-12,5]],'#1e708e',.8);
            c.restore();
        }
        bird(c,x,y,rotation,pose,light,scale=1) {
            c.save(); c.translate(x,y); c.rotate(rotation); c.scale(scale,scale);
            c.lineCap='round';c.lineJoin='round';
            // The far wing and a three-feather fan read as a bird, not an exhaust.
            this.wing(c,pose*.75+.24,true);
            for(let i=0;i<3;i++) {
                c.save();c.translate(-13,5);c.rotate(-.32+i*.29);
                c.beginPath();c.moveTo(2,-4);c.quadraticCurveTo(-15,-6,-25,-1);c.quadraticCurveTo(-19,6,-2,5);c.closePath();
                c.fillStyle=this.gradient(c,-25,0,0,0,['#9789ee','#4c9bc9','#3c9db8']);c.fill();c.strokeStyle='#294b80';c.lineWidth=.8;c.stroke();
                this.line(c,[[-21,0],[-4,1]],'#b0d6ff',.65);c.restore();
            }
            // Tucked toes remain visibly separate from the tail feathers.
            this.line(c,[[-1,13],[2,19],[7,19]],'#e4a557',1.7);
            this.line(c,[[6,12],[10,17],[14,17]],'#ffcb78',1.6);
            c.save();c.shadowColor=light?'#57b7af':'#71f7e7';c.shadowBlur=this.reduced?0:7;
            this.ellipse(c,-1,2,19,16,this.gradient(c,-8,-15,9,18,['#9ffff0','#38bcbe','#237da3']),-.17);c.restore();
            // Warm pear-shaped chest, rounded head, cheek patch and eyebrow.
            c.beginPath();c.moveTo(13,-5);c.bezierCurveTo(23,8,8,22,-2,14);c.bezierCurveTo(-6,7,3,7,5,-3);c.closePath();
            c.fillStyle=this.gradient(c,1,-7,10,18,['#fffbe0','#f8dd9b','#dbb76d']);c.fill();
            this.ellipse(c,10,-9,12,12,this.gradient(c,3,-23,15,2,['#b8fff2','#58ded2','#2da6b6']));
            // Crown feather tufts bend back, without a cockpit-like hard edge.
            c.beginPath();c.moveTo(3,-16);c.quadraticCurveTo(-1,-26,4,-24);c.quadraticCurveTo(6,-24,8,-19);
            c.quadraticCurveTo(7,-27,11,-24);c.quadraticCurveTo(13,-23,13,-18);c.closePath();c.fillStyle='#8aeee0';c.fill();
            this.ellipse(c,15,-5,6.4,6.7,'#f8f4cf',-.25);
            // A short curved upper beak and lower mandible, not a pointed nosecone.
            c.beginPath();c.moveTo(20,-7);c.quadraticCurveTo(29,-7,31,-1);c.quadraticCurveTo(25,1,20,-1);c.closePath();
            c.fillStyle='#ffca61';c.fill();c.strokeStyle='#9e663b';c.lineWidth=.8;c.stroke();
            c.beginPath();c.moveTo(20,0);c.lineTo(28,0);c.quadraticCurveTo(23,5,20,2);c.closePath();c.fillStyle='#e99a4f';c.fill();
            this.ellipse(c,15,-10,4.5,5.1,'#f5fff6');
            this.ellipse(c,16,-10,2.7,3.7,'#112842');this.ellipse(c,16.9,-11.6,1.15,1.35,'#ffffff');
            c.beginPath();c.moveTo(11,-16);c.quadraticCurveTo(16,-19,19,-15);c.strokeStyle='#23768c';c.lineWidth=1.2;c.stroke();
            this.ellipse(c,10,-1,3,1.5,'#e3b77b');
            this.wing(c,pose);
            for(let i=0;i<3;i++)this.line(c,[[i*3+1,10-i],[i*3+2,12-i]],'#d4b579',.6);
            c.restore();
        }
        pose() {
            if(this.reduced)return .35;
            const a=this.flapAge;
            if(a<.09)return .95-a/.09*1.65;
            if(a<.3)return -.7+(a-.09)/.21*1.05;
            return .35+Math.sin(this.clock*4)*.08;
        }
        effects(light) {
            if(this.reduced)return;
            const c=this.ctx,p=palettes[light?'light':'dark']; c.save();
            for(const r of this.rings) {
                const progress=1-r.life/r.max;c.globalAlpha=r.life/r.max*.55;
                c.beginPath();c.ellipse(r.x,r.y,15+progress*40,24+progress*58,0,0,TAU);c.strokeStyle=p.spark;c.lineWidth=1.5;c.stroke();
            }
            for(const s of this.particles) {
                c.globalAlpha=Math.max(0,s.life/s.max);
                if(s.kind==='feather') {c.save();c.translate(s.x,s.y);c.rotate(s.life*4);this.ellipse(c,0,0,s.size*2,s.size*.55,light?'#348ea8':'#8cdfea');c.restore();}
                else {c.fillStyle=s.kind==='hit'?'#f4bf76':p.spark;c.fillRect(s.x,s.y,s.size,s.size);}
            }
            c.restore();
        }
        draw({player,gates,time,speed,state,light}) {
            const ratio=Math.min(2,Math.max(1,window.devicePixelRatio||1));
            if(ratio!==this.ratio) {this.canvas.width=W*ratio;this.canvas.height=H*ratio;this.ratio=ratio;}
            const c=this.ctx;c.setTransform(ratio,0,0,ratio,0,0);c.clearRect(0,0,W,H);
            this.background(light,time,speed);gates.forEach(g=>this.gate(g,light,time));this.ground(light,time,speed);
            this.effects(light);this.bird(c,BIRD_X,player.y,player.rotation,this.pose(),light);
            if(this.preview&&state!=='running') {
                const pc=this.preview.getContext('2d');this.preview.width=200*ratio;this.preview.height=140*ratio;
                pc.setTransform(ratio,0,0,ratio,0,0);pc.clearRect(0,0,200,140);
                this.bird(pc,112,80,-.12,.65,light,2.35);
            }
        }
    }
    window.NeonFlightRenderer=Renderer;
})();
