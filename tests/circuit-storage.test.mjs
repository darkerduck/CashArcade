import test from 'node:test';
import assert from 'node:assert/strict';
import {KEY,fresh,clean,create,recordWin} from '../circuit/storage.mjs';
import {Game} from '../circuit/engine.mjs';
const mock=()=>{const values=new Map();return {values,getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};};
test('new saves use versioned independent keys and ten clean records',()=>{const a=fresh(),b=fresh();assert.equal(a.version,1);assert.equal(a.unlocked,1);assert.equal(a.records.length,10);a.records[0].stars=3;assert.equal(b.records[0].stars,0);assert.equal(KEY,'casharcade-circuit-v1');});
test('invalid or unsupported saves are safely reset',()=>{for(const raw of [null,undefined,1,'oops',{version:99},{version:0}])assert.deepEqual(clean(raw),fresh());});
test('untrusted preferences and records are independently range checked',()=>{
  const value=clean({version:1,unlocked:500,selected:100,reducedMotion:true,records:[{stars:9,score:Infinity,time:-5,clears:-1},{stars:2,score:890,time:15.2,clears:2},{stars:'2',score:1.5,time:1e20,clears:1e10}]});
  assert.equal(value.unlocked,10);assert.equal(value.selected,9);assert.equal(value.reducedMotion,true);assert.deepEqual(value.records[0],fresh().records[0]);assert.deepEqual(value.records[1],{stars:2,score:890,time:15.2,clears:2});assert.deepEqual(value.records[2],fresh().records[2]);
  assert.equal(clean({version:1,unlocked:2,selected:5}).selected,1);assert.equal(clean({version:1,unlocked:-3,selected:-1}).unlocked,1);
});
test('round-trip save verifies persistence and preserves every record',()=>{const store=mock(),api=create(store),value=fresh();value.unlocked=4;value.selected=3;value.records[1]={stars:3,score:1900,time:16.5,clears:2};assert.equal(api.save(value),true);assert.equal(api.available,true);assert.deepEqual(api.load(),value);});
test('corrupt JSON, denied reads, quota errors and silent drops remain playable',()=>{
  const store=mock();store.values.set(KEY,'not JSON');const corrupted=create(store);assert.deepEqual(corrupted.load(),fresh());assert.equal(corrupted.available,false);
  const denied=create({getItem(){throw new Error('denied');},setItem(){throw new Error('quota');}});assert.deepEqual(denied.load(),fresh());assert.equal(denied.save(fresh()),false);assert.equal(denied.available,false);
  const dropped=create({getItem(){return null;},setItem(){}});assert.equal(dropped.save(fresh()),false);assert.equal(dropped.available,false);
});
test('winning unlocks the next circuit and retains best independent records',()=>{
  const value=fresh(),game=new Game(0);game.start();game.elapsed=20;game.score=2500;game.stars=3;game.state='won';assert.equal(recordWin(value,game),true);assert.equal(value.unlocked,2);assert.deepEqual(value.records[0],{stars:3,score:2500,time:20,clears:1});
  game.elapsed=30;game.score=1900;game.stars=1;recordWin(value,game);assert.deepEqual(value.records[0],{stars:3,score:2500,time:20,clears:2});game.elapsed=15;game.score=2700;recordWin(value,game);assert.equal(value.records[0].score,2700);assert.equal(value.records[0].time,15);
});
test('failed runs do not unlock; final victory caps at the final circuit',()=>{const value=fresh(),game=new Game();game.start();game.die('patrol');assert.equal(recordWin(value,game),false);assert.equal(value.unlocked,1);const final=new Game(9);final.state='won';final.stars=2;final.score=2400;final.elapsed=50;recordWin(value,final);assert.equal(value.unlocked,10);assert.equal(value.records[9].clears,1);});
