import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { Game, Save, POWERS, createLevel, sweepBox, W, H } = require('../breakout/storage.js');
const run = (g, seconds) => { for (let t = 0; t < seconds; t += 1/120) g.tick(1/120); };
const brick = (type='normal', extra={}) => ({ id:100, x:300,y:200,bx:300,by:200,w:46,h:20,type,hp:2,maxHp:2,active:false,emitted:0,nextEmission:0,...extra });
const empty = () => { const g=new Game();g.bricks=[brick('heavy',{x:20,bx:20,hp:999,maxHp:999})];g.level.gates=[];g.level.rotors=[];g.level.portals=[];g.state='running';g.balls=[];return g; };
const memory = () => { const data=new Map();return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k)}; };

test('30 authored formations differ in topology, have named tactics, and contain only bounded geometry',()=>{
    const signatures=new Set();
    for(let i=0;i<30;i++) {
        const c=createLevel(i);
        assert.ok(c.tip.length>25);assert.ok(c.bricks.filter(b=>b.hp>0).length>8);
        for(const b of c.bricks) {assert.ok(b.x>=0&&b.x+b.w<=W,`${i+1} horizontal bounds`);assert.ok(b.y>=40&&b.y+b.h<440,`${i+1} vertical bounds`);}
        signatures.add(JSON.stringify(c.bricks.map(b=>[Math.round(b.x),Math.round(b.y),b.w,b.h,b.type])));
        assert.equal(Save.valid(new Game({levelIndex:i}).snapshot()),true);
    }
    assert.equal(signatures.size,30);
    assert.equal(Object.keys(POWERS).length,16);
    for(const [i,p] of [[0,'wide'],[1,'big'],[15,'fire'],[16,'laser'],[18,'multi'],[20,'rain'],[21,'big'],[21,'full'],[22,'small'],[23,'pierce'],[24,'antigravity']]) assert.ok(createLevel(i).bricks.some(b=>b.power===p),`${i+1} guarantees ${p}`);
});
test('gravity and swept collisions catch a high-speed ball without tunnelling',()=>{
    assert.ok(sweepBox(323,300,0,-200,8,brick()));
    const g=empty();g.bricks=[brick(),brick('heavy',{id:101,x:50,bx:50,hp:100})];const b=g.spawnBall(323,255,0,-1100);g.tick(.06);
    assert.equal(g.bricks[0].hp,0);assert.ok(b.vy>0);assert.ok(g.score>=20);
    const f=empty(), ball=f.spawnBall(600,300,0,0);run(f,.5);assert.ok(ball.vy>100);
});
test('micro, normal and giant balls deal 1, 2 and 4 damage; size timers are exclusive',()=>{
    for(const [power,d] of [['small',1],[null,2],['big',4]]) {const g=empty(),b=brick('heavy',{hp:12,maxHp:12});if(power)g.collect(power);g.hitBrick(b,g.damage());assert.equal(b.hp,12-d);assert.equal(g.size(),power==='big'?13:power==='small'?5:8);}
    const g=empty();g.collect('big');g.collect('small');assert.equal(g.has('big'),false);g.collect('wide');g.collect('narrow');assert.equal(g.has('wide'),false);assert.equal(g.paddleWidth(),116*.65);
});
test('charged release lasts 0.12s, applies capped 40% boost, +2 damage and six-second shield penetration',()=>{
    const g=empty();g.beginCharge();g.time=.45;g.releaseCharge();const b=g.spawnBall(360,491,0,300);g.bouncePaddle(b);
    assert.equal(b.vy,-721);assert.equal(b.strongUntil,6.45);assert.ok(Math.abs(g.paddle.releaseUntil-.57)<1e-10);
    const target=brick('repel',{hp:8,maxHp:8});assert.equal(g.hitBrick(target,2),false);assert.equal(target.hp,8);
    g.bricks=[target,brick('heavy',{id:102,x:40,bx:40,hp:100})];b.x=323;b.y=245;b.vy=-600;b.vx=0;g.moveBall(b,.1);assert.equal(target.hp,4);assert.equal(b.strongUntil,0);
    g.beginCharge();assert.equal(g.paddle.charging,false);g.time=.74;g.beginCharge();assert.equal(g.paddle.charging,true);
});
test('regular balls are reflected by repulsion shell; directional weakpoints only accept top impacts',()=>{
    const g=empty(),r=brick('repel',{hp:4,maxHp:4});g.bricks=[r];const b=g.spawnBall(323,310,0,-530);g.moveBall(b,.2);assert.equal(r.hp,4);assert.ok(b.vy>0);
    const d=brick('directional',{hp:4,maxHp:4});assert.equal(g.hitBrick(d,2,{ny:1}),false);assert.equal(g.hitBrick(d,2,{ny:-1}),true);assert.equal(d.hp,2);
});
test('life is lost once only when the entire ball group disappears; future rain postpones loss',()=>{
    const g=empty();g.spawnBall(400,H+10,0,300);g.spawnBall(600,400,0,-200);g.tick(.1);assert.equal(g.lives,3);assert.equal(g.balls.length,1);
    g.balls=[];g.collect('rain');g.nextRain=g.time+1;g.tick(.1);assert.equal(g.lives,3);run(g,1.1);assert.ok(g.balls.length>0);
    delete g.effects.rain;g.balls=[];g.tick(.01);assert.equal(g.lives,2);assert.equal(g.state,'life-lost');run(g,1);assert.equal(g.lives,2);
});
test('hatches release balls and activated factories emit at most six each; multiball never exceeds 24',()=>{
    const g=empty(),h=brick('hatch');g.bricks.push(h);g.hitBrick(h,2);assert.equal(g.balls.length,1);
    const e=brick('emitter',{id:105,hp:4,maxHp:4});g.bricks.push(e);g.hitBrick(e,1);
    for(let i=0;i<9;i++){g.time=i*1.3+1;g.updateGenerators();}assert.equal(e.emitted,6);assert.equal(g.balls.length,7);
    for(let i=0;i<8;i++)g.collect('multi');assert.equal(g.balls.length,24);
    g.hitBrick(e,9);g.time+=4;g.updateGenerators();assert.equal(e.emitted,6);
});
test('all 16 powers, refresh timers, combinations, collection, shields and laser occlusion',()=>{
    const g=empty();g.spawnBall(600,450,0,-530);
    for(const name of Object.keys(POWERS)) {g.collect(name);assert.ok(g.drainEvents().some(e=>e.name==='power'&&e.power===name));}
    assert.equal(g.lives,4);assert.equal(g.shield,2);assert.ok(g.has('fire')&&g.has('pierce')&&g.has('laser')&&g.has('lightning'));
    g.time=2;g.collect('fire');assert.equal(g.effects.fire,12);
    g.items=[{id:11,name:'big',x:360,y:490}];g.updateItems(.02);assert.equal(g.items.length,0);assert.equal(g.has('big'),true);
    const wall=brick('steel',{id:20,x:320,bx:320,y:270,by:270,hp:-1,maxHp:-1});const target=brick();g.bricks=[wall,target];g.shots=[{id:21,x:323,y:300}];g.updateShots(.15);assert.equal(target.hp,2);assert.equal(g.shots.length,0);
    g.effects={};g.balls=[];const b=g.spawnBall(600,507,0,400);g.moveBall(b,.05);assert.equal(g.shield,1);assert.ok(b.vy<0);
});
test('piercing ignores crystals but reflects on steel; elemental chains do not recurse without bound',()=>{
    const g=empty();g.collect('pierce');g.bricks=[brick('normal',{y:230,by:230}),brick('normal',{id:101,y:180,by:180}),brick('steel',{id:102,y:120,by:120,hp:-1,maxHp:-1})];const b=g.spawnBall(323,290,0,-950);g.moveBall(b,.25);assert.equal(g.bricks[0].hp,0);assert.equal(g.bricks[1].hp,0);assert.equal(g.bricks[2].hp,-1);assert.ok(b.vy>0);
    const e=new Game({levelIndex:5});e.hitBrick(e.bricks[6],2);assert.equal(e.bricks.filter(b=>b.hp===0).length,7);assert.ok(e.bricks.filter(b=>b.hp>0).length>0);
    const f=empty();f.collect('fire');f.collect('lightning');f.bricks=[brick('heavy',{hp:30,maxHp:30}),brick('heavy',{id:101,x:350,bx:350,hp:30,maxHp:30}),brick('heavy',{id:102,x:400,bx:400,hp:30,maxHp:30})];f.hitBrick(f.bricks[0],2,{ball:f.spawnBall(300,200)});assert.ok(f.events.length<20);assert.ok(f.bricks[2].hp>0);
});
test('portals have cooldown, rotation changes reflection, gates respond to matching switches',()=>{
    const g=empty();g.level.portals=[{id:'a',x:400,y:300,tx:150,ty:100,r:18,angle:0}];const b=g.spawnBall(400,350,0,-600);g.moveBall(b,.1);assert.ok(b.x<300);assert.ok(b.vx>0);assert.ok(b.portalUntil>g.time);
    const s=new Game({levelIndex:13});s.hitBrick(s.bricks.find(b=>b.type==='switch'&&b.opens==='lock2'),2);assert.equal(s.level.gates.find(g=>g.id==='lock2').open,true);assert.equal(s.level.gates.filter(g=>g.open).length,1);
    const r=empty();r.level.rotors=[{x:400,y:250,r:25,speed:1.4}];const ball=r.spawnBall(400,320,0,-600);r.moveBall(ball,.1);assert.ok(Math.abs(ball.vx)>0);
});
test('three bosses enforce nodes; supernova phases stop at 40/20 HP and persist without phase duplication',()=>{
    for(const [i,hp,nodeHp,count] of [[9,24,12,2],[19,36,8,3],[29,60,8,2]]) {
        const g=new Game({levelIndex:i});g.launch();const core=g.bricks.find(b=>b.bossRole==='core'),nodes=g.bricks.filter(b=>b.bossRole==='node');assert.equal(core.hp,hp);assert.equal(nodes.length,count);assert.ok(nodes.every(b=>b.hp===nodeHp));
        assert.equal(g.hitBrick(core,4),false);
        for(const n of nodes)g.hitBrick(n,100,{strong:true});g.hitBrick(core,100,{strong:true});
        if(i===29){assert.equal(core.hp,40);assert.equal(g.bossPhase,1);const restored=Game.restore(g.snapshot());assert.equal(restored.bossPhase,1);assert.equal(restored.bricks.filter(b=>b.bossRole==='node'&&b.hp>0).length,2);assert.equal(restored.state,'paused');for(const n of g.bricks.filter(b=>b.bossRole==='node'&&b.hp>0))g.hitBrick(n,8,{strong:true});g.hitBrick(core,99);assert.equal(core.hp,20);assert.equal(g.bossPhase,2);assert.equal(g.level.portals.length,2);for(const n of g.bricks.filter(b=>b.bossRole==='node'&&b.hp>0))g.hitBrick(n,8,{strong:true});g.hitBrick(core,99);}
        g.checkComplete();assert.equal(g.state,i===29?'won':'level-clear');const lives=g.lives;g.checkComplete();assert.equal(g.lives,lives);
    }
});
test('stage 29 unfolds three distinct scenes; only final clear grants a life',()=>{
    const g=new Game({levelIndex:28});g.launch();const shapes=[];
    for(let w=0;w<3;w++){shapes.push(JSON.stringify(g.bricks.map(b=>[b.x,b.y])));assert.equal(g.wave,w);assert.ok(g.bricks.some(b=>b.power===['multi','fire','lightning'][w]));g.bricks.forEach(b=>b.hp=0);g.checkComplete();assert.equal(g.lives,w<2?3:4);}
    assert.equal(new Set(shapes).size,3);assert.equal(g.state,'level-clear');g.nextLevel();assert.equal(g.levelIndex,29);
});
test('complete checkpoint restores multiball, timers, pickups, mechanisms and terminal states silently',()=>{
    const g=new Game({levelIndex:26,score:320,lives:4});g.launch();g.collect('big');g.collect('fire');g.collect('multi');g.collect('shield');g.time=3.4;g.hitBrick(g.bricks.find(b=>b.type==='switch'),2);g.shots=[{id:100,x:200,y:300}];const snap=g.snapshot();assert.ok(Save.valid(snap));const r=Game.restore(snap);assert.equal(r.state,'paused');assert.equal(r.balls.length,g.balls.length);assert.deepEqual(r.effects,g.effects);assert.deepEqual(r.level.gates,g.level.gates);assert.equal(r.score,g.score);assert.equal(r.events.length,0);r.tick(5);assert.equal(r.time,3.4);r.resume();r.tick(.01);assert.ok(r.time>3.4);
    const local=memory(),session=memory(),s=Save.create(local,session);s.write({version:2,pending:false,paidReady:false,played:true,game:snap});assert.equal(s.load().envelope.game.score,g.score);
    local.setItem(Save.KEY,'{bad');assert.equal(s.load().blocked,true);
});
test('legacy active boards retain score, HP and progress; loss, win and paid states never become free rounds',()=>{
    for(const state of ['running','over','won','level-clear']) {const old={version:1,gameState:state,score:99,lives:state==='over'?0:2,levelIndex:2,paidReady:false,bricks:[{x:100,y:100,width:64,height:22,hp:1,maxHp:2}],ball:{x:300,y:300,vx:100,vy:-150,attached:false},paddle:{x:100}};const e=Save.migrate(old);assert.equal(e.game.state,state==='running'?'paused':state);assert.equal(e.played,true);assert.equal(e.game.bricks[0].hp,2);assert.equal(e.game.score,99);assert.equal(e.game.levelIndex,2);assert.ok(Save.valid(e.game));}
    assert.throws(()=>Save.migrate({version:1,gameState:'unknown'}));
});
test('pause freezes all gameplay timers; 24-ball stress remains finite and bounded',()=>{
    const g=empty();g.spawnBall(600,450,10,-530);g.collect('rain');g.collect('laser');g.collect('fire');g.pause();const before=g.snapshot();run(g,8);assert.deepEqual(g.snapshot(),before);g.resume();
    for(let i=0;i<24;i++)g.spawnBall(50+i*25,400,(i%2?1:-1)*800,-600);run(g,4);assert.ok(g.balls.length<=24);assert.ok(g.events.length<=300);assert.ok(g.balls.every(b=>Number.isFinite(b.x)&&Number.isFinite(b.vy)));
});

