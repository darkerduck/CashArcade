import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../circuit/engine.mjs';
import {LEVELS} from '../circuit/levels.mjs';
import {Renderer,WIDTH,HEIGHT} from '../circuit/renderer.mjs';
function fixture(){let balance=0,calls=0;const ctx=new Proxy({}, {get(object,key){if(key in object)return object[key];return (...args)=>{calls++;for(const n of args)if(typeof n==='number')assert.ok(Number.isFinite(n),String(key));if(key==='save')balance++;if(key==='restore')balance--;if(String(key).startsWith('create'))return {addColorStop(){}};if(key==='measureText')return {width:20};};},set(o,k,v){o[k]=v;return true;}});return {canvas:{width:WIDTH,height:HEIGHT,getContext:()=>ctx},balance:()=>balance,calls:()=>calls};}
const serialize=game=>JSON.stringify({...game,nodes:[...game.nodes],shards:[...game.shards],cloaks:[...game.cloaks]});
test('all ten boards render every lifecycle, theme and motion choice without changing the game',()=>{
  const h=fixture(),renderer=new Renderer(h.canvas);
  for(const level of LEVELS){const game=new Game(level.id);game.start();game.turn('right');game.tick();for(const state of ['ready','running','paused','dead','won']){game.state=state;for(const theme of ['dark','light'])for(const reducedMotion of [false,true]){const before=serialize(game);renderer.render(game,{theme,reducedMotion});assert.equal(serialize(game),before);assert.equal(h.balance(),0);}}}
  assert.ok(h.calls()>1000);renderer.destroy();assert.equal(renderer.cache,null);
});
test('switches, open exits, cloak and every laser pulse state render with finite coordinates',()=>{const h=fixture(),renderer=new Renderer(h.canvas),game=new Game(9);game.start();game.cloak();game.nodes.clear();for(const phase of [0,1])for(const tick of [0,9,21,24]){game.phase=phase;game.tickCount=tick;game.accumulator=.074;renderer.render(game);assert.equal(h.balance(),0);}});
test('cached board uses the canvas owner document and refreshes for theme and level',()=>{
  const h=fixture();let created=0;h.canvas.ownerDocument={createElement(){created++;return fixture().canvas;}};const renderer=new Renderer(h.canvas);const game=new Game();renderer.render(game);renderer.render(game);assert.equal(created,1);renderer.render(game,{theme:'light'});assert.equal(created,2);renderer.render(new Game(1),{theme:'light'});assert.equal(created,3);
});
