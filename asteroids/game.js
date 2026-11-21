(() => {
    'use strict';
    const $ = id => document.getElementById(id);
    const { Game, STEP, training } = NeonAsteroids;
    const { prefix, fresh, create } = NeonAsteroidsStorage;
    const { levels, sectors } = NeonAsteroidsData;
    const store = create(), canvas = $('game-canvas'), overlay = $('overlay'), machine = $('machine');
    const saved = store.load();
    const newSeed = () => globalThis.crypto?.getRandomValues(new Uint32Array(1))[0] ?? Date.now() >>> 0;
    let checkpoint = saved, seen = store.tutorialSeen(), best = store.best();
    let game = new Game(checkpoint ?? fresh(newSeed()));
    let view = 'ready', previousView = null, dirty = true, accumulator = 0, lastTime, hudElapsed = 0, aftermath = 0;
    let pendingNew = false;

    const reduce = matchMedia('(prefers-reduced-motion: reduce)');
    const renderer = new NeonAsteroidsRenderer(canvas);
    renderer.reduced = reduce.matches;
    reduce.addEventListener('change', () => { renderer.reduced = reduce.matches; dirty = true; });
    const audio = CashArcadeAudio.create({ storageKey: prefix + '-sound-muted', toggleButton: $('sound-toggle'),
        outputLevel: 0.58, musicMix: true });
    const thrust = StarshardSound.createThrust(audio.musicOutput);
    const music = CashArcadeMusic.create({ toggleButton: $('music-toggle'), volumeInput: $('music-volume'),
        volumeLabel: $('music-volume-value'), trackLabel: $('music-track'), score: StarshardScore,
        storagePrefix: prefix, audioOutput: audio.musicOutput, initialLevel: game.level });
    const active = () => view === 'running';
    const wake = () => { audio.resume(); music.wake(); };
    const input = StarshardInput.create({ buttons: [...document.querySelectorAll('[data-action]')],
        active, pause, retry, wake, changed: ({ thrust: held }) => thrust.update(held && active() && !audio.isMuted()) });
    $('sound-toggle').addEventListener('click', () => thrust.update(input.value().thrust && active() && !audio.isMuted()));

    const names = { pulse: '脈衝主砲', spread: '散射砲', laser: '穿透雷射' };
    function setText(id, value) {
        const element = $(id);
        if (element.textContent !== String(value)) element.textContent = value;
    }
    function notice() {
        setText('storage-note', store.unavailable ? '無法使用瀏覽器儲存。這個分頁仍可遊玩及重試，重載後可能無法恢復。' : '');
    }
    function renderHud() {
        const p = game.player, format = n => String(n).padStart(6, '0');
        setText('score', format(game.practice ? 0 : game.score));
        setText('best', format(best));
        setText('hull', p.hull + ' / 3');
        setText('speed', Math.round(Math.hypot(p.vx, p.vy)) + ' px/s');
        setText('weapon', names[p.weapon] + (p.weapon === 'pulse' ? '' : ' Lv.' + p[p.weapon]));
        setText('gear', '護盾 ' + (p.shield ? '●' : '—') + ' · 護航 ' + p.escorts);
        setText('sector', game.practice ? '飛行訓練' : sectors[game.data.sector]);
        setText('mission', game.practice ? '操作練習' : game.data.name);
        setText('level', game.practice ? Math.min(game.lesson + 1, training.length) + ' / ' + training.length :
            String(game.level).padStart(2, '0') + ' / 09');
        setText('status', game.practice ? '轉向、推進、漂移與射擊' : game.data.goal);
        let objective = '等待部署';
        if (game.practice) objective = training[game.lesson] ?? '練習完成';
        else if (game.boss) {
            const guards = game.boss.parts.filter(part => part.role === 'guard' && !part.dead).length;
            const weapons = game.boss.parts.filter(part => part.role === 'weapon' && !part.dead).length;
            objective = guards ? '編隊護衛 ' + guards : weapons ? '外側武裝 ' + weapons :
                '核心 ' + Math.ceil(Math.max(0, game.boss.core.hp) / game.boss.core.maxHp * 100) + '%' + (game.overload ? ' · 過載' : '');
        } else if (game.data.boss && game.time >= 2.8) objective = '請離開旗艦部署區';
        else if (!game.data.boss) {
            const pending = game.data.groups.length - game.group;
            objective = '場上目標 ' + (game.enemies.length + game.warnings.length) + ' · 待部署 ' + pending + ' 批';
        }
        setText('objective', objective);
        $('flight-tip').hidden = !(game.practice && active() && game.mode === 'running');
        setText('flight-tip', training[game.lesson] ?? '');
    }
    function screen(title, message, action, secondary = '') {
        setText('overlay-title', title);
        setText('overlay-message', message);
        setText('start', action);
        setText('skip', secondary);
        $('skip').hidden = !secondary;
        overlay.hidden = false;
    }
    function show() {
        renderHud();
        $('pause').disabled = !(active() || view === 'paused' || view === 'aftermath');
        $('pause').textContent = view === 'paused' ? '繼續' : '暫停';
        $('retry').disabled = !['running', 'paused', 'lost'].includes(view) || game.mode === 'won' || game.mode === 'clear';
        $('retry').textContent = game.practice ? '重試練習' : '重試本關';
        $('practice').disabled = active() || view === 'aftermath';
        $('new').disabled = view === 'aftermath';
        if (view === 'running' || view === 'aftermath') overlay.hidden = true;
        else if (view === 'paused') screen('飛行暫停', '繼續後按鍵才會重新生效。', '繼續飛行', game.practice ? '離開練習' : '');
        else if (view === 'lost') screen(game.failure === 'hole' ? '飛船被黑洞吞噬' : '船體已損毀',
            '重試將還原本關起點的船體、武器與分數。', '免費重試本關');
        else if (view === 'clear') screen(game.data.name + ' · 完成',
            '分數 ' + game.score + '。修復一格船體，下一關是「' + levels[checkpoint.level - 1].name + '」。', '部署下一關');
        else if (view === 'won') screen('九關戰役完成',
            '分數 ' + game.score + ' · 戰鬥時間 ' + Math.floor((game.origin.elapsed + game.time) / 60) + ' 分 ' +
            Math.floor((game.origin.elapsed + game.time) % 60) + ' 秒', '開始新戰役');
        else if (view === 'trained') screen('飛行練習完成', '接下來可帶著同一套操作進入戰役。', checkpoint ? '返回戰役' : '開始戰役');
        else if (view === 'confirm') screen('開始新戰役？', '新戰役會取代目前的關卡存檔。', '確認開始', '返回');
        else if (checkpoint) screen('戰役待命', '從第 ' + checkpoint.level + ' 關「' + levels[checkpoint.level - 1].name +
            '」的起點繼續。', '繼續戰役');
        else if (seen) screen('準備起飛', '旋轉船頭、推進與開火。放開推進後，飛船仍會漂移。', '開始戰役');
        else screen('準備起飛', '透過五個短步驟掌握慣性飛行。', '開始飛行練習', '跳過練習');
        notice();
        dirty = true;
    }
    function stop() {
        view = 'ready';
        input.clear();
        thrust.update(false);
        music.pause();
        accumulator = 0;
    }
    function start(next, practice = false) {
        stop();
        game = new Game(next, { practice });
        renderer.reset();
        if (!practice) {
            checkpoint = game.checkpoint();
            store.save(checkpoint);
        }
        view = 'running';
        show();
        canvas.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        canvas.focus({ preventScroll: true });
        wake();
        if (!practice) music.start(game.level, 0);
    }
    function beginPractice() { start(fresh(17), true); }
    function finishPractice() {
        seen = true;
        store.finishTutorial();
    }
    function leavePractice() {
        finishPractice();
        stop();
        game = new Game(checkpoint ?? fresh(newSeed()));
        renderer.reset();
        show();
    }
    function finishRun() {
        const result = game.mode;
        stop();
        if (result === 'trained') finishPractice();
        if (result === 'clear') {
            checkpoint = game.nextCheckpoint();
            store.save(checkpoint);
        }
        if (result === 'won') {
            checkpoint = null;
            store.clear();
        }
        aftermath = result === 'trained' ? 0 : reduce.matches ? 0.25 : game.boss ? 1.1 : 0.55;
        view = aftermath > 0 ? 'aftermath' : result;
        show();
    }
    function pause() {
        if (view === 'paused') {
            view = previousView;
            input.clear();
            accumulator = 0;
            show();
            canvas.focus({ preventScroll: true });
            if (active() && !game.practice) { audio.resume(); music.resume(); }
        } else if (active() || view === 'aftermath') {
            previousView = view;
            stop();
            view = 'paused';
            show();
        }
    }
    function retry() {
        if (!['running', 'paused', 'lost'].includes(view) || ['clear', 'won', 'trained'].includes(game.mode)) return;
        start(game.checkpoint(), game.practice);
    }
    function newCampaign() { start(fresh(newSeed())); }
    $('start').addEventListener('click', () => {
        if (view === 'paused') pause();
        else if (view === 'lost') retry();
        else if (view === 'confirm' || view === 'won') { pendingNew = false; finishPractice(); newCampaign(); }
        else if (view === 'clear' || view === 'trained' || view === 'ready') {
            if (checkpoint) start(checkpoint);
            else if (seen) newCampaign();
            else beginPractice();
        }
    });
    $('new').addEventListener('click', () => {
        if (pendingNew || view === 'aftermath') return;
        if (!checkpoint && !game.practice) { finishPractice(); newCampaign(); return; }
        if (active()) pause();
        const returnTo = view;
        pendingNew = returnTo;
        view = 'confirm';
        show();
    });
    $('skip').addEventListener('click', () => {
        if (view === 'confirm') { view = pendingNew; pendingNew = false; show(); }
        else if (view === 'paused' && game.practice) leavePractice();
        else if (view === 'ready') { finishPractice(); newCampaign(); }
    });
    $('practice').addEventListener('click', () => {
        if (!active() && view !== 'confirm' && view !== 'aftermath') beginPractice();
    });
    $('pause').addEventListener('click', pause);
    $('retry').addEventListener('click', retry);
    const autoPause = () => { if (active() || view === 'aftermath') pause(); else input.clear(); };
    window.addEventListener('blur', autoPause);
    document.addEventListener('visibilitychange', () => { if (document.hidden) autoPause(); });

    let theme = 'dark';
    try { if (localStorage.getItem('casharcade-theme') === 'light') theme = 'light'; }
    catch { /* Theme preference is optional. */ }
    function displayTheme() {
        document.documentElement.dataset.theme = theme;
        $('theme-toggle').setAttribute('aria-pressed', String(theme === 'light'));
        dirty = true;
    }
    $('theme-toggle').addEventListener('click', () => {
        theme = theme === 'dark' ? 'light' : 'dark';
        try { localStorage.setItem('casharcade-theme', theme); } catch { /* Keep the current theme. */ }
        displayTheme();
    });
    function fullscreenLabel() {
        const expanded = document.fullscreenElement === machine || machine.classList.contains('fullscreen-fallback');
        setText('fullscreen', expanded ? '離開全螢幕' : '全螢幕');
        $('fullscreen').setAttribute('aria-pressed', String(expanded));
        dirty = true;
    }
    $('fullscreen').addEventListener('click', async () => {
        if (machine.classList.contains('fullscreen-fallback')) {
            machine.classList.remove('fullscreen-fallback');
            document.body.classList.remove('machine-expanded');
            fullscreenLabel();
            return;
        }
        try {
            if (document.fullscreenElement === machine) await document.exitFullscreen();
            else await machine.requestFullscreen();
        } catch {
            machine.classList.add('fullscreen-fallback');
            document.body.classList.add('machine-expanded');
            fullscreenLabel();
        }
    });
    document.addEventListener('fullscreenchange', fullscreenLabel);
    $('preview-sound').addEventListener('click', () => {
        audio.resume();
        audio.play('starPulse');
        audio.play('starRock', 0.20);
    });
    function consume() {
        const events = game.drain();
        renderer.consume(events);
        for (const event of events) {
            const sound = event.type === 'fire' ? StarshardSound.weapons[event.weapon] : StarshardSound.effects[event.type];
            if (sound) audio.play(sound);
            if (event.type === 'overload') music.phase('overload');
            if (event.type === 'hurt' || event.type === 'bossDown') music.duck();
        }
        if (!game.practice && game.score > best) {
            best = game.score;
            store.saveBest(best);
            notice();
        }
    }
    function frame(now) {
        const dt = lastTime === undefined ? 0 : Math.min(0.05, Math.max(0, (now - lastTime) / 1000));
        lastTime = now;
        if (active()) {
            accumulator += dt;
            const actions = input.value();
            while (accumulator >= STEP && game.mode === 'running') {
                game.update(STEP, actions);
                accumulator -= STEP;
            }
            renderer.update(dt);
            consume();
            hudElapsed += dt;
            if (hudElapsed >= 0.10) { renderHud(); hudElapsed = 0; }
            dirty = true;
            if (game.mode !== 'running') finishRun();
        } else if (view === 'aftermath') {
            renderer.update(dt);
            aftermath -= dt;
            if (aftermath <= 0) { view = game.mode; show(); }
            dirty = true;
        }
        if (dirty) { renderer.draw(game, theme); dirty = false; }
        requestAnimationFrame(frame);
    }
    displayTheme();
    show();
    requestAnimationFrame(frame);
})();
