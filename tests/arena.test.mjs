import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const scope=vm.createContext({});
for(const file of ['data','storage','engine','music'])vm.runInContext(readFileSync(new URL(`../arena/${file}.js`,import.meta.url),'utf8'),scope);
const {Game}=scope.NeonArena,{fresh,valid,create}=scope.NeonArenaStorage,{upgrades,stats}=scope.NeonArenaData;
const plain=v=>JSON.parse(JSON.stringify(v));
function step(g,seconds,input={}){for(let i=0;i<Math.round(seconds*120);i++)g.update(1/120,input);}
function isolated(){const g=new Game(fresh(42));g.spawned=0;g.config={...g.config,count:999,duration:1e9};g.fireTimer=1e8;g.pillars=[];return g;}

test('arc hits the first circle on aim ray, chains with decaying damage and unique targets',()=>{
    const g=isolated();g.player.x=100;g.player.y=360;g.player.aimX=1;g.player.aimY=0;
    const enemies=[g.addEnemy('guard',200,360),g.addEnemy('guard',270,390),g.addEnemy('guard',330,390),g.addEnemy('guard',180,450)];
    const ids=g.fire();assert.equal(ids[0],enemies[0].id);assert.equal(ids.length,3);assert.equal(new Set(ids).size,3);
    assert.equal(enemies[0].maxHp-enemies[0].hp,24);assert.ok(Math.abs(enemies[1].maxHp-enemies[1].hp-24*.72)<1e-8);
    assert.equal(enemies[3].hp,enemies[3].maxHp);assert.ok(enemies[2].hp<enemies[2].maxHp);
});
test('mobile auto aim shares ray and damage rules and excludes pillars from nearest enemy selection',()=>{
    const g=isolated();g.player.x=360;g.player.y=360;const e=g.addEnemy('guard',460,360);g.fireTimer=0;g.update(1/120,{autoAim:true});
    assert.equal(g.player.aimX,1);assert.equal(g.player.aimY,0);assert.equal(e.maxHp-e.hp,24);
});
test('pillars and death blasts queue across ticks, terminate, do not hurt player or score twice',()=>{
    const g=isolated();g.upgrades.deathBlast=3;g.stats=stats(g.upgrades);g.player.x=360;g.player.y=360;
    g.pillars=[0,1,2,3].map((n)=>({id:++g.serial,kind:'pillar',x:330+n*25,y:360,hp:20,r:18,dead:false}));
    for(let i=0;i<7;i++)g.addEnemy('swarm',340+i*8,420);
    const first=g.pillars[0];g.damage(first,30);assert.equal(g.explosions.length,1);g.damage(first,300);assert.equal(g.explosions.length,1);
    step(g,1);assert.equal(g.explosions.length,0);assert.equal(g.pillars.length,0);assert.equal(g.enemies.length,0);assert.equal(g.score,560);assert.equal(g.hp,5);
});
test('dash lasts .18s, is invulnerable, stops at boundary and recharges after 2.4s',()=>{
    const g=isolated(),p=g.player;p.x=695;p.moveX=1;p.moveY=0;
    assert.equal(g.dash(),true);assert.equal(g.hurt(),false);assert.equal(g.dash(),false);step(g,.18);assert.equal(p.x,707);assert.equal(p.dashTime,0);
    assert.equal(p.charges,0);step(g,2.23);assert.equal(p.charges,1);assert.equal(g.hurt(),true);assert.equal(g.hp,4);g.hurt();assert.equal(g.hp,4);step(g,1.01);g.hurt();assert.equal(g.hp,3);
});
test('stationary dash follows aim; two charges replenish serially; trails do not stack damage per sample',()=>{
    const g=isolated();g.upgrades.charge=1;g.upgrades.trail=1;g.stats=stats(g.upgrades);g.player.charges=2;g.player.aimX=-1;g.player.aimY=0;
    g.dash();step(g,.2);assert.ok(g.player.x<200);assert.equal(g.player.charges,1);g.dash();step(g,.2);assert.equal(g.player.charges,0);
    step(g,2.01);assert.equal(g.player.charges,1);step(g,2.41);assert.equal(g.player.charges,2);assert.equal(g.trails.length,0);
});
test('shield absorbs exactly one hit per wave and gives rank-specific invulnerability',()=>{
    const g=isolated();g.upgrades.shield=2;g.player.shield=true;
    g.hurt();assert.equal(g.hp,5);assert.equal(g.player.shield,false);assert.equal(g.player.invulnerable,2);g.hurt();assert.equal(g.hp,5);step(g,2.01);g.hurt();assert.equal(g.hp,4);
});
test('overlapping trail samples apply damage once per enemy per tick',()=>{
    const g=isolated();g.upgrades.trail=2;g.stats=stats(g.upgrades);g.player.x=600;g.player.y=600;
    const e=g.addEnemy('guard',100,100);g.trails=Array.from({length:60},()=>({x:100,y:100,life:1.2}));
    g.update(1/120);assert.ok(Math.abs(e.maxHp-e.hp-48/120)<1e-8);
});
test('spawn warnings are safe, visible before enemies, and all ordinary counts match design',()=>{
    const expected=[14,20,26,32,38,44,50,58,66];assert.deepEqual(plain(scope.NeonArenaData.waves.filter(w=>!w.boss).map(w=>w.count)),expected);
    const g=new Game(fresh(123));g.update(1/120);assert.equal(g.enemies.length,0);assert.equal(g.warnings.length,1);const w=g.warnings[0];
    assert.ok(Math.hypot(w.x-g.player.x,w.y-g.player.y)>=230);step(g,1);assert.equal(g.enemies.length,0);step(g,.2);assert.equal(g.enemies.length,1);
    g.warn('swarm');const next=g.warnings[0];g.player.x=next.x;g.player.y=next.y;step(g,1.2);assert.ok(g.warnings.length);assert.ok(g.warnings.some(w=>w.time>0));
});
test('charger telegraphs a fixed direction and splitter creates exactly two children once',()=>{
    const g=isolated(),e=g.addEnemy('charger',80,80);e.timer=0;g.update(1/120);assert.ok(e.windup>0);const dx=e.dx;
    g.player.x=30;g.player.y=600;step(g,.4);assert.equal(e.dx,dx);const split=g.addEnemy('splitter',500,500);g.damage(split,999);g.damage(split,999);
    assert.equal(g.enemies.filter(e=>e.kind==='shard').length,2);assert.equal(g.score,180);
});
test('every upgrade has numeric effects, ranks cap correctly, offers are unique and selection commits once',()=>{
    const g=new Game(fresh(66));
    for(let wave=1;wave<12;wave++){
        g.complete();const choices=g.getUpgrades();assert.equal(choices.length,3);assert.equal(new Set(choices.map(u=>u.id)).size,3);
        for(const u of choices){assert.ok(u.level<u.max);assert.match(u.effect,/\d/);}
        const id=choices[0].id,before=g.upgrades[id];assert.ok(g.chooseUpgrade(id));assert.equal(g.upgrades[id],before+1);assert.equal(g.chooseUpgrade(id),false);assert.equal(g.wave,wave+1);assert.equal(valid(g.checkpoint()),true);
    }
    g.complete();assert.equal(g.state,'won');assert.equal(g.getUpgrades().length,0);
    for(const u of upgrades){const x=new Game(fresh(1));x.upgrades[u.id]=u.max;x.complete();assert.ok(!x.choices.includes(u.id));}
});
test('reload preserves pending choices; retry restores hp, score, seed and waves deterministically',()=>{
    const g=new Game(fresh(9));g.score=300;g.hp=2;g.complete();const cp=g.checkpoint(),h=new Game(cp);
    assert.deepEqual(plain(h.getUpgrades()),plain(g.getUpgrades()));assert.equal(h.hp,3);const chosen=h.choices[0];h.chooseUpgrade(chosen);const start=h.checkpoint();
    step(h,4,{dx:1});const warnings=plain(h.warnings),seed=h.seed;h.score+=3000;h.hp=0;h.state='lost';assert.ok(h.retry());
    assert.equal(h.score,start.score);assert.equal(h.hp,start.hp);assert.equal(h.seed,start.seed);step(h,4,{dx:1});assert.equal(h.seed,seed);assert.deepEqual(plain(h.warnings),warnings);
    const leaked=h.checkpoint();leaked.score=9999;assert.equal(h.checkpoint().score,start.score);
});
test('storage rejects malformed or out of range campaigns and detects silent write failures',()=>{
    const c=plain(fresh(42));assert.equal(valid(c),true);
    for(const bad of [{...c,wave:13},{...c,hp:0},{...c,seed:0},{...c,score:NaN},{...c,version:2},{...c,kind:'upgrade',choices:['damage','damage','speed']},{...c,upgrades:{...c.upgrades,charge:2}},{...c,wave:2}])assert.equal(valid(bad),false);
    let errors=0;const broken=create({getItem(){return null;},setItem(){},removeItem(){}},()=>errors++);assert.equal(broken.save(c),false);assert.equal(errors,1);
    const map=new Map(),store=create({getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)});assert.ok(store.save(c));assert.deepEqual(plain(store.load()),c);store.saveBest(1234);store.clear();assert.equal(store.load(),null);assert.equal(store.best(),1234);
});
test('all twelve waves finish through real damage, all three bosses attack and clear summons',()=>{
    const g=new Game(fresh(100));const seen=[];
    for(let wave=1;wave<=12;wave++){
        assert.equal(g.wave,wave);g.player.invulnerable=999;
        if(g.boss){const boss=g.boss;let sawBeam=false,sawSummon=false,sawCharge=false,sawBullets=false;
            for(let i=0;i<17*120;i++){g.update(1/120,{autoAim:true});sawBeam ||= g.beams.length>0;sawSummon ||= g.warnings.length>0;sawCharge ||= boss.windup>0;sawBullets ||= g.bullets.length>0;}
            assert.ok(boss.step>=4);seen.push(boss.step);assert.ok(sawBullets);
            if(wave===4)assert.ok(sawCharge);else {assert.ok(sawBeam);assert.ok(sawSummon);}
            g.damage(boss,boss.maxHp);assert.equal(g.bullets.length,0);assert.equal(g.warnings.length,0);assert.ok(g.enemies.every(e=>e.dead));
        }else{
            let guard=0;while(g.state==='running'&&guard++<9000){g.update(1/120,{autoAim:true});for(const e of [...g.enemies])g.damage(e,10000);}
            assert.ok(guard<9000);assert.equal(g.spawned,g.config.count);assert.ok(g.time>=g.config.duration*(g.config.count-1)/g.config.count);
        }
        assert.equal(g.state,wave===12?'won':'upgrade');if(wave<12){assert.equal(valid(g.checkpoint()),true);g.chooseUpgrade(g.choices[0]);}
    }
    assert.equal(seen.length,3);assert.ok(g.score>36000);
});
test('boss waves can lose and retry without retaining damage, bullets or rewards; overload emits once',()=>{
    const g=new Game(fresh(10));
    for(let wave=1;wave<=12;wave++){
        if(g.boss){g.boss.hp=g.boss.maxHp*.29;g.update(1/120);assert.equal(g.drain().filter(e=>e.type==='overload').length,1);g.update(1/120);assert.equal(g.drain().filter(e=>e.type==='overload').length,0);
            for(let i=0;i<g.stats.maxHp;i++){g.player.invulnerable=0;g.hurt();}assert.equal(g.state,'lost');g.retry();assert.equal(g.boss.hp,g.boss.maxHp);assert.equal(g.state,'running');assert.equal(g.bullets.length,0);
        }
        g.complete();if(wave<12)g.chooseUpgrade(g.choices[0]);
    }
});
test('death and retry restore the checkpoint on every wave including late-game armor and shields',()=>{
    const g=new Game(fresh(19));
    for(let wave=1;wave<=12;wave++){
        const cp=g.checkpoint();g.score+=1000;g.player.shield=false;
        while(g.state==='running'){g.player.invulnerable=0;g.hurt();}
        assert.equal(g.state,'lost');assert.ok(g.retry());assert.equal(g.wave,wave);assert.equal(g.score,cp.score);assert.equal(g.hp,cp.hp);assert.equal(g.player.shield,g.upgrades.shield>0);
        g.complete();if(wave<12)g.chooseUpgrade(g.choices[0]);
    }
});
test('six distinct music motifs produce finite notes; overload adds arrangement and tempo',()=>{
    const score=scope.NeonArenaScore,profiles=[1,4,5,8,9,12].map(w=>score.profile(w));assert.equal(new Set(profiles.map(p=>p.name)).size,6);
    const signatures=profiles.map(p=>JSON.stringify(Array.from({length:128},(_,i)=>score.notesForStep(p,i))));assert.equal(new Set(signatures).size,6);
    for(const p of profiles)for(let i=0;i<128;i++)for(const n of score.notesForStep(p,i)){assert.ok(Number.isFinite(n.note)&&Number.isFinite(n.level)&&n.length>0);}
    for(const wave of [4,8,12]){const base=score.profile(wave),rage=score.profile(wave,'overload');assert.ok(rage.intensity>base.intensity);assert.ok(rage.bpm>base.bpm);assert.ok(score.notesForStep(rage,1).length>score.notesForStep(base,1).length);}
});