test('micro-size expiry in a narrow needle shortcut ejects to free space, never oscillates inside steel',()=>{
    const g=new Game({levelIndex:22});g.launch();g.collect('small');const b=g.balls[0];b.x=127;b.y=250;b.vx=0;b.vy=-200;b.r=5;g.time=8.1;delete g.effects.small;b.r=8;g.resolveOverlap(b);
    const blocked=g.bricks.some(x=>x.hp!==0&&b.x>x.x-b.r&&b.x<x.x+x.w+b.r&&b.y>x.y-b.r&&b.y<x.y+x.h+b.r);assert.equal(blocked,false);assert.ok(b.y!==250||b.x!==127);g.tick(.01);assert.ok(Number.isFinite(b.y));
});

test('every ordered pair of powerups composes safely and retains exclusive size classes',()=>{
    const names=Object.keys(POWERS);
    for(const first of names)for(const second of names){
        const g=empty();g.spawnBall(600,380,70,-530);g.collect(first);g.time=.1;g.collect(second);g.tick(.08);
        assert.ok(g.balls.length<=24,`${first}+${second} ball cap`);
        assert.ok(g.balls.every(b=>['x','y','vx','vy'].every(k=>Number.isFinite(b[k]))));
        assert.ok(['big','small'].filter(k=>g.has(k)).length<=1);
        assert.ok(['wide','narrow','full'].filter(k=>g.has(k)).length<=1);
        assert.ok(Save.valid(g.snapshot()),`${first}+${second} checkpoint`);
    }
});

