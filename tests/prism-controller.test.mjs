import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './prism-test-helper.mjs';
test('initial state is silent; double Start cannot replace a live round; pause/resume preserves it',()=>{
    const h=fixture();assert.equal(h.game.state,'ready');assert.equal(h.musicCalls.length,0);assert.equal(h.elements.get('drop').disabled,true);
    h.click('start');const game=h.game;h.key('ArrowLeft');const x=h.game.piece.x;h.click('start');assert.equal(h.game,game);assert.equal(h.game.piece.x,x);assert.equal(h.musicCalls.filter(e=>e[0]==='start').length,1);
    h.click('pause');assert.equal(h.game.state,'paused');const time=h.game.time;for(let i=0;i<20;i++)h.frame(50);assert.equal(h.game.time,time);h.click('start');assert.equal(h.game,game);assert.equal(h.game.state,'running');assert.ok(h.musicCalls.some(e=>e[0]==='resume'));
});
test('keyboard controls wake audio, ignore native forms and do not repeat drop/hold/rotate',()=>{
    const h=fixture();h.click('start');const wake=h.audioCalls.length;h.key('KeyZ');h.key('ArrowDown');assert.ok(h.audioCalls.length>=wake+2);h.document.fire('keyup',{code:'ArrowDown'});
    const piece=JSON.stringify(h.game.piece);h.key('KeyZ',{repeat:true});h.key('Space',{repeat:true});h.key('KeyC',{repeat:true});assert.equal(JSON.stringify(h.game.piece),piece);
    const e=h.key('ArrowRight',{target:h.elements.get('music-volume')});assert.equal(e.prevented,undefined);assert.equal(JSON.stringify(h.game.piece),piece);
    h.key('Space',{target:h.elements.get('start')});assert.equal(JSON.stringify(h.game.piece),piece);
    const editable={matches:()=>false,isContentEditable:true};h.key('KeyR',{target:editable});assert.equal(h.game.state,'running');
});
test('hidden, blur and pagehide clear held input, pause music and require explicit resume',()=>{
    const h=fixture();h.click('start');h.key('ArrowDown');h.document.hidden=true;h.document.fire('visibilitychange');assert.equal(h.game.state,'paused');h.document.hidden=false;h.document.fire('visibilitychange');assert.equal(h.game.state,'paused');
    h.click('start');for(let i=0;i<10;i++)h.frame(17);assert.equal(h.game.piece.y,0);h.window.fire('blur');assert.equal(h.game.state,'paused');h.click('start');h.window.fire('pagehide');assert.equal(h.game.state,'paused');assert.equal(h.musicCalls.at(-1)[0],'pause');
});
test('single-pointer swipe and tap are bounded; cancellation and foreign touches are harmless',()=>{
    const h=fixture();h.click('start');const canvas=h.elements.get('canvas');const before=JSON.stringify(h.game.piece);
    canvas.fire('pointerdown',{pointerId:1});canvas.fire('pointerdown',{pointerId:2,clientX:200});canvas.fire('pointercancel',{pointerId:2});canvas.fire('pointerup',{pointerId:2,clientX:250});assert.equal(JSON.stringify(h.game.piece),before);
    canvas.fire('pointerup',{pointerId:1,clientX:70});assert.equal(h.game.piece.x,5);
    canvas.fire('pointerdown',{pointerId:3});canvas.fire('lostpointercapture',{pointerId:3});canvas.fire('pointerup',{pointerId:3,clientY:100});assert.equal(h.game.loops,0);
    canvas.fire('pointerdown',{pointerId:4,button:2});canvas.fire('pointerup',{pointerId:4});assert.equal(h.game.piece.cells[1].y,0);
    canvas.fire('pointerdown',{pointerId:5});canvas.fire('pointerup',{pointerId:5});assert.equal(h.game.piece.cells[1].y,1);
});
test('real first drop clears, announces and records once, then continues; retry resets safely',()=>{
    const h=fixture();h.click('start');h.key('Space');h.frame();assert.equal(h.game.loops,1);assert.match(h.elements.get('live').textContent,/4 格，1 連鎖/);assert.equal(h.audioCalls.filter(e=>e==='win').length,1);
    const writes=h.writes;for(let i=0;i<12;i++)h.frame(50);assert.equal(h.game.state,'running');assert.ok(h.game.piece);assert.equal(h.writes,writes);assert.equal(h.elements.get('drop').disabled,false);
    h.key('ArrowDown');h.click('retry');assert.equal(h.game.state,'ready');assert.equal(h.game.score,0);assert.equal(h.elements.get('pause').disabled,true);assert.ok(JSON.parse(h.values.get('casharcade-prism-v1')).best>=400);
    h.click('start');h.frame(50);assert.equal(h.game.piece.y,0);
});
test('game over is announced and a fresh free round is available without duplicate loss effects',()=>{
    const h=fixture();h.click('start');h.game.board[0][3]=5;h.game.spawn();h.frame();assert.equal(h.game.state,'finished');assert.equal(h.elements.get('overlay').hidden,false);assert.match(h.elements.get('live').textContent,/遊戲結束/);h.frame();assert.equal(h.audioCalls.filter(e=>e==='lose').length,1);h.click('start');assert.equal(h.game.state,'running');assert.equal(h.game.score,0);
});
test('progress guard only warns while a live round would be lost',()=>{
    const h=fixture();assert.equal(h.window.fire('beforeunload').prevented,undefined);h.click('start');assert.equal(h.window.fire('beforeunload').prevented,true);h.click('pause');assert.equal(h.window.fire('beforeunload').prevented,true);h.click('retry');assert.equal(h.window.fire('beforeunload').prevented,undefined);
});
test('missing audio and denied storage still allow a complete first loop',()=>{
    const h=fixture({audio:false,denied:true});assert.equal(h.elements.get('sound-toggle').disabled,true);assert.equal(h.elements.get('music-toggle').disabled,true);assert.match(h.elements.get('notice').textContent,/無法儲存/);h.click('start');h.key('Space');h.frame();assert.equal(h.game.loops,1);
});
test('preferences honor system reduced motion unless explicitly chosen, and theme toggles',()=>{
    const a=fixture({reduced:true,theme:'light'});assert.equal(a.elements.get('motion').checked,true);assert.equal(a.renders.at(-1).light,true);a.click('theme');assert.equal(a.renders.at(-1).light,false);
    const b=fixture({reduced:true,saved:{best:90,chain:2,motion:false}});assert.equal(b.elements.get('motion').checked,false);assert.equal(b.elements.get('best').textContent,90);b.elements.get('motion').checked=true;b.elements.get('motion').fire('change');b.frame();assert.equal(b.renders.at(-1).motion,true);assert.equal(JSON.parse(b.values.get('casharcade-prism-v1')).motion,true);
});
test('a pending level-up clear cannot restart music after a background pause',()=>{const h=fixture();h.click('start');h.game.loops=3;h.key('Space');assert.equal(h.game.level,2);h.window.fire('blur');const starts=h.musicCalls.filter(e=>e[0]==='start').length;h.frame();assert.equal(h.game.state,'paused');assert.equal(h.musicCalls.filter(e=>e[0]==='start').length,starts);assert.equal(h.audioCalls.includes('win'),false);h.click('start');assert.equal(h.musicCalls.at(-1)[0],'start');assert.equal(h.musicCalls.at(-1)[1],2);});
