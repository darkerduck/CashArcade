(() => {
    'use strict';
    const W = 720, H = 720, { waves, enemies:types, upgrades, stats } = NeonArenaData;
    const { copy, fresh, valid } = NeonArenaStorage;
    const clamp = (n,a,b) => Math.max(a,Math.min(b,n));
    const distance = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
    const direction = (x,y) => { const d = Math.hypot(x,y); return d ? {x:x/d,y:y/d} : {x:0,y:-1}; };
    function segmentDistance(p,a,b) {
        const dx=b.x-a.x,dy=b.y-a.y,t=clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1),0,1);
        return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);
    }
    class Game {
        constructor(cp = fresh()) { this.start(cp); }
        start(cp = fresh()) {
            if (!valid(cp)) cp = fresh();
            this.saved = copy(cp); this.wave = cp.wave; this.hp = cp.hp; this.score = cp.score; this.elapsed = cp.elapsed;
            this.upgrades = copy(cp.upgrades); this.stats = stats(this.upgrades); this.seed = cp.seed; this.config = waves[this.wave-1];
            this.state = cp.kind === 'upgrade' ? 'upgrade' : 'running'; this.choices = [...(cp.choices || [])];
            this.time = 0; this.serial = 0; this.events = []; this.enemies = []; this.bullets = []; this.warnings = []; this.beams = [];
            this.explosions = []; this.trails = []; this.spawned = 0; this.fireTimer = .2; this.boss = null;
            this.player = { x:360,y:490,r:13,aimX:0,aimY:-1,moveX:0,moveY:0,invulnerable:0,dashTime:0,dashX:0,dashY:0,
                charges:this.stats.charges,recharge:0,shield:this.upgrades.shield > 0 };
            this.pillars = [[200,210],[520,210],[200,500],[520,500]].map(([x,y])=>({id:++this.serial,kind:'pillar',x,y,r:18,hp:36,maxHp:36,dead:false}));
            if (this.config.boss && this.state === 'running') {
                const hp = [4000,6500,10000][this.config.sector];
                this.boss = {id:++this.serial,kind:'boss',x:360,y:165,r:48,hp,maxHp:hp,dead:false,timer:2,step:0,chargeTime:0,windup:0,overload:false};
                this.enemies.push(this.boss); this.emit('boss',{x:360,y:165});
            }
            return this;
        }
        random() { this.seed = (Math.imul(this.seed,1664525)+1013904223) >>> 0; return this.seed/4294967296; }
        emit(type, data={}) { if(this.events.length<320) this.events.push({type,...data}); }
        drain() { return this.events.splice(0); }
        checkpoint() { return copy(this.saved); }
        retry() { if (this.saved.kind !== 'wave') return false; this.start(this.saved); return true; }
        getUpgrades() { return this.state === 'upgrade' ? this.choices.map(id => { const u = upgrades.find(u=>u.id===id); return {id,name:u.name,route:u.route,level:this.upgrades[id],max:u.max,effect:u.effect(this.upgrades[id])}; }) : []; }
        chooseUpgrade(id) {
            if (this.state !== 'upgrade' || !this.choices.includes(id)) return false;
            const next = copy(this.saved); next.upgrades[id]++; next.wave++; next.kind = 'wave'; delete next.choices;
            if(id==='armor') next.hp++; next.seed = this.seed || 1;
            this.start(next); this.emit('upgrade'); return true;
        }
        dash(input={}) {
            const p=this.player;
            if(this.state !== 'running' || p.charges < 1 || p.dashTime > 0) return false;
            const dx=input.dx ?? p.moveX,dy=input.dy ?? p.moveY;
            const d=direction(dx || dy ? dx : p.aimX,dx || dy ? dy : p.aimY);
            p.dashX=d.x;p.dashY=d.y;p.dashTime=.18;p.charges--;
            if(p.recharge<=0)p.recharge=this.stats.cooldown;
            this.emit('dash',{x:p.x,y:p.y,angle:Math.atan2(d.y,d.x)});return true;
        }
        hurt() {
            const p=this.player;
            if(this.state !== 'running' || p.invulnerable > 0 || p.dashTime > 0) return false;
            if(p.shield){p.shield=false;p.invulnerable=1+this.upgrades.shield*.5;this.emit('shield',{x:p.x,y:p.y});return false;}
            this.hp--;p.invulnerable=1;this.emit('hurt',{x:p.x,y:p.y});
            if(this.hp<=0){this.state='lost';this.emit('lost');}return true;
        }
        queueBlast(source,radius,damage,delay=.045) {
            this.explosions.push({id:++this.serial,x:source.x,y:source.y,radius,damage,delay});
        }
        damage(target, amount) {
            if(target.dead || this.state !== 'running') return;
            target.hp-=amount;
            if(target.hp>0){this.emit('hit',{x:target.x,y:target.y,boss:target.kind==='boss'});return;}
            target.dead=true;
            if(target.kind==='pillar') {
                this.queueBlast(target,(125+this.upgrades.radius*25),105*this.stats.blastMultiplier);
            } else {
                this.score+=target.kind==='boss' ? this.wave*1000 : types[target.kind].score;
                this.emit('kill',{x:target.x,y:target.y,kind:target.kind});
                if(target.kind==='boss') {
                    this.enemies.forEach(e=>e.dead=true);this.bullets=[];this.beams=[];this.warnings=[];this.explosions=[];
                    this.emit('bossDown',{x:target.x,y:target.y});this.complete();return;
                }
                if(target.kind==='splitter')for(let i=0;i<2;i++)this.addEnemy('shard',clamp(target.x+(i?20:-20),28,692),clamp(target.y+16,28,692));
                if(this.stats.deathDamage)this.queueBlast(target,this.stats.radius,this.stats.deathDamage*this.stats.blastMultiplier);
            }
        }
        fire() {
            const p=this.player,d={x:p.aimX,y:p.aimY},targets=[...this.enemies,...this.pillars].filter(e=>!e.dead);
            let first=null,firstT=Infinity;
            // Ray/circle entry distance selects the physically first hit, not the nearest centre.
            for(const e of targets){const x=e.x-p.x,y=e.y-p.y,t=x*d.x+y*d.y,perp=x*x+y*y-t*t,r=e.r+5;
                if(perp>r*r)continue;const entry=Math.max(0,t-Math.sqrt(Math.max(0,r*r-perp)));
                if(t+r>=0&&entry<firstT&&entry<=440){first=e;firstT=entry;}}
            const points=[{x:p.x,y:p.y}],hit=new Set();let e=first,damage=this.stats.damage;
            for(let hop=0;e&&hop<=this.stats.jumps;hop++){
                hit.add(e.id);points.push({x:e.x,y:e.y});this.damage(e,damage);damage*=.72;
                const last=e;e=targets.filter(t=>!t.dead&&!hit.has(t.id)&&distance(last,t)<=this.stats.reach).sort((a,b)=>distance(last,a)-distance(last,b)||a.id-b.id)[0];
                if(this.state!=='running')break;
            }
            if(!first)points.push({x:p.x+d.x*100,y:p.y+d.y*100});
            this.emit('arc',{points,ids:[...hit]});if(hit.size>1)this.emit('chain');
            return [...hit];
        }
        addEnemy(kind,x,y) {
            if(this.enemies.filter(e=>!e.dead).length>=100)return null;
            const data=types[kind],scale=1+this.config.sector*.15;
            const e={...data,id:++this.serial,kind,x,y,hp:data.hp*scale,maxHp:data.hp*scale,dead:false,timer:1+this.random(),windup:0,chargeTime:0};
            this.enemies.push(e);return e;
        }
        warn(kind) {
            for(let tries=0;tries<12;tries++){
                const edge=Math.floor(this.random()*4),v=55+this.random()*610,x=edge===0?28:edge===1?692:v,y=edge===2?28:edge===3?692:v;
                if(distance({x,y},this.player)<230)continue;
                this.warnings.push({x,y,kind,time:1.15});this.emit('warning',{x,y});return;
            }
            const p=this.player,x=p.x<360?692:28,y=p.y<360?665:55;
            this.warnings.push({x,y,kind,time:1.15});
        }
        shoot(e,angle,count=1,spread=.22,speed=165) {
            for(let i=0;i<count&&this.bullets.length<240;i++){
                const a=angle+(i-(count-1)/2)*spread;
                this.bullets.push({x:e.x+Math.cos(a)*(e.r+7),y:e.y+Math.sin(a)*(e.r+7),vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,r:5,life:7});
            }
        }
        beam(e,angle,rotating=false) {
            this.beams.push({x:e.x,y:e.y,angle,rotation:rotating?.3:0,length:rotating?325:880,width:12,warning:1.3,life:rotating?3.1:1.25});
            this.emit('warning',{x:e.x,y:e.y});
        }
        bossUpdate(e,dt) {
            const p=this.player,angle=Math.atan2(p.y-e.y,p.x-e.x);
            if(e.hp/e.maxHp<.3&&!e.overload){e.overload=true;this.emit('overload',{x:e.x,y:e.y});}
            if(e.windup>0){e.windup-=dt;if(e.windup<=0)e.chargeTime=.7;}
            else if(e.chargeTime>0){e.chargeTime-=dt;e.x=clamp(e.x+e.dx*350*dt,60,660);e.y=clamp(e.y+e.dy*350*dt,60,660);}
            else {
                e.timer-=dt;
                const tx=360+Math.sin(this.time*.3)*110,ty=250+Math.sin(this.time*.2)*90;
                const d=direction(tx-e.x,ty-e.y);if(distance(e,{x:tx,y:ty})>4){e.x+=d.x*32*dt;e.y+=d.y*32*dt;}
                if(e.timer<=0){
                    e.timer=e.overload?2.2:3.2;e.step++;
                    if(this.wave===4){if(e.step%2){const d=direction(p.x-e.x,p.y-e.y);e.dx=d.x;e.dy=d.y;e.windup=1;}
                        else this.shoot(e,angle,e.overload?9:7,.25,175);}
                    if(this.wave===8){
                        if(e.step%3===0){this.warn('guard');this.warn('swarm');}
                        else if(!this.beams.length){this.beam(e,angle,true);this.beam(e,angle+Math.PI,true);}
                        this.shoot(e,angle,3,.32,150);
                    }
                    if(this.wave===12){
                        if(e.step%3===1){this.warn('charger');this.warn('shooter');if(e.overload)this.warn('splitter');}
                        else if(e.step%3===2){this.beam({x:0,y:clamp(p.y,100,620)},0);this.beam({x:clamp(p.x,100,620),y:0},Math.PI/2);}
                        else this.shoot(e,angle,e.overload?11:7,.3,185);
                    }
                    this.emit('bossAttack',{x:e.x,y:e.y});
                }
            }
        }
        enemyUpdate(e,dt) {
            if(e.kind==='boss'){this.bossUpdate(e,dt);return;}
            const p=this.player,d=direction(p.x-e.x,p.y-e.y),dist=distance(p,e);
            if(e.windup>0){e.windup-=dt;if(e.windup<=0)e.chargeTime=.62;}
            else if(e.chargeTime>0){e.chargeTime-=dt;e.x=clamp(e.x+e.dx*340*dt,22,698);e.y=clamp(e.y+e.dy*340*dt,22,698);}
            else {
                const speed=e.speed*(1+this.config.sector*.07),move=e.kind==='shooter'?(dist<210?-1:dist>285?1:0):1;
                e.x=clamp(e.x+d.x*speed*move*dt,e.r,720-e.r);e.y=clamp(e.y+d.y*speed*move*dt,e.r,720-e.r);
                e.timer-=dt;
                if(e.kind==='charger'&&e.timer<=0){e.dx=d.x;e.dy=d.y;e.windup=.8;e.timer=3.6;this.emit('warning',{x:e.x,y:e.y});}
                if(e.kind==='shooter'&&e.timer<=0){this.shoot(e,Math.atan2(d.y,d.x));e.timer=2.5;}
                if(e.kind==='guard'&&e.timer<=0){this.shoot(e,Math.atan2(d.y,d.x),3,.38,135);e.timer=3.4;}
            }
        }
        complete() {
            if(this.state!=='running')return;
            this.bullets=[];this.beams=[];this.warnings=[];this.hp=Math.min(this.stats.maxHp,this.hp+1);
            if(this.wave===12){this.state='won';this.emit('won');return;}
            const pool=upgrades.filter(u=>this.upgrades[u.id]<u.max).map(u=>u.id);this.choices=[];
            for(let i=0;i<3;i++)this.choices.push(pool.splice(Math.floor(this.random()*pool.length),1)[0]);
            this.state='upgrade';this.saved={version:1,kind:'upgrade',wave:this.wave,hp:this.hp,score:this.score,elapsed:this.elapsed,
                upgrades:copy(this.upgrades),seed:this.seed||1,choices:[...this.choices]};this.emit('waveClear');
        }
        update(dt,input={}) {
            if(this.state!=='running'||!Number.isFinite(dt)||dt<=0)return;
            dt=Math.min(dt,1/30);this.time+=dt;this.elapsed+=dt;const p=this.player;
            const mx=Number.isFinite(input.dx)?input.dx:0,my=Number.isFinite(input.dy)?input.dy:0,len=Math.max(1,Math.hypot(mx,my));
            p.moveX=mx/len;p.moveY=my/len;
            if(input.autoAim){const near=this.enemies.filter(e=>!e.dead).sort((a,b)=>distance(a,p)-distance(b,p))[0];
                if(near){const d=direction(near.x-p.x,near.y-p.y);p.aimX=d.x;p.aimY=d.y;}}
            else if(Number.isFinite(input.aimX)&&Number.isFinite(input.aimY)){const d=direction(input.aimX-p.x,input.aimY-p.y);p.aimX=d.x;p.aimY=d.y;}
            p.invulnerable=Math.max(0,p.invulnerable-dt);
            if(p.charges<this.stats.charges){p.recharge-=dt;if(p.recharge<=0){p.charges++;p.recharge=p.charges<this.stats.charges?this.stats.cooldown:0;}}
            const dash=p.dashTime>0,dashDt=Math.min(dt,p.dashTime);
            const vx=dash?p.dashX*950:p.moveX*this.stats.speed,vy=dash?p.dashY*950:p.moveY*this.stats.speed;
            p.x=clamp(p.x+vx*(dash?dashDt:dt),p.r,720-p.r);p.y=clamp(p.y+vy*(dash?dashDt:dt),p.r,720-p.r);
            if(dash){if(this.trails.length<60)this.trails.push({x:p.x,y:p.y,life:1.2});this.emit('ghost',{x:p.x,y:p.y,angle:Math.atan2(p.aimY,p.aimX)});}
            this.fireTimer-=dt;if(this.fireTimer<=0){this.fireTimer+=.24;this.fire();}
            if(this.state!=='running')return;
            if(!this.config.boss){
                const due=Math.min(this.config.count,Math.floor(this.time/this.config.duration*this.config.count)+1);
                while(this.spawned<due){const kinds=this.config.enemies;this.warn(kinds[this.spawned%kinds.length]);this.spawned++;}
            }
            for(const w of this.warnings){w.time-=dt;if(w.time<=0){
                if(distance(w,p)<95){w.time=1.15;const opposite={x:720-w.x,y:720-w.y};w.x=opposite.x;w.y=opposite.y;}
                else {this.addEnemy(w.kind,w.x,w.y);w.done=true;}
            }}this.warnings=this.warnings.filter(w=>!w.done);
            for(const e of this.enemies){if(e.dead)continue;this.enemyUpdate(e,dt);if(distance(e,p)<e.r+p.r)this.hurt();}
            for(const b of this.bullets){const old={x:b.x,y:b.y};b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;
                if(segmentDistance(p,old,b)<p.r+b.r){this.hurt();b.life=0;}}
            this.bullets=this.bullets.filter(b=>b.life>0&&b.x>-20&&b.x<740&&b.y>-20&&b.y<740);
            for(const b of this.beams){if(b.warning>0)b.warning-=dt;else {b.life-=dt;b.angle+=b.rotation*dt;
                const end={x:b.x+Math.cos(b.angle)*b.length,y:b.y+Math.sin(b.angle)*b.length};if(segmentDistance(p,b,end)<p.r+b.width/2)this.hurt();}}
            this.beams=this.beams.filter(b=>b.life>0);
            for(const t of this.trails)t.life-=dt;this.trails=this.trails.filter(t=>t.life>0);
            if(this.stats.trail)for(const e of this.enemies)if(!e.dead&&this.trails.some(t=>distance(t,e)<e.r+19))this.damage(e,this.stats.trail*dt);
            // Process a snapshot of the queue; newly chained explosions resolve on subsequent ticks.
            const ready=[];for(const b of this.explosions){b.delay-=dt;if(b.delay<=0)ready.push(b);}
            this.explosions=this.explosions.filter(b=>b.delay>0);
            for(const b of ready){if(this.state!=='running')break;this.emit('explode',{x:b.x,y:b.y,radius:b.radius});
                const hit=new Set();for(const e of [...this.enemies,...this.pillars])if(!e.dead&&!hit.has(e.id)&&distance(e,b)<=b.radius+e.r){hit.add(e.id);this.damage(e,b.damage);}}
            this.enemies=this.enemies.filter(e=>!e.dead);this.pillars=this.pillars.filter(e=>!e.dead);
            p.dashTime=Math.max(0,p.dashTime-dt);
            if(!this.config.boss&&this.spawned===this.config.count&&!this.warnings.length&&!this.enemies.length&&!this.explosions.length)this.complete();
        }
    }
    globalThis.NeonArena=Object.freeze({Game,W,H,direction,segmentDistance});
})();
