import test from 'node:test';
import assert from 'node:assert/strict';
import '../drift/storage.js';
const {create,clean,fresh}=globalThis.NeonDriftStorage;
test('drift records and independent audio preferences survive reload',()=>{const map=new Map();const local={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)};const store=create(local),data=fresh();data.track=2;data.unlocked=2;data.records[2]={score:900,lap:12.4,combo:5};data.music=false;data.sound=true;data.volume=.25;assert.equal(store.save(data),true);assert.deepEqual(create(local).load(),data);});
test('corrupt and adversarial drift records are sanitized',()=>{assert.deepEqual(clean({version:3}),fresh());const r=clean({version:1,track:99,volume:Infinity,sound:'false',records:[{score:-1,lap:-4,combo:99}]});assert.deepEqual(r,fresh());const r2=clean({version:1,volume:4});assert.equal(r2.volume,1);});
test('unavailable storage never blocks play',()=>{const s=create({getItem(){throw Error('denied');},setItem(){throw Error('denied');}});assert.deepEqual(s.load(),fresh());assert.equal(s.available,false);assert.equal(s.save(fresh()),false);});
test('silently discarded writes are detected',()=>{const s=create({getItem(){return null;},setItem(){}});assert.equal(s.save(fresh()),false);});

test('legacy records survive migration but arbitrary old track selection does not unlock races',()=>{
 const data=clean({version:1,track:2,records:[{score:200,lap:12,combo:3}]});
 assert.equal(data.unlocked,0);assert.equal(data.track,0);assert.equal(data.records[0].score,200);
});
test('only a valid intact first-place finish unlocks the immediate next track',()=>{
 const data=fresh(), base={state:'finished',won:true,health:10,rank:1,laps:2,trackIndex:0};
 for(const change of [{state:'destroyed'},{won:false},{health:0},{rank:2},{laps:0},{trackIndex:2}]){
  assert.equal(globalThis.NeonDriftStorage.unlock(data,{...base,...change}),false);assert.equal(data.unlocked,0);
 }
 assert.equal(globalThis.NeonDriftStorage.unlock(data,base),true);assert.equal(data.unlocked,1);
 assert.equal(globalThis.NeonDriftStorage.unlock(data,{...base,trackIndex:1}),true);assert.equal(data.unlocked,2);
 assert.equal(clean({...data,track:2}).track,2);
});
