(() => {
    'use strict';
    const $ = id => document.getElementById(id), { Game, LEVELS } = GravityCourier;
    const storage = GravityCourierStorage.create(), settings = storage.load();
    let game = new Game(settings.selected), renderer = new GravityCourierRenderer.Renderer($('game-canvas'));
    const sound = CashArcadeAudio.create({ storageKey: 'casharcade-gravity-sound-muted', toggleButton: $('sound-toggle'), outputLevel: .7, musicMix: true });
    const music = CashArcadeMusic.create({ score: CashArcadeExpansionScores.gravity, storagePrefix: 'casharcade-gravity-music',
        toggleButton: $('music-toggle'), volumeInput: $('music-volume'), volumeLabel: $('music-volume-value'), trackLabel: $('music-track'), audioOutput: sound.musicOutput, initialLevel: settings.selected + 1 });
    const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
    let theme = 'dark', previous = 0, lastRender = 0, lastHud = 0, renderKey = '', reported = false, activePointer = null;
    try { theme = localStorage.getItem('casharcade-theme') === 'light' ? 'light' : 'dark'; } catch { /* Local theme remains usable. */ }
    document.documentElement.dataset.theme = theme;
    function save() { if (!storage.save(settings)) $('storage-note').textContent = '瀏覽器無法儲存；本頁仍可免費遊玩，關閉後可能失去紀錄。'; }
    if (!storage.available) $('storage-note').textContent = '瀏覽器儲存不可用；紀錄暫時只保留在本頁。';
    function clearInput() { activePointer = null; $('flip').classList.remove('active'); }
    function wakeAudio() { sound.resume(); music.wake(); }
    function stars(n) { return '★'.repeat(n) + '☆'.repeat(3 - n); }
    function overlay(kicker, title, message, button, hint) {
        $('overlay').hidden = false; $('overlay').dataset.state = game.state; $('overlay-kicker').textContent = kicker; $('overlay-title').textContent = title;
        $('overlay-message').textContent = message; $('start').textContent = button; $('overlay-hint').textContent = hint;
        $('result-stars').hidden = game.state !== 'delivered'; $('live').textContent = title;
    }
    function sync() {
        $('pause').disabled = !['running', 'paused'].includes(game.state); $('pause').textContent = game.state === 'paused' ? '繼續' : '暫停';
        $('flip').disabled = game.state !== 'running'; $('gravity-arrow').textContent = game.player.gravity > 0 ? '↓' : '↑';
        $('level').innerHTML = String(game.levelIndex + 1).padStart(2, '0') + ' <em>/ 10</em>';
        $('time').textContent = game.time.toFixed(2); $('shards').innerHTML = game.collected.length + ' <em>/ 3</em>';
        $('core').textContent = game.state === 'delivered' ? '已送達' : game.state === 'lost' ? '訊號中斷' : '運送中';
        $('goal').textContent = '限時目標 ' + game.level.goal.toFixed(2) + 's';
        $('progress-fill').style.width = game.progress * 100 + '%'; $('progress').setAttribute('aria-valuenow', Math.floor(game.progress * 100));
        $('status').textContent = game.state === 'running' ? game.boost > 0 ? '碎片加速！提早準備下一次翻轉。' : '核心安全 · ' + (game.player.gravity > 0 ? '重力向下 ↓' : '重力向上 ↑') : game.state === 'paused' ? '配送已暫停，核心安全。' : game.state === 'lost' ? '免費重試，重新找回節奏。' : game.state === 'delivered' ? '城市又多了一束光。' : '核心已裝載，等待出發。';
    }
    function levelMenu() {
        $('levels').replaceChildren();
        LEVELS.forEach((level, i) => {
            const button = document.createElement('button'), record = settings.records[i]; button.type = 'button'; button.className = 'level-button';
            button.disabled = i >= settings.unlocked; button.setAttribute('aria-pressed', String(i === settings.selected));
            button.setAttribute('aria-label', '第 ' + (i + 1) + ' 關 ' + level.name + (button.disabled ? '，完成前一關解鎖' : '，' + record.stars + ' 顆星'));
            button.innerHTML = String(i + 1).padStart(2, '0') + '<small>' + (button.disabled ? '鎖定' : stars(record.stars)) + '</small>';
            button.addEventListener('click', () => ready(i)); $('levels').append(button);
        });
        const record = settings.records[settings.selected]; $('mission-title').textContent = String(settings.selected + 1).padStart(2, '0') + ' / ' + game.level.name;
        $('mission-tip').textContent = game.level.tip; $('best-stars').textContent = stars(record.stars);
        $('best-time').textContent = record.best === null ? '—' : record.best.toFixed(2) + 's';
        $('total-stars').textContent = settings.records.reduce((sum, r) => sum + r.stars, 0) + ' / 30 ★';
    }
    function ready(index = settings.selected) {
        if (index < 0 || index >= settings.unlocked) return;
        music.pause(); clearInput(); settings.selected = index; game = new Game(index); renderer.effects = []; reported = false; previous = 0;
        save(); levelMenu(); sync();
        overlay('ROUTE ' + String(index + 1).padStart(2, '0') + ' / ' + game.level.zone.split(' / ')[0], index === 0 ? '把城市的光，送到另一邊。' : game.level.name, game.level.tip, '開始配送 →', 'Space 或輕點翻轉 · 十條路線 · 免費重試');
        renderKey = '';
    }
    function begin() {
        wakeAudio(); clearInput(); previous = 0;
        if (game.state === 'paused') { game.resume(); music.resume(); }
        else {
            if (game.state === 'delivered' && game.levelIndex < LEVELS.length - 1) { settings.selected++; game = new Game(settings.selected); save(); levelMenu(); }
            else if (game.state !== 'ready') game = new Game(settings.selected);
            renderer.effects = []; game.start(); reported = false; music.start(game.levelIndex + 1);
        }
        $('overlay').hidden = true; sync(); $('game-canvas').focus({ preventScroll: true });
    }
    function retry() { music.pause(); clearInput(); game = new Game(settings.selected); renderer.effects = []; reported = false; begin(); }
    function pause() {
        if (game.state === 'running') { game.pause(); music.pause(); clearInput(); sync();
            overlay('DELIVERY ON HOLD', '這束光，等你回來。', '時間和機關都已停止。準備好後，繼續這趟配送。', '繼續配送 →', 'P / Esc 或點擊繼續'); }
        else if (game.state === 'paused') begin();
    }
    function flip() { if (game.state === 'running') { wakeAudio(); game.flip(); sync(); } }
    $('start').addEventListener('click', begin); $('pause').addEventListener('click', pause); $('retry').addEventListener('click', retry);
    for (const id of ['flip', 'game-canvas']) {
        const el = $(id);
        el.addEventListener('pointerdown', event => { if (game.state !== 'running' || activePointer !== null || event.button > 0) return;
            event.preventDefault(); activePointer = event.pointerId; el.setPointerCapture(event.pointerId); $('flip').classList.add('active'); flip(); });
        const release = event => { if (event.pointerId === activePointer) clearInput(); };
        el.addEventListener('pointerup', release); el.addEventListener('pointercancel', release); el.addEventListener('lostpointercapture', release);
        el.addEventListener('contextmenu', event => event.preventDefault());
    }
    $('flip').addEventListener('click', event => { if (event.detail === 0) flip(); });
    document.addEventListener('keydown', event => {
        if (event.target.matches('input,select,textarea') || ((event.code === 'Space' || event.code === 'Enter') && event.target.closest('button,a'))) return;
        if (event.code === 'Space') { event.preventDefault(); if (!event.repeat) { if (game.state === 'running') flip(); else begin(); } }
        if (!event.repeat && ['KeyP', 'Escape'].includes(event.code)) { event.preventDefault(); pause(); }
        if (!event.repeat && event.code === 'KeyR') { event.preventDefault(); retry(); }
    });
    window.addEventListener('blur', () => { if (game.state === 'running') pause(); clearInput(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden && game.state === 'running') pause(); clearInput(); previous = 0; });
    window.addEventListener('pagehide', () => { if (game.state === 'running') pause(); music.pause(); save(); });
    $('motion').checked = settings.reducedMotion; $('motion').addEventListener('change', () => { settings.reducedMotion = $('motion').checked; save(); renderKey = ''; });
    $('theme-toggle').addEventListener('click', () => { theme = theme === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = theme; try { localStorage.setItem('casharcade-theme', theme); } catch { /* Current page still changes. */ } renderKey = ''; });
    $('fullscreen').addEventListener('click', async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.querySelector('.machine').requestFullscreen(); } catch { $('live').textContent = '這個瀏覽器不支援全螢幕；仍可在頁面繼續遊玩。'; } });
    document.addEventListener('fullscreenchange', () => { $('fullscreen').textContent = document.fullscreenElement ? '離開全螢幕' : '全螢幕'; renderKey = ''; });
    function finished() {
        reported = true; clearInput(); music.pause();
        if (game.state === 'delivered') {
            GravityCourierStorage.complete(settings, game.levelIndex, game); save(); levelMenu(); $('result-stars').textContent = stars(game.stars);
            overlay(game.levelIndex === 9 ? 'ALL ROUTES DELIVERED' : 'DELIVERY COMPLETE', game.levelIndex === 9 ? '天亮了，城市收到了光。' : '已簽收，謝謝你的光。',
                game.time.toFixed(2) + ' 秒 · ' + game.collected.length + ' / 3 碎片 · ' + game.flips + ' 次翻轉。' + (game.stars === 3 ? '完美三星配送！' : '重跑路線，挑戰更快、更完整的配送。'),
                game.levelIndex === 9 ? '再跑最後一趟 →' : '下一條路線 →', game.levelIndex === 9 ? '十條路線都已解鎖，可隨時回去補滿星章。' : '新路線已解鎖 · R 重跑本關');
        } else overlay('SIGNAL LOST', '再翻一次，就能更靠近。', game.deathReason === 'laser' ? '紅色光束正在通電。留意金色預警，或提早翻到另一側。' : '碰到尖刺了。試著更早翻轉重力，留一點時間飛向另一側。', '免費重試 →', '每次重試，所有機關都從相同節奏開始。');
        sync();
    }
    const effects = { start: 'start', flip: 'breakoutSwitch', shard: 'defensePickup', pause: 'pause', resume: 'resume', death: 'lose', delivery: 'win' };
    function frame(now) {
        const dt = previous ? Math.min((now - previous) / 1000, .05) : 0; previous = now; game.update(dt);
        for (const event of game.drain()) { sound.play(effects[event.type] || 'confirm'); renderer.event(event, game.time); if (event.type === 'shard') $('live').textContent = '取得能量碎片 ' + game.collected.length + ' / 3，短暫加速。'; }
        if (['delivered', 'lost'].includes(game.state) && !reported) finished();
        const reducedMotion = settings.reducedMotion || motionQuery.matches;
        const nextKey = [game.levelIndex, game.state, theme, reducedMotion, innerWidth, innerHeight, Boolean(document.fullscreenElement)].join(':');
        if ((game.state === 'running' && now - lastRender >= 1000 / 30) || nextKey !== renderKey) { renderer.render(game, { theme, reducedMotion }); lastRender = now; renderKey = nextKey; }
        if (now - lastHud >= 80) { sync(); lastHud = now; }
        requestAnimationFrame(frame);
    }
    // Read-only diagnostics for accessibility tooling and deterministic browser QA.
    globalThis.GravityCourierApp = Object.freeze({ snapshot: () => ({ state: game.state, level: game.levelIndex, x: game.player.x, y: game.player.y,
        time: game.time, gravity: game.player.gravity, flips: game.flips, shards: [...game.collected], stars: game.stars, unlocked: settings.unlocked }) });
    levelMenu(); sync(); requestAnimationFrame(frame);
})();
