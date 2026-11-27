(() => {
    'use strict';
    const $ = id => document.getElementById(id);
    const { levels, colors, sectors, tools } = LightbubbleLevels;
    const { prefix, create } = LightbubbleStorage;
    const store = create(), board = $('board'), overlay = $('overlay'), dialog = $('level-dialog');
    const renderer = new LightbubbleRenderer.Renderer(board);
    const sound = CashArcadeAudio.create({ storageKey: prefix + '-sound-muted', toggleButton: $('sound-toggle'),
        outputLevel: .58, musicMix: true });
    const music = CashArcadeMusic.create({ toggleButton: $('music-toggle'), trackLabel: $('music-track'),
        volumeInput: $('music-volume'), volumeLabel: $('music-volume-value'), score: LightbubbleScore,
        storagePrefix: prefix, audioOutput: sound.musicOutput, initialLevel: store.state.last });
    const effects = Object.freeze({ launch: 'bubbleLaunch', bounce: 'bubbleBounce', attach: 'bubbleAttach',
        pop: 'bubblePop', drop: 'bubbleDrop', pulse: 'bubblePulse', drill: 'bubbleDrill', crack: 'bubbleCrack',
        descend: 'bubbleDescend', won: 'bubbleWin', lost: 'bubbleLost' });
    const goals = { clear: '清空所有泡泡。', rescue: '救出所有光靈。', unlock: '打開所有結晶封鎖。' };
    const buttons = [...document.querySelectorAll('[data-tool]')];
    const pressure = $('pressure'), ticks = $('ticks');
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    renderer.reduced = motion.matches;
    let game = new Lightbubble.Game(store.state.last), view = 'ready', previous = 'playing';
    let last, accumulator = 0, dirty = true, theme = 'dark', waiting = 0;
    let guide = { angle: 0, cancel: false, dragging: false };
    try { if (localStorage.getItem('casharcade-theme') === 'light') theme = 'light'; } catch { /* Optional setting. */ }
    const ready = () => view === 'playing' && game.mode === 'ready' && !renderer.offset && !dialog.open;
    const input = LightbubbleInput.create({ canvas: board, enabled: ready, fire, swap, pause, retry, tool,
        changed(value) { guide = value; dirty = true; } });
    function text(id, value) {
        const node = $(id);
        if (node.textContent !== String(value)) node.textContent = value;
    }
    function label(title, message, button) {
        overlay.hidden = false;
        text('overlay-title', title);
        text('overlay-message', message);
        text('start', button);
    }
    function hud() {
        const level = game.level, canShoot = ready();
        text('score', game.score.toLocaleString('zh-TW'));
        text('stage', String(level.id).padStart(2, '0') + ' / 18');
        text('goal-count', game.remaining);
        text('sector', sectors[level.sector]);
        text('mission', level.name);
        text('goal', goals[level.goal]);
        text('hint', level.hint);
        const best = store.state.records[level.id];
        text('best', best ? '最高 ' + best.score.toLocaleString('zh-TW') + ' 分 · 最少 ' + best.shots + ' 發' : '尚無通關紀錄');
        pressure.setAttribute('aria-valuemax', String(level.missLimit));
        pressure.setAttribute('aria-valuenow', String(game.misses));
        pressure.setAttribute('aria-valuetext', '再失手 ' + (level.missLimit - game.misses) + ' 次降板');
        text('remain', '再失手 ' + (level.missLimit - game.misses) + ' 次降板');
        if (ticks.children.length !== level.missLimit) {
            ticks.replaceChildren(...Array.from({ length: level.missLimit }, () => document.createElement('span')));
        }
        [...ticks.children].forEach((dot, i) => dot.classList.toggle('used', i < game.misses));
        $('swap').disabled = !canShoot || Boolean(game.selected);
        $('swap').setAttribute('aria-label', '換泡泡，目前 ' + colors[game.current].name + '，預備 ' + colors[game.next].name);
        for (const button of buttons) {
            const name = button.dataset.tool, selected = game.selected === name;
            button.disabled = !canShoot || !game.inventory[name];
            button.setAttribute('aria-pressed', String(selected));
            button.setAttribute('aria-label', tools[name].name + '，剩餘 ' + game.inventory[name] + '，' + tools[name].help);
            button.querySelector('b').textContent = game.inventory[name];
            button.title = tools[name].help;
        }
        $('pause').disabled = !['playing', 'ending', 'paused'].includes(view);
        text('pause', view === 'paused' ? '繼續' : '暫停');
        $('retry').disabled = view === 'ready';
        text('save-note', store.unavailable ? '瀏覽器儲存無法使用。這個分頁仍可遊玩，重載可能無法保留進度。' : '');
    }
    function show() {
        dirty = true;
        hud();
        if (view === 'ready') label(game.level.name, game.level.hint, '開始第 ' + game.level.id + ' 關');
        else if (view === 'paused') label('遊戲暫停', '泡泡與音樂會從原處繼續。', '繼續');
        else if (view === 'lost') label('泡泡抵達警戒線', '重試可取回這關原有的道具與盤面。', '重試本關');
        else if (view === 'won') label(game.level.id === 18 ? '光靈迎來新生' : '關卡完成',
            game.shots + ' 發 · ' + game.score.toLocaleString('zh-TW') + ' 分',
            game.level.id === 18 ? '選擇關卡' : '下一關');
        else overlay.hidden = true;
    }
    function setup(level, play = false) {
        if (!store.visit(level)) return;
        music.pause();
        game = new Lightbubble.Game(level);
        view = play ? 'playing' : 'ready';
        waiting = accumulator = 0;
        input.reset();
        renderer.reset();
        text('feedback', '');
        show();
        if (play) {
            sound.resume();
            music.start(level, 0);
            board.focus({ preventScroll: true });
            board.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        }
    }
    function fire(angle) {
        if (!ready() || !game.shoot(angle)) return;
        sound.resume();
        music.wake();
        hud();
    }
    function swap() {
        if (!ready() || !game.swap()) return;
        sound.play('bubbleAttach');
        text('feedback', '已換成' + colors[game.current].name + '泡泡。');
        hud(); dirty = true;
    }
    function tool(kind) {
        if (!ready() || !game.select(kind)) return;
        sound.play('bubbleAttach');
        text('feedback', game.selected ? tools[kind].name + '已裝填。' + tools[kind].help : '已取消道具。');
        hud(); dirty = true;
    }
    function pause() {
        if (dialog.open) return;
        if (view === 'paused') {
            view = previous;
            if (view === 'playing') { sound.resume(); music.resume(); }
            board.focus({ preventScroll: true });
        } else if (view === 'playing' || view === 'ending') {
            previous = view;
            view = 'paused';
            music.pause();
        } else return;
        accumulator = 0;
        input.clear();
        show();
    }
    function retry() {
        if (view !== 'ready' && !dialog.open) setup(game.level.id, true);
    }
    function chooseLevel() {
        if (dialog.open) return;
        if (view === 'playing' || view === 'ending') pause();
        const list = $('level-list');
        list.replaceChildren();
        sectors.forEach((sector, idx) => {
            const title = document.createElement('h3'), group = document.createElement('div');
            title.textContent = sector; group.className = 'sector-list';
            for (const level of levels.slice(idx * 6, idx * 6 + 6)) {
                const button = document.createElement('button'), detail = document.createElement('small');
                button.type = 'button';
                button.disabled = level.id > store.state.open;
                button.textContent = level.id + ' · ' + level.name;
                detail.textContent = button.disabled ? '尚未解鎖' : store.state.records[level.id] ? '已通關' : '可遊玩';
                button.append(detail);
                button.addEventListener('click', () => { dialog.close(); setup(level.id); });
                group.append(button);
            }
            list.append(title, group);
        });
        dialog.showModal();
    }
    $('levels').addEventListener('click', chooseLevel);
    $('close-levels').addEventListener('click', () => dialog.close());
    $('pause').addEventListener('click', pause);
    $('retry').addEventListener('click', retry);
    $('swap').addEventListener('click', swap);
    for (const button of buttons) button.addEventListener('click', () => tool(button.dataset.tool));
    $('start').addEventListener('click', () => {
        if (view === 'paused') pause();
        else if (view === 'ready' || view === 'lost') setup(game.level.id, true);
        else if (view === 'won' && game.level.id < levels.length) setup(game.level.id + 1);
        else if (view === 'won') chooseLevel();
    });
    const autoPause = () => {
        if (view === 'playing' || view === 'ending') pause();
        else input.clear();
    };
    window.addEventListener('blur', autoPause);
    document.addEventListener('visibilitychange', () => { if (document.hidden) autoPause(); });
    window.addEventListener('resize', () => { input.clear(); dirty = true; });
    function displayTheme() {
        document.documentElement.dataset.theme = theme;
        $('theme-toggle').setAttribute('aria-pressed', String(theme === 'light'));
        dirty = true;
    }
    $('theme-toggle').addEventListener('click', () => {
        theme = theme === 'light' ? 'dark' : 'light';
        try { localStorage.setItem('casharcade-theme', theme); } catch { /* Keep this page's theme. */ }
        displayTheme();
    });
    motion.addEventListener('change', () => { renderer.reduced = motion.matches; renderer.reset(); hud(); dirty = true; });
    $('preview-sound').addEventListener('click', () => {
        sound.play('bubbleLaunch'); sound.play('bubblePop', .16); sound.play('bubbleDrop', .30);
    });
    function consume() {
        const events = game.drain();
        if (!events.length) return;
        renderer.consume(events);
        for (const event of events) {
            const effect = effects[event.type];
            if (effect) sound.play(effect);
            if (event.type === 'pop' || event.type === 'drop') {
                const freed = event.bubbles.filter(bubble => bubble.type === 'L').length;
                text('feedback', freed ? '救出 ' + freed + ' 個光靈！' :
                    (event.type === 'drop' ? '能量瀑布！落下 ' : '消除 ') + event.bubbles.length + ' 顆。');
                if (event.bubbles.length >= 6) music.duck();
            }
            if (event.type === 'descend') {
                text('feedback', '失手達到門檻，泡泡板下降一格。');
                music.phase('pressure');
            }
            if (event.type === 'crack') text('feedback', '結晶封鎖已受損。');
            if (event.type === 'won') store.finish(game.level.id, game.score, game.shots);
        }
        if (game.mode === 'won' || game.mode === 'lost') {
            view = 'ending';
            waiting = renderer.reduced ? .16 : events.some(e => e.type === 'drop') ? .87 : .46;
            input.clear();
            music.pause();
        }
        hud();
        dirty = true;
    }
    const STEP = 1 / 120;
    function frame(now) {
        const dt = last === undefined ? 0 : Math.min(.05, (now - last) / 1000);
        last = now;
        if (view === 'playing' || view === 'ending') {
            if (view === 'playing' && game.mode === 'flight') {
                accumulator += dt;
                while (accumulator >= STEP && game.mode === 'flight') {
                    game.update(STEP);
                    accumulator -= STEP;
                }
                dirty = true;
            } else accumulator = 0;
            // Keep drawing while effects run, and while playing so the mascot stays alive.
            if (renderer.busy || (view === 'playing' && !renderer.reduced)) {
                const wasDescending = renderer.offset;
                renderer.update(dt);
                if (wasDescending && !renderer.offset) hud();
                dirty = true;
            }
            consume();
            if (view === 'ending') {
                waiting -= dt;
                if (waiting <= 0) { view = game.mode; show(); }
            }
        }
        if (dirty) {
            renderer.draw(game, { ...guide, theme, guide: view === 'playing' }); globalThis.CashArcadeNeon?.apply(board,{theme,strength:1});
            dirty = false;
        }
        requestAnimationFrame(frame);
    }
    displayTheme();
    show();
    requestAnimationFrame(frame);
})();
