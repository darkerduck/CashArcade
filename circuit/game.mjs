import { Game, STEP_SECONDS } from './engine.mjs';
import { LEVELS } from './levels.mjs';
import { Renderer } from './renderer.mjs';
import { create as createStorage, recordWin } from './storage.mjs';

const $=id=>document.getElementById(id);
const storage=createStorage(),settings=storage.load(),canvas=$('game-canvas'),renderer=new Renderer(canvas);
const silent={play(){},resume(){},musicOutput(){return null;}},quiet={start(){},pause(){},resume(){},wake(){}};
let sound=silent,music=quiet;
try{sound=globalThis.CashArcadeAudio?.create({storageKey:'casharcade-circuit-sound-muted',toggleButton:$('sound-toggle'),outputLevel:.65,musicMix:true})||silent;}catch{}
try{if(globalThis.CashArcadeExpansionScores?.circuit)music=globalThis.CashArcadeMusic?.create({score:CashArcadeExpansionScores.circuit,storagePrefix:'casharcade-circuit-music',toggleButton:$('music-toggle'),volumeInput:$('music-volume'),volumeLabel:$('music-volume-value'),trackLabel:$('music-track'),audioOutput:sound.musicOutput,initialLevel:settings.selected+1})||quiet;}catch{}
if(sound===silent){$('sound-toggle').disabled=true;$('sound-toggle').textContent='音效暫不可用';}
if(music===quiet){$('music-toggle').disabled=true;$('music-volume').disabled=true;$('music-track').textContent='音樂暫不可用；可正常遊玩';}
let game=new Game(settings.selected),theme='dark',previous=0,lastRender=0,lastHud=0,dirty=true,swipe=null;
const directionNames={up:'↑ 上',down:'↓ 下',left:'← 左',right:'→ 右'};
const systemMotion=matchMedia('(prefers-reduced-motion: reduce)');
try{theme=localStorage.getItem('casharcade-theme')==='light'?'light':'dark';}catch{}
document.documentElement.dataset.theme=theme;
function save(){if(!storage.save(settings))$('storage-note').textContent='瀏覽器無法保存紀錄；仍可在本頁免費遊玩。';}
if(!storage.available)$('storage-note').textContent='瀏覽器儲存不可用；紀錄只保留在本頁。';
function awaken(){try{sound.resume();music.wake();}catch{}}
function clearInput(){swipe=null;document.querySelectorAll('.dpad .active').forEach(button=>button.classList.remove('active'));}
function announce(message){$('live').textContent=message;}
function clock(seconds){const s=Math.floor(seconds);return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0');}
function overlay(kicker,title,message,button,hint='免費重試 · 紀錄儲存在這個瀏覽器'){
  $('overlay').hidden=false;$('overlay-kicker').textContent=kicker;$('overlay-title').textContent=title;$('overlay-message').textContent=message;$('start').textContent=button;$('overlay-hint').textContent=hint;
  $('replay').hidden=game.state!=='won';dirty=true;
}
function hud(){
  $('level-number').replaceChildren(document.createTextNode(String(game.level.id+1).padStart(2,'0')+' '));const total=document.createElement('span');total.textContent='/ 10';$('level-number').append(total);
  $('energy').textContent=game.collected+' / '+game.level.nodes.length;$('score').textContent=String(game.score).padStart(6,'0');$('time').textContent=clock(game.elapsed);
  $('route-phase').innerHTML='<b>'+['A','B'][game.phase]+'</b> 相位通路';$('route-phase').style.color=game.phase?'#b68aff':'';
  $('queue-label').textContent=game.queued?'下一彎 '+directionNames[game.queued]:game.direction?'前進 '+directionNames[game.direction]:'等待方向';
  $('shards').textContent='◆ '+(game.level.shards.length-game.shards.size)+' / '+game.level.shards.length;
  $('cloak').disabled=game.state!=='running'||game.charges<1||game.cloaked;
  $('cloak-label').textContent=game.cloaked?'隱形 '+(game.cloakTicks*STEP_SECONDS).toFixed(1)+'s':'隱形 × '+game.charges;
  const percent=Math.round(game.collected/game.level.nodes.length*100);$('energy-fill').style.width=percent+'%';$('energy-meter').setAttribute('aria-valuenow',String(percent));
  $('pause').disabled=!['running','paused'].includes(game.state);$('pause').textContent=game.state==='paused'?'繼續':'暫停';
}
function levelMenu(){
  $('levels').replaceChildren();
  LEVELS.forEach((level,i)=>{const button=document.createElement('button'),stars=settings.records[i].stars;
    button.className='level';button.type='button';button.disabled=i>=settings.unlocked;button.setAttribute('aria-pressed',String(i===game.level.id));
    button.setAttribute('aria-label',`第 ${i+1} 關 ${level.name}，${button.disabled?'尚未解鎖':`${stars} 顆星`}`);
    button.textContent=String(i+1).padStart(2,'0');const rating=document.createElement('span');rating.textContent=button.disabled?'—':'★'.repeat(stars)+'☆'.repeat(3-stars);button.append(rating);
    button.addEventListener('click',()=>ready(i));$('levels').append(button);
  });
  const record=settings.records[game.level.id];$('mission-name').textContent=game.level.name;$('mission-zone').textContent=game.level.zone;$('mission-tip').textContent=game.level.tip;
  $('record-stars').textContent='★'.repeat(record.stars)+'☆'.repeat(3-record.stars);$('record-stars').setAttribute('aria-label',record.stars+' 顆星');
  $('best-time').textContent=record.time===null?'—':record.time.toFixed(1)+' 秒';$('par-time').textContent=game.level.par+' 秒';
}
function ready(index=game.level.id){
  if(index>=settings.unlocked||index<0)return;
  music.pause();clearInput();game=new Game(index);settings.selected=index;save();levelMenu();
  overlay('SECTOR '+String(index+1).padStart(2,'0')+' / '+game.level.zone,index===0?'讓每道電路，為你開路。':game.level.name,game.level.tip,'連入電路 →','方向鍵 / WASD / 滑動 · 收齊能量後前往出口');hud();
}
function start(){
  if(game.state==='running')return;
  awaken();clearInput();
  if(game.state==='paused'){game.resume();music.resume();}
  else {
    if(game.state==='won'&&game.level.id<LEVELS.length-1){game=new Game(game.level.id+1);settings.selected=game.level.id;save();levelMenu();}
    else if(game.state!=='ready')game.restart();
    game.start();music.start(game.level.id+1);
  }
  $('overlay').hidden=true;$('replay').hidden=true;canvas.focus({preventScroll:true});previous=0;dirty=true;hud();
}
function pause(){
  if(game.state==='paused'){start();return;}
  if(game.state!=='running')return;
  game.brake();game.pause();music.pause();clearInput();
  overlay('CONNECTION PAUSED','電路，等你回來。','時間與巡邏都已停止。繼續後，輸入方向就能重新出發。','繼續連線 →');hud();
}
function turn(direction){if(game.turn(direction)){awaken();dirty=true;hud();}}
function cloak(){awaken();if(game.cloak()){dirty=true;hud();}}
$('start').addEventListener('click',start);$('replay').addEventListener('click',()=>{ready();start();});$('pause').addEventListener('click',pause);$('retry').addEventListener('click',()=>ready());$('cloak').addEventListener('click',cloak);$('brake').addEventListener('click',()=>{game.brake();hud();});
$('theme-toggle').addEventListener('click',()=>{theme=theme==='dark'?'light':'dark';document.documentElement.dataset.theme=theme;try{localStorage.setItem('casharcade-theme',theme);}catch{}dirty=true;});
$('motion').checked=settings.reducedMotion;$('motion').addEventListener('change',()=>{settings.reducedMotion=$('motion').checked;save();dirty=true;});
systemMotion.addEventListener?.('change',()=>{dirty=true;});
for(const button of document.querySelectorAll('[data-direction]')){
  button.addEventListener('pointerdown',event=>{event.preventDefault();if(game.state!=='running')return;turn(button.dataset.direction);button.classList.add('active');button.setPointerCapture?.(event.pointerId);});
  const release=()=>button.classList.remove('active');button.addEventListener('pointerup',release);button.addEventListener('pointercancel',release);button.addEventListener('lostpointercapture',release);
  button.addEventListener('click',event=>{if(event.detail===0)turn(button.dataset.direction);});
  button.addEventListener('contextmenu',event=>event.preventDefault());
}
canvas.addEventListener('pointerdown',event=>{if(game.state!=='running'||swipe)return;event.preventDefault();swipe={id:event.pointerId,x:event.clientX,y:event.clientY};canvas.setPointerCapture?.(event.pointerId);awaken();});
canvas.addEventListener('pointermove',event=>{
  if(!swipe||swipe.id!==event.pointerId||game.state!=='running')return;
  event.preventDefault();const dx=event.clientX-swipe.x,dy=event.clientY-swipe.y;if(Math.max(Math.abs(dx),Math.abs(dy))<18)return;
  turn(Math.abs(dx)>Math.abs(dy)?dx>0?'right':'left':dy>0?'down':'up');swipe.x=event.clientX;swipe.y=event.clientY;
});
const endSwipe=event=>{if(swipe?.id===event.pointerId)swipe=null;};canvas.addEventListener('pointerup',endSwipe);canvas.addEventListener('pointercancel',endSwipe);canvas.addEventListener('lostpointercapture',endSwipe);canvas.addEventListener('contextmenu',event=>event.preventDefault());
const keys={ArrowUp:'up',KeyW:'up',ArrowRight:'right',KeyD:'right',ArrowDown:'down',KeyS:'down',ArrowLeft:'left',KeyA:'left'};
document.addEventListener('keydown',event=>{
  if(event.target.matches('input,select,textarea')||((event.code==='Space'||event.code==='Enter')&&event.target.closest('button,a')))return;
  if(keys[event.code]){event.preventDefault();turn(keys[event.code]);return;}
  if(event.repeat)return;
  if(['Space','KeyX'].includes(event.code)){event.preventDefault();cloak();}
  if(event.code==='KeyC'){event.preventDefault();game.brake();hud();}
  if(['KeyP','Escape'].includes(event.code)){event.preventDefault();pause();}
  if(event.code==='KeyR'){event.preventDefault();ready();}
  if(event.code==='Enter'&&game.state!=='running'){event.preventDefault();start();}
});
window.addEventListener('blur',()=>{if(game.state==='running')pause();clearInput();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&game.state==='running')pause();clearInput();});
window.addEventListener('pagehide',()=>{if(game.state==='running')pause();music.pause();save();});
$('fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.querySelector('.machine').requestFullscreen();}catch{announce('這個瀏覽器不支援全螢幕；可繼續在頁面遊玩。');}});
document.addEventListener('fullscreenchange',()=>{$('fullscreen').textContent=document.fullscreenElement?'離開全螢幕':'全螢幕';dirty=true;});
window.addEventListener('resize',()=>{dirty=true;});
const effects={start:'start',pause:'pause',resume:'resume',node:'pass',shard:'dessert',charge:'snakeShield',cloak:'snakePortal',switch:'breakoutSwitch',exitOpen:'level',death:'lose',win:'win'};
function frame(now){
  const dt=previous?Math.min((now-previous)/1000,.05):0;previous=now;game.update(dt);
  for(const event of game.drain()){
    if(!document.hidden)try{sound.play(effects[event.type]);}catch{}
    if(event.type==='exitOpen')announce('能量已收齊，綠色出口已開啟。');
    if(event.type==='death'){
      music.pause();clearInput();const reason=event.reason==='laser'?'雷射實線亮起時有傷害，隱形也無法穿越。觀察脈衝，熄滅後再走。':'撞上巡邏機了。看清往返節奏，或使用隱形安全穿過。';
      overlay('SIGNAL LOST','連線中斷。再試一次。',reason,'免費重試 →');announce('本關失敗。'+reason);hud();
    }
    if(event.type==='win'){
      music.pause();clearInput();recordWin(settings,game);save();levelMenu();
      const last=game.level.id===LEVELS.length-1;
      overlay(last?'ALL CIRCUITS COMPLETE':'CIRCUIT CLEARED',last?'十道防線，全部點亮。':'出口已開。漂亮的逃脫。',`${'★'.repeat(game.stars)}${'☆'.repeat(3-game.stars)} · ${game.score} 分 · ${game.elapsed.toFixed(1)} 秒。${last?'每一道電路都記得你的光。回頭挑戰三星，讓紀錄更漂亮。':'下一道防線已解鎖。'}`,last?'再闖最終關 →':'前往下一關 →');announce(`第 ${game.level.id+1} 關完成，${game.stars} 顆星。`);hud();
    }
  }
  if(dirty||(game.state==='running'&&now-lastRender>=1000/30)){renderer.render(game,{theme,reducedMotion:settings.reducedMotion||systemMotion.matches});lastRender=now;dirty=false;}
  if(game.state==='running'&&now-lastHud>100){hud();lastHud=now;}requestAnimationFrame(frame);
}
levelMenu();hud();requestAnimationFrame(frame);