test('locked-room portals remain inactive until their matching switch opens',()=>{
    const g=new Game({levelIndex:26});g.launch();const p=g.level.portals.find(p=>p.requires==='room0'),b=g.balls[0];
    const approach=()=>{b.x=p.x;b.y=p.y+45;b.vx=0;b.vy=-600;b.portalUntil=0;g.moveBall(b,.1);};
    g.drainEvents();approach();assert.equal(g.drainEvents().some(e=>e.name==='portal'),false);
    g.hitBrick(g.bricks.find(b=>b.opens==='room0'),2);g.drainEvents();approach();
    assert.equal(g.drainEvents().filter(e=>e.name==='portal').length,1);
    assert.ok(Math.abs(b.x-p.tx)<1);
});

test('supernova final-phase portal exits above a directional node and permits a real top impact',()=>{
    const g=new Game({levelIndex:29});g.launch();const core=g.bricks.find(b=>b.bossRole==='core');
    for(let phase=0;phase<2;phase++){
        for(const n of g.bricks.filter(b=>b.bossRole==='node'&&b.hp>0))g.hitBrick(n,8,{strong:true});
        g.hitBrick(core,20);
    }
    const p=g.level.portals[0],node=g.bricks.find(b=>b.bossRole==='node'&&b.hp>0&&b.x>400),b=g.balls[0];
    // Two shots open the remaining armor in the exit lane; the third reaches the node's top face.
    for(let shot=0;shot<3;shot++){
        b.x=p.x;b.y=p.y+45;b.vx=0;b.vy=-600;b.portalUntil=0;g.drainEvents();g.moveBall(b,.1);
        assert.equal(g.drainEvents().filter(e=>e.name==='portal').length,1);
    }
    assert.equal(node.hp,6);
});
