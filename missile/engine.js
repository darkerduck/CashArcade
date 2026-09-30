(() => {
    'use strict';
    const W = 960, H = 720, GROUND = 650;
    // Explicit formations; salvo groups preserve the advertised mean density.
    const LEVELS = [
        ['防線啟動',24,72,1,2,1,'spread',['normal']],
        ['交叉火網',32,80,.90,2,2,'cross',['normal']],
        ['極速突襲',40,88,.82,2,2,'sweep',['normal','fast']],
        ['分裂危機',48,96,.74,3,3,'v',['split','normal','fast']],
        ['重甲壓境',58,106,.68,3,3,'cross',['armored','normal','fast']],
        ['空中封鎖',66,116,.62,3,2,'cross',['cruiser','normal','fast','normal']],
        ['雙翼包圍',76,126,.57,4,3,'pincer',['split','fast','split','normal']],
        ['鋼鐵暴雨',88,138,.52,4,3,'cross',['armored','cruiser','armored','normal']],
        ['最後防線',102,150,.46,4,4,'surround',['normal','fast','split','armored','cruiser']],
        ['母艦降臨',32,150,1,2,2,'cross',['armored','fast','normal','split']],
        ['逆襲航線',110,158,.44,4,3,'sweep',['fast','fast','normal']],
        ['蜂群分裂',118,164,.43,4,3,'v',['split','split','fast','normal']],
        ['裝甲縱隊',126,170,.42,4,2,'cross',['armored','armored','fast','normal']],
        ['空襲走廊',134,176,.41,4,3,'pincer',['cruiser','armored','cruiser','fast']],
        ['四面封鎖',142,182,.40,5,4,'surround',['armored','fast','split','normal']],
        ['碎星風暴',150,188,.39,5,4,'fan',['split','fast','split','fast','normal']],
        ['鋼翼護航',158,194,.38,5,4,'pincer',['cruiser','armored','split','fast']],
        ['飽和轟炸',166,200,.37,5,4,'surround',['cruiser','fast','armored','split','normal']],
        ['終界防線',178,208,.35,5,5,'fan',['normal','fast','split','armored','cruiser']],
        ['終焉方舟',60,208,.70,3,3,'surround',['armored','fast','split','cruiser']],
    ].map(([name,count,speed,interval,waves,salvo,formation,types]) =>
        Object.freeze({name,count,speed,interval,waves,salvo,formation,types}));
    const POWERS = ['rapid','wide','slow','shield','emp'];
    const cityX = [190,295,400,560,665,770];
    const clone = value => JSON.parse(JSON.stringify(value));
    const clamp = (v,lo,hi) => Math.max(lo,Math.min(hi,v));
    function fresh() {
        return {version:1,phase:'stage',level:1,score:0,radius:64,reload:.65,
            cities:cityX.map(x => ({x,hp:3,shield:false})),seed:Math.floor(Math.random()*2147483646)+1};
    }
    function valid(c) {
        return c && c.version === 1 && ['stage','upgrade'].includes(c.phase)
            && Number.isInteger(c.level) && c.level >= 1 && c.level <= LEVELS.length-(c.phase === 'upgrade' ? 1 : 0)
            && Number.isFinite(c.score) && c.score >= 0 && c.score <= 1e8
            && Number.isFinite(c.radius) && c.radius >= 64 && c.radius <= 136
            && Number.isFinite(c.reload) && c.reload >= .28 && c.reload <= .651
            && Number.isInteger(c.seed) && c.seed > 0 && c.seed < 2147483647
            && Array.isArray(c.cities) && c.cities.length === 6
            && c.cities.every((v,i) => v && v.x === cityX[i] && Number.isInteger(v.hp)
                && v.hp >= 0 && v.hp <= 3 && typeof v.shield === 'boolean') && c.cities.some(v => v.hp > 0);
    }
    function canUpgrade(c,choice) {
        return valid(c) && c.phase === 'upgrade' && (choice === 'repair'
            || choice === 'radius' && c.radius < 136 || choice === 'reload' && c.reload > .290001);
    }
    function upgrade(checkpoint,choice) {
        if (!canUpgrade(checkpoint,choice)) return null;
        const c = clone(checkpoint);
        if (choice === 'radius') c.radius = Math.min(136,c.radius+8);
        if (choice === 'reload') c.reload = Math.max(.29,Math.round((c.reload-.04)*100)/100);
        if (choice === 'repair') {
            const dead = c.cities.find(city => city.hp === 0);
            c.cities.forEach(city => { if (city.hp > 0) city.hp = Math.min(3,city.hp+1); });
            if (dead) dead.hp = 1;
        }
        c.phase = 'stage'; c.level++; c.seed = c.seed%2147483646+1;
        return c;
    }
    function schedule(config) {
        const entries = []; let at = 1, index = 0;
        for (let wave = 0; wave < config.waves; wave++) {
            const size = Math.floor(config.count/config.waves)+(wave < config.count%config.waves ? 1 : 0);
            for (let i = 0; i < size;) {
                const group = Math.min(config.salvo,size-i);
                for (let slot = 0; slot < group; slot++) {
                    entries.push({at:at+slot*.14,wave:wave+1,slot,group,index,
                        type:config.types[(index+wave)%config.types.length]}); index++;
                }
                at += group*config.interval; i += group;
            }
            at += 2;
        }
        return entries;
    }
    // Tail flames and bloom are not collision bodies.
    function touches(blast,e) {
        if (e.type === 'cruiser') {
            const dx = Math.max(0,Math.abs(blast.x-e.x)-31), dy = Math.max(0,Math.abs(blast.y-e.y)-13);
            return Math.hypot(dx,dy) <= blast.r;
        }
        const angle = Math.atan2(GROUND-e.y,e.target-e.x), dx = blast.x-e.x, dy = blast.y-e.y;
        const along = dx*Math.cos(angle)+dy*Math.sin(angle), across = -dx*Math.sin(angle)+dy*Math.cos(angle);
        return Math.hypot(Math.max(0,Math.abs(along)-9),across) <= blast.r+(e.type === 'armored' ? 7 : 4);
    }
    class Game {
        constructor(checkpoint) {
            if (!valid(checkpoint) || checkpoint.phase !== 'stage') throw new Error('Invalid stage checkpoint');
            this.checkpoint=clone(checkpoint); this.level=checkpoint.level; this.config=LEVELS[this.level-1];
            this.score=checkpoint.score; this.cities=clone(checkpoint.cities); this.radius=checkpoint.radius;
            this.reload=Math.max(.29,checkpoint.reload); this.seed=checkpoint.seed;
            this.time=0; this.spawned=0; this.wave=1; this.schedule=schedule(this.config); this.nextSpawn=1;
            this.id=0; this.enemies=[]; this.shots=[]; this.blasts=[]; this.items=[]; this.events=[];
            this.effects={rapid:0,wide:0,slow:0}; this.drops=0; this.kills=0;
            this.turrets=[70,480,890].map(x => ({x,y:GROUND+15,ready:0,fired:-10,angle:-Math.PI/2}));
            this.state='running'; this.boss=null;
            if (this.level === 10 || this.level === 20) {
                const final = this.level === 20;
                this.boss={x:W/2,y:final ? 128 : 108,variant:final ? 'ark' : 'carrier',
                    offsets:final ? [-180,-90,90,180] : [-95,95],nodes:final ? [8,8,8,8] : [8,8],maxNodeHp:8,
                    hp:final ? 60 : 32,maxHp:final ? 60 : 32,phase:'shield',nextAttack:3,
                    rage:false,dead:false,charge:false,transitionAt:0,escortAt:0,deathAt:0};
                this.emit('alarm',this.boss.x,this.boss.y,{phase:'shield',variant:this.boss.variant});
                this.dropPower('shield');
            }
        }
        random() { this.seed=this.seed*16807%2147483647; return (this.seed-1)/2147483646; }
        emit(type,x=W/2,y=H/2,extra={}) { this.events.push({type,x,y,...extra}); }
        drain() { return this.events.splice(0); }
        fire(x,y) {
            if (this.state !== 'running') return false;
            x=clamp(x,15,W-15); y=clamp(y,35,GROUND-35);
            const turret=this.turrets.filter(t => t.ready <= this.time)
                .sort((a,b) => Math.hypot(a.x-x,a.y-y)-Math.hypot(b.x-x,b.y-y))[0];
            if (!turret) return false;
            const rapid=this.effects.rapid > 0; turret.ready=this.time+this.reload*(rapid ? .5 : 1);
            turret.fired=this.time; turret.angle=Math.atan2(y-turret.y,x-turret.x);
            this.shots.push({x:turret.x,y:turret.y,tx:x,ty:y,speed:620*(rapid ? 1.35 : 1),rapid,trail:[]});
            this.emit('launch',turret.x,turret.y,{turret:this.turrets.indexOf(turret),angle:turret.angle,rapid}); return true;
        }
        target() { const alive=this.cities.filter(c => c.hp > 0); return alive[Math.floor(this.random()*alive.length)] || this.cities[0]; }
        spawn(type,x,y=-20) {
            const target=this.target();
            const e={id:++this.id,type,x:x ?? this.random()*(W-80)+40,y,target:target.x,
                hp:type === 'armored' ? 2 : type === 'cruiser' ? 3 : 1,
                speed:this.config.speed*(type === 'fast' ? 1.5 : 1),trail:[],dropAt:this.time+this.dropInterval(),dead:false};
            if (type === 'cruiser') {
                e.x=x ?? (this.spawned%2 ? -35 : W+35); e.y=y < 0 ? 115+(this.spawned%3)*38 : y;
                e.vx=(e.x < W/2 ? 1 : -1)*(85+this.level*4); e.radius=31;
            }
            this.enemies.push(e); return e;
        }
        dropInterval() { return Math.max(.85,2.25-this.level*.06); }
        spawnEntry(entry) {
            const {formation}=this.config, n=entry.index, slot=entry.slot;
            let x=60+this.random()*840, y=-20;
            if (formation === 'cross' || formation === 'pincer') x=n%2 ? 820-this.random()*100 : 40+this.random()*100;
            if (formation === 'sweep') x=70+(n%9)*102;
            if (formation === 'v' || formation === 'fan') x=480+(slot-(entry.group-1)/2)*(formation === 'fan' ? 170 : 190);
            if (formation === 'surround') {
                x=slot%4 === 0 ? 15 : slot%4 === 3 ? W-15 : 210+slot*170;
                y=slot%4 === 0 || slot%4 === 3 ? 65+(n%3)*25 : -20;
            }
            const e=this.spawn(entry.type,entry.type === 'cruiser' ? (n%2 ? -35 : W+35) : x,y);
            const target=formation === 'cross' ? cityX[n%2 ? n%3 : 5-n%3]
                : formation === 'v' || formation === 'fan' ? cityX[Math.round(slot/Math.max(1,entry.group-1)*5)] : null;
            if (this.cities.some(c => c.x === target && c.hp > 0)) e.target=target;
        }
        explode(x,y,radius=this.radius*(this.effects.wide > 0 ? 1.5 : 1),depth=0) {
            if (this.blasts.length >= 180) this.blasts.shift();
            const boosted=!depth && this.effects.wide > 0;
            this.blasts.push({id:++this.id,x,y,radius,age:0,r:0,hit:new Set(),depth,boosted});
            this.emit(depth ? 'chain' : 'explosion',x,y,{depth,radius,boosted});
        }
        destroy(e,depth=0,chain=true) {
            if (e.dead) return;
            e.dead=true; this.kills++;
            this.score+=({normal:100,fast:150,split:200,armored:250,cruiser:400}[e.type] || 100)*Math.min(4,depth+1);
            if (e.type === 'cruiser') this.emit('breakup',e.x,e.y,{direction:Math.sign(e.vx),enemy:e.type});
            if (chain) this.explode(e.x,e.y,42,depth+1);
        }
        dropPower(type=POWERS[(this.level+this.drops*2-1)%POWERS.length]) {
            this.items.push({x:230+this.random()*500,y:230+this.random()*130,type,life:8}); this.drops++;
        }
        pickup(type,x=W/2,y=300) {
            if (!POWERS.includes(type)) return;
            const targets=type === 'emp' ? this.enemies.filter(e => !e.dead).map(e => ({x:e.x,y:e.y,type:e.type})) : [];
            if (type === 'rapid' || type === 'wide') this.effects[type]=10;
            if (type === 'slow') this.effects.slow=8;
            if (type === 'shield') this.cities.forEach(c => { if (c.hp > 0) c.shield=true; });
            if (type === 'emp') this.enemies.forEach(e => this.destroy(e,0,false));
            this.emit('pickup',x,y,{power:type,targets,
                cities:this.cities.filter(c => c.hp > 0).map(c => ({x:c.x,y:GROUND-24})),
                turrets:this.turrets.map(t => ({x:t.x,y:t.y}))});
        }
        hitCity(e) {
            const city=this.cities.find(c => c.x === e.target);
            if (city && city.hp > 0) {
                if (city.shield) { city.shield=false; this.emit('shield',city.x,GROUND,{hp:city.hp}); }
                else { city.hp--; this.emit('damage',city.x,GROUND,{hp:city.hp,destroyed:city.hp === 0}); }
            }
            e.dead=true;
        }
        update(dt) {
            if (this.state !== 'running') return;
            dt=clamp(dt,0,.05); this.time+=dt;
            for (const key of Object.keys(this.effects)) this.effects[key]=Math.max(0,this.effects[key]-dt);
            const slow=this.effects.slow > 0 ? .6 : 1;
            while (this.spawned < this.config.count && this.time >= this.schedule[this.spawned].at && !this.boss?.dead) {
                const entry=this.schedule[this.spawned++];
                if (entry.wave !== this.wave) { this.wave=entry.wave; this.emit('wave',480,240,{wave:this.wave,total:this.config.waves}); }
                this.spawnEntry(entry); this.nextSpawn=this.schedule[this.spawned]?.at ?? Infinity;
            }
            if (this.boss) {
                if (!this.boss.dead) this.updateBoss(dt,slow);
            } else {
                const dropTimes=this.level > 10 ? [4,14,26] : [4,12];
                if (this.drops < dropTimes.length && this.time >= dropTimes[this.drops]) this.dropPower();
            }
            for (const s of this.shots) {
                s.trail.push({x:s.x,y:s.y}); if (s.trail.length > (s.rapid ? 15 : 10)) s.trail.shift();
                const dx=s.tx-s.x,dy=s.ty-s.y,d=Math.hypot(dx,dy),step=s.speed*dt;
                if (d <= step) { s.dead=true; this.explode(s.tx,s.ty); }
                else { s.x+=dx/d*step; s.y+=dy/d*step; }
            }
            // New chains participate next frame; a blast damages each target once.
            for (const b of [...this.blasts]) {
                b.age+=dt; b.r=Math.max(0,b.radius*Math.min(1,b.age/.2,(1-b.age)/.3));
                if (b.age >= 1) continue;
                for (const e of this.enemies) {
                    if (e.dead || b.hit.has(e.id) || !touches(b,e)) continue;
                    b.hit.add(e.id); e.hp--;
                    if (e.hp <= 0) this.destroy(e,b.depth); else this.emit('armor',e.x,e.y,{enemy:e.type,hp:e.hp});
                }
                for (const item of this.items) if (!item.dead && Math.hypot(item.x-b.x,item.y-b.y) <= b.r+15) {
                    item.dead=true; this.pickup(item.type,item.x,item.y);
                }
                this.hitBoss(b);
            }
            for (const e of [...this.enemies]) {
                if (e.dead) continue;
                e.trail.push({x:e.x,y:e.y}); if (e.trail.length > 64) e.trail.shift();
                if (e.type === 'cruiser') {
                    e.x+=e.vx*dt*slow;
                    if (this.time >= e.dropAt) {
                        this.spawn(this.level >= 14 && this.kills%3 === 0 ? 'fast' : 'normal',e.x,e.y+16);
                        e.dropAt=this.time+this.dropInterval(); this.emit('bombDrop',e.x,e.y+16);
                    }
                    if (e.x < -60 || e.x > W+60) e.dead=true;
                } else {
                    const dx=e.target-e.x,dy=GROUND-e.y,d=Math.hypot(dx,dy),step=e.speed*dt*slow;
                    if (d <= step+4) this.hitCity(e); else { e.x+=dx/d*step; e.y+=dy/d*step; }
                    if (e.type === 'split' && e.y > 285 && !e.dead) {
                        e.dead=true;
                        for (let n=-1; n<=1; n++) this.spawn('normal',e.x+n*12,e.y);
                        this.emit('split',e.x,e.y);
                    }
                }
            }
            this.items.forEach(i => { i.life-=dt; }); this.items=this.items.filter(i => !i.dead && i.life > 0);
            this.enemies=this.enemies.filter(e => !e.dead); this.shots=this.shots.filter(s => !s.dead);
            this.blasts=this.blasts.filter(b => b.age < 1);
            if (!this.cities.some(c => c.hp > 0)) { this.state='lost'; this.emit('lose'); }
            else if (this.spawned >= this.config.count && !this.enemies.length
                && (!this.boss || this.boss.dead && this.time >= this.boss.deathAt+2.5)) {
                this.state=this.level === LEVELS.length ? 'won' : 'upgrade';
                this.score+=this.cities.reduce((sum,c) => sum+c.hp*100,0); this.emit(this.state === 'won' ? 'win' : 'level');
            }
        }
        updateBoss(dt,slow) {
            const b=this.boss, final=b.variant === 'ark';
            b.x=W/2+Math.sin(this.time*.5)*(final ? 130 : 190); b.nextAttack-=dt*slow;
            if (b.nextAttack <= .7 && !b.charge) { b.charge=true; this.emit('bossCharge',b.x,b.y,{phase:b.phase}); }
            if (b.nextAttack <= 0) {
                const count=final ? (b.rage ? 7 : b.phase === 'core' ? 5 : 4) : b.rage ? 5 : 3;
                for (let i=0; i<count; i++) {
                    const type=b.rage && i%3 === 0 ? 'split' : i%3 === 1 ? 'armored' : 'fast';
                    this.spawn(type,b.x+(i-(count-1)/2)*(final ? 46 : 65),b.y+40);
                }
                b.nextAttack=final ? (b.rage ? 1.2 : b.phase === 'core' ? 1.8 : 2.4) : b.rage ? 1.8 : 2.8;
                b.charge=false; this.emit('bossVolley',b.x,b.y+40,{phase:b.phase});
            }
            if (final && b.phase !== 'shield' && this.time >= b.escortAt) {
                this.spawn('cruiser',this.kills%2 ? -35 : W+35,185); b.escortAt=this.time+(b.rage ? 4 : 6);
            }
        }
        hitBoss(blast) {
            const b=this.boss; if (!b || b.dead) return;
            if (b.nodes.some(hp => hp > 0)) {
                b.nodes.forEach((hp,i) => {
                    const key=`node${i}`,x=b.x+b.offsets[i];
                    if (hp > 0 && !blast.hit.has(key) && Math.hypot(x-blast.x,b.y-blast.y) < blast.r+21) {
                        blast.hit.add(key); b.nodes[i]--; this.emit('armor',x,b.y,{hp:b.nodes[i],enemy:'boss'});
                    }
                });
                if (!b.nodes.some(hp => hp > 0)) {
                    b.phase='core'; b.transitionAt=this.time; b.escortAt=this.time+2;
                    this.dropPower('wide'); this.emit('bossPhase',b.x,b.y,{phase:'core',variant:b.variant});
                }
            } else if (!blast.hit.has('core') && Math.hypot(b.x-blast.x,b.y-blast.y) < blast.r+28) {
                blast.hit.add('core'); b.hp--; this.emit('armor',b.x,b.y,{hp:b.hp,enemy:'boss'});
                if (b.hp <= (b.variant === 'ark' ? 20 : 16) && !b.rage) {
                    b.rage=true; b.phase='rage'; b.transitionAt=this.time; b.nextAttack=Math.min(b.nextAttack,1.2);
                    this.dropPower('rapid'); this.emit('bossPhase',b.x,b.y,{phase:'rage',variant:b.variant});
                    this.emit('alarm',b.x,b.y,{phase:'rage',variant:b.variant});
                }
                if (b.hp <= 0) {
                    b.dead=true; b.deathAt=this.time; b.charge=false; this.spawned=this.config.count;
                    this.score+=b.variant === 'ark' ? 15000 : 5000;
                    this.emit('bossDeath',b.x,b.y,{variant:b.variant,width:b.variant === 'ark' ? 440 : 300});
                }
            }
        }
        nextCheckpoint() {
            if (this.state !== 'upgrade') return null;
            return {...clone(this.checkpoint),phase:'upgrade',score:this.score,cities:clone(this.cities)};
        }
    }
    globalThis.NeonDefense=Object.freeze({W,H,GROUND,LEVELS,POWERS,Game,fresh,valid,upgrade,canUpgrade,clone,schedule,touches});
})();
