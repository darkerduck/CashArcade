(() => {
    'use strict';
    class Renderer {
        constructor(canvas) {
            this.canvas=canvas;this.ctx=canvas.getContext('2d');this.reduced=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches||false;
            globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').addEventListener?.('change',e=>{this.reduced=e.matches;if(e.matches){this.ghosts=[];this.shake=0;}});
            this.reset();this.resize();
        }
        resize(){const d=Math.min(2,globalThis.devicePixelRatio||1);this.canvas.width=720*d;this.canvas.height=720*d;this.scale=d;}
        reset(){this.time=0;this.particles=[];this.arcs=[];this.rings=[];this.ghosts=[];this.shake=0;}
        consume(events){
            for(const e of events){
                if(e.type==='arc'){this.arcs.push({points:e.points,life:.16});if(this.arcs.length>12)this.arcs.shift();}
                if(e.type==='ghost'&&!this.reduced){this.ghosts.push({...e,life:.28});if(this.ghosts.length>40)this.ghosts.shift();}
                if(['explode','shield','hurt','bossDown','kill'].includes(e.type)){
                    const color=e.type==='shield'?'#5ceaff':e.type==='hurt'?'#ff758c':e.type==='kill'?'#ae82ff':'#ffd46c';
                    this.rings.push({...e,color,life:e.type==='bossDown'?1:.42,total:e.type==='bossDown'?1:.42,radius:e.radius||(e.type==='bossDown'?160:35)});
                    const count=this.reduced?4:e.type==='bossDown'?55:e.type==='explode'?22:9;
                    for(let i=0;i<count&&this.particles.length<240;i++){const a=i*2.39996+this.time,v=35+(i%7)*26;
                        this.particles.push({x:e.x,y:e.y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:.35+i%5*.12,color,size:e.type==='bossDown'?8:2+i%3});}
                    if(!this.reduced&&['explode','hurt','bossDown'].includes(e.type))this.shake=e.type==='bossDown'?7:3;
                }
            }
            if(this.rings.length>32)this.rings.splice(0,this.rings.length-32);
        }
        update(dt){this.time+=dt;this.shake=Math.max(0,this.shake-dt*18);
            for(const list of [this.particles,this.arcs,this.rings,this.ghosts])for(const e of list){e.life-=dt;if(e.vx!==undefined){e.x+=e.vx*dt;e.y+=e.vy*dt;}}
            this.particles=this.particles.filter(e=>e.life>0);this.arcs=this.arcs.filter(e=>e.life>0);this.rings=this.rings.filter(e=>e.life>0);this.ghosts=this.ghosts.filter(e=>e.life>0);
        }
        line(points,color,width=1){const c=this.ctx;c.strokeStyle=color;c.lineWidth=width;c.beginPath();points.forEach((p,i)=>i?c.lineTo(p[0],p[1]):c.moveTo(p[0],p[1]));c.stroke();}
        polygon(x,y,r,n,angle,color,fill){const c=this.ctx;c.beginPath();for(let i=0;i<n;i++){const a=angle+i*Math.PI*2/n;i?c.lineTo(x+Math.cos(a)*r,y+Math.sin(a)*r):c.moveTo(x+Math.cos(a)*r,y+Math.sin(a)*r);}c.closePath();if(fill){c.fillStyle=fill;c.fill();}c.strokeStyle=color;c.lineWidth=2;c.stroke();}
        circle(x,y,r,color,width=1){const c=this.ctx;c.beginPath();c.arc(x,y,Math.max(0,r),0,Math.PI*2);c.strokeStyle=color;c.lineWidth=width;c.stroke();}
        mech(x,y,angle,alpha=1){const c=this.ctx;c.save();c.translate(x,y);c.rotate(angle+Math.PI/2);c.globalAlpha*=alpha;
            c.fillStyle=this.light?'#dff6fc':'#13283c';c.strokeStyle=this.cyan;c.lineWidth=2;
            c.beginPath();c.moveTo(0,-21);c.lineTo(12,-8);c.lineTo(10,14);c.lineTo(-10,14);c.lineTo(-12,-8);c.closePath();c.fill();c.stroke();
            c.fillStyle=this.violet;c.fillRect(-20,-5,7,17);c.fillRect(13,-5,7,17);c.fillStyle=this.cyan;c.fillRect(-3,-13,6,12);
            c.fillStyle=this.light?'#213655':'#f0ffff';c.fillRect(-3,1,6,5);c.restore();
        }
        background(g){const c=this.ctx,sector=g.config.sector;
            c.fillStyle=this.light?'#eef5fb':'#080f20';c.fillRect(0,0,720,720);
            const grad=c.createRadialGradient(360,300,20,360,360,510);grad.addColorStop(0,this.light?'#dce8f4':['#17233c','#201836','#151b3b'][sector]);grad.addColorStop(1,this.light?'#f4f8fc':'#080f20');c.fillStyle=grad;c.fillRect(0,0,720,720);
            c.strokeStyle=this.light?'#d2dfea':'#19283d';c.lineWidth=1;c.beginPath();for(let n=36;n<720;n+=36){c.moveTo(n,18);c.lineTo(n,702);c.moveTo(18,n);c.lineTo(702,n);}c.stroke();
            c.globalAlpha=.28;
            if(sector===0){for(let n=0;n<4;n++){const y=120+n*160;this.line([[20,y],[100,y],[145,y+35],[575,y+35],[620,y],[700,y]],this.cyan,2);}}
            else if(sector===1){for(const r of [155,225,285]){this.circle(360,360,r,this.violet);this.polygon(360,360,r,6,Math.PI/6,this.violet);}}
            else {for(const r of [100,190,280])this.polygon(360,360,r,8,Math.PI/8,this.cyan);for(let i=0;i<8;i++){const a=i*Math.PI/4;this.line([[360+Math.cos(a)*105,360+Math.sin(a)*105],[360+Math.cos(a)*310,360+Math.sin(a)*310]],this.violet,4);}}
            c.globalAlpha=1;c.strokeStyle=this.light?'#91b1c8':'#395671';c.lineWidth=3;c.strokeRect(13,13,694,694);
            for(const [x,y,sx,sy] of [[13,13,1,1],[707,13,-1,1],[13,707,1,-1],[707,707,-1,-1]])this.line([[x,y+sy*40],[x,y],[x+sx*40,y]],this.cyan,4);
            c.font='10px monospace';c.fillStyle=this.light?'#6f8399':'#60788f';c.textAlign='left';c.fillText(`SECTOR 0${sector+1} / ${['POWER WORKS','ION REACTOR','LOCKDOWN CORE'][sector]}`,28,37);
            c.textAlign='right';c.fillText('BOUNDARY // 720 × 720',692,688);
            c.globalAlpha=.35;for(let i=0;i<4;i++){const a=i*Math.PI/2,x=360+Math.cos(a)*342,y=360+Math.sin(a)*342;this.circle(x,y,18,this.cyan,2);}c.globalAlpha=1;
        }
        draw(g,theme='dark') {
            const c=this.ctx;this.light=theme==='light';this.cyan=this.light?'#007f9d':'#5ceaff';this.violet=this.light?'#773dcc':'#b68cff';this.warm=this.light?'#c24637':'#ff8466';this.gold=this.light?'#9b6608':'#ffd46c';
            c.setTransform(this.scale,0,0,this.scale,0,0);c.save();c.beginPath();c.rect(0,0,720,720);c.clip();
            if(this.shake&&!this.reduced)c.translate(Math.sin(this.time*83)*this.shake,Math.cos(this.time*71)*this.shake);
            this.background(g);
            for(const t of g.trails)if(g.stats.trail){c.globalAlpha=t.life/1.2*.22;this.circle(t.x,t.y,19,this.violet,6);}c.globalAlpha=1;
            for(const b of g.beams){const end=[b.x+Math.cos(b.angle)*b.length,b.y+Math.sin(b.angle)*b.length];
                c.setLineDash(b.warning>0?[12,9]:[]);c.globalAlpha=b.warning>0?.7:1;this.line([[b.x,b.y],end],this.warm,b.warning>0?3:b.width);c.setLineDash([]);
                if(b.warning<=0)this.line([[b.x,b.y],end],this.light?'#ffdcad':'#ffe3b0',3);c.globalAlpha=1;
            }
            for(const w of g.warnings){this.circle(w.x,w.y,25+(1-w.time/1.15)*9,this.warm,2);this.polygon(w.x,w.y,15,3,-Math.PI/2,this.warm);c.fillStyle=this.warm;c.textAlign='center';c.font='bold 15px monospace';c.fillText('!',w.x,w.y+6);}
            for(const p of g.pillars){this.polygon(p.x,p.y,23,6,Math.PI/6,this.gold,this.light?'#fff2d7':'#302b24');this.polygon(p.x,p.y,11,6,Math.PI/6,this.gold);c.fillStyle=this.gold;c.fillRect(p.x-2,p.y-8,4,16);}
            for(const e of g.enemies){
                if(e.windup>0){c.setLineDash([10,8]);this.line([[e.x,e.y],[e.x+e.dx*250,e.y+e.dy*250]],this.warm,3);c.setLineDash([]);}
                if(e.kind==='boss'){
                    c.save();c.translate(e.x,e.y);c.rotate(this.reduced?0:this.time*(g.wave===4?.6:.14));
                    const n=g.wave===4?12:g.wave===8?6:8;
                    for(let i=0;i<n;i++){const a=i*Math.PI*2/n,x=Math.cos(a)*49,y=Math.sin(a)*49;this.polygon(x,y,12,g.wave===4?3:4,a,this.warm,this.light?'#e4dbea':'#2e2542');}
                    this.polygon(0,0,46,8,Math.PI/8,e.overload?this.warm:this.violet,this.light?'#e4dbea':'#23243e');
                    this.polygon(0,0,30,6,0,this.gold);this.circle(0,0,16,e.overload?this.warm:this.gold,5);c.restore();
                    if(e.hp/e.maxHp<.65)this.line([[e.x-28,e.y-20],[e.x-12,e.y],[e.x-25,e.y+14]],this.warm,3);
                } else {
                    const angle=Math.atan2(g.player.y-e.y,g.player.x-e.x),sides={swarm:3,charger:4,shooter:4,guard:6,splitter:5,shard:3}[e.kind];
                    this.polygon(e.x,e.y,e.r,sides,angle,this.warm,this.light?'#fae5e5':'#382333');
                    if(e.kind==='guard')this.polygon(e.x,e.y,e.r-7,6,angle,this.gold);
                    else if(e.kind==='shooter')this.circle(e.x,e.y,6,this.warm,3);
                    else if(e.kind==='splitter'){this.line([[e.x-7,e.y],[e.x+7,e.y]],this.warm,3);this.line([[e.x,e.y-7],[e.x,e.y+7]],this.warm,3);}
                    else {c.fillStyle=this.warm;c.fillRect(e.x-3,e.y-3,6,6);}
                    if(e.hp<e.maxHp){c.fillStyle=this.warm;c.fillRect(e.x-e.r,e.y-e.r-8,2*e.r*e.hp/e.maxHp,3);}
                }
            }
            for(const b of g.bullets){c.fillStyle=this.warm;c.beginPath();c.arc(b.x,b.y,b.r+1,0,Math.PI*2);c.fill();c.fillStyle=this.light?'#fff6d7':'#fff4d5';c.fillRect(b.x-2,b.y-2,4,4);}
            for(const t of this.ghosts)this.mech(t.x,t.y,t.angle,t.life/.28*.32);
            const p=g.player;
            if(p.shield)this.circle(p.x,p.y,29,this.cyan,2);
            if(p.dashTime>0)this.circle(p.x,p.y,25,this.violet,3);
            const alpha=p.invulnerable>0&&!this.reduced?.55+Math.sin(this.time*30)*.2:1;
            this.mech(p.x,p.y,Math.atan2(p.aimY,p.aimX),alpha);
            c.globalAlpha=.4;this.line([[p.x+p.aimX*26,p.y+p.aimY*26],[p.x+p.aimX*65,p.y+p.aimY*65]],this.cyan);c.globalAlpha=1;
            for(const arc of this.arcs){c.globalAlpha=Math.min(1,arc.life/.08);for(let i=1;i<arc.points.length;i++){
                const a=arc.points[i-1],b=arc.points[i],pts=[[a.x,a.y]],len=Math.hypot(b.x-a.x,b.y-a.y)||1;
                for(let j=1;j<7;j++){const off=this.reduced?2:Math.sin(j*12.7+this.time*55)*9;pts.push([a.x+(b.x-a.x)*j/7-(b.y-a.y)/len*off,a.y+(b.y-a.y)*j/7+(b.x-a.x)/len*off]);}pts.push([b.x,b.y]);
                this.line(pts,i===1?this.cyan:this.violet,4);this.line(pts,this.light?'#e7fbff':'#efffff',1);
            }}c.globalAlpha=1;
            for(const e of this.rings){c.globalAlpha=e.life/e.total;this.circle(e.x,e.y,e.radius*(1-e.life/e.total),e.color,3);}c.globalAlpha=1;
            for(const e of this.particles){c.globalAlpha=Math.min(1,e.life*3);c.fillStyle=e.color;c.fillRect(e.x,e.y,e.size,e.size);}c.globalAlpha=1;
            if(g.boss&&!g.boss.dead){const b=g.boss;c.fillStyle=this.light?'#ffffffde':'#091222dc';c.fillRect(140,46,440,42);c.fillStyle=this.warm;c.fillRect(150,76,420*Math.max(0,b.hp/b.maxHp),4);c.fillStyle=this.light?'#402338':'#ffe2dd';c.textAlign='center';c.font='bold 13px system-ui';c.fillText(`${g.config.boss}${b.overload?' / 過載':''}`,360,66);}
            c.restore();
        }
    }
    globalThis.NeonArenaRenderer=Renderer;
})();
