(() => {
    'use strict';
    const { W, H, LEVELS, WEAPONS, Game, fresh, valid } = NeonAssault, $ = id => document.getElementById(id);
    const KEY = 'casharcade-assault-checkpoint-v1', BEST = 'casharcade-assault-high-score';
    function read(key) { try { return localStorage.getItem(key); } catch { return null; } }
    function save(key, value) {
        try { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value); }
        catch { $('storage-note').textContent = '瀏覽器儲存無法使用，本頁仍可遊玩；關卡進度與最高分暫時無法保存。'; }
    }
    function applyTheme() {
        let stored = null;
        try { stored = localStorage.getItem('casharcade-theme'); } catch { /* Dark default. */ }
        document.documentElement.dataset.theme = stored === 'light' ? 'light' : 'dark';
    }
    applyTheme();
    let checkpoint = fresh(), restored = false;
    try { const value = JSON.parse(read(KEY)); if (valid(value)) { checkpoint = value; restored = true; } } catch { /* A malformed save does not prevent a free new campaign. */ }
    let best = Math.max(0, Math.min(1e9, Number(read(BEST)) || 0)), game = new Game(checkpoint), mode = 'ready';
    const renderer = new NeonAssaultRenderer($('game-canvas'));
    const sound = CashArcadeAudio.create({ storageKey: 'casharcade-assault-sound-muted', toggleButton: $('sound-toggle'), outputLevel: .65, musicMix: true });
    const music = CashArcadeMusic.create({ score: NeonAssaultScore, storagePrefix: 'casharcade-assault-music',
        toggleButton: $('music-toggle'), volumeInput: $('music-volume'), volumeLabel: $('music-volume-value'), trackLabel: $('music-track'), audioOutput: sound.musicOutput, initialLevel: checkpoint.level });
    const keys = new Set(); let pointer = null, target = null, previous = 0, accumulator = 0, hudTime = 0, pausedState = 'running';
    game.state = 'ready';
    function clearInput() { keys.clear(); pointer = null; target = null; accumulator = 0; }
    function persistBest() { best = Math.max(best, game.score); save(BEST, String(best)); }
    function overlay(kicker, title, message, button, hint = '免費重玩 · 關卡起點自動保存') {
        $('overlay').hidden = false; $('overlay-kicker').textContent = kicker; $('overlay-title').textContent = title;
        $('overlay-message').textContent = message; $('start').textContent = button; $('overlay-hint').textContent = hint;
        $('live').textContent = title;
    }
    function sync() {
        $('pause').disabled = !['running', 'paused'].includes(mode); $('pause').textContent = mode === 'paused' ? '繼續' : '暫停';
        $('retry').disabled = !['running', 'paused', 'lost'].includes(mode);
        $('bomb').disabled = mode !== 'running' || game.state !== 'running' || game.bombs === 0;
        $('full-bomb').disabled = $('bomb').disabled;
    }
    function hud() {
        $('score').textContent = String(game.score).padStart(6, '0'); $('best').textContent = String(Math.max(best, game.score)).padStart(6, '0');
        $('health').textContent = '▰'.repeat(Math.max(0, game.hp)) + '▱'.repeat(5 - Math.max(0, game.hp));
        $('health').setAttribute('aria-label', `裝甲 ${Math.max(0, game.hp)} / 5`);
        $('health').style.color = game.hp <= 2 ? 'var(--danger)' : 'var(--cyan)';
        $('weapon').textContent = `${WEAPONS[game.weapon]} Lv.${game.power}`; $('wings').textContent = `僚機 ${game.wings} / 2`; $('bomb-count').textContent = game.bombs;
        $('mission-name').textContent = game.config.name; $('level').textContent = `${String(game.level).padStart(2, '0')} / 03`;
        const progress = Math.min(100, Math.floor(game.time / game.config.duration * 100));
        $('progress-fill').style.width = `${progress}%`; $('progress').setAttribute('aria-valuenow', String(progress));
        if (mode === 'running') $('status').textContent = game.state === 'clearing' ? '頭目擊破 · 航路已淨空' : game.boss ? `${game.config.boss} · ${{ armor: '摧毀金色裝甲', core: '攻擊中央核心', rage: '核心過載，留意光束' }[game.boss.phase]}` : `航路突破中 · 第 ${Math.max(1, game.wave)} 波`;
        document.querySelectorAll('[data-stage]').forEach(el => { el.classList.toggle('current', Number(el.dataset.stage) === game.level); el.classList.toggle('complete', Number(el.dataset.stage) < game.level); });
        sync();
    }
    function begin(cp = checkpoint) {
        checkpoint = { ...cp }; save(KEY, JSON.stringify(checkpoint)); game = new Game(checkpoint);
        mode = 'running'; clearInput(); renderer.reset(); $('overlay').hidden = true; previous = performance.now();
        sound.resume(); sound.play('assaultStart'); music.start(game.level, 0); hud(); $('game-canvas').focus({ preventScroll: true });
    }
    function pause() {
        if (mode !== 'running') return;
        pausedState = game.state; mode = 'paused'; game.state = 'paused'; clearInput(); music.pause(); persistBest();
        $('status').textContent = '已暫停'; overlay('FLIGHT ON HOLD', '航線暫停', '戰機、敵彈與所有強化都已凍結。準備好後，接續出擊。', '繼續出擊'); sync();
    }
    function resume() {
        if (mode !== 'paused') return;
        mode = 'running'; game.state = pausedState; clearInput(); previous = performance.now();
        sound.resume(); if (game.state === 'running') music.resume(); $('overlay').hidden = true; sync(); $('game-canvas').focus({ preventScroll: true });
    }
    function togglePause() { if (mode === 'paused') resume(); else pause(); }
    function deployBomb() { sound.resume(); if (mode === 'running') { game.bomb(); consume(); hud(); } }
    function consume() {
        const events = game.drain(); renderer.consume(events);
        const effects = { shoot: game.weapon === 'laser' ? 'assaultLaser' : 'assaultShot', explode: 'assaultExplosion', part: 'assaultPart',
            hurt: 'assaultHurt', bomb: 'assaultBomb', pickup: 'assaultPickup', boss: 'defenseAlarm', warning: 'defenseAlarm', phase: 'assaultPart', bossDown: 'assaultBossDown', lost: 'lose', won: 'win', stageClear: 'level' };
        for (const e of events) {
            if (effects[e.type]) sound.play(effects[e.type]);
            if (['pickup', 'hurt', 'bomb', 'bossDown', 'part'].includes(e.type)) music.duck();
            if (e.type === 'boss') music.phase('armor');
            if (e.type === 'phase') music.phase(e.phase);
            if (e.type === 'bossDown') music.pause();
            if (e.type === 'pickup') $('live').textContent = `取得${NeonAssault.ITEMS[e.item]}`;
        }
    }
    function settle() {
        if (mode !== 'running' || !['lost', 'stageClear', 'won'].includes(game.state)) return;
        mode = game.state; clearInput(); persistBest(); music.pause();
        if (mode === 'lost') {
            $('status').textContent = '戰機失聯';
            overlay('SIGNAL LOST', '重整隊形，再次出擊', `本次分數 ${game.score.toLocaleString()}。重試會還原第 ${game.level} 關起點的裝甲、火力與分數。`, '重試本關');
        } else if (mode === 'stageClear') {
            checkpoint = game.nextCheckpoint(); save(KEY, JSON.stringify(checkpoint)); $('status').textContent = '航路突破';
            overlay('SECTOR CLEAR', `第 ${game.level} 關突破`, `裝甲 +1、脈衝彈 +1。保留火力，下一站：${LEVELS[checkpoint.level - 1].name}。`, '前往下一關');
        } else {
            save(KEY, null); $('status').textContent = '三關戰役完成';
            overlay('MISSION COMPLETE', '你點亮了整片星空', `三大機械頭目已擊破！總分 ${game.score.toLocaleString()}，本關最高 ${game.maxCombo} 連鎖。`, '再次出擊');
        }
        hud(); $('start').focus({ preventScroll: true });
    }
    $('start').addEventListener('click', () => { if (mode === 'paused') resume(); else begin(mode === 'won' ? fresh() : checkpoint); });
    $('pause').addEventListener('click', togglePause); $('full-pause').addEventListener('click', togglePause);
    $('retry').addEventListener('click', () => begin(checkpoint)); $('new').addEventListener('click', () => begin(fresh()));
    $('bomb').addEventListener('click', deployBomb); $('full-bomb').addEventListener('click', deployBomb);
    $('theme-toggle').addEventListener('click', () => { const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = theme; save('casharcade-theme', theme); });
    $('preview-sound').addEventListener('click', () => { sound.resume(); sound.play('assaultShot'); sound.play('assaultPickup', .18); sound.play('assaultExplosion', .55); });
    async function fullscreen() {
        try { if (document.fullscreenElement) await document.exitFullscreen(); else if ($('arena').requestFullscreen) await $('arena').requestFullscreen(); else $('storage-note').textContent = '此瀏覽器不支援全螢幕；可以直接在頁面遊玩。'; }
        catch { $('storage-note').textContent = '無法切換全螢幕；可以直接在頁面遊玩。'; }
    }
    $('fullscreen').addEventListener('click', fullscreen); $('full-exit').addEventListener('click', fullscreen);
    document.addEventListener('fullscreenchange', () => { clearInput(); renderer.resize(); });
    const movement = ['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd', 'shift'];
    document.addEventListener('keydown', e => {
        const key = e.key.toLowerCase();
        if (e.ctrlKey || e.metaKey || e.altKey || e.target.closest?.('input, select, textarea, [contenteditable="true"]')) return;
        if ([' ', 'enter'].includes(key) && e.target.closest?.('button, summary, a')) return;
        if (![...movement, ' ', 'x', 'p', 'escape', 'r', 'enter'].includes(key)) return;
        e.preventDefault();
        if (movement.includes(key)) { keys.add(key); target = null; return; }
        if (e.repeat) return;
        if (key === 'p' || key === 'escape') togglePause();
        else if (key === 'r' && ['running', 'paused', 'lost'].includes(mode)) begin(checkpoint);
        else if (key === ' ' || key === 'x') deployBomb();
        else if (key === 'enter' && mode === 'ready') begin();
    });
    document.addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
    const canvas = $('game-canvas');
    canvas.addEventListener('pointerdown', e => {
        if (mode !== 'running' || game.state !== 'running' || pointer || e.button !== 0) return;
        e.preventDefault(); canvas.focus({ preventScroll: true }); canvas.setPointerCapture(e.pointerId);
        pointer = { id: e.pointerId, x: e.clientX, y: e.clientY }; target = { x: game.player.x, y: game.player.y };
    });
    canvas.addEventListener('pointermove', e => {
        if (!pointer || pointer.id !== e.pointerId || mode !== 'running') return;
        const rect = canvas.getBoundingClientRect();
        // In fullscreen, object-fit may letterbox the portrait canvas.
        const scale = Math.min(rect.width / W, rect.height / H);
        target = { x: Math.max(22, Math.min(W - 22, (target?.x ?? game.player.x) + (e.clientX - pointer.x) / scale)),
            y: Math.max(245, Math.min(H - 28, (target?.y ?? game.player.y) + (e.clientY - pointer.y) / scale)) };
        pointer.x = e.clientX; pointer.y = e.clientY;
    });
    function release(e) { if (pointer?.id === e.pointerId) { pointer = null; target = null; } }
    canvas.addEventListener('pointerup', release); canvas.addEventListener('pointercancel', release); canvas.addEventListener('lostpointercapture', release);
    window.addEventListener('blur', () => { clearInput(); pause(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) { clearInput(); pause(); } });
    window.addEventListener('pagehide', () => { persistBest(); music.pause(); });
    window.addEventListener('resize', () => { clearInput(); renderer.resize(); });
    function frame(now) {
        const elapsed = Math.min(.1, Math.max(0, (now - (previous || now)) / 1000)); previous = now;
        if (mode === 'running') {
            accumulator += elapsed;
            const input = target || { dx: (keys.has('arrowright') || keys.has('d') ? 1 : 0) - (keys.has('arrowleft') || keys.has('a') ? 1 : 0),
                dy: (keys.has('arrowdown') || keys.has('s') ? 1 : 0) - (keys.has('arrowup') || keys.has('w') ? 1 : 0), focus: keys.has('shift') };
            while (accumulator >= 1 / 120) { game.update(1 / 120, input); accumulator -= 1 / 120; }
            consume(); renderer.update(elapsed); settle();
        }
        hudTime += elapsed; if (hudTime >= .1) { hud(); hudTime = 0; }
        renderer.draw(game, document.documentElement.dataset.theme); requestAnimationFrame(frame);
    }
    if (restored) overlay('FLIGHT RECORD RECOVERED', `第 ${checkpoint.level} 關待命`, `已載入「${LEVELS[checkpoint.level - 1].name}」起點。裝甲 ${checkpoint.hp} / 5，${WEAPONS[checkpoint.weapon]} Lv.${checkpoint.power}。`, '繼續戰役');
    hud(); requestAnimationFrame(frame);
})();
