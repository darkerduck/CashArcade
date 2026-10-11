(() => {
    'use strict';
    const $ = id => document.getElementById(id), { Game, MISSIONS, NUDGE } = ReactorPinball;
    const BEST = 'casharcade-reactor-best-v1';
    const read = key => { try { return localStorage.getItem(key); } catch { return null; } };
    let best = Number(read(BEST)); if (!Number.isSafeInteger(best) || best < 0 || best > 1e12) best = 0;
    let theme = read('casharcade-theme') === 'light' ? 'light' : 'dark'; document.documentElement.dataset.theme = theme;
    let game = new Game(), previous = 0, lastHud = 0, lastRender = 0, lastRenderKey = '', toastUntil = 0, reported = false;
    const canvas = $('game-canvas'), renderer = new ReactorPinballRenderer.Renderer(canvas);
    const sound = CashArcadeAudio.create({ storageKey: 'casharcade-reactor-sound-muted', toggleButton: $('sound-toggle'), musicMix: true });
    const music = CashArcadeMusic.create({ score: CashArcadeExpansionScores.reactor, storagePrefix: 'casharcade-reactor-music',
        toggleButton: $('music-toggle'), volumeInput: $('music-volume'), volumeLabel: $('music-volume-value'),
        trackLabel: $('music-track'), audioOutput: sound.musicOutput, initialLevel: 1 });
    const keys = new Set(), pointers = new Map(), nudgeButtonKeys = new Set();
    function write(key, value) {
        try { localStorage.setItem(key, value); }
        catch { $('storage-note').textContent = '瀏覽器無法保存紀錄；仍可在本頁免費遊玩。'; }
    }
    function record() { if (game.score > best) { best = game.score; write(BEST, String(best)); } }
    function input() {
        const active = name => [...pointers.values()].includes(name);
        return { left: keys.has('ArrowLeft') || keys.has('KeyA') || active('left'),
            right: keys.has('ArrowRight') || keys.has('KeyD') || active('right'),
            plunger: keys.has('Space') || keys.has('ArrowDown') || active('plunger') };
    }
    function clearInput() {
        keys.clear(); pointers.clear(); nudgeButtonKeys.clear(); game.clearInput();
        for (const id of ['left', 'right', 'plunger']) { $(id).classList.remove('active'); $(id).setAttribute('aria-pressed', 'false'); }
    }
    function touchState() {
        const controls = input();
        for (const id of ['left', 'right', 'plunger']) { const value = game.state === 'running' && !game.tilted && controls[id]; $(id).classList.toggle('active', value); $(id).setAttribute('aria-pressed', String(value)); }
    }
    function overlay(title, message, button, kicker) {
        $('overlay').hidden = false; $('overlay-title').textContent = title; $('overlay-message').textContent = message;
        $('start').textContent = button; $('overlay-kicker').textContent = kicker; $('live').textContent = title;
    }
    function toast(message, kind = '') { $('toast').dataset.kind = kind; $('toast').hidden = false; $('toast').textContent = message; $('live').textContent = message; toastUntil = performance.now() + 2200; }
    function begin(restart = false) {
        sound.resume();
        if (game.state === 'paused' && !restart) { clearInput(); game.resume(); music.resume(); sound.play('resume'); }
        else { record(); game.restart(); clearInput(); renderer.reset(); reported = false; music.start(1); sound.play('start'); }
        previous = performance.now(); $('overlay').hidden = true; $('toast').hidden = true;
        canvas.focus({ preventScroll: true }); hud();
    }
    function pause() {
        if (game.state !== 'running') return;
        game.pause(); clearInput(); record(); music.pause(); sound.play('pause');
        overlay('反應爐暫停', '鋼珠、擋板與過載時間都停在這裡。準備好，再接住下一球。', '繼續遊玩 →', 'REACTOR ON HOLD'); hud();
    }
    function togglePause() { if (game.state === 'paused') begin(); else pause(); }
    function hud() {
        $('score').textContent = String(game.score).padStart(6, '0'); $('best').textContent = String(Math.max(best, game.score)).padStart(6, '0');
        $('balls').textContent = '●'.repeat(Math.max(0, game.ballsRemaining)); $('balls').setAttribute('aria-label', '剩餘 ' + game.ballsRemaining + ' 顆球');
        $('multiplier').textContent = '×' + game.multiplier; $('overloads').textContent = String(game.overloads).padStart(2, '0');
        $('mission-count').textContent = String(game.missions).padStart(2, '0'); $('combo').textContent = '×' + game.combo;
        const tilted = game.tilted, hot = game.overload > 0, percent = hot ? game.overload / 22 * 100 : game.energy;
        $('energy-fill').style.width = percent + '%'; $('energy-meter').setAttribute('aria-valuenow', String(Math.round(percent)));
        $('energy-meter').setAttribute('aria-label', hot ? '過載剩餘時間百分比' : '反應爐能量'); $('energy-meter').classList.toggle('hot', hot);
        $('reactor-state').textContent = tilted ? 'TILT · 球台鎖定' : hot ? '核心過載 · ' + Math.ceil(game.overload) + ' 秒' : game.energy > 65 ? '反應爐充能中' : '穩定運轉';
        $('reactor-tip').textContent = tilted ? '搖晃過度：擋板、得分與救球停用，10 秒內收回台上鋼珠。' : hot ? '全台得分三倍！瞄準核心，收下超級獎勵。' : game.mission.detail + '，完成任務額外充能。';
        $('energy-label').textContent = tilted ? 'TILT · 等待落球' : hot ? 'MULTIBALL · ×3' : '能量 ' + Math.floor(game.energy) + '%';
        document.querySelectorAll('[data-mission]').forEach(el => {
            const i = Number(el.dataset.mission), current = i === game.missionIndex, complete = i < game.missionIndex;
            el.classList.toggle('current', current); el.classList.toggle('complete', complete);
            $('mission-' + i).textContent = (complete ? MISSIONS[i].target : current ? game.missionProgress : 0) + ' / ' + MISSIONS[i].target;
        });
        const playing = game.state === 'running';
        $('pause').disabled = !['running', 'paused'].includes(game.state); $('pause').textContent = game.state === 'paused' ? '繼續' : '暫停';
        $('left').disabled = $('right').disabled = !playing || tilted; $('plunger').disabled = !playing || tilted || !game.staged;
        nudgeState();
        $('launch-fill').style.width = game.plungerCharge * 100 + '%'; $('launch-label').textContent = game.plungerCharge > .02 ? '放開發射' : game.staged ? '按住發球' : '球已發射';
        $('table-status').textContent = game.state === 'ready' ? '準備啟動' : game.state === 'paused' ? '已暫停' : game.state === 'over' ? '本局結束' : tilted ? 'TILT · 擋板、得分與救球停用' : game.staged ? '按住中間按鈕或空白鍵，放開發球' : game.ballSave > 0 ? '救球保護 ' + Math.ceil(game.ballSave) + ' 秒' : game.balls.length > 1 ? game.balls.length + ' 球同場 · 保持專注' : '抓準時機，再按擋板';
        touchState();
    }
    function nudgeState() {
        const heat = game.nudgeHeat, cooldown = game.nudgeCooldown, playing = game.state === 'running';
        const activeBall = game.balls.some(ball => !ball.staged && ball.inField);
        const percent = Math.min(100, Math.max(0, heat / NUDGE.tiltAt * 100));
        $('nudge').disabled = !game.canNudge;
        if (!game.tilted && $('toast').dataset.kind === 'tilt') $('toast').hidden = true;
        $('nudge-controls').classList.toggle('tilted', game.tilted);
        $('nudge-controls').classList.toggle('warning', !game.tilted && heat + 1 >= NUDGE.tiltAt);
        let status = '可搖晃 · 適時救球';
        if (game.state === 'over') status = '本局結束';
        else if (game.tilted) status = 'TILT · ' + Math.ceil(game.tiltRemaining) + ' 秒內收球';
        else if (game.state === 'paused') status = '已暫停';
        else if (!playing) status = '發球進場後可用';
        else if (!activeBall) status = game.staged ? '發球進場後可用' : '等待鋼珠進場';
        else if (cooldown > 1e-9) status = '冷卻 ' + Math.max(.1, cooldown).toFixed(1) + ' 秒';
        else if (heat + 1 >= NUDGE.tiltAt) status = '高警戒 · 再搖可能 TILT';
        else if (heat > 0) status = '可搖晃 · 警戒降溫中';
        $('nudge-status').textContent = status;
        $('nudge-fill').style.width = percent + '%';
        $('nudge-meter').setAttribute('aria-valuenow', String(Math.round(percent)));
        $('nudge-meter').setAttribute('aria-valuetext', game.tilted ? 'TILT，擋板、得分與救球停用' : '搖晃警戒 ' + Math.round(percent) + '%');
    }
    function nudge() {
        if (!game.canNudge) return;
        wake(); game.nudge(); consume(); hud();
    }
    function consume() {
        const events = game.takeEvents(); renderer.consume(events);
        const effects = { launch: 'defenseLaunch', flipper: 'paddle', bumper: 'brick', core: 'breakoutStrong', rail: 'breakoutPortal', sling: 'paddle', wall: 'wall', mission: 'level', extraBall: 'win', overload: 'breakoutBossDown', drain: 'life', save: 'defenseShield', nudge: 'paddle', tilt: 'life' };
        for (const e of events) {
            if (effects[e.type]) sound.play(effects[e.type]);
            if (e.type === 'mission') toast('程序完成：' + e.name);
            if (e.type === 'extraBall') toast('啟動程序完成！多一顆球');
            if (e.type === 'overload') { toast('反應爐過載！三球同場 · 分數 ×3'); music.phase('overload'); }
            if (e.type === 'save') toast('救球成功 · 再次發球');
            if (e.type === 'tilt') { clearInput(); toast('搖晃過度！TILT · 擋板、得分與救球停用', 'tilt'); hud(); }
            if (e.type === 'gameover' && !reported) {
                reported = true; record(); clearInput(); music.pause(); sound.play('lose');
                overlay('反應爐，等待再啟動。', '本局 ' + game.score.toLocaleString('zh-TW') + ' 分 · 完成 ' + game.missions + ' 項任務 · ' + game.overloads + ' 次過載。再挑戰一次，把時機抓得更準。', '免費再來一局 →', 'FINAL SCORE / ' + game.score.toLocaleString('zh-TW')); hud();
            }
        }
    }
    $('start').addEventListener('click', () => begin()); $('retry').addEventListener('click', () => begin(true)); $('pause').addEventListener('click', togglePause);
    $('theme-toggle').addEventListener('click', () => { theme = theme === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = theme; write('casharcade-theme', theme); lastRender = 0; });
    function wake() { sound.resume(); music.wake(); }
    function press(e, action) {
        if (game.state !== 'running' || game.tilted || (action === 'plunger' && !game.staged) || (e.pointerType === 'mouse' && e.button !== 0)) return;
        e.preventDefault(); wake(); pointers.set(e.pointerId, action);
        try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* Pointer may already be released. */ }
        touchState();
    }
    function release(e, cancelled = false) {
        const action = pointers.get(e.pointerId); if (!action) return;
        pointers.delete(e.pointerId);
        // A quick tap is a low-power launch, even if no animation frame saw it held.
        if (action === 'plunger' && !input().plunger) {
            if (cancelled) { game._plungerHeld = false; game.plungerCharge = 0; }
            else game.launch();
        }
        touchState();
    }
    for (const id of ['left', 'right', 'plunger']) {
        $(id).addEventListener('pointerdown', e => press(e, id));
        $(id).addEventListener('pointerup', e => release(e));
        $(id).addEventListener('pointercancel', e => release(e, true));
        $(id).addEventListener('lostpointercapture', e => release(e, true));
        $(id).addEventListener('contextmenu', e => e.preventDefault());
        // Native focused buttons also support held Space/Enter for keyboard-only play.
        $(id).addEventListener('keydown', e => {
            if (!['Space', 'Enter'].includes(e.code) || e.repeat || $(id).disabled) return;
            e.preventDefault(); wake(); pointers.set('keyboard-' + id, id); touchState();
        });
        $(id).addEventListener('keyup', e => {
            if (!['Space', 'Enter'].includes(e.code)) return;
            e.preventDefault(); release({ pointerId: 'keyboard-' + id });
        });
        $(id).addEventListener('blur', () => release({ pointerId: 'keyboard-' + id }, true));
    }
    // One native click covers touch, mouse, Space and Enter. Do not also nudge
    // on pointerdown or keydown, which would double-fire a single activation.
    $('nudge').addEventListener('click', nudge);
    $('nudge').addEventListener('keydown', e => {
        if (!['Space', 'Enter'].includes(e.code)) return;
        if (e.repeat || nudgeButtonKeys.has(e.code)) e.preventDefault();
        else nudgeButtonKeys.add(e.code);
    });
    $('nudge').addEventListener('keyup', e => nudgeButtonKeys.delete(e.code));
    $('nudge').addEventListener('blur', () => nudgeButtonKeys.clear());
    canvas.addEventListener('pointerdown', e => {
        const r = canvas.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
        if (y > .58) press(e, x < .49 ? 'left' : 'right');
    });
    canvas.addEventListener('pointerup', e => release(e)); canvas.addEventListener('pointercancel', e => release(e, true));
    canvas.addEventListener('lostpointercapture', e => release(e, true)); canvas.addEventListener('contextmenu', e => e.preventDefault());
    const controls = ['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD', 'Space', 'ArrowDown'];
    window.addEventListener('keydown', e => {
        if (e.target.matches('input,select,textarea,[contenteditable]')) return;
        if (e.code === 'Space' && e.target.closest('button,a')) return;
        if (e.code === 'KeyZ') {
            e.preventDefault();
            if (e.repeat || keys.has(e.code)) return;
            keys.add(e.code); nudge(); return;
        }
        if (controls.includes(e.code)) {
            if (game.state !== 'running' || game.tilted) return; e.preventDefault(); wake(); keys.add(e.code); touchState(); return;
        }
        if (e.repeat) return;
        if (e.code === 'Escape' || e.code === 'KeyP') { e.preventDefault(); togglePause(); }
        if (e.code === 'KeyR') { e.preventDefault(); begin(true); }
    });
    window.addEventListener('keyup', e => {
        const had = keys.delete(e.code);
        if (had && (e.code === 'Space' || e.code === 'ArrowDown') && !input().plunger) { e.preventDefault(); game.launch(); }
        touchState();
    });
    window.addEventListener('blur', pause);
    document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
    window.addEventListener('pagehide', () => { pause(); record(); });
    function frame(now) {
        const delta = previous ? Math.min(.1, (now - previous) / 1000) : 0; previous = now;
        if (game.state === 'running') { game.update(delta, input()); consume(); }
        if (now - lastHud > 60) { hud(); lastHud = now; }
        if (!$('toast').hidden && now > toastUntil) $('toast').hidden = true;
        // Physics stays at 120 Hz; draw active play at 30 Hz and idle only on change.
        const renderKey = [game.state, theme, globalThis.innerWidth || 0, globalThis.innerHeight || 0].join(':');
        if ((game.state === 'running' && now - lastRender >= 1000 / 30) || renderKey !== lastRenderKey) { renderer.draw(game, lastRender ? Math.min(.1, (now - lastRender) / 1000) : delta, theme); lastRender = now; lastRenderKey = renderKey; }
        requestAnimationFrame(frame);
    }
    hud(); requestAnimationFrame(frame);
})();
