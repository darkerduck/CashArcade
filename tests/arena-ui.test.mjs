import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
function harness(storage=new Map(),broken=false){
    const els=new Map(),events=new Map(),music=[];let frame,now=0,game,visual=0;
    function element(id){if(!els.has(id)){const listeners=new Map(),children=[];els.set(id,{children,dataset:{},style:{},hidden:false,disabled:false,textContent:'',classList:{add(){},remove(){}},
        addEventListener:(k,f)=>listeners.set(k,f),setAttribute(k,v){this[k]=v;},focus(){},setPointerCapture(){},getBoundingClientRect:()=>({left:10,top:20,width:360,height:360}),
        fire(k,e={}){if(k==='click'&&this.disabled)return;listeners.get(k)?.(e);},append(...nodes){children.push(...nodes);},replaceChildren(){children.length=0;},get firstElementChild(){return children[0];}});}return els.get(id);}
    let next=0;
    const scope=vm.createContext({document:{getElementById:element,createElement:()=>element('created'+next++),documentElement:{dataset:{}},addEventListener:(k,f)=>events.set(k,f)},
        localStorage:{getItem:k=>{if(broken)throw Error();return storage.get(k)??null;},setItem:(k,v)=>{if(broken)throw Error();storage.set(k,v);},removeItem:k=>storage.delete(k)},
        CashArcadeAudio:{create:()=>({resume(){},play(){},musicOutput(){}})},CashArcadeMusic:{create:()=>Object.fromEntries(['start','pause','resume','duck','phase'].map(k=>[k,(...a)=>music.push([k,...a])]))},
        NeonArenaRenderer:class{reset(){visual=0;}resize(){}consume(){}update(dt){visual+=dt;}draw(g){game=g;}},
        performance:{now:()=>now},requestAnimationFrame:f=>frame=f,addEventListener:(k,f)=>events.set(k,f),matchMedia:()=>({matches:false})});scope.window=scope;
    for(const f of ['data','storage','engine','input','music','game'])vm.runInContext(readFileSync(new URL(`../arena/${f}.js`,import.meta.url),'utf8'),scope);
    const tick=(n=1)=>{for(let i=0;i<n;i++){now+=25;frame(now);}};tick();
    return {element,scope,storage,music,tick,get game(){return game;},get visual(){return visual;},click:id=>element(id).fire('click'),event:(k,e={})=>events.get(k)(e),key:(key,extra={})=>events.get('keydown')({key,target:{},preventDefault(){},...extra})};
}
test('no autoplay, keyboard and scaled mouse aim work; blur freezes battle, effects and cooldowns',()=>{
    const h=harness();assert.equal(h.music.length,0);h.tick(40);assert.equal(h.game.time,0);h.click('start');h.tick(4);
    const x=h.game.player.x;h.key('d');h.tick(4);assert.ok(h.game.player.x>x+20);h.event('keyup',{key:'d'});
    h.element('game-canvas').fire('pointermove',{clientX:370,clientY:20,pointerType:'mouse'});h.tick();assert.ok(h.game.player.aimX>0&&h.game.player.aimY<0);
    h.key('Shift');h.tick(8);h.event('blur');const t=h.game.time,v=h.visual,recharge=h.game.player.recharge;h.tick(100);assert.equal(h.game.time,t);assert.equal(h.visual,v);assert.equal(h.game.player.recharge,recharge);assert.equal(h.music.at(-1)[0],'pause');
    h.click('start');h.tick(2);assert.ok(h.game.time>t);assert.equal(h.game.player.moveX,0);
});
test('two pointers move and dash simultaneously, unrelated cancel keeps stick; own cancel releases',()=>{
    const h=harness();h.click('start');h.tick();const stick=h.element('joystick'),dash=h.element('dash');
    const pointer={pointerId:1,pointerType:'touch',clientX:360,clientY:200,button:0,preventDefault(){}};
    stick.fire('pointerdown',pointer);h.tick(4);const x=h.game.player.x;assert.ok(h.game.player.moveX>.9);
    dash.fire('pointerdown',{...pointer,pointerId:2});h.tick(4);assert.ok(h.game.player.x>x+70);assert.equal(h.game.player.charges,0);
    stick.fire('pointercancel',{pointerId:2});h.tick(8);assert.ok(h.game.player.moveX>.9);
    stick.fire('pointercancel',{pointerId:1});h.tick();assert.equal(h.game.player.moveX,0);
});
test('slider keys do not move/dash; repeat cannot consume extra charge, hidden page pauses',()=>{
    const h=harness();h.click('start');h.tick();const x=h.game.player.x;
    h.key('d',{target:{closest:s=>s.includes('input')}});h.key(' ',{target:{closest:s=>s.includes('input')}});h.tick(4);assert.equal(h.game.player.x,x);assert.equal(h.game.player.charges,1);
    h.key('Shift',{repeat:true});assert.equal(h.game.player.charges,1);h.scope.document.hidden=true;h.event('visibilitychange');const time=h.game.time;h.tick(40);assert.equal(h.game.time,time);
});
test('checkpoint reload waits for Continue and keeps upgrade cards; rapid double selection applies once',()=>{
    const h=harness();h.click('start');h.tick();h.game.score=500;h.game.hp=2;h.game.complete();h.tick(50);const cp=h.storage.get('casharcade-arena-checkpoint-v1');assert.ok(cp.includes('upgrade'));
    const re=harness(h.storage);assert.equal(re.music.length,0);assert.equal(re.element('upgrades').children.length,0);re.click('start');re.tick();
    const card=re.element('upgrades').children[0],id=card.dataset.upgrade;card.fire('click');card.fire('click');re.tick();assert.equal(re.game.wave,2);assert.equal(re.game.upgrades[id],1);
    re.game.score=9999;re.game.hp=0;re.game.state='lost';re.tick();re.key('r');re.tick();assert.equal(re.game.score,500);assert.ok(re.game.hp>=3);
});
test('post-boss transition freezes on blur, does not resume music, and victory clears campaign only',()=>{
    const h=harness();h.click('start');h.tick();h.game.complete();h.tick();h.event('blur');const v=h.visual;h.tick(80);assert.equal(h.visual,v);h.click('start');h.tick(50);assert.equal(h.element('upgrades').children.length,3);assert.equal(h.music.filter(m=>m[0]==='resume').length,0);
    h.element('upgrades').children[0].fire('click');h.tick();h.game.state='won';h.game.score=9000;h.tick(50);assert.equal(h.storage.has('casharcade-arena-checkpoint-v1'),false);assert.equal(h.storage.get('casharcade-arena-high-score'),'9000');
});
test('storage failure displays warning and free play/retry remains available',()=>{const h=harness(new Map(),true);assert.match(h.element('storage-note').textContent,/無法/);h.click('start');h.tick(20);assert.equal(h.game.state,'running');h.key('r');h.tick();assert.ok(h.game.time<.1);});
test('coordinate conversion accounts for letterboxing',()=>{const h=harness(),canvas={getBoundingClientRect:()=>({left:10,top:20,width:900,height:720})};const p=h.scope.NeonArenaInput.point(canvas,460,380);assert.equal(p.x,360);assert.equal(p.y,360);});
