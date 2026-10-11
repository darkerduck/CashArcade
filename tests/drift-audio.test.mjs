import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync}from'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
function setup(){const notes=[],music=[],intervals=new Set();let contexts=0,silences=0;const param={setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}};class Context{constructor(){contexts++;this.state='suspended';this.currentTime=1;this.destination={};}resume(){this.state='running';return Promise.resolve();}createOscillator(){const node={frequency:param,connect(){},disconnect(){},stops:[],start(){notes.push(node);},stop(at){node.stops.push(at??null);}};return node;}createGain(){return {gain:param,connect(){},disconnect(){}};}}const scope=vm.createContext({AudioContext:Context,setInterval(fn){intervals.add(fn);return fn;},clearInterval(fn){intervals.delete(fn);},CashArcadeMusic:{synth(){return {step(...args){music.push(args);},silence(){silences++;},volume(){}};}}});vm.runInContext(read('expansion-scores.js'),scope);vm.runInContext(read('drift/audio.js'),scope);return {audio:new scope.NeonDriftAudio.Audio(),notes,music,intervals,contexts:()=>contexts,silences:()=>silences};}
const game={state:'running',trackIndex:0,time:1,car:{speed:200}};
test('audio is gesture initialized and music and SFX mute independently',()=>{const h=setup(),a=h.audio;a.event('boost');assert.equal(h.contexts(),0);a.unlock();assert.equal(h.contexts(),1);a.configure({sound:false,music:false,volume:.5});a.event('boost');a.update(game);assert.equal(h.notes.length,0);assert.equal(h.music.length,0);a.configure({sound:false,music:true,volume:.5});a.update(game);assert.ok(h.music.length>0);assert.equal(h.notes.length,0);a.configure({sound:true,music:false,volume:.5});for(let i=0;i<100;i++)a.event('boost');assert.equal(h.notes.length,16);for(const n of h.notes)n.onended();assert.equal(a.voices.size,0);a.pause();assert.equal(h.intervals.size,0);});
test('lookahead progresses from audio clock; pause cancels timer; resume and track changes work',()=>{const h=setup(),a=h.audio;a.unlock();a.update(game);assert.equal(h.intervals.size,1);const first=a.beat;a.context.currentTime+=1;[...h.intervals][0]();assert.ok(a.beat>first);a.update({...game,state:'paused'});assert.equal(h.intervals.size,0);assert.ok(h.silences()>0);a.context.currentTime+=10;a.update({...game,trackIndex:2});assert.equal(h.intervals.size,1);assert.equal(a.profile.tonic,49);assert.ok(h.music.at(-1)[2]>=a.context.currentTime);a.pause();});
test('stale sound voices expire even if onended is delayed',()=>{const h=setup(),a=h.audio;a.unlock();for(let i=0;i<20;i++)a.event('boost');assert.equal(a.voices.size,16);a.context.currentTime+=1;a.event('boost');assert.equal(a.voices.size,1);});
test('unsupported Web Audio stays playable and idle creates no context or timer',()=>{const scope=vm.createContext({setInterval(){return 1;},clearInterval(){}});vm.runInContext(read('expansion-scores.js'),scope);vm.runInContext(read('drift/audio.js'),scope);const a=new scope.NeonDriftAudio.Audio();assert.doesNotThrow(()=>{a.unlock();a.update({...game,state:'ready'});a.event('start');a.pause();});assert.equal(a.context,null);});
test('each expansion score has valid, distinct original phrases and pitched leads',()=>{const scope=vm.createContext({});vm.runInContext(read('expansion-scores.js'),scope);const phrases=[];for(const [id,score]of Object.entries(scope.CashArcadeExpansionScores)){const p=score.profile(1),events=Array.from({length:128},(_,i)=>score.notesForStep(p,i));assert.ok(p.bpm>=100&&p.bpm<=150,id);assert.ok(events.flat().filter(e=>e.voice==='lead').length>=40,id);for(const e of events.flat()){assert.ok(Number.isFinite(e.note));assert.ok(e.length>0&&e.level>0&&e.level<=1);}phrases.push(JSON.stringify(events));}assert.equal(new Set(phrases).size,5);});

for(const [type,state] of [['explosion','destroyed'],['finish','finished']]){
 test(`${type} SFX keeps its scheduled tail when same-frame terminal update stops music`,()=>{
  const h=setup(),a=h.audio;a.unlock();a.update(game);
  a.event(type);const voice=h.notes.at(-1);assert.ok(voice);
  const scheduled=voice.stops[0];assert.ok(scheduled>a.context.currentTime);
  a.update({...game,state});
  assert.equal(h.intervals.size,0);assert.ok(h.silences()>0);
  assert.deepEqual(voice.stops,[scheduled],'terminal update must not stop SFX immediately');
  assert.equal(a.voices.size,1);voice.onended();assert.equal(a.voices.size,0);
 });
}
test('explicit pause and page exit still cut sound tails while stopping music',()=>{
 const h=setup(),a=h.audio;a.unlock();a.update(game);a.event('explosion');const voice=h.notes.at(-1);
 a.update({...game,state:'destroyed'});a.pause();assert.equal(voice.stops.at(-1),null);assert.equal(a.voices.size,0);
});
