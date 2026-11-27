// 蒸汽前線 COGFRONT page controller: loop, overlays, stage select, workshop, troop bar, audio and saving.
(() => {
    'use strict';
    const $ = id => document.getElementById(id);
    const D = CogfrontData, { Game } = Cogfront;
    function applyTheme() {
        let stored = null;
        try { stored = localStorage.getItem('casharcade-theme'); } catch { /* Dark default. */ }
        document.documentElement.dataset.theme = stored === 'light' ? 'light' : 'dark';
    }
    applyTheme();
    const storage = CogfrontStorage.create(globalThis.localStorage ?? { getItem() { throw Error(); }, setItem() { throw Error(); } }, () => { $('storage-note').textContent = '瀏覽器儲存無法使用：本次進度可能無法保存，但仍可免費遊玩。'; });
    const save = storage.load();
    const motionQuery = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
    const silent = { play() {}, resume() {}, musicOutput() { return null; } }, quiet = { start() {}, pause() {}, resume() {}, phase() {}, duck() {}, wake() {} };
    let sound = silent, music = quiet;
    try { sound = CashArcadeAudio.create({ storageKey: 'casharcade-cogfront-sound-muted', toggleButton: $('sound-toggle'), outputLevel: .6, musicMix: true }); } catch { /* Sound is optional. */ }
    try { music = CashArcadeMusic.create({ score: CogfrontScore, storagePrefix: 'casharcade-cogfront-music', toggleButton: $('music-toggle'), volumeInput: $('music-volume'), volumeLabel: $('music-volume-value'), trackLabel: $('music-track'), audioOutput: sound.musicOutput, initialLevel: save.unlocked }); } catch { /* Music is optional. */ }
    globalThis.CogfrontArt?.load('./art/');
    const renderer = new CogfrontRenderer.Renderer($('game-canvas'));
    let selected = save.unlocked, game = new Game({ stage: selected, seed: seed(), upgrades: save.upgrades, unlocked: save.unlocked });
    let mode = 'menu', previous = 0, ending = 0, uiTimer = 0;
    function seed() { return (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0 || 1; }
    const reduced = () => save.reducedMotion || Boolean(motionQuery?.matches);
    function persist() { storage.save(save); }

    // ---------------- audio mapping
    const SOUNDS = { burst: 'cogBurst', charge: 'cogCharge', dodge: 'cogDodge', deploy: 'cogDeploy', kill: 'cogKill', heroHit: 'cogHurt', heroDown: 'cogLose',
        trainHit: 'cogTrain', explode: 'cogBlast', blast: 'cogBlast', shot: 'cogShot', heal: 'cogHeal', overdrive: 'cogOverdrive', bossEnter: 'cogBoss',
        bossAttack: 'cogBossAttack', denied: 'cogDenied', won: 'cogWin', lost: 'cogLose', wave: 'start', order: 'confirm', heroBack: 'resume', gateDown: 'cogBlast', bossDown: 'cogBlast' };
    function play(events) {
        for (const e of events) {
            if (e.type === 'slash') sound.play(e.combo === 2 ? 'cogSlashHeavy' : 'cogSlash');
            else if (SOUNDS[e.type]) sound.play(SOUNDS[e.type]);
            if (e.type === 'bossPhase') music.phase('overload');
            if (e.type === 'heroDown') announce('隊長倒下，5 秒後從列車重新出擊。');
            if (e.type === 'bossEnter') announce(`頭目出現：${e.name}。注意紅色地面預警。`);
        }
    }
    function announce(text) { $('live').textContent = text; }

    // ---------------- input
    const input = CogfrontInput.create({
        onAction(name) {
            if (mode !== 'running') return;
            sound.resume(); music.wake();
            if (name === 'attack') game.attack();
            else if (name === 'dodge') game.dodge();
            else if (name === 'order') game.toggleOrder();
            else if (name.startsWith('deploy:')) game.deploy(name.slice(7));
            else game.skill(name);
        },
        onSystem(code, event) {
            if (code === 'KeyP' || code === 'Escape') { event.preventDefault?.(); togglePause(); }
            else if (code === 'KeyR' && mode !== 'menu') retry();
            else if (code === 'KeyF') fullscreen();
        },
    });
    for (const [id, action] of [['t-left', 'left'], ['t-right', 'right'], ['t-attack', 'attack'], ['t-burst', 'burst'], ['t-charge', 'charge'], ['t-over', 'overdrive'], ['t-dodge', 'dodge'], ['t-order', 'order']]) input.bind($(id), action);
    const troopButtons = {};
    for (const [i, kind] of D.TROOP_ORDER.entries()) {
        const spec = D.TROOPS[kind], b = document.createElement('button');
        b.type = 'button'; b.id = `troop-${kind}`; b.innerHTML = `<b>${spec.short}</b><small>${i + 1} · ${spec.cost} 蒸汽</small><i></i>`;
        b.setAttribute('aria-label', `派出${spec.name}，花費 ${spec.cost} 蒸汽壓`);
        input.bind(b, `deploy:${kind}`); $('troops').append(b); troopButtons[kind] = b;
    }

    // ---------------- flow
    function start(stage = selected) {
        selected = Math.max(1, Math.min(save.unlocked, stage));
        game = new Game({ stage: selected, seed: seed(), upgrades: save.upgrades, unlocked: save.unlocked });
        renderer.reset(); input.clear(); ending = 0; mode = 'running';
        $('overlay').hidden = true; sound.resume(); music.start(selected);
        $('pause').disabled = false; $('retry').disabled = false;
        $('game-canvas').focus({ preventScroll: true }); updatePanels(); renderShop();
        announce(`第 ${selected} 關 ${game.stageData.name} 開始。`);
    }
    function retry() { start(game.level); }
    function togglePause() {
        if (mode === 'running') { mode = 'paused'; music.pause(); input.clear(); overlay({ kicker: 'PAUSED', title: '戰線暫停', message: '按繼續回到前線。換頁或失焦時會自動暫停。', primary: '繼續 →', secondary: '選擇關卡' }); $('pause').textContent = '繼續'; }
        else if (mode === 'paused') { mode = 'running'; $('overlay').hidden = true; music.resume(); $('pause').textContent = '暫停'; previous = 0; $('game-canvas').focus({ preventScroll: true }); }
    }
    function finish() {
        mode = 'result'; music.pause(); input.clear();
        CogfrontStorage.record(save, game); persist();
        $('pause').disabled = true;
        const won = game.state === 'won', last = game.level === D.STAGES.length;
        overlay(won ? {
            kicker: last ? 'CAMPAIGN COMPLETE' : 'STAGE CLEAR', title: last ? '灰燼號墜落，城市重見天光。' : `${game.stageData.name}，攻破！`,
            message: `用時 ${game.time.toFixed(1)} 秒 · 擊破 ${game.kills} · 獲得 ${game.reward} 齒輪幣。到右側工坊升級，再往下一道防線。`,
            stars: '★'.repeat(game.stars) + '☆'.repeat(3 - game.stars), primary: last ? '再打一次 →' : '下一關 →', secondary: '選擇關卡',
        } : { kicker: 'TRAIN DESTROYED', title: '列車失守。', message: `帶回 ${game.reward} 齒輪幣。升級工坊、多派盾衛與技師守住列車，再試一次。`, primary: '重打本關 →', secondary: '選擇關卡' });
        updatePanels(); renderShop();
    }
    function overlay({ kicker, title, message, stars = '', primary, secondary = '', grid = false }) {
        $('overlay').hidden = false; $('overlay-kicker').textContent = kicker; $('overlay-title').textContent = title; $('overlay-message').textContent = message;
        $('overlay-stars').hidden = !stars; $('overlay-stars').textContent = stars;
        $('stage-grid').hidden = !grid; if (grid) renderStages();
        $('start').textContent = primary; $('secondary').hidden = !secondary; $('secondary').textContent = secondary;
    }
    function renderStages() {
        $('stage-grid').replaceChildren(...D.STAGES.map(s => {
            const b = document.createElement('button'), locked = s.id > save.unlocked;
            b.type = 'button'; b.disabled = locked; b.setAttribute('aria-pressed', String(s.id === selected));
            b.innerHTML = `<b>${String(s.id).padStart(2, '0')} ${locked ? '🔒' : '★'.repeat(save.stars[s.id - 1]) + '☆'.repeat(3 - save.stars[s.id - 1])}</b>${s.name}<br><small>${s.zone}${s.boss ? ' · 頭目' : ''}</small>`;
            b.addEventListener('click', () => { selected = s.id; renderStages(); updatePanels(true); });
            return b;
        }));
    }
    function showStages() { mode = 'menu'; music.pause(); overlay({ kicker: 'CAMPAIGN MAP', title: '選擇要攻打的防線', message: '已解鎖的關卡可以隨時重打，賺取齒輪幣與星章。', primary: '出擊 →', grid: true }); $('pause').disabled = true; }
    $('start').addEventListener('click', () => {
        if (mode === 'paused') return togglePause();
        if (mode === 'result' && game.state === 'won') selected = Math.min(save.unlocked, game.level + 1);
        else if (mode === 'result') selected = game.level;
        start(selected);
    });
    $('secondary').addEventListener('click', showStages);
    $('stages').addEventListener('click', () => { if (mode === 'running') togglePause(); showStages(); });
    $('pause').addEventListener('click', togglePause);
    $('retry').addEventListener('click', retry);
    $('preview-sound').addEventListener('click', () => { sound.resume(); sound.play('cogSlash'); sound.play('cogDeploy', .25); sound.play('cogSlashHeavy', .5); });
    $('motion').checked = save.reducedMotion;
    $('motion').addEventListener('change', () => { save.reducedMotion = $('motion').checked; persist(); });
    $('theme-toggle').addEventListener('click', () => { const theme = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light'; document.documentElement.dataset.theme = theme; try { localStorage.setItem('casharcade-theme', theme); } catch { /* Page still switches. */ } });
    function fullscreen() {
        const machine = $('machine');
        if (document.fullscreenElement) document.exitFullscreen?.();
        else if (machine.requestFullscreen) machine.requestFullscreen().catch(() => machine.classList.toggle('fullscreen-fallback'));
        else machine.classList.toggle('fullscreen-fallback');
    }
    $('fullscreen').addEventListener('click', fullscreen);
    const autoPause = () => { if (mode === 'running') togglePause(); };
    document.addEventListener('visibilitychange', () => { if (document.hidden) autoPause(); });
    globalThis.addEventListener?.('blur', autoPause);
    globalThis.addEventListener?.('pagehide', persist);

    // ---------------- side panels
    function updatePanels(menu = false) {
        const st = menu ? D.STAGES[selected - 1] : game.stageData;
        $('stage-label').textContent = `${String(st.id).padStart(2, '0')} / 08`;
        $('zone').textContent = st.zone; $('stage-name').textContent = st.name;
        const stars = save.stars[st.id - 1]; $('stage-stars').textContent = '★'.repeat(stars) + '☆'.repeat(3 - stars);
        $('best').textContent = save.best[st.id - 1] ? `最佳時間 ${save.best[st.id - 1]} 秒 · 星章目標 ${st.timeGoal} 秒內` : `星章目標：${st.timeGoal} 秒內、列車 70% 以上`;
        $('coins').textContent = save.coins; $('shop-coins').textContent = `${save.coins} ⚙`;
    }
    function renderShop() {
        const open = mode !== 'running';
        $('shop-note').textContent = open ? '關卡之間用齒輪幣升級隊長、招式與兵種。' : '戰鬥中無法升級；過關後回來工坊。';
        $('shop-list').replaceChildren(...D.UPGRADES.filter(u => !u.troop || D.TROOPS[u.troop].unlock <= save.unlocked).map(u => {
            const level = save.upgrades[u.id], maxed = level >= u.max, price = D.cost(u, level);
            const row = document.createElement('div'); row.className = 'shop-item';
            row.innerHTML = `<b>${u.name}</b><button type="button">${maxed ? 'MAX' : price + ' ⚙'}</button><span>${u.effect(level)}</span><em>${'■'.repeat(level)}${'□'.repeat(u.max - level)}</em>`;
            const b = row.querySelector('button'); b.disabled = !open || maxed || save.coins < price;
            b.setAttribute('aria-label', `${u.name}，${maxed ? '已滿級' : `花費 ${price} 齒輪幣`}`);
            b.addEventListener('click', () => { if (CogfrontStorage.buy(save, u.id)) { persist(); sound.play('cogDeploy'); renderShop(); updatePanels(mode === 'menu'); } });
            return row;
        }));
    }
    function updateBars() {
        const steam = Math.round(game.steam);
        $('steam-fill').style.width = `${steam}%`; $('steam-text').textContent = steam; $('steam').setAttribute('aria-valuenow', String(steam));
        for (const kind of D.TROOP_ORDER) {
            const spec = D.TROOPS[kind], b = troopButtons[kind], locked = !game.unlockedTroop(kind), cd = game.cooldowns[kind];
            b.disabled = locked || mode !== 'running';
            b.classList.toggle('cooling', cd > 0); b.classList.toggle('poor', game.steam < spec.cost);
            b.querySelector('i').style.width = `${cd > 0 ? (1 - cd / spec.cooldown) * 100 : 100}%`;
            if (locked) b.querySelector('small').textContent = `第 ${spec.unlock} 關解鎖`;
        }
        $('kills').textContent = game.kills;
        $('progress-fill').style.width = `${Math.round(game.progress * 100)}%`; $('progress').setAttribute('aria-valuenow', String(Math.round(game.progress * 100)));
        if (mode === 'running') $('status').textContent = game.boss ? `頭目 ${Math.ceil(game.boss.hp / game.boss.maxHp * 100)}% · 陣形：${{ follow: '跟進', charge: '衝鋒', hold: '固守' }[game.order]}` : `${game.gate ? '閘門 ' + Math.ceil(game.gate.hp / game.gate.maxHp * 100) + '%' : '頭目尚未現身'} · 士兵 ${game.allies.length} · 陣形：${{ follow: '跟進', charge: '衝鋒', hold: '固守' }[game.order]}`;
    }

    // ---------------- loop
    function frame(now) {
        requestAnimationFrame(frame); // schedule first so one bad frame can never freeze the game
        const dt = previous ? Math.min(.05, Math.max(0, (now - previous) / 1000)) : 0; previous = now;
        if (mode === 'running') {
            game.update(dt * renderer.timeScale(), input.value(dt));
            const events = game.drain(); renderer.consume(events, game); play(events);
            if (game.state !== 'running') { ending += dt; if (ending > 1.1) finish(); }
        }
        renderer.render(game, { dt, reducedMotion: reduced() });
        uiTimer += dt; if (uiTimer > .1) { uiTimer = 0; updateBars(); }
    }
    updatePanels(true); renderShop(); updateBars();
    if (save.clears > 0) overlay({ kicker: 'WELCOME BACK, CAPTAIN', title: '鍋爐仍在運轉。', message: `已解鎖到第 ${save.unlocked} 關，持有 ${save.coins} 齒輪幣。`, primary: '出擊 →', secondary: '選擇關卡' });
    else $('secondary').hidden = false;
    globalThis.CogfrontApp = Object.freeze({ snapshot: () => ({ mode, stage: game.level, state: game.state, steam: game.steam, allies: game.allies.length, hero: { x: game.hero.x, hp: game.hero.hp, alive: game.hero.alive }, coins: save.coins, unlocked: save.unlocked }) });
    requestAnimationFrame(frame);
})();
