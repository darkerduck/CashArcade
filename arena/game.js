(() => {
    'use strict';
    const $=id=>document.getElementById(id), {fresh}=NeonArenaStorage;
    const storage=NeonArenaStorage.create({getItem:k=>localStorage.getItem(k),setItem:(k,v)=>localStorage.setItem(k,v),removeItem:k=>localStorage.removeItem(k)},()=>{
        $('storage-note').textContent='瀏覽器儲存無法使用，進度及偏好可能無法保存；本頁仍可免費遊玩。';
    });
    function applyTheme() {
        let stored = null;
        try { stored = localStorage.getItem('casharcade-theme'); } catch { /* Dark default. */ }
        document.documentElement.dataset.theme = stored === 'light' ? 'light' : 'dark';
    }
    applyTheme();
    const restored=storage.load();let game=new NeonArena.Game(restored||fresh()),best=storage.best(),mode='ready',previous=0,accumulator=0,transition=0,pausedMode='running',hudTime=0,renderDirty=true;
    const renderer=new NeonArenaRenderer($('game-canvas'));
    const sound=CashArcadeAudio.create({storageKey:'casharcade-arena-sound-muted',toggleButton:$('sound-toggle'),outputLevel:.6,musicMix:true});
    const music=CashArcadeMusic.create({score:NeonArenaScore,storagePrefix:'casharcade-arena-music',toggleButton:$('music-toggle'),volumeInput:$('music-volume'),volumeLabel:$('music-volume-value'),trackLabel:$('music-track'),audioOutput:sound.musicOutput,initialLevel:game.wave});
    const input=NeonArenaInput.create({canvas:$('game-canvas'),joystick:$('joystick'),knob:$('stick-knob'),dash:$('dash'),onDash:dash,onPause:togglePause,onRetry:retry,active:()=>mode==='running'});
    function clear(){input.clear();accumulator=0;previous=performance.now();renderDirty=true;}
    function persist(){best=Math.max(best,game.score);storage.saveBest(best);if(game.state==='won')storage.clear();else storage.save(game.checkpoint());}
    function overlay(title,message,button){$('overlay').hidden=false;$('overlay-title').textContent=title;$('overlay-message').textContent=message;$('start').textContent=button;$('start').hidden=false;$('upgrades').hidden=true;$('overlay').classList.remove('choosing');$('live').textContent=title;}
    function hud(){
        $('score').textContent=String(game.score).padStart(6,'0');$('best').textContent=String(Math.max(best,game.score)).padStart(6,'0');
        $('health').textContent=`${Math.max(0,game.hp)} / ${game.stats.maxHp}`;$('health').style.color=game.hp<=2?'var(--danger)':'var(--cyan)';
        $('wave').textContent=`${String(game.wave).padStart(2,'0')} / 12`;$('sector').textContent=NeonArenaData.sectors[game.config.sector];
        $('weapon').textContent=`電弧 ${game.stats.damage} · ${game.stats.jumps+1} 目標`;$('shield').textContent=game.player.shield?'護盾已就緒':game.upgrades.shield?'護盾已消耗':'護盾未裝備';
        $('dash-status').textContent=`衝刺 ${game.player.charges} / ${game.stats.charges}${game.player.recharge>0?` · ${game.player.recharge.toFixed(1)}s`:''}`;
        $('dash').disabled=mode!=='running'||game.player.charges<1;
        $('pause').disabled=!['running','paused','transition'].includes(mode);$('pause').textContent=mode==='paused'?'繼續':'暫停';
        $('retry').disabled=!['running','paused','lost'].includes(mode)||game.saved.kind!=='wave';
        const progress=game.boss?100*(1-Math.max(0,game.boss.hp)/game.boss.maxHp):100*game.spawned/game.config.count;
        $('progress-fill').style.width=`${progress}%`;$('progress').setAttribute('aria-valuenow',String(Math.round(progress)));$('progress').setAttribute('aria-label',game.boss?'頭目擊破進度':'本波生成進度');
        if(mode==='running')$('status').textContent=game.boss?`${game.config.boss}${game.boss.overload?' · 過載！留意暖色預警':''}`:`入口 ${game.spawned} / ${game.config.count} · 場上 ${game.enemies.length} · ${Math.floor(game.time)}s`;
        const build=NeonArenaData.upgrades.filter(u=>game.upgrades[u.id]).map(u=>`${u.name} ${game.upgrades[u.id]}`);$('build').textContent=build.length?build.join(' · '):'本戰役尚未取得升級';
    }
    function consume(){const events=game.drain();renderer.consume(events);const effects={arc:'arenaArc',chain:'arenaChain',dash:'arenaDash',explode:'arenaExplosion',hurt:'arenaHurt',shield:'arenaShield',upgrade:'arenaUpgrade',boss:'arenaBoss',bossAttack:'arenaBoss',bossDown:'arenaBossDown',overload:'arenaBoss',lost:'lose',won:'win',waveClear:'level'};
        for(const e of events){if(effects[e.type])sound.play(effects[e.type]);if(e.type==='overload')music.phase('overload');if(['hurt','explode','bossDown'].includes(e.type))music.duck();}
    }
    function upgrades(){mode='upgrade';clear();music.pause();persist();overlay(`第 ${game.wave} 波突破`,`裝甲已修復一格。選擇一項能力，進入第 ${game.wave+1} 波。`,'');
        $('overlay-kicker').textContent='UPGRADE / CHOOSE ONE';$('start').hidden=true;$('upgrades').hidden=false;$('overlay').classList.add('choosing');$('upgrades').replaceChildren();
        for(const u of game.getUpgrades()){
            const b=document.createElement('button');b.className='upgrade';b.dataset.upgrade=u.id;
            const rank=document.createElement('span'),name=document.createElement('strong'),effect=document.createElement('span');
            rank.className='rank';rank.textContent=`${u.route} / Lv.${u.level} → ${u.level+1} · 上限 ${u.max}`;name.textContent=u.name;effect.className='effect';effect.textContent=u.effect;
            b.append(rank,name,effect);b.addEventListener('click',()=>{if(mode!=='upgrade'||!game.chooseUpgrade(u.id))return;storage.save(game.checkpoint());activate();});$('upgrades').append(b);
        }
        $('status').textContent='波次完成 · 選擇升級';hud();$('upgrades').firstElementChild?.focus({preventScroll:true});
    }
    function activate(){mode='running';clear();renderer.reset();$('overlay').hidden=true;sound.resume();music.start(game.wave,0);consume();hud();$('game-canvas').focus({preventScroll:true});}
    function begin(cp){if(cp)game=new NeonArena.Game(cp);storage.save(game.checkpoint());if(game.state==='upgrade')upgrades();else activate();}
    function retry(){if(['running','lost','paused'].includes(mode)&&game.saved.kind==='wave'){game.retry();begin();}}
    function pause(){if(!['running','transition'].includes(mode))return;pausedMode=mode;mode='paused';clear();music.pause();persist();overlay('機甲連線暫停','戰場與冷卻已凍結。準備好後，繼續突破。','繼續戰役');$('status').textContent='已暫停';hud();}
    function resume(){if(mode!=='paused')return;mode=pausedMode;clear();sound.resume();if(mode==='running')music.resume();$('overlay').hidden=true;hud();$('game-canvas').focus({preventScroll:true});}
    function togglePause(){if(mode==='paused')resume();else pause();}
    function dash(value){if(mode!=='running')return;sound.resume();game.dash(value);consume();hud();}
    function settle(){clear();music.pause();persist();
        if(game.state==='upgrade'){upgrades();return;}
        mode=game.state;
        if(mode==='lost'){overlay('重新連線，再次突圍',`本次分數 ${game.score.toLocaleString()}。免費重試，還原第 ${game.wave} 波起點的分數、裝甲及能力。`,'重試本波');$('status').textContent='機甲離線';}
        else {const m=Math.floor(game.elapsed/60),s=Math.floor(game.elapsed%60);overlay('十二重封鎖，全部解除。',`戰役完成 · ${m} 分 ${s} 秒 · ${game.score.toLocaleString()} 分。你的電弧點亮了整座城市。`,'再次出擊');$('status').textContent='全戰役通關';}
        hud();$('start').focus({preventScroll:true});
    }
    $('start').addEventListener('click',()=>{if(mode==='paused')resume();else if(mode==='lost')retry();else begin(mode==='won'?fresh():undefined);});
    $('new').addEventListener('click',()=>begin(fresh()));$('retry').addEventListener('click',retry);$('pause').addEventListener('click',togglePause);
    $('theme-toggle').addEventListener('click',()=>{const theme=document.documentElement.dataset.theme==='light'?'dark':'light';document.documentElement.dataset.theme=theme;renderDirty=true;try{localStorage.setItem('casharcade-theme',theme);}catch{$('storage-note').textContent='主題偏好無法保存；本頁仍可使用。';}});
    $('preview-sound').addEventListener('click',()=>{sound.resume();sound.play('arenaArc');sound.play('arenaChain',.15);sound.play('arenaDash',.4);});
    $('fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if($('machine').requestFullscreen)await $('machine').requestFullscreen();else $('storage-note').textContent='瀏覽器不支援全螢幕；可繼續在頁面遊玩。';}catch{$('storage-note').textContent='無法切換全螢幕；可繼續在頁面遊玩。';}});
    document.addEventListener('fullscreenchange',()=>{clear();renderer.resize();$('fullscreen').textContent=document.fullscreenElement?'離開全螢幕':'全螢幕';});
    window.addEventListener('blur',()=>{clear();pause();});document.addEventListener('visibilitychange',()=>{if(document.hidden){clear();pause();}});
    window.addEventListener('pagehide',()=>{persist();music.pause();});window.addEventListener('resize',()=>{clear();renderer.resize();});
    function frame(now){const dt=Math.min(.1,Math.max(0,(now-(previous||now))/1000)),animated=mode==='running'||mode==='transition';previous=now;
        if(mode==='running'){
            accumulator+=dt;while(accumulator>=1/120&&game.state==='running'){game.update(1/120,input.value());accumulator-=1/120;}
            consume();renderer.update(dt);
            if(game.state!=='running'){music.pause();persist();clear();if(game.state==='lost')settle();else {mode='transition';transition=1.1;}}
        }else if(mode==='transition'){renderer.update(dt);transition-=dt;if(transition<=0)settle();}
        if(animated){hudTime+=dt;if(hudTime>=.1){hud();hudTime=0;}}
        if(animated||renderDirty){renderer.draw(game,document.documentElement.dataset.theme);renderDirty=false;}requestAnimationFrame(frame);
    }
    if(restored)overlay('機甲記錄已恢復',restored.kind==='upgrade'?`第 ${game.wave} 波已完成。繼續選擇已保存的三項升級。`:`從第 ${game.wave} 波起點恢復：裝甲 ${game.hp}，分數 ${game.score}。`,'繼續戰役');
    hud();requestAnimationFrame(frame);
})();
