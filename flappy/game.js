(() => {
    'use strict';

    const WIDTH = 720;
    const HEIGHT = 540;
    const GROUND_Y = 510;
    const PLAYER_X = 160;
    const PLAYER_RADIUS = 16;
    const GRAVITY = 1500;
    const FLAP_VELOCITY = -460;
    const INITIAL_SPEED = 190;
    const MAX_SPEED = 286;
    const INITIAL_GAP = 160;
    const MIN_GAP = 125;
    const GATE_WIDTH = 76;
    const GATE_SPACING = 280;
    const STORAGE_KEY = 'casharcade-flappy-high-score';

    const canvas = document.querySelector('#game-canvas');
    const renderer = new NeonFlightRenderer(canvas, document.querySelector('#bird-preview'));
    const overlay = document.querySelector('#game-overlay');
    const overlayKicker = document.querySelector('#overlay-kicker');
    const overlayTitle = document.querySelector('#overlay-title');
    const overlayMessage = document.querySelector('#overlay-message');
    const startButton = document.querySelector('#start-button');
    const pauseButton = document.querySelector('#pause-button');
    const restartButton = document.querySelector('#restart-button');
    const scoreElement = document.querySelector('#score');
    const highScoreElement = document.querySelector('#high-score');
    const speedElement = document.querySelector('#speed');
    const statusElement = document.querySelector('#status-text');
    const liveRegion = document.querySelector('#live-region');
    const themeToggle = document.querySelector('#theme-toggle');
    const sound = CashArcadeAudio.create({ storageKey: 'casharcade-flappy-sound-muted', toggleButton: document.querySelector('#sound-toggle'), musicMix: true });
    const music = CashArcadeMusic.create({ score: CashArcadeScores.flappy, storagePrefix: 'casharcade-flappy-music',
        toggleButton: document.querySelector('#music-toggle'), volumeInput: document.querySelector('#music-volume'),
        volumeLabel: document.querySelector('#music-volume-value'), trackLabel: document.querySelector('#music-track'), audioOutput: sound.musicOutput });

    let player;
    let gates;
    let score;
    let highScore = readHighScore();
    let gameState;
    let gateSpeed;
    let gateGap;
    let animationFrame;
    let previousTime;
    let worldTime;

    function readHighScore() {
        try {
            return Number.parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10) || 0;
        } catch {
            return 0;
        }
    }

    function saveHighScore() {
        try {
            localStorage.setItem(STORAGE_KEY, String(highScore));
        } catch {
            // The game remains playable when storage is unavailable.
        }
    }

    function resetGame() {
        renderer.reset();
        music.pause();
        cancelAnimationFrame(animationFrame);
        player = { y: HEIGHT / 2, velocity: 0, rotation: 0 };
        gates = [];
        score = 0;
        gateSpeed = INITIAL_SPEED;
        gateGap = INITIAL_GAP;
        worldTime = 0;
        previousTime = 0;
        addGate(WIDTH + 120);
        addGate(WIDTH + 120 + GATE_SPACING);
        gameState = 'ready';
        pauseButton.disabled = true;
        pauseButton.textContent = '暫停';
        showOverlay('READY TO LAUNCH?', '準備起飛', '點擊、觸控或按 Space，穿越每一道能源閘門。', '開始飛行');
        updateHud();
        draw();
    }

    function startGame() {
        if (gameState === 'running') return;
        if (gameState === 'over') resetGame();

        sound.play('flap');
        renderer.flap(player.y);
        music.start(1);
        player.velocity = FLAP_VELOCITY;
        gameState = 'running';
        overlay.hidden = true;
        pauseButton.disabled = false;
        pauseButton.textContent = '暫停';
        updateStatus('飛行中');
        liveRegion.textContent = '飛行開始';
        previousTime = performance.now();
        cancelAnimationFrame(animationFrame);
        animationFrame = requestAnimationFrame(loop);
    }

    function flap() {
        if (gameState === 'ready' || gameState === 'over') {
            startGame();
            return;
        }
        if (gameState !== 'running') return;
        music.wake();
        player.velocity = FLAP_VELOCITY;
        sound.play('flap');
        renderer.flap(player.y);
    }

    function togglePause(automatic = false) {
        if (gameState === 'running') {
            music.pause();
            if (!automatic) sound.play('pause');
            cancelAnimationFrame(animationFrame);
            gameState = 'paused';
            pauseButton.textContent = '繼續';
            showOverlay(automatic ? 'FOCUS LOST' : 'PAUSED', automatic ? '已自動暫停' : '飛行暫停', automatic ? '回到頁面後再繼續，小鳥不會在背景墜落。' : '航線已凍結，準備好再繼續。', '繼續飛行');
            updateStatus('已暫停');
            liveRegion.textContent = automatic ? '視窗失焦，遊戲已自動暫停' : '遊戲已暫停';
            draw();
            return;
        }

        if (gameState === 'paused') resumeGame();
    }

    function resumeGame() {
        music.resume();
        sound.play('resume');
        gameState = 'running';
        overlay.hidden = true;
        pauseButton.textContent = '暫停';
        updateStatus('飛行中');
        liveRegion.textContent = '繼續飛行';
        previousTime = performance.now();
        animationFrame = requestAnimationFrame(loop);
    }

    function loop(time) {
        if (gameState !== 'running') return;
        const delta = Math.min((time - previousTime) / 1000, .034);
        previousTime = time;
        update(delta);
        draw();
        if (gameState === 'running') animationFrame = requestAnimationFrame(loop);
    }

    function update(delta) {
        renderer.advance(delta);
        worldTime += delta;
        player.velocity += GRAVITY * delta;
        player.y += player.velocity * delta;
        player.rotation = clamp(player.velocity / 850, -.48, .82);

        gates.forEach((gate) => { gate.x -= gateSpeed * delta; });
        gates = gates.filter((gate) => gate.x + GATE_WIDTH > -10);

        const lastGate = gates[gates.length - 1];
        if (lastGate && lastGate.x <= WIDTH - GATE_SPACING) addGate(lastGate.x + GATE_SPACING);

        gates.forEach((gate) => {
            if (!gate.scored && gate.x + GATE_WIDTH < PLAYER_X) {
                gate.scored = true;
                score += 1;
                sound.play('pass');
                renderer.pass(gate.x + GATE_WIDTH / 2, (gate.gapTop + gate.gapBottom) / 2);
                music.duck(); music.phase(Math.floor(score / 10));
                if (score % 5 === 0) sound.play('speed');
                highScore = Math.max(highScore, score);
                saveHighScore();
                updateDifficulty();
                updateHud();
            }
        });

        if (hasCollision()) endGame();
    }

    function addGate(x) {
        const safeMargin = 72;
        const minimumCenter = safeMargin + gateGap / 2;
        const maximumCenter = GROUND_Y - safeMargin - gateGap / 2;
        const gapCenter = minimumCenter + Math.random() * (maximumCenter - minimumCenter);
        gates.push({ x, gapTop: gapCenter - gateGap / 2, gapBottom: gapCenter + gateGap / 2, scored: false });
    }

    function updateDifficulty() {
        const tier = Math.floor(score / 5);
        gateSpeed = Math.min(INITIAL_SPEED + tier * 12, MAX_SPEED);
        gateGap = Math.max(INITIAL_GAP - tier * 5, MIN_GAP);
        if (score > 0 && score % 5 === 0) {
            updateStatus(`速度 ×${(gateSpeed / INITIAL_SPEED).toFixed(1)}`);
            liveRegion.textContent = `已穿越 ${score} 道閘門，速度提升`;
        }
    }

    function hasCollision() {
        if (player.y - PLAYER_RADIUS <= 0 || player.y + PLAYER_RADIUS >= GROUND_Y) return true;

        return gates.some((gate) => {
            return circleHitsRectangle(gate.x, 0, GATE_WIDTH, gate.gapTop)
                || circleHitsRectangle(gate.x - 8, gate.gapTop - 20, GATE_WIDTH + 16, 20)
                || circleHitsRectangle(gate.x, gate.gapBottom, GATE_WIDTH, GROUND_Y - gate.gapBottom)
                || circleHitsRectangle(gate.x - 8, gate.gapBottom, GATE_WIDTH + 16, 20);
        });
    }

    function circleHitsRectangle(x, y, width, height) {
        const nearestX = clamp(PLAYER_X, x, x + width);
        const nearestY = clamp(player.y, y, y + height);
        return (PLAYER_X - nearestX) ** 2 + (player.y - nearestY) ** 2 < PLAYER_RADIUS ** 2;
    }

    function endGame() {
        music.pause();
        cancelAnimationFrame(animationFrame);
        sound.play('lose');
        renderer.lose(player.y);
        gameState = 'over';
        pauseButton.disabled = true;
        showOverlay('FLIGHT ENDED', `本局穿越 ${score} 道閘門`, `最高紀錄 ${highScore} 分。再試一次，飛得更遠。`, '再飛一次');
        updateStatus('飛行結束');
        liveRegion.textContent = `飛行結束，本局得分 ${score}`;
    }

    function draw() {
        renderer.draw({ player, gates, time: worldTime, speed: gateSpeed, state: gameState,
            light: document.documentElement.dataset.theme === 'light' });
    }

    function clamp(value, minimum, maximum) {
        return Math.max(minimum, Math.min(maximum, value));
    }

    function showOverlay(kicker, title, message, buttonLabel) {
        overlayKicker.textContent = kicker;
        overlayTitle.textContent = title;
        overlayMessage.textContent = message;
        startButton.textContent = buttonLabel;
        overlay.hidden = false;
    }

    function updateHud() {
        scoreElement.textContent = String(score).padStart(4, '0');
        highScoreElement.textContent = String(highScore).padStart(4, '0');
        speedElement.textContent = `×${(gateSpeed / INITIAL_SPEED).toFixed(1)}`;
    }

    function updateStatus(status) {
        statusElement.textContent = status;
    }

    function handleKeydown(event) {
        if (['INPUT','TEXTAREA','SELECT'].includes(event.target?.tagName) || event.target?.id === 'music-toggle') return;
        if ([' ', 'Spacebar', 'ArrowUp', 'w', 'W', 'p', 'P', 'Escape'].includes(event.key)) event.preventDefault();
        if (event.repeat) return;
        if (event.key === ' ' || event.code === 'Space' || event.key === 'ArrowUp' || event.key === 'w' || event.key === 'W') flap();
        if (event.key === 'p' || event.key === 'P' || event.key === 'Escape') togglePause();
        if (event.key === 'r' || event.key === 'R') {
            resetGame();
            startGame();
        }
    }

    function applyTheme() {
        let storedTheme = '';
        try { storedTheme = localStorage.getItem('casharcade-theme') || ''; } catch { /* Use dark default. */ }
        document.documentElement.dataset.theme = storedTheme || 'dark';
    }

    function toggleTheme() {
        const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
        document.documentElement.dataset.theme = next;
        try { localStorage.setItem('casharcade-theme', next); } catch { /* Current page still updates. */ }
        draw();
    }

    startButton.addEventListener('click', () => gameState === 'paused' ? resumeGame() : startGame());
    pauseButton.addEventListener('click', () => togglePause());
    restartButton.addEventListener('click', () => { resetGame(); startGame(); });
    themeToggle.addEventListener('click', toggleTheme);
    canvas.addEventListener('pointerdown', (event) => { event.preventDefault(); flap(); });
    document.addEventListener('keydown', handleKeydown);
    window.addEventListener('blur', () => { if (gameState === 'running') togglePause(true); });
    document.addEventListener('visibilitychange', () => { if (document.hidden && gameState === 'running') togglePause(true); });
    window.addEventListener('pagehide', () => music.pause());
    window.addEventListener('resize', draw);

    applyTheme();
    resetGame();
})();
