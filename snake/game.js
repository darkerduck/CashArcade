import { SnakeGame, LEVELS, POWERS } from './engine.mjs';
import { Campaign, CampaignStore, BEST_KEY, SAVE_KEY } from './storage.mjs';
import { ReplayGate, sdkFactory } from './payment.mjs';
import { playEvents } from './audio-events.mjs';

const $ = id => document.getElementById(id);
const canvas = $('game-canvas'), overlay = $('game-overlay');
let campaign, store, renderer, sound, music, initialized = false, busy = false, countdown = 0;
let lastFrame = 0, lastHud = 0, lastRevision = -1, lastSave = 0, storageError = false, conflict = false;
let highScore = 0, musicStarted = false, musicLevel = -1, resumeSound = false, restored = false;
let game = new SnakeGame(), touchStart = null, unavailable = false;
const map = $('mini-map').getContext('2d');
const mobileLayout = matchMedia('(max-width: 640px)');
const controlPanel = document.querySelector('.control-panel'), navigationPanel = document.querySelector('.navigation');
function placeMobileControls() {
    const destination = mobileLayout.matches ? $('mobile-navigation') : document.querySelector('.mission-panel');
    if (mobileLayout.matches) destination.append(controlPanel, navigationPanel);
    else destination.append(navigationPanel, controlPanel);
}
placeMobileControls(); mobileLayout.addEventListener('change', placeMobileControls);

    function applyStoredTheme() {
        let savedTheme;
        try { savedTheme = localStorage.getItem('casharcade-theme'); } catch { /* Default remains dark. */ }
        document.documentElement.dataset.theme = savedTheme === 'light' ? 'light' : 'dark';
    }
applyStoredTheme();

function message(kicker, title, detail, action, { survey = false, disabled = false } = {}) {
    overlay.hidden = false; overlay.classList.toggle('survey', survey);
    $('overlay-kicker').textContent = kicker; $('overlay-title').textContent = title;
    $('overlay-message').textContent = detail; $('start-button').textContent = action; $('start-button').disabled = disabled;
}
const reasonText = { wall: '撞到牆面', self: '撞到自己的身體', bomb: '碰到炸彈', laser: '碰到啟動中的雷射' };
function showState() {
    if (unavailable || conflict) return;
    if (storageError) { message('SAVE REQUIRED', '存檔暫時無法保存', $('storage-note').textContent, campaign?.consumed ? '恢復已解鎖局' : '重試保存／恢復'); return; }
    if (campaign?.record.replay === 'pending') { message('CASHLINK / REPLAY', '尚未開始下一局', '保留原局與原訂單；請確認付款狀態，不要重複付款。', campaign.consumed ? '恢復已解鎖局' : '恢復付款'); return; }
    if (game.state === 'failed') message('SIGNAL LOST', reasonText[game.reason] || '本局結束', `戰役得分 ${game.score}。重試會從第 ${game.levelIndex + 1} 關起點恢復，需先解鎖「再來一局」。`, '解鎖並重試本關');
    else if (game.state === 'won') message('CAMPAIGN COMPLETE', '十二座光域，全部突破', `戰役完成！總分 ${game.score}。你已掌握六方向的霓虹世界。`, '解鎖新戰役');
    else if (game.state === 'level-clear') message('SECTOR COMPLETE', `${game.level.name} · 完成`, `下一站：${LEVELS[game.levelIndex + 1].name}。免費延續戰役，重新部署四節蛇身。`, '前往下一關');
    else if (game.state === 'paused') message('TACTICAL VIEW', '暫停 · 自由觀察', '拖曳旋轉、滾輪或雙指縮放；繼續後恢復固定角度。', restored ? '恢復已保存的同一局' : '繼續遊戲', { survey: true });
    else if (game.state === 'ready') message('SECTOR ' + String(game.levelIndex + 1).padStart(2, '0'), game.level.name, game.level.hint, campaign?.record.replay === 'paid-ready' ? '開始已解鎖的一局' : '開始戰役');
    else overlay.hidden = true;
}
function controls() {
    const locked = !initialized || busy || conflict || unavailable;
    $('restart-button').disabled = locked || storageError; $('new-button').disabled = locked || storageError;
    $('pause-button').disabled = locked || !['running', 'paused'].includes(game.state) || campaign?.record.replay === 'pending' || storageError;
    $('pause-button').textContent = game.state === 'paused' ? '繼續遊戲' : '暫停／觀察';
    $('cancel-payment').hidden = !gate.busy;
    if (locked) $('start-button').disabled = true;
}
function save() {
    if (!campaign || conflict) return false;
    try { campaign.save(); storageError = false; lastRevision = game.revision; lastSave = game.time; return true; }
    catch {
        game.pause(); countdown = 0; music?.pause(); storageError = true;
        $('storage-note').classList.add('error'); $('storage-note').textContent = '瀏覽器未能保存進度。請允許網站儲存並保留本頁；不會開啟新付款或丟棄已解鎖局。';
        showState(); controls(); return false;
    }
}
const gate = new ReplayGate({
    factory: sdkFactory,
    status: text => { $('payment-note').textContent = text; },
    checkout: url => { $('payment-fallback').hidden = !url; $('payment-fallback').href = url || '#'; },
    busy: value => { $('cancel-payment').hidden = !value; showState(); controls(); },
});

