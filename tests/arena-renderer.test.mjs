import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
test('all three sectors, enemies, boss phases and effects render finite, balanced and without gameplay mutation',()=>{
    let saves=0,calls=0;const gradient={addColorStop(){}};
    const ctx=new Proxy({}, {get:(_,key)=>key==='createRadialGradient'?()=>gradient:(...args)=>{for(const a of args)if(typeof a==='number')assert.ok(Number.isFinite(a),String(key));if(key==='save')saves++;if(key==='restore')saves--;calls++;},set:()=>true});
    const scope=vm.createContext({devicePixelRatio:3,matchMedia:()=>({matches:false,addEventListener(){}})});
    for(const f of ['data','storage','engine','renderer'])vm.runInContext(readFileSync(new URL(`../arena/${f}.js`,import.meta.url),'utf8'),scope);
    const canvas={getContext:()=>ctx},renderer=new scope.NeonArenaRenderer(canvas),g=new scope.NeonArena.Game(scope.NeonArenaStorage.fresh(23));assert.equal(canvas.width,1440);
    for(let wave=1;wave<=12;wave++){
        for(const kind of ['swarm','charger','shooter','guard','splitter','shard'])g.addEnemy(kind,150+g.serial*5,300);
        g.warn('charger');g.beam({x:300,y:300},1,true);if(g.boss){g.boss.overload=true;g.boss.hp*=.2;g.boss.windup=1;g.boss.dx=1;g.boss.dy=0;}
        g.dash({dx:1,dy:0});g.fire();for(const type of ['explode','hurt','shield','bossDown'])g.emit(type,{x:360,y:360,radius:150});renderer.consume(g.drain());renderer.update(.05);
        const before=JSON.stringify(g);renderer.draw(g,'dark');renderer.draw(g,'light');assert.equal(JSON.stringify(g),before);assert.equal(saves,0);
        g.complete();if(wave<12)g.chooseUpgrade(g.choices[0]);
    }
    renderer.consume(Array.from({length:1000},()=>({type:'explode',x:360,y:360})));assert.ok(renderer.particles.length<=240);assert.ok(renderer.rings.length<=32);
    renderer.reduced=true;renderer.reset();renderer.consume([{type:'ghost',x:0,y:0},{type:'hurt',x:0,y:0}]);assert.equal(renderer.ghosts.length,0);assert.equal(renderer.shake,0);renderer.update(2);assert.equal(renderer.particles.length,0);assert.ok(calls>1000);
});
