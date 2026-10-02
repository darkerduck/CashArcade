import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function harness() {
    const ops=[], media={matches:false}, canvases=[];
    function canvas() {
        const operations=[], state={};
        const ctx=new Proxy(state,{
            get: (obj,name)=>name in obj?obj[name]:(...args)=>{
                operations.push([name,...args]);
                for(const value of args)if(typeof value==='number')assert.ok(Number.isFinite(value),`${name} must be finite`);
                if(String(name).startsWith('create'))return {addColorStop() {}};
            },
            set:(obj,name,value)=>{obj[name]=value;operations.push([name,value]);return true;},
        });
        const result={width:720,height:540,getContext:()=>ctx};canvases.push(result);ops.push(operations);return result;
    }
    const scope=vm.createContext({matchMedia:()=>media,document:{createElement:()=>canvas()},devicePixelRatio:3});
    scope.window=scope;
    vm.runInContext(readFileSync(new URL('../flappy/renderer.js',import.meta.url),'utf8'),scope);
    const main=canvas(),preview=canvas(),r=new scope.NeonFlightRenderer(main,preview);
    const state={player:{y:260,rotation:-.2},gates:[{x:300,gapTop:170,gapBottom:330}],time:4,speed:190,state:'running',light:false};
    return {r,ops,media,main,preview,scope,state};
}

test('bird has a rounded head, separate curved beak, feathered wings/tail and an animated downstroke',()=>{
    const {r,ops}=harness(),c=r.ctx;
    r.bird(c,160,260,0,.8,false);const up=JSON.stringify(ops[0]);
    assert.ok(ops[0].some(op=>op[0]==='ellipse'&&op[1]===10&&op[2]===-9&&op[3]===12));
    assert.ok(ops[0].some(op=>op[0]==='quadraticCurveTo'&&op[1]===29&&op[2]===-7));
    assert.equal(ops[0].filter(op=>op[0]==='bezierCurveTo').length,4); // two wings and two chest contours
    ops[0].length=0;r.bird(c,160,260,0,-.7,false);assert.notEqual(JSON.stringify(ops[0]),up);
    r.flap(260);assert.equal(r.pose(),.95);r.advance(.09);assert.ok(r.pose()<-.69);
    r.advance(.21);assert.ok(r.pose()>.2);
});

test('both themes draw bounded HiDPI scenes without changing any physics object',()=>{
    const {r,ops,state,main,preview,scope}=harness();const original=JSON.stringify(state);
    for(const light of [false,true]) {
        r.draw({...state,light,state:'ready'});
        assert.equal(main.width,1440);assert.equal(main.height,1080);
        assert.equal(preview.width,400);assert.equal(preview.height,280);
        assert.equal(r.backdropTheme,light);
        assert.ok(ops[0].some(op=>op[0]==='fillRect'&&op[1]===300&&op[2]===0&&op[3]===76&&op[4]===170));
    }
    assert.equal(JSON.stringify(state),original);
    scope.devicePixelRatio=1;r.draw(state);assert.equal(main.width,720);assert.equal(main.height,540);
});

test('cached sky is reused until theme changes; all canvas save/restore calls balance',()=>{
    const {r,ops,state}=harness();r.draw(state);const cachedCount=ops[2].length;
    r.draw({...state,time:9});assert.equal(ops[2].length,cachedCount);
    r.draw({...state,light:true});assert.ok(ops[2].length>cachedCount);
    for(const list of ops)assert.equal(list.filter(op=>op[0]==='save').length,list.filter(op=>op[0]==='restore').length);
});

test('visual buffers are bounded, paused clocks freeze, effects expire and a new round resets them',()=>{
    const {r}=harness();
    for(let i=0;i<50;i++){r.flap(250);r.pass(400,260);r.lose(250);}
    assert.ok(r.particles.length<=64);assert.equal(r.rings.length,6);
    const saved=JSON.stringify({particles:r.particles,rings:r.rings,clock:r.clock,pose:r.pose()});
    r.advance(0);assert.equal(JSON.stringify({particles:r.particles,rings:r.rings,clock:r.clock,pose:r.pose()}),saved);
    r.advance(1);assert.equal(r.particles.length,0);assert.equal(r.rings.length,0);
    r.flap(230);r.pass(300,230);r.reset();assert.equal(r.clock,0);assert.equal(r.flapAge,1);assert.equal(r.particles.length,0);assert.equal(r.rings.length,0);
});

test('reduced motion freezes scenery and wing pose, skips particles and keeps collision boundaries visible',()=>{
    const {r,media,ops,state}=harness();media.matches=true;
    r.flap(260);r.pass(400,260);r.lose(260);assert.equal(r.particles.length,0);assert.equal(r.rings.length,0);
    r.draw(state);ops[0].length=0;r.draw(state);const first=JSON.stringify(ops[0]);
    ops[0].length=0;r.advance(1);r.draw({...state,time:25});assert.equal(JSON.stringify(ops[0]),first);assert.equal(r.pose(),.35);
});
