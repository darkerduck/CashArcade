import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const read=f=>readFileSync(new URL('../'+f,import.meta.url),'utf8');
const html=read('drift/index.html'),controller=read('drift/game.js');
test('drift page loads ordered modules with no payment or third-party script',()=>{const src=[...html.matchAll(/<script src="([^"?]+)/g)].map(m=>m[1]);assert.deepEqual(src,['./engine.js','./storage.js','./audio.js','./renderer.js','./game.js']);for(const s of src)assert.ok(existsSync(new URL('../drift/'+s,import.meta.url)));assert.doesNotMatch(html,/cashlink|https?:\/\/[^" ]+\.js/i);});
test('every controller id resolves once and settings are labeled',()=>{const ids=[...html.matchAll(/id="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length);for(const m of controller.matchAll(/\$\('([^']+)'\)/g))assert.ok(ids.includes(m[1]),m[1]);assert.match(html,/for="volume"/);assert.match(html,/id="motion" type="checkbox"/);assert.match(html,/aria-live="polite"/);});
test('input cancellation, native form keys and interrupted runs have handlers',()=>{for(const pattern of [/pointercancel/,/lostpointercapture/,/visibilitychange/,/window.addEventListener\('blur'/,/e.target.matches\('input,select,textarea'\)/,/e.target.closest\('button,a'\)/])assert.match(controller,pattern);});
