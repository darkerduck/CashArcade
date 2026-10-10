import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {Game,STEP_SECONDS} from '../circuit/engine.mjs';
import {LEVELS} from '../circuit/levels.mjs';
import {create as createStorage,recordWin,KEY} from '../circuit/storage.mjs';
const html=readFileSync(new URL('../circuit/index.html',import.meta.url),'utf8');
const source=readFileSync(new URL('../circuit/game.mjs',import.meta.url),'utf8').replace(/^import[^\n]+\n/gm,'');
class Element{
  constructor(id='',tag='div'){this.id=id;this.tagName=tag;this.children=[];this.events={};this.attrs={};this.dataset={};this.style={};this.textContent='';this.innerHTML='';this.disabled=false;this.hidden=false;this.value='';this.classes=new Set();this.classList={add:c=>this.classes.add(c),remove:c=>this.classes.delete(c),contains:c=>this.classes.has(c)};}
  addEventListener(type,listener){(this.events[type]??=[]).push(listener);}
  emit(type,data={}){const event={target:this,preventDefault(){this.prevented=true;},pointerId:1,clientX:0,clientY:0,detail:1,...data};for(const listener of this.events[type]||[])listener(event);return event;}
  setAttribute(k,v){this.attrs[k]=v;}getAttribute(k){return this.attrs[k];}
  append(child){this.children.push(child);}replaceChildren(...children){this.children=children;}
  matches(selector){return selector.split(',').includes(this.tagName);}closest(selector){return this.matches(selector)?this:null;}
  setPointerCapture(){}focus(){this.focused=true;}requestFullscreen(){return Promise.resolve();}
}
function fixture({saved=null,audio=true,denied=false}={}){
  const elements=new Map([...html.matchAll(/<(\w+)[^>]*id="([^"]+)"[^>]*>/g)].map(m=>[m[2],new Element(m[2],m[1])]));
  const buttons=['up','right','down','left'].map(direction=>{const e=new Element('', 'button');e.dataset.direction=direction;return e;});
  const doc=new Element(),win=new Element(),machine=new Element(),values=new Map(saved?[[KEY,JSON.stringify(saved)]]:[]),audioEvents=[],musicEvents=[];let nextFrame=null,time=0,game;
  const storage={getItem(key){if(denied)throw new Error('denied');return values.get(key)??null;},setItem(key,value){if(denied)throw new Error('denied');values.set(key,value);}};
  doc.getElementById=id=>elements.get(id);doc.documentElement={dataset:{}};doc.createElement=tag=>new Element('',tag);doc.createTextNode=text=>({textContent:text});doc.hidden=false;
  doc.querySelector=()=>machine;doc.querySelectorAll=selector=>selector==='[data-direction]'?buttons:buttons.filter(b=>b.classes.has('active'));
  const sound={play:name=>audioEvents.push(name),resume:()=>audioEvents.push('wake'),musicOutput(){return null;}};
  const music=Object.fromEntries(['start','pause','resume','wake'].map(method=>[method,value=>musicEvents.push([method,value])]));
  const api=createStorage(storage);
  class FakeRenderer{render(value){game=value;}destroy(){}}
  const scope={Game,STEP_SECONDS,LEVELS,Renderer:FakeRenderer,createStorage:()=>api,recordWin,document:doc,window:win,localStorage:storage,matchMedia:()=>({matches:false,addEventListener(){}}),requestAnimationFrame:fn=>{nextFrame=fn;}};
  if(audio){scope.CashArcadeAudio={create:()=>sound};scope.CashArcadeMusic={create:()=>music};scope.CashArcadeExpansionScores={circuit:{}};}
  vm.runInNewContext(source,scope,{filename:'circuit/game.mjs'});
  const frame=(dt=17)=>{time+=dt;const current=nextFrame;nextFrame=null;current(time);};frame();
  return {elements,buttons,doc,win,frame,get game(){return game;},musicEvents,audioEvents,values,click(id){elements.get(id).emit('click');frame();},key(code,target=elements.get('game-canvas')){return doc.emit('keydown',{code,target,repeat:false});}};
}
test('controller boots without starting music, starts once and supports safe pause/resume',()=>{
  const h=fixture();assert.equal(h.game.state,'ready');assert.equal(h.musicEvents.filter(e=>e[0]==='start').length,0);h.click('start');assert.equal(h.game.state,'running');assert.equal(h.elements.get('overlay').hidden,true);h.click('start');assert.equal(h.musicEvents.filter(e=>e[0]==='start').length,1);
  h.key('ArrowRight');h.frame(160);h.click('pause');assert.equal(h.game.state,'paused');assert.equal(h.game.direction,null);const tick=h.game.tickCount;h.frame(500);assert.equal(h.game.tickCount,tick);h.click('start');assert.equal(h.game.state,'running');assert.equal(h.game.direction,null);assert.ok(h.musicEvents.some(e=>e[0]==='resume'));
});
test('swipe queues a direction once threshold is crossed; canceled capture cannot keep steering',()=>{
  const h=fixture();h.click('start');const canvas=h.elements.get('game-canvas');canvas.emit('pointerdown',{pointerId:8,clientX:20,clientY:20});canvas.emit('pointermove',{pointerId:8,clientX:28,clientY:20});assert.equal(h.game.queued,null);canvas.emit('pointermove',{pointerId:8,clientX:65,clientY:20});assert.equal(h.game.queued,'right');canvas.emit('pointercancel',{pointerId:8});canvas.emit('pointermove',{pointerId:8,clientX:65,clientY:80});assert.equal(h.game.queued,'right');
});
test('D-pad, keyboard cloak, brake and native form keyboard behavior are separate',()=>{
  const h=fixture();h.click('start');const down=h.buttons.find(b=>b.dataset.direction==='down');down.emit('pointerdown');assert.equal(h.game.queued,'down');assert.equal(down.classList.contains('active'),true);down.emit('lostpointercapture');assert.equal(down.classList.contains('active'),false);h.key('Space');assert.equal(h.game.cloaked,true);h.key('KeyC');assert.equal(h.game.queued,null);const e=h.key('ArrowRight',h.elements.get('music-volume'));assert.equal(e.prevented,undefined);assert.equal(h.game.queued,null);h.key('Space',h.elements.get('start'));assert.equal(h.game.charges,0);
});
test('visibility and window blur pause automatically and do not auto-resume',()=>{
  const h=fixture();h.click('start');h.doc.hidden=true;h.doc.emit('visibilitychange');assert.equal(h.game.state,'paused');h.doc.hidden=false;h.doc.emit('visibilitychange');assert.equal(h.game.state,'paused');h.click('start');h.win.emit('blur');assert.equal(h.game.state,'paused');assert.equal(h.elements.get('overlay').hidden,false);
});
test('death shows one free-retry action and retry rebuilds all state without any payment',()=>{
  const h=fixture();h.click('start');h.game.die('laser');h.frame();assert.equal(h.elements.get('start').textContent,'免費重試 →');assert.equal(h.elements.get('overlay').hidden,false);h.click('start');assert.equal(h.game.state,'running');assert.equal(h.game.tickCount,0);assert.equal(h.game.nodes.size,5);assert.equal(h.game.charges,1);
});
test('win is recorded once, unlocks next level, advances safely and replay stays on level',()=>{
  const h=fixture();h.click('start');h.game.elapsed=12;h.game.nodes.clear();h.game.shards.clear();h.game.complete();h.frame();let data=JSON.parse(h.values.get(KEY));assert.equal(data.unlocked,2);assert.equal(data.records[0].clears,1);h.frame();assert.equal(JSON.parse(h.values.get(KEY)).records[0].clears,1);assert.equal(h.elements.get('replay').hidden,false);h.click('replay');assert.equal(h.game.level.id,0);assert.equal(h.game.state,'running');h.game.nodes.clear();h.game.complete();h.frame();h.click('start');assert.equal(h.game.level.id,1);assert.equal(h.game.state,'running');
});
test('restored selection and reduced-motion preference are respected; locked stages stay disabled',()=>{
  const h=fixture({saved:{version:1,selected:3,unlocked:4,reducedMotion:true}});assert.equal(h.game.level.id,3);assert.equal(h.elements.get('motion').checked,true);const buttons=h.elements.get('levels').children;assert.equal(buttons.length,10);assert.equal(buttons[3].disabled,false);assert.equal(buttons[4].disabled,true);h.click('theme-toggle');assert.equal(h.doc.documentElement.dataset.theme,'light');h.click('theme-toggle');assert.equal(h.doc.documentElement.dataset.theme,'dark');
});
test('unavailable sound/music or persistent storage never prevents free gameplay',()=>{
  const h=fixture({audio:false,denied:true});assert.equal(h.elements.get('sound-toggle').disabled,true);assert.equal(h.elements.get('music-toggle').disabled,true);assert.match(h.elements.get('storage-note').textContent,/不可用/);h.click('start');h.key('ArrowRight');for(let i=0;i<12;i++)h.frame(20);assert.ok(h.game.player.x>1);h.click('retry');assert.equal(h.game.state,'ready');assert.match(h.elements.get('storage-note').textContent,/無法保存/);
});
