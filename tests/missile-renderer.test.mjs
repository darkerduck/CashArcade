import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

let reduced=false;
const scope = vm.createContext({ devicePixelRatio: 1, matchMedia: () => ({ get matches() { return reduced; } }),
    document:{documentElement:{dataset:{theme:'dark'}}} });
vm.runInContext(readFileSync(new URL('../missile/engine.js', import.meta.url), 'utf8'), scope);
vm.runInContext(readFileSync(new URL('../missile/renderer.js', import.meta.url), 'utf8'), scope);
const ground = scope.NeonDefense.GROUND;

function cityDrawing(hp, light = false, shield = false) {
    const operations = [];
    const context = new Proxy({}, {
        get: (_, name) => (...args) => operations.push([name, ...args]),
        set: (_, name, value) => { operations.push([name, value]); return true; },
    });
    const canvas = { getContext: () => context };
    const renderer = new scope.NeonDefenseRenderer(canvas);
    renderer.city({ x: 150, hp, shield }, light);
    return operations;
}

test('city silhouette changes across all four damage states in both themes', () => {
    for (const light of [false, true]) {
        const states = [3, 2, 1, 0].map(hp => cityDrawing(hp, light));
        assert.equal(new Set(states.map(s => JSON.stringify(s))).size, 4);
        assert.ok(states[0].some(([name, , y]) => name === 'lineTo' && y === ground - 55)); // intact tower top
        assert.ok(states[1].some(([name, , y]) => name === 'lineTo' && y === ground - 49)); // damaged roof
        assert.ok(states[2].some(([name, , y]) => name === 'lineTo' && y === ground - 35)); // collapsed roof
        assert.ok(!states[3].some(([name, , y]) => name === 'lineTo' && y < ground - 20)); // rubble only
    }
});

test('shield is separate from damage and repair redraws the intact city', () => {
    const intact = cityDrawing(3);
    const damaged = cityDrawing(1);
    assert.notDeepEqual(damaged, intact);
    assert.deepEqual(cityDrawing(3), intact);
    assert.ok(cityDrawing(2, false, true).some(([name, , , radius]) => name === 'arc' && radius === 43));
    assert.ok(!cityDrawing(0, false, true).some(([name, , , radius]) => name === 'arc' && radius === 43));
});

function renderer() {
    const operations=[];
    const context=new Proxy({}, {
        get: (_,name) => (...args) => {
            operations.push([name,...args]);
            if (name === 'createLinearGradient' || name === 'createRadialGradient') return {addColorStop() {}};
        },
        set: (_,name,value) => { operations.push([name,value]); return true; },
    });
    return {r:new scope.NeonDefenseRenderer({getContext:() => context}),operations};
}
test('all shake events have their specified duration/amplitude, merge and end within one window', () => {
    const cases=[
        [{type:'damage',hp:2},.4,12],[{type:'damage',destroyed:true},.65,18],
        [{type:'shield'},.18,3],[{type:'bossPhase',phase:'core'},.35,8],
        [{type:'bossPhase',phase:'rage'},.65,16],[{type:'bossDeath'},.9,22],
        [{type:'explosion',boosted:true},.22,5],[{type:'chain',depth:3},.3,7],[{type:'breakup'},.3,6],
    ];
    for (const [event,duration,amplitude] of cases) {
        const {r}=renderer(); r.event({x:300,y:300,...event});
        assert.equal(r.shake,duration); assert.equal(r.shock.amplitude,amplitude);
        for (let i=0;i<20;i++) {
            const offset=r.offset(); assert.ok(Math.hypot(offset.x,offset.y) <= amplitude+.0001);
            r.advance(.05); r.event({x:300,y:300,...event});
            assert.ok(r.shock.end <= r.shock.start+.9+.0001);
        }
    }
    const {r}=renderer(); r.event({type:'damage',x:300,y:650});
    r.advance(.05); r.event({type:'bossDeath',x:480,y:128});
    assert.ok(r.shock.end <= .9); assert.equal(r.shock.amplitude,22);
    r.advance(.9); assert.equal(r.shake,0); assert.equal(r.offset().x,0);
});
test('all powers have distinct visuals, EMP targets stay after destruction and decorative buffers are bounded', () => {
    const {r}=renderer();
    for (const power of ['rapid','wide','slow','shield','emp']) r.event({type:'pickup',power,x:320,y:250,
        turrets:[{x:70,y:665}],cities:[{x:190,y:626}],targets:Array.from({length:100},(_,i) => ({x:i*8,y:100}))});
    assert.equal(new Set(r.vfx.map(f => f.kind)).size,5);
    assert.equal(r.vfx.find(f => f.kind === 'emp').targets.length,32);
    for (let i=0;i<100;i++) r.event({type:'bossDeath',x:480,y:128,width:440});
    assert.ok(r.particles.length <= 480); assert.ok(r.vfx.length <= 48); assert.ok(r.debris.length <= 48);
});
test('effect/debris/particle clocks freeze, expire and reset; reduced motion suppresses shake/flash', () => {
    const {r}=renderer(); r.event({type:'bossDeath',x:480,y:128});
    const saved=JSON.stringify({particles:r.particles,vfx:r.vfx,debris:r.debris,shock:r.shock});
    r.advance(0); assert.equal(JSON.stringify({particles:r.particles,vfx:r.vfx,debris:r.debris,shock:r.shock}),saved);
    r.advance(3); assert.equal(r.vfx.length,0); assert.equal(r.particles.length,0); assert.equal(r.debris.length,0);
    r.event({type:'damage',x:190,y:650}); r.reset();
    assert.equal(r.shake,0); assert.equal(r.clock,0); assert.equal(r.particles.length,0); assert.equal(r.vfx.length,0);
    reduced=true; r.event({type:'bossDeath',x:480,y:128});
    assert.equal(r.shake,0); assert.equal(r.flash,0); assert.equal(r.offset().x,0); reduced=false;
});
test('both themes draw all unit states and powers; camera transform ends before crosshair', () => {
    for (const theme of ['dark','light']) {
        scope.document.documentElement.dataset.theme=theme;
        const {r,operations}=renderer(), g=new scope.NeonDefense.Game({...scope.NeonDefense.fresh(),level:20});
        for (const type of ['normal','fast','split','armored','cruiser']) {
            const e=g.spawn(type,400,250); if (type === 'cruiser') e.hp=1;
        }
        g.effects.slow=8; g.effects.rapid=10; g.effects.wide=10; g.cities[0].shield=true;
        r.event({type:'damage',x:190,y:650});
        for (const power of ['rapid','wide','slow','shield','emp']) {
            r.event({type:'pickup',power,x:320,y:250,turrets:g.turrets,cities:g.cities,targets:g.enemies});
        }
        r.draw(g,{x:555,y:444},.05);
        const reticle=operations.findIndex(op => op[0] === 'arc' && op[1] === 555 && op[2] === 444 && op[3] === 14);
        const lastRestore=operations.slice(0,reticle).findLastIndex(op => op[0] === 'restore');
        assert.ok(lastRestore >= 0); assert.ok(!operations.slice(lastRestore+1,reticle).some(op => op[0] === 'translate'));
        g.boss.nodes.fill(0); g.boss.phase='core'; r.draw(g,{x:555,y:444},.05);
        g.boss.rage=true; g.boss.phase='rage'; r.draw(g,{x:555,y:444},.05);
    }
});
