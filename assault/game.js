(() => {
    'use strict';
    const { W, H, LEVELS, WEAPONS, Game, fresh } = NeonAssault, $ = id => document.getElementById(id);
    const BEST = 'casharcade-assault-high-score';
    function read(key) { try { return localStorage.getItem(key); } catch { return null; } }
    function savePreference(key, value) {
        try { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value); }
        catch { $('storage-note').textContent = '瀏覽器無法保存偏好或最高分。'; }
    }
    function applyTheme() {
        let stored = null;
        try { stored = localStorage.getItem('casharcade-theme'); } catch { /* Dark default. */ }
        document.documentElement.dataset.theme = stored === 'light' ? 'light' : 'dark';
    }
    applyTheme();
    const store = NeonAssaultStorage.create(), loaded = store.load();
    let record = loaded.record, loadBlocked = !!loaded.blocked, storageBlocked = loadBlocked;
    let checkpoint = record?.checkpoint || fresh();
    let game = record ? Game.restore(record.game) : new Game(checkpoint);
    let mode = record?.phase || 'ready', pausedState = 'running', restoredSession = false;
    if (mode === 'active' || mode === 'paid-ready') {
        pausedState = game.state; game.state = 'paused'; mode = 'paused'; restoredSession = true;
    } else if (mode === 'pending') mode = 'payment';
    else if (mode === 'ready') game.state = 'ready';
    let best = Math.max(0, Math.min(1e9, Number(read(BEST)) || 0));
    const renderer = new NeonAssaultRenderer($('game-canvas'));
    const sound = CashArcadeAudio.create({ storageKey: 'casharcade-assault-sound-muted', toggleButton: $('sound-toggle'), outputLevel: .65, musicMix: true });
    const music = CashArcadeMusic.create({ score: NeonAssaultScore, storagePrefix: 'casharcade-assault-music',
        toggleButton: $('music-toggle'), volumeInput: $('music-volume'), volumeLabel: $('music-volume-value'),
        trackLabel: $('music-track'), audioOutput: sound.musicOutput, initialLevel: checkpoint.level });
    const keys = new Set(); let pointer = null, target = null, previous = 0, accumulator = 0, hudTime = 0, lastSave = 0;
    let paymentBusy = false, consumedRecord = null;
    function clearInput() { keys.clear(); pointer = null; target = null; accumulator = 0; }
    function persistBest() { best = Math.max(best, game.score); savePreference(BEST, String(best)); }
    function overlay(kicker, title, message, button, hint = '局中進度自動保存 · 死亡後再開局需解鎖') {
        $('overlay').hidden = false; $('overlay').dataset.payment = mode === 'payment' ? 'true' : 'false';
        $('overlay-kicker').textContent = kicker; $('overlay-title').textContent = title;
        $('overlay-message').textContent = message; $('start').textContent = button; $('overlay-hint').textContent = hint;
        $('live').textContent = title;
    }
    function sync() {
        $('start').disabled = paymentBusy || loadBlocked;
        $('pause').disabled = paymentBusy || !['running', 'paused'].includes(mode);
        $('pause').textContent = mode === 'paused' ? '繼續' : '暫停';
        $('retry').disabled = paymentBusy || loadBlocked || !['running', 'paused', 'lost'].includes(mode);
        $('new').disabled = paymentBusy || loadBlocked || mode === 'payment';
        $('bomb').disabled = mode !== 'running' || game.state !== 'running' || game.bombs === 0;
        $('full-bomb').disabled = $('bomb').disabled;
        $('payment-cancel').hidden = !paymentBusy;
        $('payment-cancel').disabled = !paymentBusy;
    }
    function hud() {
        $('score').textContent = String(game.score).padStart(6, '0'); $('best').textContent = String(Math.max(best, game.score)).padStart(6, '0');
        $('health').textContent = '▰'.repeat(Math.max(0, game.hp)) + '▱'.repeat(5 - Math.max(0, game.hp));
        $('health').setAttribute('aria-label', '裝甲 ' + Math.max(0, game.hp) + ' / 5');
        $('health').style.color = game.hp <= 2 ? 'var(--danger)' : 'var(--cyan)';
        $('weapon').textContent = WEAPONS[game.weapon] + ' Lv.' + game.power; $('wings').textContent = '僚機 ' + game.wings + ' / 2'; $('bomb-count').textContent = game.bombs;
        $('mission-name').textContent = game.config.name; $('level').textContent = String(game.level).padStart(2, '0') + ' / 03';
        const progress = Math.min(100, Math.floor(game.time / game.config.duration * 100));
        $('progress-fill').style.width = progress + '%'; $('progress').setAttribute('aria-valuenow', String(progress));
        if (mode === 'running') $('status').textContent = game.state === 'clearing' ? '頭目擊破 · 航路已淨空' : game.boss
            ? game.config.boss + ' · ' + { armor: '摧毀金色裝甲', core: '攻擊中央核心', rage: '核心過載，留意光束' }[game.boss.phase]
            : '航路突破中 · 第 ' + Math.max(1, game.wave) + ' 波';
        document.querySelectorAll('[data-stage]').forEach(el => { el.classList.toggle('current', Number(el.dataset.stage) === game.level); el.classList.toggle('complete', Number(el.dataset.stage) < game.level); });
        sync();
    }
    function snapshot() {
        const data = game.snapshot();
        if (mode === 'paused') data.state = pausedState;
        if (mode === 'ready') data.state = 'running';
        return data;
    }
    function nextRecord(phase, cp = checkpoint, intent = null, serial = record?.serial || 0, candidate = snapshot()) {
        return { version: 2, serial, sequence: (record?.sequence || 0) + 1, checkpoint: cp, game: candidate, phase, intent };
    }
    function writeRecord(next) {
        try {
            const previous = record;
            store.write(next); record = next; storageBlocked = false; $('storage-note').textContent = '';
            if (previous?.phase === 'paid-ready' && next.phase !== 'paid-ready' && previous.serial === next.serial) {
                store.clearBackup(); consumedRecord = null;
            }
            return true;
        } catch {
            try { store.backupRecovery(next); record = next; } catch { /* Keep the last verified record in memory. */ }
            storageBlocked = true;
            $('storage-note').textContent = '無法安全保存遊戲或付款狀態。請允許瀏覽器儲存並重試；付款前請勿關閉本頁。';
            return false;
        }
    }
    function saveCurrent() {
        if (!record || loadBlocked || !['running', 'paused'].includes(mode)) return;
        if (!writeRecord(nextRecord('active')) && mode === 'running') freezeForStorage();
    }
    function freezeForStorage() {
        pausedState = game.state; mode = 'paused'; game.state = 'paused'; clearInput(); music.pause();
        $('status').textContent = '等待儲存恢復';
        overlay('SAVE REQUIRED', '先恢復瀏覽器儲存', '局中進度暫停在此處。儲存恢復後按「繼續戰役」，不會再次收費。', '繼續戰役');
        sync();
    }
    function begin(cp = checkpoint) {
        const nextGame = new Game(cp), next = nextRecord('active', cp, null, record?.serial || 0, nextGame.snapshot());
        if (!writeRecord(next)) return false;
        checkpoint = cp; game = nextGame; mode = 'running'; restoredSession = false;
        clearInput(); renderer.reset(); $('overlay').hidden = true; previous = performance.now();
        sound.resume(); sound.play('assaultStart'); music.start(game.level, 'shield'); hud(); $('game-canvas').focus({ preventScroll: true });
        return true;
    }
    function activatePaid(next) {
        if (!next || next.phase !== 'paid-ready') return false;
        if (record !== next && !writeRecord(next)) return false;
        checkpoint = next.checkpoint; game = Game.restore(next.game); mode = 'running'; restoredSession = false;
        clearInput(); renderer.reset(); $('overlay').hidden = true; previous = performance.now();
        sound.resume(); sound.play('assaultStart'); music.start(game.level, 'shield'); hud(); $('game-canvas').focus({ preventScroll: true });
        if (writeRecord(nextRecord('active'))) { store.clearBackup(); consumedRecord = null; }
        else freezeForStorage();
        return true;
    }
    function pause() {
        if (mode !== 'running') return;
        pausedState = game.state; mode = 'paused'; game.state = 'paused'; clearInput(); music.pause(); persistBest();
        saveCurrent(); $('status').textContent = '已暫停';
        overlay('FLIGHT ON HOLD', '航線暫停', '戰機、敵彈與所有強化都已凍結。準備好後，接續出擊。', '繼續出擊'); sync();
    }
    function resume() {
        if (mode !== 'paused') return;
        if (record?.phase === 'paid-ready') { activatePaid(record); return; }
        if (!writeRecord(nextRecord('active'))) return;
        mode = 'running'; game.state = pausedState; clearInput(); previous = performance.now();
        sound.resume();
        if (game.state === 'running') {
            if (restoredSession) music.start(game.level, game.boss?.phase || 'shield'); else music.resume();
        }
        restoredSession = false; $('overlay').hidden = true; sync(); $('game-canvas').focus({ preventScroll: true });
    }
    function togglePause() { if (mode === 'paused') resume(); else pause(); }
    function deployBomb() { sound.resume(); if (mode === 'running') { game.bomb(); consume(); saveCurrent(); hud(); } }
    function showCheckout(value) {
        const link = $('payment-link'); link.hidden = true; link.removeAttribute('href');
        if (!value) return;
        try {
            const url = new URL(value);
            if (url.origin !== 'https://linkincash.cc' || !/^\/arcade\/checkout\/[0-9a-f-]+$/i.test(url.pathname)
                || url.search || url.username || url.password) return;
            link.href = url.href; link.hidden = false;
        } catch { /* Never expose an untrusted checkout URL. */ }
    }
    const paymentGate = CashArcadeAssaultGate.create({
        onStatus(message) { $('payment-status').textContent = message; if (mode === 'payment' || mode === 'lost') $('live').textContent = message; },
        onBusy(busy) { paymentBusy = busy; clearInput(); sync(); },
        onCheckout: showCheckout,
    });
    function paymentOverlay() {
        mode = 'payment'; clearInput(); music.pause(); $('status').textContent = '等待付款';
        overlay('REPLAY RECOVERY', '恢復再來一局', '戰機失聯後的新局須經 CashLink 確認。付款未完成前不會重新部署。', '恢復付款');
        sync();
    }
    async function requestPaid(intent) {
        if (paymentBusy || loadBlocked) return;
        if (consumedRecord) {
            if (writeRecord(consumedRecord)) activatePaid(consumedRecord);
            return;
        }
        if (record?.phase === 'paid-ready') { activatePaid(record); return; }
        if (record?.phase !== 'pending') {
            if (!writeRecord(nextRecord('pending', checkpoint, intent))) return;
        }
        const pendingIntent = record.intent;
        paymentOverlay();
        const unlocked = await paymentGate.unlock(() => {
            const cp = pendingIntent === 'new' ? fresh() : checkpoint;
            const candidate = new Game(cp);
            const next = nextRecord('paid-ready', cp, null, record.serial + 1, candidate.snapshot());
            consumedRecord = next;
            try { store.backup(next); } catch { /* A verified local record can still protect this credit. */ }
            if (!writeRecord(next)) throw { code: 'checkpoint_unavailable' };
        });
        if (unlocked) activatePaid(consumedRecord);
    }
    function requestStart(intent = 'resume') {
        if (paymentBusy || loadBlocked) return;
        if (consumedRecord || record?.phase === 'paid-ready') { void requestPaid(intent); return; }
        if (mode === 'lost' || mode === 'payment' || record?.phase === 'pending') {
            void requestPaid(record?.phase === 'pending' ? record.intent : intent === 'new' ? 'new' : 'retry'); return;
        }
        if (intent === 'resume' && mode === 'paused') { resume(); return; }
        if (intent === 'resume' && mode === 'running') return;
        if (intent === 'new' || mode === 'won') begin(fresh());
        else begin(checkpoint);
    }
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
            if (e.type === 'pickup') $('live').textContent = '取得' + NeonAssault.ITEMS[e.item];
        }
    }
    function settle() {
        if (mode !== 'running' || !['lost', 'stageClear', 'won'].includes(game.state)) return;
        mode = game.state; clearInput(); persistBest(); music.pause();
        if (mode === 'lost') {
            writeRecord(nextRecord('lost'));
            $('status').textContent = '戰機失聯';
            overlay('SIGNAL LOST', '重整隊形，再次出擊', '本次分數 ' + game.score.toLocaleString() + '。死亡後重試須解鎖；成功後還原第 ' + game.level + ' 關起點。', '解鎖重試本關');
        } else if (mode === 'stageClear') {
            checkpoint = game.nextCheckpoint(); writeRecord(nextRecord('stageClear', checkpoint)); $('status').textContent = '航路突破';
            overlay('SECTOR CLEAR', '第 ' + game.level + ' 關突破', '裝甲 +1、脈衝彈 +1。保留火力，下一站：' + LEVELS[checkpoint.level - 1].name + '。', '前往下一關');
        } else {
            writeRecord(nextRecord('won')); $('status').textContent = '三關戰役完成';
            overlay('MISSION COMPLETE', '你點亮了整片星空', '三大機械頭目已擊破！總分 ' + game.score.toLocaleString() + '，本關最高 ' + game.maxCombo + ' 連鎖。', '再次出擊');
        }
        hud(); $('start').focus({ preventScroll: true });
    }
    $('start').addEventListener('click', () => requestStart());
    $('pause').addEventListener('click', togglePause); $('full-pause').addEventListener('click', togglePause);
    $('retry').addEventListener('click', () => requestStart('retry')); $('new').addEventListener('click', () => requestStart('new'));
    $('payment-cancel').addEventListener('click', () => paymentGate.cancel());
    $('bomb').addEventListener('click', deployBomb); $('full-bomb').addEventListener('click', deployBomb);
    $('theme-toggle').addEventListener('click', () => { const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = theme; savePreference('casharcade-theme', theme); });
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
        if (movement.includes(key)) { if (mode === 'running') { keys.add(key); target = null; } return; }
        if (e.repeat || paymentBusy) return;
        if (key === 'p' || key === 'escape') togglePause();
        else if (key === 'r' && ['running', 'paused', 'lost', 'payment'].includes(mode)) requestStart('retry');
        else if (key === ' ' || key === 'x') deployBomb();
        else if (key === 'enter' && ['ready', 'lost', 'payment', 'stageClear', 'won'].includes(mode)) requestStart();
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
        const scale = Math.min(rect.width / W, rect.height / H);
        target = { x: Math.max(22, Math.min(W - 22, (target?.x ?? game.player.x) + (e.clientX - pointer.x) / scale)),
            y: Math.max(245, Math.min(H - 28, (target?.y ?? game.player.y) + (e.clientY - pointer.y) / scale)) };
        pointer.x = e.clientX; pointer.y = e.clientY;
    });
    function release(e) { if (pointer?.id === e.pointerId) { pointer = null; target = null; } }
    canvas.addEventListener('pointerup', release); canvas.addEventListener('pointercancel', release); canvas.addEventListener('lostpointercapture', release);
    window.addEventListener('blur', () => { clearInput(); pause(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) { clearInput(); pause(); } });
    window.addEventListener('pagehide', () => { persistBest(); music.pause(); saveCurrent(); });
    window.addEventListener('resize', () => { clearInput(); renderer.resize(); });
    function frame(now) {
        const elapsed = Math.min(.1, Math.max(0, (now - (previous || now)) / 1000)); previous = now;
        if (mode === 'running') {
            accumulator += elapsed;
            const input = target || { dx: (keys.has('arrowright') || keys.has('d') ? 1 : 0) - (keys.has('arrowleft') || keys.has('a') ? 1 : 0),
                dy: (keys.has('arrowdown') || keys.has('s') ? 1 : 0) - (keys.has('arrowup') || keys.has('w') ? 1 : 0), focus: keys.has('shift') };
            while (accumulator >= 1 / 120) { game.update(1 / 120, input); accumulator -= 1 / 120; }
            consume(); renderer.update(elapsed); settle();
            if (mode === 'running' && now - lastSave >= 250) { saveCurrent(); lastSave = now; }
        }
        hudTime += elapsed; if (hudTime >= .1) { hud(); hudTime = 0; }
        renderer.draw(game, document.documentElement.dataset.theme); requestAnimationFrame(frame);
    }
    if (loadBlocked) {
        $('storage-note').textContent = '無法讀取有效的戰役存檔。為避免重載略過付款，請保留網站資料並修復瀏覽器儲存；目前不能開始新局。';
        overlay('SAVE UNAVAILABLE', '存檔無法確認', '請恢復瀏覽器儲存後重新載入此頁。', '暫不可開始');
    } else if (mode === 'paused') {
        $('status').textContent = '已暫停';
        overlay('FLIGHT RECORD RECOVERED', '第 ' + game.level + ' 關待命', '已恢復局中進度：分數 ' + game.score.toLocaleString() + '，裝甲 ' + game.hp + ' / 5。按下後從原位置繼續。', '繼續戰役');
    } else if (mode === 'lost') {
        $('status').textContent = '戰機失聯';
        overlay('SIGNAL LOST', '重整隊形，再次出擊', '已恢復死亡紀錄。重試本關或新戰役須先解鎖。', '解鎖重試本關');
    } else if (mode === 'payment') paymentOverlay();
    else if (mode === 'stageClear') { $('status').textContent = '航路突破'; overlay('SECTOR CLEAR', '第 ' + game.level + ' 關突破', '下一站：' + LEVELS[checkpoint.level - 1].name + '。', '前往下一關'); }
    else if (mode === 'won') { $('status').textContent = '三關戰役完成'; overlay('MISSION COMPLETE', '你點亮了整片星空', '三大機械頭目已擊破！總分 ' + game.score.toLocaleString() + '。', '再次出擊'); }
    else if (loaded.migrated) overlay('FLIGHT RECORD RECOVERED', '第 ' + checkpoint.level + ' 關待命', '已載入舊版「' + LEVELS[checkpoint.level - 1].name + '」關卡起點。', '繼續戰役');
    hud(); requestAnimationFrame(frame); void paymentGate.initialize();
})();