async function requestRound(intent = 'continue') {
    if (!initialized || unavailable || conflict || busy || countdown) return;
    sound.resume(); music.wake(); busy = true; const oldGame = game;
    game.pause(); music.pause(); renderer.survey(false); controls();
    try {
        if (storageError && !campaign?.consumed) {
            if (!campaign) { campaign = new Campaign(store, gate); game = campaign.game; renderer.load(game); }
            if (!save()) return;
        }
        const ok = await campaign.request(intent); game = campaign.game;
        if (!ok) { showState(); return; }
        storageError = false; $('storage-note').classList.remove('error');
        $('storage-note').textContent = '自動保存於此瀏覽器 · 重載恢復同一局，不會免費重置或再次收費';
        if (oldGame !== game && (intent !== 'continue' || oldGame.steps !== game.steps || oldGame.levelIndex !== game.levelIndex)) renderer.load(game);
        resumeSound = game.state === 'paused'; countdown = performance.now() + 1000;
        if (mobileLayout.matches) canvas.scrollIntoView({ block: 'start', behavior: 'instant' });
        overlay.hidden = true; $('countdown').hidden = false; $('countdown').textContent = '1';
    } catch {
        storageError = true; $('storage-note').classList.add('error');
        $('storage-note').textContent = campaign?.consumed
            ? '付款已解鎖，但本機存檔未完成。請保留本頁並允許儲存；恢復時不會再付款。'
            : '無法可靠讀取或保存戰役。請確認瀏覽器儲存權限，勿清除未完成訂單資料。';
        showState();
    } finally { busy = false; if (!countdown) showState(); controls(); }
}
function begin() {
    countdown = 0; $('countdown').hidden = true;
    try {
        if (!campaign.begin()) { showState(); return; }
        game = campaign.game; restored = false;
        sound.play(resumeSound ? 'resume' : 'start');
        if (musicStarted && musicLevel === game.levelIndex && resumeSound) music.resume();
        else { music.start(1, game.level.chapter); musicStarted = true; musicLevel = game.levelIndex; }
        renderer.survey(false); overlay.hidden = true;
    } catch { save(); }
    controls();
}
function pause(automatic = false, persist = true) {
    if (!initialized || !campaign || conflict || unavailable) return;
    if (game.state !== 'running' && !countdown) return;
    countdown = 0; $('countdown').hidden = true;
    if (game.state === 'ready') game.state = 'paused'; else game.pause();
    music.pause(); if (!automatic) sound.play('pause');
    if (persist && !save()) return;
    renderer.survey(true); showState(); controls();
}
function input(direction) {
    if (!initialized || busy || unavailable || storageError || conflict || countdown || campaign.record.replay === 'pending') return;
    sound.resume();
    if (game.state === 'running' && game.input(direction)) save();
}
function primary() {
    if (game.state === 'level-clear' && campaign?.record.replay === 'open') requestRound('next');
    else if (game.state === 'won') requestRound('new');
    else if (game.state === 'failed') requestRound('retry');
    else requestRound('continue');
}

