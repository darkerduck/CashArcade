(() => {
    'use strict';
    const { W, H, LEVELS, Game, fresh, valid, upgrade, clone } = NeonDefense;
    const $ = id => document.getElementById(id);
    const KEY = 'casharcade-missile-checkpoint', BEST = 'casharcade-missile-high-score';
    const LOSS_BACKUP = 'casharcade.missile.loss-lock.v1', PAID_BACKUP = 'casharcade.missile.paid-recovery.v1';
    const sound = CashArcadeAudio.create({ storageKey: 'casharcade-missile-sound-muted', toggleButton: $('sound-toggle'), outputLevel: .8 });
    const renderer = new NeonDefenseRenderer($('game-canvas'));
    const names = { rapid: '» 急速裝填', wide: '✦ 超載爆破', slow: '◷ 時間緩速', shield: '◇ 城市護盾', emp: 'ϟ 電磁脈衝' };
    let checkpoint = null, replay = { state: 'open', intent: null, score: 0 };
    let game = null, mode = 'ready', best = 0, previous = 0, space = false;
    let storageBlocked = false, paymentBusy = false, consumedCheckpoint = null;
    const pressedPointers = new Set();
    let aim = { x: W / 2, y: H / 2 }, keys = new Set(), toast = '', toastUntil = 0;
    function read(key) { try { return localStorage.getItem(key); } catch { return null; } }
    function save(key, value) {
        try { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value); return true; }
        catch { $('storage-note').textContent = '瀏覽器儲存無法使用；無法安全保存防線與付款狀態。請允許儲存後重試。'; return false; }
    }
    function sessionRead(key) { try { return JSON.parse(sessionStorage.getItem(key)); } catch { return null; } }
    function sessionSave(key, value) { try { sessionStorage.setItem(key, JSON.stringify(value)); } catch { /* The durable record remains authoritative. */ } }
    function sessionClear(key) { try { sessionStorage.removeItem(key); } catch { /* Ignore unavailable backup storage. */ } }
    function validRecord(value) {
        return value && value.version === 2 && valid(value.checkpoint) && value.replay
            && ['open', 'lost', 'payment-pending', 'paid-ready'].includes(value.replay.state)
            && (value.replay.state !== 'payment-pending' || ['retry', 'new'].includes(value.replay.intent))
            && (value.replay.state === 'payment-pending' || value.replay.intent === null)
            && Number.isFinite(value.replay.score) && value.replay.score >= 0
            && (value.checkpoint.phase === 'stage' || value.replay.state === 'open');
    }
    function saveRecord(nextCheckpoint, state = 'open', intent = null, score = 0) {
        const nextReplay = { state, intent, score };
        if (!validRecord({ version: 2, checkpoint: nextCheckpoint, replay: nextReplay })
            || !save(KEY, JSON.stringify({ version: 2, checkpoint: nextCheckpoint, replay: nextReplay }))) return false;
        checkpoint = nextCheckpoint; replay = nextReplay; return true;
    }
    try {
        const saved = JSON.parse(localStorage.getItem(KEY));
        if (valid(saved)) checkpoint = saved; // Existing v1 stage/upgrade saves remain free to continue.
        else if (validRecord(saved)) { checkpoint = saved.checkpoint; replay = saved.replay; }
        else if (saved) storageBlocked = true;
    } catch { storageBlocked = true; }
    if (!storageBlocked && checkpoint) {
        const lost = sessionRead(LOSS_BACKUP);
        if (replay.state === 'open' && checkpoint.phase === 'stage' && lost && lost.level === checkpoint.level
            && Number.isFinite(lost.score) && lost.score >= 0) replay = { state: 'lost', intent: null, score: lost.score };
        const paid = sessionRead(PAID_BACKUP);
        if (replay.state === 'payment-pending' && valid(paid) && paid.phase === 'stage') consumedCheckpoint = paid;
        if (replay.state === 'paid-ready') { sessionClear(LOSS_BACKUP); sessionClear(PAID_BACKUP); }
    }
    if (storageBlocked) $('storage-note').textContent = '存檔無法確認，為避免重複付款或免費略過失敗，本頁暫不開始新局。請保留瀏覽器資料並排除儲存問題。';
    best = Math.max(0, Number(read(BEST)) || 0);
    document.documentElement.dataset.theme = read('casharcade-theme') || 'dark';
    function clearInput() { pressedPointers.clear(); space = false; keys.clear(); }
    function syncControls() {
        $('start').disabled = paymentBusy || storageBlocked;
        $('retry').disabled = paymentBusy || storageBlocked || !['running', 'paused', 'lost', 'payment-pending'].includes(mode);
        $('new').disabled = paymentBusy || storageBlocked;
        $('pause').disabled = paymentBusy || !['running', 'paused'].includes(mode);
        $('payment-retry').disabled = paymentBusy || storageBlocked || !['lost', 'payment-pending'].includes(mode);
        $('payment-cancel').disabled = !paymentBusy;
    }
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
    const paymentGate = CashArcadeMissileGate.create({
        onStatus(message) { $('payment-status').textContent = message; $('live').textContent = message; },
        onBusy(busy) { paymentBusy = busy; clearInput(); syncControls(); if (busy) $('status').textContent = '等待付款'; },
        onCheckout: showCheckout,
    });
    function overlay(kicker, title, message, button = '繼續防守') {
        $('overlay').hidden = false; $('overlay-kicker').textContent = kicker; $('overlay-title').textContent = title;
        $('overlay-message').textContent = message; $('start').textContent = button; $('start').hidden = false;
        $('choices').hidden = true; $('live').textContent = title;
    }
    function showUpgrade() {
        mode = 'upgrade'; clearInput();
        overlay('SECTOR SECURED', `第 ${checkpoint.level} 關完成`, '選擇一項本局升級，部署下一道防線。');
        $('start').hidden = true; $('choices').hidden = false; $('status').textContent = '選擇升級'; syncControls();
    }
    function begin() {
        sound.resume(); clearInput();
        game = new Game(checkpoint); mode = 'running';
        renderer.particles = []; renderer.labels = []; renderer.shake = 0; renderer.flash = 0;
        $('overlay').hidden = true; $('pause').textContent = '暫停';
        $('status').textContent = '防守中'; toast = ''; sound.play('defenseStart'); previous = performance.now(); hud(); syncControls();
    }
    function pause(automatic = false) {
        if (mode !== 'running') return;
        mode = 'paused'; clearInput(); $('pause').textContent = '繼續'; $('status').textContent = '已暫停';
        overlay('DEFENSE ON HOLD', '戰線暫停', '時間、飛彈與道具倒數都已停止。'); syncControls();
        if (!automatic) sound.play('pause');
    }
    function resume() {
        if (mode !== 'paused') return;
        mode = 'running'; clearInput(); $('overlay').hidden = true; $('pause').textContent = '暫停'; $('status').textContent = '防守中';
        previous = performance.now(); sound.play('resume'); syncControls();
    }
    function showPaymentOverlay() {
        mode = 'payment-pending'; clearInput();
        overlay('REPLAY RECOVERY', '恢復再來一局', '防線失守後的下一局須由 CashLink 確認解鎖；此頁不會在載入時自動付款。', '恢復付款');
        $('status').textContent = '等待付款'; syncControls();
    }
    async function requestPaid(intent) {
        if (paymentBusy || storageBlocked) return;
        if (consumedCheckpoint) {
            if (saveRecord(consumedCheckpoint, 'paid-ready')) {
                consumedCheckpoint = null; sessionClear(LOSS_BACKUP); sessionClear(PAID_BACKUP); begin();
            }
            return;
        }
        if (replay.state !== 'payment-pending') {
            if (!saveRecord(checkpoint, 'payment-pending', intent, replay.score)) return;
        }
        const pendingIntent = replay.intent; // A cancelled or reloaded order keeps its original chosen start.
        showPaymentOverlay();
        const unlocked = await paymentGate.unlock(() => {
            const next = pendingIntent === 'new' ? fresh() : clone(checkpoint);
            sessionSave(PAID_BACKUP, next);
            if (!saveRecord(next, 'paid-ready')) {
                consumedCheckpoint = next;
                throw { code: 'checkpoint_unavailable' };
            }
            sessionClear(LOSS_BACKUP); sessionClear(PAID_BACKUP);
        });
        if (unlocked) begin();
    }
    function requestStart(intent = 'resume') {
        if (paymentBusy || storageBlocked) return;
        if (mode === 'paused' && intent === 'resume') { resume(); return; }
        if (mode === 'upgrade' && intent !== 'new') return;
        if (replay.state === 'lost' || replay.state === 'payment-pending' || mode === 'lost') {
            void requestPaid(intent === 'new' ? 'new' : 'retry'); return;
        }
        if (mode === 'running' && intent === 'resume') return;
        const next = intent === 'new' || mode === 'won' || !checkpoint ? fresh() : clone(checkpoint);
        if (!saveRecord(next)) return;
        sessionClear(LOSS_BACKUP);
        begin();
    }
    function hud() {
        const level = game?.level || checkpoint?.level || 1;
        $('level').textContent = `${String(level).padStart(2, '0')} / 10`;
        $('score').textContent = String(game?.score ?? checkpoint?.score ?? 0).padStart(6, '0');
        $('best').textContent = String(best).padStart(6, '0');
        $('cities').textContent = `${(game?.cities || checkpoint?.cities || fresh().cities).filter(c => c.hp > 0).length} / 6`;
        $('mission-name').textContent = LEVELS[level - 1].name;
        if (game) {
            const active = Object.entries(game.effects).filter(([, t]) => t > 0).map(([key, t]) => `${names[key]} ${Math.ceil(t)}s`);
            if (game.cities.some(c => c.hp && c.shield)) active.push(names.shield);
            if (game.time < toastUntil) active.push(toast);
            $('effects').textContent = active.join('　·　') || '攔截空中金色道具以啟動強化';
        }
    }
    const audio = { launch: 'defenseLaunch', explosion: 'defenseBlast', chain: 'defenseChain', armor: 'defenseArmor',
        damage: 'defenseDamage', pickup: 'defensePickup', shield: 'defenseShield', alarm: 'defenseAlarm',
        level: 'level', win: 'win', lose: 'lose', bossDeath: 'defenseBoss' };
    function events() {
        for (const e of game.drain()) {
            renderer.event(e); if (audio[e.type]) sound.play(audio[e.type]);
            if (e.type === 'pickup') { toast = `${names[e.power]} 啟動`; toastUntil = game.time + 2; $('live').textContent = toast; }
        }
        if (game.score > best) { best = game.score; save(BEST, String(best)); }
        if (game.state === 'upgrade' && mode === 'running') {
            const next = game.nextCheckpoint();
            if (!saveRecord(next)) { checkpoint = next; $('storage-note').textContent = '無法保存關卡進度；修復瀏覽器儲存後再選擇升級。'; }
            showUpgrade();
        }
        if (game.state === 'lost' && mode === 'running') {
            sessionSave(LOSS_BACKUP, { level: checkpoint.level, score: game.score });
            if (!saveRecord(checkpoint, 'lost', null, game.score)) {
                replay = { state: 'lost', intent: null, score: game.score };
                $('storage-note').textContent = '無法保存失敗狀態；請先恢復瀏覽器儲存，再重試付款。儲存未恢復前請勿關閉分頁。';
            }
            mode = 'lost'; clearInput(); $('status').textContent = '防線失守';
            overlay('SIGNAL LOST', '城市防線失守', `本次 ${game.score} 分。重試本關或新戰役都需先解鎖「再來一局」。`, '再來一局（付費）');
            syncControls();
        }
        if (game.state === 'won' && mode === 'running') {
            mode = 'won'; clearInput(); checkpoint = null; replay = { state: 'open', intent: null, score: 0 }; save(KEY, null);
            sessionClear(LOSS_BACKUP); sessionClear(PAID_BACKUP);
            $('status').textContent = '戰役完成'; overlay('ALL TEN SECTORS SECURED', '天空，重回我們手中', `十關戰役完成！總分 ${game.score}，${game.cities.filter(c => c.hp).length} 座城市存活。`, '開始新戰役（免費）');
            syncControls();
        }
    }
    function loop(now) {
        const dt = Math.min(.05, Math.max(0, (now - previous) / 1000)); previous = now;
        if (mode === 'running') {
            aim.x = Math.max(15, Math.min(W - 15, aim.x + ((keys.has('ArrowRight') ? 1 : 0) - (keys.has('ArrowLeft') ? 1 : 0)) * 450 * dt));
            aim.y = Math.max(35, Math.min(615, aim.y + ((keys.has('ArrowDown') ? 1 : 0) - (keys.has('ArrowUp') ? 1 : 0)) * 450 * dt));
            game.update(dt); events(); hud();
        }
        renderer.draw(game, aim, ['paused', 'ready'].includes(mode) ? 0 : dt); requestAnimationFrame(loop);
    }
    function point(event) {
        const rect = $('game-canvas').getBoundingClientRect();
        aim = { x: Math.max(15, Math.min(W - 15, (event.clientX - rect.left) / rect.width * W)),
            y: Math.max(35, Math.min(615, (event.clientY - rect.top) / rect.height * H)) };
    }
    $('game-canvas').addEventListener('pointerdown', e => {
        if (mode !== 'running' || (e.pointerType === 'mouse' && e.button !== 0)) return;
        e.preventDefault(); if (pressedPointers.has(e.pointerId)) return;
        pressedPointers.add(e.pointerId); sound.resume(); point(e);
        $('game-canvas').setPointerCapture(e.pointerId); $('game-canvas').focus();
        game.fire(aim.x, aim.y);
    });
    $('game-canvas').addEventListener('pointermove', point);
    for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) $('game-canvas').addEventListener(name, e => { pressedPointers.delete(e.pointerId); });
    document.addEventListener('keydown', e => {
        if (e.target instanceof HTMLButtonElement && (e.key.startsWith('Arrow') || e.code === 'Space')) return;
        if (e.key.startsWith('Arrow') || e.code === 'Space') {
            e.preventDefault(); if (mode !== 'running') return;
            sound.resume(); if (e.code === 'Space') {
                if (!e.repeat && !space) { space = true; game.fire(aim.x, aim.y); }
            } else keys.add(e.key);
        }
        if (e.repeat) return;
        if (e.key === 'Escape' || e.key.toLowerCase() === 'p') { if (mode === 'running') pause(); else resume(); }
        if (e.key.toLowerCase() === 'r') { e.preventDefault(); requestStart('retry'); }
    });
    document.addEventListener('keyup', e => { keys.delete(e.key); if (e.code === 'Space') space = false; });
    window.addEventListener('blur', () => { pause(true); clearInput(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) { pause(true); clearInput(); } });
    $('start').addEventListener('click', () => { requestStart('resume'); if (mode === 'running') $('game-canvas').focus(); });
    $('pause').addEventListener('click', () => { if (mode === 'running') pause(); else resume(); });
    $('full-pause').addEventListener('click', () => { if (mode === 'running') pause(); else resume(); });
    $('full-exit').addEventListener('click', () => { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); });
    $('retry').addEventListener('click', () => requestStart('retry'));
    $('new').addEventListener('click', () => {
        if (replay.state !== 'payment-pending' && checkpoint && !confirm('開始新戰役會覆蓋目前的關卡進度，確定從第一關開始？')) return;
        requestStart('new');
    });
    $('payment-retry').addEventListener('click', () => requestStart('retry'));
    $('payment-cancel').addEventListener('click', () => paymentGate.cancel());
    document.querySelectorAll('[data-upgrade]').forEach(button => button.addEventListener('click', () => {
        if (mode !== 'upgrade') return;
        const next = upgrade(checkpoint, button.dataset.upgrade); if (!next) return;
        if (!saveRecord(next)) return;
        sound.play('defenseUpgrade'); begin();
    }));
    $('theme-toggle').addEventListener('click', () => {
        const theme = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
        document.documentElement.dataset.theme = theme; save('casharcade-theme', theme);
    });
    $('preview-sound').addEventListener('click', () => {
        if (sound.isMuted()) sound.toggleMuted(); sound.play('defenseLaunch'); sound.play('defenseBlast', .3);
    });
    $('fullscreen').addEventListener('click', async () => {
        try { if (document.fullscreenElement) await document.exitFullscreen(); else await $('arena').requestFullscreen(); }
        catch { $('storage-note').textContent = '此瀏覽器未提供全螢幕模式，可轉為橫向獲得更大戰場。'; }
    });
    if (storageBlocked) overlay('SAVE UNAVAILABLE', '無法確認存檔', '請保留瀏覽器資料並允許儲存；付款與開局已停止，以免重複付款。', '暫時無法開始');
    else if (replay.state === 'payment-pending') showPaymentOverlay();
    else if (replay.state === 'lost') {
        mode = 'lost'; overlay('SIGNAL LOST', '城市防線失守', `上次 ${replay.score} 分。重試本關或新戰役都需先解鎖「再來一局」。`, '再來一局（付費）');
        $('status').textContent = '防線失守';
    } else if (checkpoint?.phase === 'upgrade') showUpgrade();
    else if (checkpoint) overlay('CAMPAIGN SAVED', `第 ${checkpoint.level} 關等待部署`,
        replay.state === 'paid-ready' ? '「再來一局」已解鎖；從本關起點繼續，不會再次收費。' : '繼續保存的戰役；本關會從起點重新部署。', '繼續戰役');
    game = new Game(checkpoint ? { ...clone(checkpoint), phase: 'stage' } : fresh()); game.drain();
    if (replay.state === 'lost' || replay.state === 'payment-pending') {
        game.score = replay.score; game.cities.forEach(city => { city.hp = 0; city.shield = false; }); game.state = 'lost';
    }
    hud(); syncControls();
    if (consumedCheckpoint) $('payment-status').textContent = '付款額度已消耗，但存檔尚未完成；按「恢復付款」保存並開始本局，不會再次付款。';
    else void paymentGate.initialize();
    requestAnimationFrame(loop);
})();
