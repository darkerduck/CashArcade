(() => {
    'use strict';
    const { Game, Renderer, Save, POWERS, W } = window.NeonBreakout;
    const $ = selector => document.querySelector(selector);
    const canvas = $('#game-canvas'), overlay = $('#game-overlay');
    const startButton = $('#start-button'), pauseButton = $('#pause-button'), restartButton = $('#restart-button');
    const paymentStatus = $('#payment-status'), paymentRetry = $('#payment-retry'), paymentCancel = $('#payment-cancel'), paymentLink = $('#payment-link');
    const themeToggle = $('#theme-toggle'), liveRegion = $('#live-region');
    // Keep the shared +18 dB synthesis gain; leave headroom for oversampling in dense multiball mixes.
    const sound = CashArcadeAudio.create({ storageKey: 'casharcade-breakout-sound-muted', toggleButton: $('#sound-toggle'), outputLevel: .9, musicMix: true });
    const renderer = new Renderer(canvas, { reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches });
    const store = Save.create(localStorage, sessionStorage), loaded = store.load();
    let game = loaded.envelope ? Game.restore(loaded.envelope.game) : new Game();
    const music = CashArcadeMusic.create({ score: CashArcadeScores.breakout, storagePrefix: 'casharcade-breakout-music',
        toggleButton: $('#music-toggle'), volumeInput: $('#music-volume'), volumeLabel: $('#music-volume-value'), trackLabel: $('#music-track'),
        audioOutput: sound.musicOutput, initialLevel: game.levelIndex + 1, initialPhase: game.bossPhase });
    let musicGame = null, musicLevel = -1, musicRunning = false;
    let played = loaded.envelope?.played === true, hasActive = !!loaded.envelope;
    let pending = loaded.envelope?.pending === true, paidReady = loaded.envelope?.paidReady === true;
    let storageBlocked = loaded.blocked === true, authorizedCandidate = null;
    let lastFrame = 0, lastSave = 0, uiSignature = '', uiTick = 0, chargePointer = null, drawAverage = 0;
    const keys = { left: false, right: false };
    let highScore = 0;
    try { highScore = Number.parseInt(localStorage.getItem('casharcade-breakout-high-score') || '0', 10) || 0; } catch { /* Optional score storage. */ }
    const replayGate = CashArcadeReplayGate.create({
        onStatus(message) { paymentStatus.textContent = message; },
        onBusy(busy) { clearInput(); startButton.disabled = busy; restartButton.disabled = busy; paymentRetry.disabled = busy; paymentCancel.disabled = !busy; updateHud(true); },
        onCheckout(value) {
            paymentLink.hidden = true; paymentLink.removeAttribute('href');
            if (!value) return;
            try {
                const url = new URL(value);
                if (url.origin !== 'https://linkincash.cc' || !/^\/arcade\/checkout\/[0-9a-f-]+$/i.test(url.pathname) || url.search || url.username || url.password) return;
                paymentLink.href = url.href; paymentLink.hidden = false;
            } catch { /* Never log checkout credentials or send them to an untrusted origin. */ }
        },
    });
    if (paidReady && !pending && hasActive) replayGate.acknowledgeCheckpoint();
    else if (replayGate.pending()) pending = true;
    played ||= replayGate.hasPlayed();
    function envelope(current = game, flags = {}) { return { version: 2, played, pending, paidReady, game: current.snapshot(), ...flags }; }
    function checkpoint() {
        if (authorizedCandidate || storageBlocked || !hasActive) return false;
        try { store.write(envelope()); return true; }
        catch {
            game.pause(false); clearInput(); storageBlocked = true;
            paymentStatus.textContent = '無法保存完整進度。本局已暫停；請恢復瀏覽器儲存後按「恢復／重試」，不要清除付款資料。'; return false;
        }
    }
    function clearInput() { keys.left = false; keys.right = false; chargePointer = null; game.cancelInput(); }
    function syncMusic() {
        // Observe committed game state only. Music never starts a round or calls the gate.
        if (game.state !== 'running' || pending || storageBlocked || authorizedCandidate || replayGate.busy) {
            if (musicRunning) music.pause(); musicRunning = false; return;
        }
        let phase = game.levelIndex === 28 ? game.wave : game.bossPhase;
        if (game.level.boss && game.levelIndex !== 29 && !game.bricks.some(b => b.bossRole === 'node' && b.hp > 0)) {
            const core = game.bricks.find(b => b.bossRole === 'core');
            phase = core && core.hp <= core.maxHp / 2 ? 2 : 1;
        }
        if (musicGame !== game || musicLevel !== game.levelIndex) {
            music.start(game.levelIndex + 1, phase); musicGame = game; musicLevel = game.levelIndex;
        } else if (!musicRunning) music.resume();
        music.phase(phase); musicRunning = true;
    }
    function replayLevelIndex() { return game.state === 'won' ? 0 : game.levelIndex; }
    function unlockedCommit() {
        // A consumed credit survives a failed durable write, without requesting another unlock.
        // The original checkpoint retains the failed stage throughout checkout and reload.
        if (!authorizedCandidate) { authorizedCandidate = new Game({ levelIndex: replayLevelIndex() }); authorizedCandidate.launch(); authorizedCandidate.drainEvents(); }
        const saved = envelope(authorizedCandidate, { paidReady: true, pending: false, played: true });
        try { store.paidBackup(saved); } catch { /* The durable write below is still required. */ }
        store.write(saved);
        game = authorizedCandidate; authorizedCandidate = null; pending = false; paidReady = true; played = true; hasActive = true; storageBlocked = false;
        try { store.clearPaidBackup(); } catch { /* A committed backup remains safe to restore. */ }
        replayGate.acknowledgeCheckpoint(); sound.play('start'); uiSignature = ''; updateHud(true);
    }
    async function requestNewGame() {
        if (replayGate.busy) return;
        sound.resume();
        if (authorizedCandidate) {
            try { unlockedCommit(); } catch { paymentStatus.textContent = '額度已消耗，但新局尚未安全保存。請恢復儲存後重試，不必再次付款。'; }
            updateHud(true); return;
        }
        if (storageBlocked) {
            const recovery = store.load();
            if (recovery.blocked) { paymentStatus.textContent = '儲存仍不可用或存檔無法確認；不會建立訂單或覆蓋原進度。'; return; }
            if (recovery.envelope?.paidReady && !recovery.envelope.pending) {
                game = Game.restore(recovery.envelope.game); pending = false; paidReady = true; hasActive = true; played = true; storageBlocked = false; replayGate.acknowledgeCheckpoint(); updateHud(true); return;
            }
            storageBlocked = false;
        }
        game.pause(false); clearInput(); pending = true; paidReady = false;
        try { store.write(envelope(game, { pending: true, paidReady: false, played: true })); hasActive = true; }
        catch { storageBlocked = true; paymentStatus.textContent = '無法保存付款意圖，尚未開啟付款。請允許瀏覽器儲存後重試。'; updateHud(true); return; }
        updateHud(true); await replayGate.unlock(unlockedCommit);
        if (authorizedCandidate) paymentStatus.textContent = '額度已消耗，但新局尚未安全保存。請恢復儲存後重試，不必再次付款。';
        updateHud(true);
    }
    function handleStart() {
        if (replayGate.busy) return;
        sound.resume();
        if (pending || storageBlocked || authorizedCandidate || ['over','won'].includes(game.state) || (!hasActive && played)) return requestNewGame();
        if (game.state === 'level-clear') { game.nextLevel(); if (!checkpoint()) { updateHud(true); return; } }
        if (game.state === 'paused') game.resume(true);
        else {
            if (!hasActive) {
                try { replayGate.markPlayed(); played = true; hasActive = true; store.write(envelope()); }
                catch { storageBlocked = true; paymentStatus.textContent = '無法安全保存首次遊玩狀態，請允許瀏覽器儲存後重試。'; updateHud(true); return; }
            }
            game.launch();
        }
        processEvents(); checkpoint(); updateHud(true); if(game.state==='running'&&!storageBlocked)canvas.focus({preventScroll:true});
    }
    function togglePause(silent = false) {
        if (pending || storageBlocked || replayGate.busy) return;
        if (game.state === 'running') game.pause(!silent);
        else if (game.state === 'paused' && !silent) game.resume(true);
        clearInput(); processEvents(); checkpoint(); updateHud(true);
    }
    function processEvents() {
        const events = game.drainEvents(); renderer.accept(events, game);
        const names = { impulse:'breakoutImpulse', strong:'breakoutStrong', charge:'breakoutCharge', power:'breakoutPower', portal:'breakoutPortal', magnetic:'breakoutMagnetic', switch:'breakoutSwitch', explosion:'breakoutExplosion', fire:'breakoutExplosion', lightning:'breakoutLightning', laser:'breakoutLaser', boss:'breakoutBoss', bossDown:'breakoutBossDown', wave:'level', shield:'defenseShield' };
        for (const e of events) {
            if (['power','boss','bossDown','explosion','strong','life'].includes(e.name)) music.duck();
            if (e.name === 'brick') sound.play(e.size === 13 ? 'breakoutHeavy' : e.size === 5 ? 'breakoutTiny' : e.type === 'armor' || e.type === 'heavy' ? 'reinforced' : 'brick');
            else if (e.name === 'paddle') sound.play(e.size === 13 ? 'breakoutHeavy' : e.size === 5 ? 'breakoutTiny' : 'paddle');
            else sound.play(names[e.name] || e.name);
            if (e.name === 'power') liveRegion.textContent = `取得${POWERS[e.power].name}`;
            if (['level','win','life','lose','wave','boss'].includes(e.name)) { checkpoint(); liveRegion.textContent = e.name === 'life' ? `還有 ${game.lives} 命` : game.level.name; }
        }
        if (game.score > highScore) { highScore = game.score; try { localStorage.setItem('casharcade-breakout-high-score', String(highScore)); } catch { /* Optional. */ } }
        syncMusic();
    }
    function showOverlay(kicker, title, message, button) {
        overlay.hidden = false; $('#overlay-kicker').textContent = kicker; $('#overlay-title').textContent = title; $('#overlay-message').textContent = message; startButton.textContent = button;
    }
    function updateHud(force = false) {
        syncMusic();
        const locked = pending || storageBlocked || !!authorizedCandidate;
        const signature = [game.state, game.levelIndex, game.wave, locked, replayGate.busy].join(':');
        if (force || signature !== uiSignature) {
            uiSignature = signature;
            const replayLevel = replayLevelIndex() + 1;
            restartButton.textContent = game.state === 'won' ? '新戰役（付費）' : `重試第 ${replayLevel} 關（付費）`;
            paymentRetry.textContent = `恢復／重試第 ${replayLevel} 關`;
            if (locked) showOverlay('REPLAY GATE', authorizedCandidate ? '解鎖已確認' : storageBlocked ? '儲存待恢復' : `重試第 ${replayLevel} 關待解鎖`, `解鎖後從第 ${replayLevel} 關重新挑戰。原局與訂單保留；請使用下方恢復按鈕。`, authorizedCandidate ? '保存並開始已解鎖重試' : `恢復／重試第 ${replayLevel} 關`);
            else if (game.state === 'running') overlay.hidden = true;
            else if (game.state === 'paused') showOverlay('PAUSED', '光流已凍結', '完整球群、機關與道具倒數已保存；繼續不收費。', '繼續遊戲');
            else if (game.state === 'level-clear') showOverlay('STAGE CLEAR', `${game.level.name} · 完成`, `生命已補充（最多五命）。下一關：${window.NeonBreakout.TITLES[game.levelIndex + 1]}`, '部署下一關（免費）');
            else if (game.state === 'life-lost') showOverlay('RELAUNCH', `還有 ${game.lives} 命`, '只有全部球都掉落才扣命。磚塊損壞保留；重新發球免費。', '重新發球（免費）');
            else if (game.state === 'over' || game.state === 'won') showOverlay(game.state === 'won' ? 'CAMPAIGN COMPLETE' : 'GAME OVER', game.state === 'won' ? '超新星已崩解' : `第 ${replayLevel} 關 · 能量耗盡`, `本局 ${game.score} 分。解鎖後${game.state === 'won' ? '從第一關展開新戰役' : `重試第 ${replayLevel} 關，恢復三條命`}。`, game.state === 'won' ? '新戰役（付費）' : `解鎖並重試第 ${replayLevel} 關`);
            else showOverlay(`STAGE ${String(game.levelIndex + 1).padStart(2,'0')}`, game.level.name, game.level.tip, '發射第一球');
            $('#stage-name').textContent = game.level.name; $('#stage-tip').textContent = game.level.tip;
        }
        $('#score').textContent = String(game.score).padStart(4,'0'); $('#high-score').textContent = String(highScore).padStart(4,'0');
        $('#level').textContent = `${game.levelIndex + 1} / 30`; $('#lives').textContent = '♥'.repeat(game.lives) || '—'; $('#ball-count').textContent = `${game.balls.length} / 24`;
        $('#status-text').textContent = locked ? '待恢復' : ({ ready:'準備',running:'遊戲中',paused:'暫停','life-lost':'待發球','level-clear':'過關',over:'結束',won:'完成' })[game.state];
        pauseButton.disabled = locked || replayGate.busy || !['running','paused'].includes(game.state); pauseButton.textContent = game.state === 'paused' ? '繼續' : '暫停';
        $('#launch-button').disabled = locked || replayGate.busy || !['ready','life-lost','running'].includes(game.state) || !game.balls.some(b => b.attached);
        $('#charge-button').disabled = locked || replayGate.busy || !['ready','life-lost','running'].includes(game.state);
        const charge = game.paddle.charging ? Math.min(1, (game.time - game.paddle.chargeAt) / .45) : 0;
        $('#charge-meter').value = charge; $('#charge-label').textContent = charge === 1 ? '滿蓄力 · 等待接球時放開' : '按住蓄力／放開回彈';
        const effects = Object.entries(game.effects).filter(([,end]) => end > game.time).map(([name,end]) => `${POWERS[name].icon} ${POWERS[name].name} ${(end-game.time).toFixed(1)}s`);
        if (game.shield) effects.push(`◇ 底盾 ×${game.shield}`);
        $('#effects').textContent = effects.join('　') || '接取掉落道具可疊加強化 · 紅色為縮小道具';
    }
    function applyTheme() {
        let saved; try { saved = localStorage.getItem('casharcade-theme'); } catch { /* Default dark regardless of OS. */ }
        document.documentElement.dataset.theme = saved === 'light' ? 'light' : 'dark';
    }
    applyTheme();
    themeToggle.addEventListener('click', () => { const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = theme; try { localStorage.setItem('casharcade-theme', theme); } catch { /* Current page. */ } });
    startButton.addEventListener('click', handleStart); restartButton.addEventListener('click', requestNewGame); pauseButton.addEventListener('click', () => togglePause());
    paymentRetry.addEventListener('click', requestNewGame); paymentCancel.addEventListener('click', () => replayGate.cancel());
    $('#launch-button').addEventListener('click', () => { if (!pending && !storageBlocked) handleStart(); });
    $('#sound-test').addEventListener('click', () => { sound.resume(); sound.play('breakoutStrong'); });
    $('#fullscreen-button').addEventListener('click', async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); else await $('#play-surface').requestFullscreen(); } catch { liveRegion.textContent = '此瀏覽器不支援全螢幕；可橫向持握裝置。'; } });
    const chargeButton = $('#charge-button');
    chargeButton.addEventListener('pointerdown', event => { event.preventDefault(); if (replayGate.busy || pending || storageBlocked) return; chargeButton.setPointerCapture(event.pointerId); sound.resume(); game.beginCharge(); processEvents(); });
    chargeButton.addEventListener('pointerup', event => { event.preventDefault(); game.releaseCharge(); processEvents(); });
    chargeButton.addEventListener('pointercancel', () => game.cancelInput());
    chargeButton.addEventListener('keydown',event=>{if(event.key===' '){event.preventDefault();event.stopPropagation();if(!event.repeat&&!pending&&!storageBlocked){sound.resume();game.beginCharge();processEvents();}}});
    chargeButton.addEventListener('keyup',event=>{if(event.key===' '){event.preventDefault();event.stopPropagation();game.releaseCharge();processEvents();}});
    function pointerMove(event) {
        if (pending || storageBlocked || replayGate.busy) return;
        const rect = canvas.getBoundingClientRect(); game.movePaddle((event.clientX - rect.left) / rect.width * W);
        for (const b of game.balls) if (b.attached) b.x = game.paddle.x + game.paddle.w / 2;
    }
    canvas.addEventListener('pointermove', pointerMove);
    canvas.addEventListener('pointerdown', event => {
        event.preventDefault(); if (pending || storageBlocked || replayGate.busy || game.state === 'paused') return;
        sound.resume(); music.wake(); pointerMove(event); canvas.setPointerCapture(event.pointerId);
        if (event.pointerType !== 'touch' && event.button === 0 && chargePointer === null) { chargePointer = event.pointerId; game.beginCharge(); processEvents(); }
    });
    canvas.addEventListener('pointerup', event => { if (event.pointerId === chargePointer) { chargePointer = null; game.releaseCharge(); processEvents(); } });
    canvas.addEventListener('pointercancel', () => { chargePointer = null; game.cancelInput(); });
    canvas.addEventListener('contextmenu', event => { event.preventDefault(); if (!pending && !storageBlocked) handleStart(); });
    document.addEventListener('keydown', event => {
        const key = event.key.toLowerCase();
        if (['input','textarea','select'].includes(event.target?.tagName?.toLowerCase())) return;
        if (['input','textarea','select','button','a'].includes(event.target?.tagName?.toLowerCase()) && [' ','enter'].includes(key)) return;
        if (!['arrowleft','arrowright','a','d',' ','enter','p','escape','r'].includes(key)) return;
        event.preventDefault(); if (event.repeat && [' ','enter','p','escape','r'].includes(key)) return;
        sound.resume(); music.wake();
        if (key === 'r') { requestNewGame(); return; }
        if (pending || storageBlocked || replayGate.busy) return;
        if (key === 'arrowleft' || key === 'a') keys.left = true;
        if (key === 'arrowright' || key === 'd') keys.right = true;
        if (key === 'p' || key === 'escape') togglePause();
        if (key === 'enter') handleStart();
        if (key === ' ') { if (['over','won'].includes(game.state)) requestNewGame(); else game.beginCharge(); processEvents(); }
    });
    document.addEventListener('keyup', event => {
        const key = event.key.toLowerCase();
        if (key === 'arrowleft' || key === 'a') keys.left = false;
        if (key === 'arrowright' || key === 'd') keys.right = false;
        if (['input','textarea','select','button','a'].includes(event.target?.tagName?.toLowerCase())) return;
        if (key === ' ') { event.preventDefault(); game.releaseCharge(); processEvents(); }
    });
    window.addEventListener('blur', () => { if (game.state === 'running') togglePause(true); else clearInput(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden && game.state === 'running') togglePause(true); });
    window.addEventListener('pagehide', () => { music.pause(); musicRunning = false; game.pause(false); clearInput(); checkpoint(); });
    function loop(timestamp) {
        const delta = lastFrame ? Math.min(.1, Math.max(0, (timestamp - lastFrame) / 1000)) : 0; lastFrame = timestamp;
        if (!pending && !storageBlocked && !replayGate.busy) game.tick(delta, (keys.right ? 1 : 0) - (keys.left ? 1 : 0));
        processEvents(); const drawStart=performance.now(); renderer.draw(game, { light: document.documentElement.dataset.theme === 'light' });
        drawAverage=drawAverage*.96+(performance.now()-drawStart)*.04;
        if(drawAverage>18) renderer.lowFX=true; else if(drawAverage<7) renderer.lowFX=false;
        if (timestamp - uiTick > 80) { updateHud(); uiTick = timestamp; }
        if (timestamp - lastSave > 250 && game.state === 'running') { checkpoint(); lastSave = timestamp; }
        requestAnimationFrame(loop);
    }
    updateHud(true); renderer.draw(game, { light: document.documentElement.dataset.theme === 'light' }); requestAnimationFrame(loop);
    replayGate.initialize().then(() => { if (storageBlocked) paymentStatus.textContent = '存檔或瀏覽器儲存無法確認。進度不會被覆蓋，也不會自動建立付款訂單。'; });
})();
