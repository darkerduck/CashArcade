(() => {
'use strict';
const $ = id => document.getElementById(id);
let local = null, systemMotion = false;
try { local = localStorage; } catch {}
try { systemMotion = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch {}
const store = PrismStackStorage.create(local,systemMotion), saved = store.load();
function storageNotice() { $('notice').textContent = '瀏覽器無法儲存紀錄；仍可免費遊玩。'; }
if (!store.available) storageNotice();
function persist() { if (!store.save(saved)) storageNotice(); }
const silent = {resume(){},play(){},musicOutput(){return null;}};
let sound = silent, music = {start(){},pause(){},resume(){},wake(){}};
try { sound = CashArcadeAudio.create({storageKey:'casharcade-prism-sound-muted',toggleButton:$('sound-toggle'),musicMix:true}); }
catch { $('sound-toggle').disabled = true; $('sound-toggle').textContent = '音效暫時無法使用'; }
try { music = CashArcadeMusic.create({score:CashArcadeExpansionScores.prism,storagePrefix:'casharcade-prism-music',toggleButton:$('music-toggle'),volumeInput:$('music-volume'),volumeLabel:$('music-volume-value'),trackLabel:$('music-track'),audioOutput:sound.musicOutput}); }
catch { $('music-toggle').disabled = true; $('music-volume').disabled = true; $('music-toggle').textContent = '音樂暫時無法使用'; }
let game = new PrismStack.Game(), render = new PrismRenderer.Renderer($('canvas'));
let prev = 0, lastDraw = 0, soft = false, dirty = true, musicLevel = 1, swipe = null;
function wake() { sound.resume(); music.wake(); }
function play(name) { if (!document.hidden && game.state !== 'paused') sound.play(name); }
function record() { saved.best = Math.max(saved.best,game.score); saved.chain = Math.max(saved.chain,game.bestChain); persist(); }
function overlay(title,message,button) {
    $('title').textContent = title; $('message').textContent = message; $('start').textContent = button; $('overlay').hidden = false;
}
function start() {
    if (!['ready','paused','finished'].includes(game.state)) return;
    wake(); soft = false; swipe = null; prev = 0;
    if (game.state === 'paused') { game.resume(); if (game.level !== musicLevel) { music.start(game.level); musicLevel = game.level; } else music.resume(); }
    else { game = new PrismStack.Game(Date.now()); game.start(); music.start(1); musicLevel = 1; }
    $('overlay').hidden = true; $('pause').disabled = false; $('pause').textContent = '暫停';
    $('live').textContent = '接線開始。'; $('canvas').focus({preventScroll:true}); dirty = true;
}
function pause() {
    if (game.state === 'running') {
        game.pause(); music.pause(); soft = false; swipe = null; record();
        overlay('讓光，停留片刻。','棋盤已暫停。準備好再繼續接線。','繼續 →'); $('pause').textContent = '繼續';
    } else if (game.state === 'paused') start();
    dirty = true;
}
function retry() {
    music.pause(); record(); soft = false; swipe = null; prev = 0;
    game = new PrismStack.Game(Date.now()); $('pause').disabled = true; $('pause').textContent = '暫停';
    overlay('再接一條漂亮的迴路。','首組向下放，就能點亮第一個迴路。試試把下一條光路留給連鎖。','開始接線 →'); dirty = true;
}
function act(name) {
    wake();
    if (name === 'left') game.move(-1);
    else if (name === 'right') game.move(1);
    else if (name === 'rotate') game.rotate();
    else if (name === 'counter') game.rotate(-1);
    else if (name === 'drop') game.drop();
    else if (name === 'hold') game.swap();
    dirty = true;
}
for (const id of ['left','right','rotate','drop','hold']) $(id).addEventListener('click',() => act(id));
$('start').addEventListener('click',start); $('pause').addEventListener('click',pause); $('retry').addEventListener('click',retry);
document.addEventListener('keydown',event => {
    if (event.target.matches('input,select,textarea,[contenteditable="true"]') || event.target.isContentEditable || (['Space','Enter'].includes(event.code) && event.target.closest('button,a'))) return;
    const map = {ArrowLeft:'left',ArrowRight:'right',ArrowUp:'rotate',KeyX:'rotate',KeyZ:'counter',Space:'drop',KeyC:'hold'};
    if (map[event.code]) {
        event.preventDefault();
        if (!event.repeat || ['ArrowLeft','ArrowRight'].includes(event.code)) act(map[event.code]);
    }
    if (event.code === 'ArrowDown') { event.preventDefault(); wake(); soft = game.state === 'running'; }
    if (!event.repeat && ['KeyP','Escape'].includes(event.code)) { event.preventDefault(); wake(); pause(); }
    if (!event.repeat && event.code === 'KeyR') { event.preventDefault(); wake(); retry(); }
});
document.addEventListener('keyup',event => { if (event.code === 'ArrowDown') soft = false; });
$('canvas').addEventListener('pointerdown',event => {
    if (game.state !== 'running' || swipe || event.isPrimary === false || (event.button !== undefined && event.button !== 0)) return;
    event.preventDefault(); wake(); swipe = {id:event.pointerId,x:event.clientX,y:event.clientY};
    try { $('canvas').setPointerCapture(event.pointerId); } catch {}
});
$('canvas').addEventListener('pointerup',event => {
    if (!swipe || swipe.id !== event.pointerId) return;
    const dx = event.clientX - swipe.x, dy = event.clientY - swipe.y; swipe = null;
    if (dy > 36 && Math.abs(dy) > Math.abs(dx)) act('drop');
    else if (Math.abs(dx) > 20) for (let i = 0; i < Math.min(7,Math.max(1,Math.round(Math.abs(dx) / 35))); i++) act(dx > 0 ? 'right' : 'left');
    else if (Math.abs(dy) <= 36) act('rotate');
});
for (const event of ['pointercancel','lostpointercapture']) $('canvas').addEventListener(event,e => { if (swipe?.id === e.pointerId) swipe = null; });
function hide() { swipe = null; soft = false; prev = 0; if (game.state === 'running') pause(); }
window.addEventListener('blur',hide);
document.addEventListener('visibilitychange',() => { if (document.hidden) hide(); });
window.addEventListener('pagehide',() => { hide(); music.pause(); record(); });
window.addEventListener('beforeunload',event => {
    if (['running','paused'].includes(game.state)) { event.preventDefault(); event.returnValue = ''; }
});
$('motion').checked = saved.motion;
$('motion').addEventListener('change',() => { saved.motion = $('motion').checked; persist(); dirty = true; });
try { document.documentElement.dataset.theme = local?.getItem('casharcade-theme') === 'light' ? 'light' : 'dark'; } catch {}
$('theme').addEventListener('click',() => {
    const theme = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light'; document.documentElement.dataset.theme = theme;
    try { local?.setItem('casharcade-theme',theme); } catch {}
    dirty = true;
});
function hud() {
    $('score').textContent = String(game.score).padStart(6,'0'); $('level').textContent = String(game.level).padStart(2,'0'); $('loops').textContent = String(game.loops).padStart(2,'0');
    $('best').textContent = saved.best; $('chain').textContent = '×' + Math.max(saved.chain,game.bestChain);
    for (const id of ['left','right','rotate','drop','hold']) $(id).disabled = game.state !== 'running' || game.clearTime > 0 || (id === 'hold' && game.usedHold);
    [...$('queue').children].forEach((canvas,i) => render.preview(canvas,game.next[i])); render.preview($('held'),game.hold);
}
function frame(now) {
    const dt = prev ? Math.max(0,Math.min(.05,(now - prev) / 1000)) : 0; prev = now;
    game.update(dt,soft);
    for (const event of game.drain()) {
        dirty = true;
        if (event.type === 'clear') {
            play('win'); if (game.state === 'running' && game.level !== musicLevel) { music.start(game.level); musicLevel = game.level; }
            record(); $('live').textContent = '接通迴路！' + event.count + ' 格，' + event.chain + ' 連鎖。';
        } else if (event.type === 'lose') {
            play('lose'); music.pause(); soft = false; swipe = null; record(); $('pause').disabled = true;
            overlay('每次接線，都是新的想法。',game.score + ' 分 · ' + game.loops + ' 個迴路 · 最長 ' + game.bestChain + ' 連鎖','再試一次 →');
            $('live').textContent = '遊戲結束。' + game.score + ' 分。';
        } else if (event.type === 'lock') play('brick');
        else if (event.type === 'rotate') play('flap');
    }
    if (dirty || (game.state === 'running' && now - lastDraw > (saved.motion ? 100 : 50))) {
        render.render(game,saved.motion,document.documentElement.dataset.theme === 'light'); hud(); lastDraw = now; dirty = false;
    }
    requestAnimationFrame(frame);
}
hud(); requestAnimationFrame(frame);
})();
