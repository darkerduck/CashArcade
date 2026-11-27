(() => {
    'use strict';
    const $ = id => document.getElementById(id);
    const { levels, sectors } = AuroraRoutes;
    const { Game, STEP } = AuroraSprint;
    const { prefix, create } = AuroraStorage;
    const store = create(), canvas = $('road'), overlay = $('overlay'), dialog = $('routes-dialog'), machine = $('machine');
    const renderer = new AuroraRenderer.Renderer(canvas);
    const sound = CashArcadeAudio.create({ storageKey: prefix + '-sound-muted', toggleButton: $('sound-toggle'),
        outputLevel: .57, musicMix: true });
    const roadSound = AuroraSound.createRoadSound(sound.musicOutput);
    const music = CashArcadeMusic.create({ toggleButton: $('music-toggle'), volumeInput: $('music-volume'),
        volumeLabel: $('music-volume-value'), trackLabel: $('music-track'), score: AuroraScore,
        storagePrefix: prefix, audioOutput: sound.musicOutput, initialLevel: store.state.selected });
    const reduced = matchMedia('(prefers-reduced-motion: reduce)'), coarse = matchMedia('(pointer: coarse)');
    let game = new Game(store.state.selected), view = 'ready', theme = 'dark', dirty = true;
    let last, accumulator = 0, hudTime = 0, lastPaint = 0, finalMix = false, braking = false;
    const controls = [...document.querySelectorAll('[data-drive]')];
    const awake = () => { sound.resume(); music.wake(); };
    const live = () => view === 'running' && !dialog.open;
    const input = AuroraInput.create({ buttons: controls, enabled: live, pause, retry, wake: awake });
    try { if (localStorage.getItem('casharcade-theme') === 'light') theme = 'light'; } catch { /* Optional setting. */ }
    function text(id, value) {
        const el = $(id);
        if (el.textContent !== String(value)) el.textContent = value;
    }
    function syncTheme() {
        document.documentElement.dataset.theme = theme;
        $('theme-toggle').setAttribute('aria-pressed', String(theme === 'light'));
        dirty = true;
    }
    function hud() {
        const level = game.level;
        text('stage', String(level.id).padStart(2, '0') + ' / 09');
        text('sector', sectors[level.sector].name);
        text('mission', level.name);
        text('hint', level.description);
        text('time', game.timeLeft.toFixed(1));
        $('time').classList.toggle('urgent', game.timeLeft < 14);
        text('distance', ((level.length - game.distance) / 1000).toFixed(2));
        text('speed', Math.round(game.speed * 3.6));
        const nitro = Math.round(game.nitro * 100), meter = $('nitro-meter');
        meter.setAttribute('aria-valuenow', String(nitro));
        $('nitro-fill').style.width = nitro + '%';
        text('nitro-value', nitro + '%');
        text('result', '超車 ' + game.passes + ' · 碰撞 ' + game.hits + ' · ' + game.score.toLocaleString('zh-TW') + ' 分');
        const best = store.state.best[level.id];
        text('best', best ? '最快 ' + (best.ms / 1000).toFixed(2) + ' 秒 · 最高 ' + best.score.toLocaleString('zh-TW') + ' 分' : '尚無完賽紀錄');
        text('save-note', store.unavailable ? '瀏覽器儲存無法使用，當頁仍可遊玩。重載後可能無法保留紀錄。' : '');
    }
    function screen(title, body, button) {
        overlay.hidden = false;
        text('overlay-title', title); text('overlay-message', body); text('launch', button);
    }
    function show() {
        hud();
        dirty = true;
        for (const control of controls) control.disabled = view !== 'running';
        $('pause').disabled = !['running', 'paused'].includes(view);
        $('retry').disabled = view === 'ready';
        text('pause', view === 'paused' ? '繼續' : '暫停');
        const level = game.level;
        if (view === 'ready') screen(level.name, (level.length / 1000).toFixed(2) + ' km · ' + level.limit + ' 秒。' + level.description, '開始第 ' + level.id + ' 關');
        else if (view === 'paused') screen('賽事暫停', '倒數已停止。繼續時需要重新按住方向或踏板。', '繼續');
        else if (view === 'won') screen(level.id === 9 ? '九條公路全部完賽' : '抵達終點',
            '用時 ' + game.time.toFixed(2) + ' 秒 · 超車 ' + game.passes + ' 台 · 剩餘 ' + game.timeLeft.toFixed(1) + ' 秒',
            level.id === 9 ? '選擇關卡' : '下一關');
        else if (view === 'lost') screen('時間到', '距離終點還有 ' + Math.ceil(level.length - game.distance) + ' 公尺。', '免費重試');
        else overlay.hidden = true;
    }
    function stop() {
        input.clear(); music.pause(); roadSound.stop();
        accumulator = 0;
    }
    function load(level, start = false) {
        if (!store.select(level)) return;
        stop();
        game = new Game(level);
        view = 'ready';
        finalMix = braking = false;
        text('status', '等待出發');
        if (start) {
            game.start();
            view = 'running';
            sound.resume();
            music.start(level, 0);
            text('status', '注意車流與路障');
        }
        show();
        if (start) {
            canvas.scrollIntoView({ block: 'nearest', inline: 'nearest' });
            canvas.focus({ preventScroll: true });
        }
    }
    function pause() {
        if (dialog.open) return;
        if (view === 'running') {
            view = 'paused'; stop();
        } else if (view === 'paused') {
            view = 'running'; input.clear(); sound.resume(); music.resume();
            canvas.focus({ preventScroll: true });
        } else return;
        show();
    }
    function retry() { if (!dialog.open && view !== 'ready') load(game.level.id, true); }
    function showRoutes() {
        if (dialog.open) return;
        if (view === 'running') pause();
        const list = $('route-list');
        list.replaceChildren();
        for (const [i, sector] of sectors.entries()) {
            const title = document.createElement('h3'), group = document.createElement('div');
            title.textContent = sector.name;
            group.className = 'route-group';
            for (const level of levels.slice(i * 3, i * 3 + 3)) {
                const button = document.createElement('button'), info = document.createElement('small');
                button.type = 'button';
                button.textContent = level.id + ' · ' + level.name;
                button.disabled = level.id > store.state.unlocked;
                info.textContent = button.disabled ? '尚未解鎖' : store.state.best[level.id] ? '已完賽' : '可遊玩';
                button.append(info);
                button.addEventListener('click', () => { dialog.close(); load(level.id); });
                group.append(button);
            }
            list.append(title, group);
        }
        dialog.showModal();
    }
    $('routes').addEventListener('click', showRoutes);
    $('close-routes').addEventListener('click', () => dialog.close());
    $('pause').addEventListener('click', pause);
    $('retry').addEventListener('click', retry);
    $('launch').addEventListener('click', () => {
        if (view === 'paused') pause();
        else if (view === 'won') {
            if (game.level.id < 9) load(game.level.id + 1);
            else showRoutes();
        } else if (view === 'ready' || view === 'lost') load(game.level.id, true);
    });
    $('theme-toggle').addEventListener('click', () => {
        theme = theme === 'dark' ? 'light' : 'dark';
        try { localStorage.setItem('casharcade-theme', theme); } catch { /* Keep the page usable. */ }
        syncTheme();
    });
    function expanded() { return document.fullscreenElement === machine || machine.classList.contains('fullscreen-fallback'); }
    function markFullscreen() {
        text('fullscreen', expanded() ? '離開全螢幕' : '全螢幕');
        $('fullscreen').setAttribute('aria-pressed', String(expanded()));
        input.clear(); dirty = true;
    }
    $('fullscreen').addEventListener('click', async () => {
        if (machine.classList.contains('fullscreen-fallback')) {
            machine.classList.remove('fullscreen-fallback');
            document.body.classList.remove('aurora-expanded');
            markFullscreen();
        } else if (document.fullscreenElement === machine) {
            await document.exitFullscreen();
        } else {
            try { await machine.requestFullscreen(); }
            catch {
                machine.classList.add('fullscreen-fallback');
                document.body.classList.add('aurora-expanded');
                markFullscreen();
            }
        }
    });
    document.addEventListener('fullscreenchange', markFullscreen);
    $('preview-sound').addEventListener('click', () => { sound.play('auroraBoost'); sound.play('auroraPass', .43); });
    $('sound-toggle').addEventListener('click', () => { if (sound.isMuted()) roadSound.stop(); else if (live()) roadSound.sync(game); });
    function autoPause() { if (view === 'running') pause(); else input.clear(); }
    window.addEventListener('blur', autoPause);
    document.addEventListener('visibilitychange', () => { if (document.hidden) autoPause(); });
    reduced.addEventListener('change', () => { dirty = true; });
    window.addEventListener('resize', () => { input.clear(); dirty = true; });

    function consume() {
        for (const event of game.drain()) {
            renderer.event?.(event, game);
            const effect = AuroraSound.effects[event.type];
            if (effect) sound.play(effect);
            if (event.type === 'pass') text('status', event.close ? '近距超車 · 氮氣補充' : '乾淨超車 · 氮氣補充');
            if (event.type === 'cell') text('status', '拾取氮氣補給');
            if (event.type === 'boost') text('status', '氮氣加速');
            if (event.type === 'hit') { text('status', '碰撞減速 · 倒數持續'); music.duck(); }
            if (event.type === 'tunnel') text('status', '進入隧道');
            if (event.type === 'won') {
                store.finish(game.level.id, Math.round(game.time * 1000), game.score, game.passes);
                text('status', '完賽成績已結算');
            }
            if (event.type === 'lost') text('status', '倒數結束');
        }
    }
    function frame(now) {
        const dt = last === undefined ? 0 : Math.max(0, Math.min(.05, (now - last) / 1000));
        last = now;
        if (view === 'running') {
            accumulator += dt * (renderer.timeScale?.() ?? 1);
            const action = input.value();
            if (action.brake && !braking && game.speed > 19) sound.play('auroraBrake');
            braking = action.brake;
            while (accumulator >= STEP && game.mode === 'running') {
                game.update(STEP, action);
                accumulator -= STEP;
            }
            consume();
            if (!finalMix && (game.distance / game.level.length > .83 || game.timeLeft < 14)) {
                finalMix = true; music.phase('final');
            }
            hudTime += dt;
            if (hudTime >= .10) {
                hudTime = 0; hud();
                if (!sound.isMuted()) roadSound.sync(game);
            }
            if (game.mode !== 'running') { view = game.mode; stop(); show(); }
        }
        if (dirty || ((view === 'running' || renderer.busy) && now - lastPaint >= (coarse.matches ? 30 : 15))) {
            renderer.draw(game, { theme, reduced: reduced.matches }); globalThis.CashArcadeNeon?.apply(canvas,{theme,strength:1});
            dirty = false; lastPaint = now;
        }
        requestAnimationFrame(frame);
    }
    syncTheme(); show(); requestAnimationFrame(frame);
})();
