(() => {
    'use strict';
    const { W, H, LEVELS, Game, fresh, valid, upgrade, clone } = NeonDefense;
    const $ = id => document.getElementById(id);
    const KEY = 'casharcade-missile-checkpoint', BEST = 'casharcade-missile-high-score';
    const sound = CashArcadeAudio.create({ storageKey: 'casharcade-missile-sound-muted', toggleButton: $('sound-toggle'), outputLevel: .8 });
    const renderer = new NeonDefenseRenderer($('game-canvas'));
    const names = { rapid: '» 急速裝填', wide: '✦ 超載爆破', slow: '◷ 時間緩速', shield: '◇ 城市護盾', emp: 'ϟ 電磁脈衝' };
    let checkpoint = null, game = null, mode = 'ready', best = 0, previous = 0, held = false, space = false;
    let aim = { x: W / 2, y: H / 2 }, keys = new Set(), toast = '', toastUntil = 0;
    function read(key) { try { return localStorage.getItem(key); } catch { return null; } }
    function save(key, value) {
        try { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value); }
        catch { $('storage-note').textContent = '瀏覽器未允許保存資料；目前仍可遊玩與重試，關閉後進度可能無法保留。'; }
    }
    try { const saved = JSON.parse(read(KEY)); if (valid(saved)) checkpoint = saved; else if (saved) $('storage-note').textContent = '先前存檔無法讀取，請開始新戰役。'; } catch { $('storage-note').textContent = '先前存檔無法讀取，請開始新戰役。'; }
    best = Math.max(0, Number(read(BEST)) || 0);
    document.documentElement.dataset.theme = read('casharcade-theme') || 'dark';
    function persist() { if (checkpoint) save(KEY, JSON.stringify(checkpoint)); }
    function clearInput() { held = false; space = false; keys.clear(); }
    function overlay(kicker, title, message, button = '繼續防守') {
        $('overlay').hidden = false; $('overlay-kicker').textContent = kicker; $('overlay-title').textContent = title;
        $('overlay-message').textContent = message; $('start').textContent = button; $('start').hidden = false;
        $('choices').hidden = true; $('live').textContent = title;
    }
    function showUpgrade() {
        mode = 'upgrade'; clearInput();
        overlay('SECTOR SECURED', `第 ${checkpoint.level} 關完成`, '選擇一項本局升級，部署下一道防線。');
        $('start').hidden = true; $('choices').hidden = false; $('pause').disabled = true; $('retry').disabled = true;
        $('status').textContent = '選擇升級';
    }
    function begin() {
        sound.resume(); clearInput();
        if (!checkpoint) checkpoint = fresh();
        if (checkpoint.phase === 'upgrade') { showUpgrade(); return; }
        persist(); game = new Game(checkpoint); mode = 'running';
        renderer.particles = []; renderer.labels = []; renderer.shake = 0; renderer.flash = 0;
        $('overlay').hidden = true; $('pause').disabled = false; $('retry').disabled = false; $('pause').textContent = '暫停';
        $('status').textContent = '防守中'; toast = ''; sound.play('defenseStart'); previous = performance.now(); hud();
    }
    function pause(automatic = false) {
        if (mode !== 'running') return;
        mode = 'paused'; clearInput(); $('pause').textContent = '繼續'; $('status').textContent = '已暫停';
        overlay('DEFENSE ON HOLD', '戰線暫停', '時間、飛彈與道具倒數都已停止。');
        if (!automatic) sound.play('pause');
    }
    function resume() {
        if (mode !== 'paused') return;
        mode = 'running'; clearInput(); $('overlay').hidden = true; $('pause').textContent = '暫停'; $('status').textContent = '防守中';
        previous = performance.now(); sound.play('resume');
    }
    function retry() { if (game && ['running', 'paused', 'lost'].includes(mode)) begin(); }
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
        if (game.state === 'upgrade' && mode === 'running') { checkpoint = game.nextCheckpoint(); persist(); showUpgrade(); }
        if (game.state === 'lost' && mode === 'running') {
            mode = 'lost'; clearInput(); $('pause').disabled = true; $('status').textContent = '防線失守';
            overlay('SIGNAL LOST', '城市防線失守', `本次 ${game.score} 分。重試將還原第 ${game.level} 關起點的城市、分數與升級。`, '重試本關');
        }
        if (game.state === 'won' && mode === 'running') {
            mode = 'won'; clearInput(); checkpoint = null; save(KEY, null); $('pause').disabled = true; $('retry').disabled = true;
            $('status').textContent = '戰役完成'; overlay('ALL TEN SECTORS SECURED', '天空，重回我們手中', `十關戰役完成！總分 ${game.score}，${game.cities.filter(c => c.hp).length} 座城市存活。`, '開始新戰役');
        }
    }
    function loop(now) {
        const dt = Math.min(.05, Math.max(0, (now - previous) / 1000)); previous = now;
        if (mode === 'running') {
            aim.x = Math.max(15, Math.min(W - 15, aim.x + ((keys.has('ArrowRight') ? 1 : 0) - (keys.has('ArrowLeft') ? 1 : 0)) * 450 * dt));
            aim.y = Math.max(35, Math.min(615, aim.y + ((keys.has('ArrowDown') ? 1 : 0) - (keys.has('ArrowUp') ? 1 : 0)) * 450 * dt));
            if (held || space) game.fire(aim.x, aim.y);
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
        e.preventDefault(); sound.resume(); point(e); held = true; $('game-canvas').setPointerCapture(e.pointerId); $('game-canvas').focus();
        game.fire(aim.x, aim.y);
    });
    $('game-canvas').addEventListener('pointermove', point);
    for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) $('game-canvas').addEventListener(name, () => { held = false; });
    document.addEventListener('keydown', e => {
        if (e.target instanceof HTMLButtonElement && (e.key.startsWith('Arrow') || e.code === 'Space')) return;
        if (e.key.startsWith('Arrow') || e.code === 'Space') {
            e.preventDefault(); if (mode !== 'running') return;
            sound.resume(); if (e.code === 'Space') { space = true; if (!e.repeat) game.fire(aim.x, aim.y); } else keys.add(e.key);
        }
        if (e.repeat) return;
        if (e.key === 'Escape' || e.key.toLowerCase() === 'p') { if (mode === 'running') pause(); else resume(); }
        if (e.key.toLowerCase() === 'r') retry();
    });
    document.addEventListener('keyup', e => { keys.delete(e.key); if (e.code === 'Space') space = false; });
    window.addEventListener('blur', () => { pause(true); clearInput(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) { pause(true); clearInput(); } });
    $('start').addEventListener('click', () => { if (mode === 'paused') resume(); else { if (mode === 'won') checkpoint = fresh(); begin(); } $('game-canvas').focus(); });
    $('pause').addEventListener('click', () => { if (mode === 'running') pause(); else resume(); });
    $('full-pause').addEventListener('click', () => { if (mode === 'running') pause(); else resume(); });
    $('full-exit').addEventListener('click', () => { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); });
    $('retry').addEventListener('click', retry);
    $('new').addEventListener('click', () => {
        if (checkpoint && !confirm('開始新戰役會覆蓋目前的關卡進度，確定從第一關開始？')) return;
        checkpoint = fresh(); begin();
    });
    document.querySelectorAll('[data-upgrade]').forEach(button => button.addEventListener('click', () => {
        if (mode !== 'upgrade') return;
        const next = upgrade(checkpoint, button.dataset.upgrade); if (!next) return;
        checkpoint = next; persist(); sound.play('defenseUpgrade'); begin();
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
    if (checkpoint) overlay('CAMPAIGN SAVED', `第 ${checkpoint.level} 關${checkpoint.phase === 'upgrade' ? '已完成' : '等待部署'}`, '繼續保存的戰役；本關會從起點重新部署。', '繼續戰役');
    game = new Game(checkpoint ? { ...clone(checkpoint), phase: 'stage' } : fresh()); game.drain();
    hud(); requestAnimationFrame(loop);
})();
