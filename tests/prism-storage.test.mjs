import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {read} from './prism-test-helper.mjs';
const scope=vm.createContext({});vm.runInContext(read('prism/storage.js'),scope);const {KEY,clean,create}=scope.PrismStackStorage;
const json=value=>JSON.parse(JSON.stringify(value));
test('valid Prism records and reduced-motion preference round-trip independently',()=>{const values=new Map(),storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)},store=create(storage);assert.equal(store.save({best:1234,chain:3,motion:true}),true);assert.deepEqual(json(create(storage).load()),{best:1234,chain:3,motion:true});assert.equal(KEY,'casharcade-prism-v1');});
test('adversarial data cannot produce negative, nonfinite or fabricated string records',()=>{for(const value of[null,[],true,'bad',{best:NaN,chain:Infinity},{best:1e13,chain:-1},{best:'999',chain:1.5}])assert.deepEqual(json(clean(value)),{best:0,chain:0,motion:false});assert.deepEqual(json(clean({best:42,motion:false,evil:true},true)),{best:42,chain:0,motion:false});});
test('corrupt JSON and blocked storage fall back safely; silent write loss is detected',()=>{const corrupt=create({getItem:()=>'{bad'});assert.equal(corrupt.load().best,0);assert.equal(corrupt.available,false);const blocked=create(null,true);assert.equal(blocked.load().motion,true);assert.equal(blocked.save({best:42}),false);const silent=create({getItem:()=>null,setItem(){}});assert.equal(silent.save({best:42}),false);});
