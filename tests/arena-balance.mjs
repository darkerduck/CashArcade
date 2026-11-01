// Deterministic input-only pacing probe. No invulnerability, damage edits or forced wave completion.
// This is not a substitute for human difficulty testing. Run: node tests/arena-balance.mjs
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const scope=vm.createContext({});
for(const name of ['data','storage','engine'])vm.runInContext(readFileSync(new URL(`../arena/${name}.js`,import.meta.url),'utf8'),scope);
const order=['damage','deathBlast','speed','armor','shield','cooldown','jumps','reach','trail','radius','blastDamage','charge'];
for(const seed of [2026,42,93,120,750]){
    const game=new scope.NeonArena.Game(scope.NeonArenaStorage.fresh(seed)),waves=[];let ticks=0,hits=0,lastHp=game.hp;
    while(game.state!=='lost'&&game.state!=='won'&&ticks++<120*1200){
        if(game.state==='upgrade'){waves.push({wave:game.wave,seconds:+game.time.toFixed(1),hp:game.hp});game.chooseUpgrade(order.find(id=>game.choices.includes(id)));lastHp=game.hp;}
        const p=game.player,angle=game.time*.45,tx=360+Math.cos(angle)*225,ty=360+Math.sin(angle)*225;
        let dx=tx-p.x,dy=ty-p.y,n=Math.hypot(dx,dy)||1;dx/=n;dy/=n;
        // Steer around nearby enemies while keeping the orbit moving.
        for(const e of game.enemies){const d=Math.hypot(p.x-e.x,p.y-e.y);if(d<100){dx+=(p.x-e.x)/(d||1)*1.3;dy+=(p.y-e.y)/(d||1)*1.3;}}
        const danger=game.enemies.some(e=>Math.hypot(p.x-e.x,p.y-e.y)<e.r+40)||game.bullets.some(b=>Math.hypot(p.x-b.x,p.y-b.y)<45);
        if(danger)game.dash({dx,dy});game.update(1/120,{dx,dy,autoAim:true});game.drain();
        if(game.hp<lastHp)hits+=lastHp-game.hp;lastHp=game.hp;
    }
    waves.push({wave:game.wave,seconds:+game.time.toFixed(1),hp:game.hp});
    console.log(JSON.stringify({seed,state:game.state,wave:game.wave,seconds:+game.elapsed.toFixed(1),hits,waves}));
}