function drawMap() {
    const w = 168, size = game.level.width, unit = w / size, layer = game.snake[0].y;
    map.clearRect(0, 0, w, w); map.fillStyle = '#071827'; map.fillRect(0, 0, w, w);
    map.strokeStyle = '#183443'; map.lineWidth = .5;
    for (let i = 0; i <= size; i++) { map.beginPath(); map.moveTo(i * unit, 0); map.lineTo(i * unit, w); map.moveTo(0, i * unit); map.lineTo(w, i * unit); map.stroke(); }
    const box = (p, color, inset = 1) => { map.fillStyle = color; map.fillRect(p.x * unit + inset, p.z * unit + inset, unit - inset * 2, unit - inset * 2); };
    game.level.walls.filter(p => p.y === layer).forEach(p => box(p, '#516376'));
    game.level.gates.forEach((gate, i) => gate.cells.filter(p => p.y === layer).forEach(p => box(p, game.gates[i].active ? '#ff426c' : game.gates[i].warning ? '#ffc355' : '#372837', 2)));
    game.level.portals.forEach(pair => [pair.a, pair.b].filter(p => p.y === layer).forEach(p => box(p, pair.color, 3)));
    game.snake.slice().reverse().filter(p => p.y === layer).forEach(p => box(p, '#2eba96', 2)); box(game.snake[0], '#ccfff2', 1.5);
    for (const [p, color] of [[game.food, '#ffcf5b'], [game.dessert, '#ff8bd9'], [game.power, '#94a2ff'], [game.level.exit, game.collected >= game.level.quota ? '#8cffab' : '#465d62'], ...game.bombs.map(p => [p, '#ff4966'])]) {
        if (!p) continue;
        if (p.y === layer) box(p, color, 3);
        else if (p === game.food || p === game.level.exit && game.collected >= game.level.quota) { map.strokeStyle = color; map.lineWidth = 1.4; map.strokeRect(p.x * unit + 2, p.z * unit + 2, unit - 4, unit - 4); }
    }
}
function updateHUD() {
    $('level-number').innerHTML = `${String(game.levelIndex + 1).padStart(2, '0')} <small>/ ${LEVELS.length}</small>`;
    $('score').textContent = String(game.score).padStart(5, '0'); $('high-score').textContent = String(highScore).padStart(5, '0');
    $('speed').innerHTML = `${(1000 / game.delay()).toFixed(1)} <small>格／秒</small>`;
    $('sector-label').textContent = `CHAPTER ${String(game.level.chapter + 1).padStart(2, '0')} · ${game.level.name}`;
    $('clock-label').textContent = `${String(Math.floor(game.time / 60000)).padStart(2, '0')}:${String(Math.floor(game.time / 1000) % 60).padStart(2, '0')}`;
    $('mission-title').textContent = game.level.name; $('mission-hint').textContent = game.level.hint;
    $('goal-count').textContent = `${Math.min(game.collected, game.level.quota)} / ${game.level.quota}`;
    $('goal-progress').max = game.level.quota; $('goal-progress').value = game.collected;
    const y = game.snake[0].y; $('altitude').textContent = `${String(y + 1).padStart(2, '0')} / ${String(game.level.height).padStart(2, '0')}`;
    $('altitude-bars').innerHTML = Array.from({ length: game.level.height }, (_, i) => `<span class="${i === y ? 'active' : ''}"></span>`).join('');
    const target = game.collected >= game.level.quota ? game.level.exit : game.food;
    $('target-label').textContent = target ? `${game.collected >= game.level.quota ? '出口已啟動' : '食物'}：${target.y === y ? '同高度' : target.y > y ? `↑ 上方 ${target.y - y} 層` : `↓ 下方 ${y - target.y} 層`}` : '目標準備中';
    $('dessert-status').textContent = game.levelIndex === 0 ? '本關沒有甜點' : game.collected >= game.level.quota ? '能量已足夠，前往出口' : game.dessert ? `甜點剩 ${Math.ceil((10000 - game.time % 20000) / 1000)} 秒` : `下次甜點 ${Math.ceil((20000 - game.time % 20000) / 1000)} 秒後`;
    const danger = game.danger(); $('danger-status').textContent = danger ? `△ ${danger} · 可用 E / Q 改變高度` : '六面封閉 · E 持續上升 · Q 持續下降 · 不可立即反向'; $('danger-status').classList.toggle('danger', !!danger);
    const active = [];
    if (game.effects.shield) active.push('◇ 護盾 ×1');
    for (const k of ['slow', 'magnet', 'emp']) if (game.effects[k] > game.time) active.push(`${POWERS[k].glyph} ${POWERS[k].name} ${Math.ceil((game.effects[k] - game.time) / 1000)}s`);
    if (game.effects.immune > game.time) active.push('◇ 護盾抵擋中');
    $('effects').innerHTML = active.length ? active.map(s => `<span class="effect-chip">${s}</span>`).join('') : 'NO ACTIVE POWERS / 道具吃到立即生效';
    const stateText = { ready: '準備部署', running: '遊戲中', paused: '暫停觀察', failed: '本局結束', 'level-clear': '關卡完成', won: '戰役完成' };
    $('status-text').textContent = unavailable ? '場景中斷' : campaign?.record.replay === 'pending' ? '等待解鎖' : storageError ? '等待存檔' : stateText[game.state];
    $('view-mode').textContent = game.state === 'paused' && !countdown ? '自由觀察' : '固定視角'; drawMap();
}
function frame(now) {
    requestAnimationFrame(frame);
    const delta = lastFrame ? Math.min(100, now - lastFrame) : 0; lastFrame = now;
    if (!renderer || renderer.lost || document.hidden || !initialized) return;
    if (countdown && now >= countdown) begin();
    if (!countdown && !busy && !storageError && !unavailable && !conflict) {
        game.advance(delta);
        const events = game.drain();
        if (events.length) {
            renderer.events(events, game); playEvents(events, sound, music);
            const latest = events.filter(e => ['eat', 'power', 'level-clear', 'won', 'lose'].includes(e.type)).at(-1);
            if (latest) $('live-region').textContent = latest.type === 'power' ? `取得${POWERS[latest.kind].name}` : latest.type === 'eat' ? `${latest.kind === 'food' ? '能量' : '甜點'}，戰役分數 ${game.score}` : latest.type === 'lose' ? reasonText[game.reason] : '關卡完成';
            if (game.score > highScore) { highScore = game.score; try { localStorage.setItem(BEST_KEY, String(highScore)); } catch { /* Main save will surface a storage error. */ } }
            if (['failed', 'level-clear', 'won'].includes(game.state)) { showState(); controls(); }
        }
        if (game.revision !== lastRevision || game.state === 'running' && game.time - lastSave >= 250) save();
    }
    const animate = !countdown && !busy && game.state !== 'paused' && !storageError && campaign?.record.replay !== 'pending';
    renderer.draw(game, animate ? delta / 1000 : 0);
    if (now - lastHud > 90) { updateHUD(); lastHud = now; }
}

