import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8'),html=read('circuit/index.html'),controller=read('circuit/game.mjs'),css=read('circuit/style.css');
test('circuit has local module dependencies and no payment or external runtime',()=>{
  assert.match(html,/<html lang="zh-Hant">/);assert.doesNotMatch(html,/cashlink|linkincash|https?:\/\/[^" ]+\.js/i);
  const scripts=[...html.matchAll(/<script src="([^"?]+)/g)].map(m=>m[1]);assert.deepEqual(scripts,['../audio.js','../music.js','../expansion-scores.js','./game.mjs']);for(const src of scripts)assert.ok(existsSync(new URL('../circuit/'+src,import.meta.url)),src);
  assert.match(html,/game\.mjs\?v=1" type="module"/);for(const m of controller.matchAll(/from '([^']+)'/g))assert.ok(existsSync(new URL('../circuit/'+m[1],import.meta.url)));
});
test('every controller ID resolves uniquely and essential controls are accessible',()=>{
  const ids=[...html.matchAll(/id="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length);
  for(const m of controller.matchAll(/\$\('([^']+)'\)/g))assert.ok(ids.includes(m[1]),m[1]);
  assert.match(html,/for="music-volume"/);assert.match(html,/aria-live="polite"/);assert.match(html,/id="motion" type="checkbox"/);assert.match(html,/aria-label="方向控制"/);
});
test('keyboard, buffered swipe, native controls and interruption cleanup are explicitly handled',()=>{
  for(const pattern of [/pointercancel/,/lostpointercapture/,/visibilitychange/,/window.addEventListener\('blur'/,/event.target.matches\('input,select,textarea'\)/,/event.target.closest\('button,a'\)/,/Math.max\(Math.abs\(dx\),Math.abs\(dy\)\)<18/,/game.turn\(direction\)/,/game.brake\(\)/])assert.match(controller,pattern);
  assert.match(css,/@media\(max-width:520px\)/);assert.match(css,/touch-action:none/);assert.match(css,/:focus-visible/);assert.match(css,/prefers-reduced-motion/);
});
test('music uses circuit-specific score, shared audio mix and explicit lifecycle',()=>{
  for(const pattern of [/CashArcadeExpansionScores\.circuit/,/storagePrefix:'casharcade-circuit-music'/,/audioOutput:sound.musicOutput/,/music.start\(game.level.id\+1\)/,/music.pause\(\)/,/music.resume\(\)/,/music.wake\(\)/])assert.match(controller,pattern);
});
