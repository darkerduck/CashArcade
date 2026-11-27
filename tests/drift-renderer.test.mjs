import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
function fixture(){let balance=0,calls=0;const ctx=new Proxy({}, {get(o,k){if(k in o)return o[k];return (...args)=>{calls++;for(const n of args)if(typeof n==='number')assert.ok(Number.isFinite(n),String(k));if(k==='save')balance++;if(k==='restore')balance--;if(String(k).startsWith('create'))return {addColorStop(){}};if(k==='measureText')return {width:30};};},set(o,k,v){o[k]=v;return true;}});class Canvas{constructor(w=1000,h=760){this.width=w;this.height=h;}getContext(){return ctx;}}const scope=vm.createContext({OffscreenCanvas:Canvas,performance:{now:()=>0}});for(const f of ['engine','renderer'])vm.runInContext(readFileSync(new URL('../drift/'+f+'.js',import.meta.url),'utf8'),scope);return {scope,canvas:new Canvas(),balance:()=>balance,calls:()=>calls};}
test('every track renders in dark/light and reduced motion without mutating game',()=>{const h=fixture(),r=new h.scope.NeonDriftRenderer.Renderer(h.canvas);for(let i=0;i<3;i++){const g=new h.scope.NeonDrift.Game(i);for(const theme of ['dark','light'])for(const reducedMotion of [true,false]){const before=JSON.stringify(g);r.render(g,{theme,reducedMotion});assert.equal(JSON.stringify(g),before);}}assert.equal(h.balance(),0);assert.ok(h.calls()>100);r.destroy();});
test('chase camera zooms in on the car, reduced motion shows the whole track, and race events drive arcade FX',()=>{
    const ops=[];let balance=0;const ctx=new Proxy({}, {get(o,k){if(k in o)return o[k];return (...args)=>{for(const n of args)if(typeof n==='number')assert.ok(Number.isFinite(n),String(k));ops.push([k,...args]);if(k==='save')balance++;if(k==='restore')balance--;if(String(k).startsWith('create'))return {addColorStop(){}};};},set(o,k,v){o[k]=v;return true;}});
    class Canvas{constructor(w=1000,h=760){this.width=w;this.height=h;}getContext(){return ctx;}}
    let wall=0;const scope=vm.createContext({OffscreenCanvas:Canvas,performance:{now:()=>wall}});
    for(const f of ['../arcade-fx.js','../drift/engine.js','../drift/renderer.js'])vm.runInContext(readFileSync(new URL(f,import.meta.url),'utf8'),scope);
    const r=new scope.NeonDriftRenderer.Renderer(new Canvas()),g=new scope.NeonDrift.Game(0);g.start();
    r.render(g,{});const zoomed=ops.filter(o=>o[0]==='setTransform').map(o=>o[1]);assert.ok(zoomed.some(v=>v>1.5),'camera is zoomed');
    assert.ok(r.cache.width===2000,'world cache is drawn at 2x');
    ops.length=0;r.render(g,{reducedMotion:true});assert.ok(ops.filter(o=>o[0]==='setTransform').every(o=>o[1]<=1.0001),'reduced motion keeps the full view');r.render(g,{});
    r.event({type:'collision',damage:16,x:g.car.x,y:g.car.y},g);assert.equal(r.timeScale(),0);assert.ok(r.busy);
    r.event({type:'lap',laps:1,lapTime:21.5,best:true},g);assert.equal(r.screenFx.stats().banner,'BEST LAP');
    r.event({type:'explosion',x:500,y:300},g);
    for(let i=0;i<60;i++){wall+=50;r.render(g,{});}
    assert.equal(r.timeScale(),1);assert.equal(r.busy,false);assert.equal(balance,0);
});