$('start-button').addEventListener('click', primary);
$('pause-button').addEventListener('click', () => game.state === 'paused' ? requestRound('continue') : pause());
$('restart-button').addEventListener('click', () => requestRound('retry'));
$('new-button').addEventListener('click', () => {
    pause(true);
    if (!campaign?.record.played || confirm('開始新戰役會取代目前戰役，且需要解鎖「再來一局」。確定繼續？')) requestRound('new');
});
$('cancel-payment').addEventListener('click', () => gate.cancel());
$('theme-toggle').addEventListener('click', () => { const theme = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light'; document.documentElement.dataset.theme = theme; try { localStorage.setItem('casharcade-theme', theme); } catch { /* Page preference still works. */ } });
$('fullscreen-button').addEventListener('click', async () => {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else if ($('game-card').requestFullscreen) await $('game-card').requestFullscreen(); else $('storage-note').textContent = '此瀏覽器不支援全螢幕；仍可使用目前的響應式版面。'; } catch { $('storage-note').textContent = '瀏覽器未允許全螢幕，遊戲仍可正常操作。'; }
});
const keyDirections = { ArrowUp: 'forward', w: 'forward', ArrowDown: 'back', s: 'back', ArrowLeft: 'left', a: 'left', ArrowRight: 'right', d: 'right', e: 'rise', q: 'dive' };
window.addEventListener('keydown', event => {
    if (event.target?.closest?.('input,textarea,select,[contenteditable="true"]') || ['music-toggle', 'sound-toggle', 'theme-toggle'].includes(event.target?.id)) return;
    const k = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if (keyDirections[k] || [' ', 'p', 'Escape', 'r'].includes(k)) event.preventDefault(); else return;
    if (event.repeat) return;
    if (keyDirections[k]) input(keyDirections[k]);
    else if (k === 'r') requestRound('retry');
    else if (game.state === 'running' || countdown) pause();
    else if (game.state === 'paused') requestRound('continue');
});
document.querySelectorAll('[data-direction]').forEach(button => button.addEventListener('click', () => input(button.dataset.direction)));
canvas.addEventListener('pointerdown', event => { if (game.state === 'running') { touchStart = { x: event.clientX, y: event.clientY, id: event.pointerId }; canvas.setPointerCapture(event.pointerId); } });
canvas.addEventListener('pointerup', event => {
    if (!touchStart || touchStart.id !== event.pointerId) return;
    const dx = event.clientX - touchStart.x, dy = event.clientY - touchStart.y; touchStart = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 15) return;
    input(Math.abs(dx) > Math.abs(dy) ? dx > 0 ? 'right' : 'left' : dy > 0 ? 'back' : 'forward');
});
canvas.addEventListener('pointercancel', () => { touchStart = null; });
window.addEventListener('blur', () => pause(true));
document.addEventListener('visibilitychange', () => { if (document.hidden) { pause(true); lastFrame = 0; } });
window.addEventListener('pagehide', () => { if (!unavailable && !conflict) { pause(true); save(); } });
window.addEventListener('storage', event => {
    if (event.key !== SAVE_KEY || !initialized) return;
    pause(true, false); conflict = true; controls();
    message('ANOTHER TAB', '其他分頁更新了戰役', '為避免覆蓋存檔或重複解鎖，本頁已停止。請重新載入後繼續。', '請重新載入本頁', { disabled: true });
});

