import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const api=createRequire(import.meta.url)('../breakout/engine.js');
const source=readFileSync(new URL('../breakout/renderer.js',import.meta.url),'utf8');
function setup(reduced=false){
    const calls=[];
    const c=new Proxy({}, {get:(target,k)=>k in target?target[k]:k==='createLinearGradient'?()=>({addColorStop:(...a)=>calls.push(['color',...a])}):(...args)=>calls.push([k,...args]),set:(target,k,v)=>{target[k]=v;calls.push(['set',k,v]);return true;}});
    const scope={window:{NeonBreakout:{...api}},Math};vm.runInNewContext(source,scope);
    return {calls, renderer:new scope.window.NeonBreakout.Renderer({getContext:()=>c},{reducedMotion:reduced})};
}
test('every stage renders in both themes, and active mechanisms/24 balls render without errors',()=>{
    for(let i=0;i<30;i++){const g=new api.Game({levelIndex:i}),r=setup().renderer;r.draw(g);r.draw(g,{light:true});g.launch();g.time=2.4;g.animateMechanisms();g.collect('rain');g.collect('fire');g.collect('lightning');for(let k=0;k<24;k++)g.spawnBall(40+k*25,430,100,-500);r.accept(g.drainEvents(),g);r.draw(g);assert.ok(r.particles.length<=400);assert.ok(r.rings.length<=48);}
});
test('basic bricks cycle through three colors and distinct offsets; reduced motion freezes cycling',()=>{
    const g=new api.Game({levelIndex:0}),h=setup(),b=g.bricks[0];
    const colorAt=(t,brick=b)=>{g.time=t;h.calls.length=0;h.renderer.drawBrick(brick,g,false);return h.calls.find(c=>c[0]==='set'&&c[1]==='shadowColor')[2];};
    const trio=[colorAt(0),colorAt(4/3),colorAt(8/3)];assert.equal(new Set(trio).size,3);assert.notEqual(colorAt(0,g.bricks[1]),trio[0]);
    const reduced=setup(true);g.time=0;reduced.renderer.drawBrick(b,g,false);const first=reduced.calls.find(c=>c[0]==='set'&&c[1]==='shadowColor')[2];reduced.calls.length=0;g.time=1;reduced.renderer.drawBrick(b,g,false);assert.equal(reduced.calls.find(c=>c[0]==='set'&&c[1]==='shadowColor')[2],first);
});
test('special bricks sparkle without losing type markings, and FX are hard bounded',()=>{
    const g=new api.Game({levelIndex:19}),h=setup();h.renderer.draw(g);assert.ok(h.calls.some(c=>c[0]==='set'&&c[1]==='shadowBlur'&&c[2]>8));
    h.renderer.accept(Array.from({length:500},()=>({name:'explosion',x:360,y:250})),g);assert.ok(h.renderer.particles.length<=400);assert.ok(h.renderer.rings.length<=48);h.renderer.lowFX=true;h.renderer.accept([{name:'explosion',x:300,y:200}],g);assert.ok(h.renderer.particles.length<=100);assert.ok(h.renderer.rings.length<=16);
});