async function initialize() {
    try {
        sound = window.CashArcadeAudio.create({ storageKey: 'casharcade-snake-sound-muted', toggleButton: $('sound-toggle'), musicMix: true });
        music = window.CashArcadeMusic.create({ score: window.CashArcadeScores.snake, storagePrefix: 'casharcade-snake-music', toggleButton: $('music-toggle'), volumeInput: $('music-volume'), volumeLabel: $('music-volume-value'), trackLabel: $('music-track'), audioOutput: sound.musicOutput });
        try { store = new CampaignStore(localStorage, sessionStorage); campaign = new Campaign(store, gate); game = campaign.game; restored = campaign.record.played; highScore = Math.max(0, Number(localStorage.getItem(BEST_KEY)) || 0); }
        catch { storageError = true; $('storage-note').classList.add('error'); $('storage-note').textContent = '戰役存檔無法讀取或驗證。請確認儲存權限，勿清除未完成付款資料。'; }
        const { SnakeRenderer } = await import('./renderer.mjs');
        renderer = new SnakeRenderer(canvas, {
            onLost: () => { pause(true); unavailable = true; music.pause(); controls(); message('WEBGL INTERRUPTED', '3D 畫面暫時中斷', '已暫停並保留原局；待瀏覽器恢復後可免費繼續。', '等待恢復', { disabled: true }); },
            onRestored: () => { unavailable = false; showState(); controls(); },
        });
        renderer.load(game); await renderer.ready(); initialized = true;
        if (game.state === 'paused') renderer.survey(true);
        $('power-guide-list').innerHTML = Object.values(POWERS).map(p => `<div><strong>${p.glyph} ${p.name}</strong>${p.detail}</div>`).join('');
        showState(); controls(); updateHUD(); requestAnimationFrame(frame); gate.initialize();
    } catch (error) {
        unavailable = true; music?.pause();
        message('WEBGL2 REQUIRED', '無法建立 3D 場景', error.message || '請檢查網路、更新瀏覽器或啟用硬體加速。沒有開始遊戲或付款。', '請檢查瀏覽器設定', { disabled: true });
        $('status-text').textContent = '場景未就緒';
    }
}
initialize();
