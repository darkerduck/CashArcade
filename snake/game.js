(() => {
    'use strict';

    const GRID_SIZE = 20;
    const START_DELAY = 150;
    const MIN_DELAY = 70;
    const SPEED_STEP = 8;
    const SCORE_STEP = 10;
    const DESSERT_INTERVAL_MS = 20000;
    const DESSERT_LIFETIME_MS = 10000;
    const BOMB_RELOCATION_MS = 30000;
    const CASHLINK_PUBLISHABLE_KEY = 'clgame_Z8DkWrGouzFoSO4z1uC0SrKkQWpoSx8GJGWrHmN6MDm9Rx4L';
    const DIRECTIONS = Object.freeze({
        up: { x: 0, y: -1 },
        down: { x: 0, y: 1 },
        left: { x: -1, y: 0 },
        right: { x: 1, y: 0 },
    });

    const canvas = document.querySelector('#game-canvas');
    const context = canvas.getContext('2d');
    const overlay = document.querySelector('#game-overlay');
    const overlayKicker = document.querySelector('#overlay-kicker');
    const overlayTitle = document.querySelector('#overlay-title');
    const overlayMessage = document.querySelector('#overlay-message');
    const startButton = document.querySelector('#start-button');
    const paymentFallback = document.querySelector('#payment-fallback');
    const paymentNote = document.querySelector('#payment-note');
    const pauseButton = document.querySelector('#pause-button');
    const restartButton = document.querySelector('#restart-button');
    const scoreElement = document.querySelector('#score');
    const highScoreElement = document.querySelector('#high-score');
    const speedElement = document.querySelector('#speed');
    const dessertStatus = document.querySelector('#dessert-status');
    const statusElement = document.querySelector('#status-text');
    const liveRegion = document.querySelector('#live-region');
    const themeToggle = document.querySelector('#theme-toggle');
    const sound = CashArcadeAudio.create({ storageKey: 'casharcade-snake-sound-muted', toggleButton: document.querySelector('#sound-toggle') });

    let snake;
    let food;
    let dessert;
    let bomb;
    let direction;
    let queuedDirection;
    let score;
    let foodsEaten;
    let growthRemaining;
    let elapsedPlayMs;
    let runStartedAt;
    let dessertCycle;
    let bombCycle;
    let timer;
    let gameState;
    let touchStart;
    let cashLinkArcade;
    let paymentPending = false;
    let paymentRetryRequired = false;
    let roundStarted = false;
    let highScore = readNumber('casharcade-high-score');

    function readNumber(key) {
        try {
            return Number.parseInt(localStorage.getItem(key) || '0', 10) || 0;
        } catch {
            return 0;
        }
    }

    function saveValue(key, value) {
        try {
            localStorage.setItem(key, String(value));
        } catch {
            // The game remains playable when storage is unavailable.
        }
    }

    function resetGame() {
        window.clearTimeout(timer);
        snake = [
            { x: 10, y: 10 },
            { x: 9, y: 10 },
            { x: 8, y: 10 },
        ];
        direction = DIRECTIONS.right;
        queuedDirection = DIRECTIONS.right;
        score = 0;
        foodsEaten = 0;
        growthRemaining = 0;
        elapsedPlayMs = 0;
        runStartedAt = null;
        dessertCycle = 0;
        bombCycle = 0;
        gameState = 'ready';
        dessert = null;
        food = placeItem();
        bomb = placeItem([food]);
        pauseButton.disabled = true;
        pauseButton.textContent = '暫停';
        showOverlay('READY?', '準備開玩', '使用方向鍵、WASD 或下方按鈕控制。', '開始遊戲');
        updateHud();
        updateDessertStatus();
        draw();
    }

    function startGame() {
        if (gameState === 'running') return;

        sound.play(gameState === 'paused' ? 'resume' : 'start');
        runStartedAt = performance.now();
        gameState = 'running';
        overlay.hidden = true;
        pauseButton.disabled = false;
        pauseButton.textContent = '暫停';
        updateStatus('遊戲中');
        liveRegion.textContent = '遊戲開始';
        scheduleTick();
    }

    function freezePlayClock() {
        if (runStartedAt !== null) {
            elapsedPlayMs += Math.max(0, performance.now() - runStartedAt);
            runStartedAt = null;
        }
    }

    function playingTime() {
        return elapsedPlayMs + (runStartedAt === null ? 0 : Math.max(0, performance.now() - runStartedAt));
    }

    function pauseGame(automatic = false) {
        if (gameState !== 'running') return;
        if (!automatic) sound.play('pause');
        window.clearTimeout(timer);
        freezePlayClock();
        gameState = 'paused';
        pauseButton.textContent = '繼續';
        showOverlay('PAUSED', '遊戲暫停', '休息一下。按空白鍵或按鈕繼續。', '繼續遊戲');
        updateStatus('已暫停');
        liveRegion.textContent = '遊戲已暫停';
    }

    function togglePause() {
        if (gameState === 'running') {
            pauseGame();
            return;
        }

        if (gameState === 'paused' && !paymentRetryRequired && !paymentPending) {
            startGame();
        }
    }

    function scheduleTick() {
        window.clearTimeout(timer);
        timer = window.setTimeout(tick, currentDelay());
    }

    function currentDelay() {
        return Math.max(MIN_DELAY, START_DELAY - Math.floor(foodsEaten / 5) * SPEED_STEP);
    }

    function tick() {
        if (gameState !== 'running') return;

        updateDessert();
        direction = queuedDirection;
        const head = snake[0];
        const next = {
            x: wrapCoordinate(head.x + direction.x),
            y: wrapCoordinate(head.y + direction.y),
        };
        updateBomb(next);
        const wrapped = head.x + direction.x !== next.x || head.y + direction.y !== next.y;
        if (sameCell(next, bomb)) {
            finishGame(false, 'bomb');
            return;
        }

        const ateFood = sameCell(next, food);
        const ateDessert = sameCell(next, dessert);
        const growth = ateDessert ? 2 : ateFood ? 1 : 0;
        const collisionBody = growthRemaining + growth > 0 ? snake : snake.slice(0, -1);
        const hitSelf = collisionBody.some((segment) => segment.x === next.x && segment.y === next.y);

        if (hitSelf) {
            finishGame(false);
            return;
        }

        snake.unshift(next);
        growthRemaining += growth;
        if (growthRemaining > 0) growthRemaining -= 1;
        else snake.pop();

        if (ateFood || ateDessert) {
            const previousFoodsEaten = foodsEaten;
            score += SCORE_STEP * growth;
            foodsEaten += growth;
            highScore = Math.max(highScore, score);
            saveValue('casharcade-high-score', highScore);
            sound.play(ateDessert ? 'dessert' : 'food');
            if (ateFood) food = null;
            if (ateDessert) {
                dessert = null;
                updateDessertStatus();
            }

            if (snake.length === GRID_SIZE * GRID_SIZE) {
                updateHud();
                finishGame(true, 'full', .26);
                return;
            }

            ensureFood();
            if (Math.floor(foodsEaten / 5) > Math.floor(previousFoodsEaten / 5)) sound.play('speed', .26);
            liveRegion.textContent = `得分 ${score}`;
        }

        if (wrapped && !ateFood && !ateDessert) sound.play('wrap');

        updateHud();
        draw();
        scheduleTick();
    }

    function wrapCoordinate(value) {
        return (value + GRID_SIZE) % GRID_SIZE;
    }

    function finishGame(won, cause = 'self', soundDelay = 0) {
        window.clearTimeout(timer);
        freezePlayClock();
        sound.play(cause === 'bomb' ? 'bomb' : won ? 'win' : 'lose', soundDelay);
        gameState = won ? 'won' : 'over';
        pauseButton.disabled = true;
        updateStatus(won ? '全盤制霸' : cause === 'bomb' ? '碰到炸彈' : '遊戲結束');
        showOverlay(
            won ? 'PERFECT!' : 'GAME OVER',
            won ? '你填滿了整座街機' : cause === 'bomb' ? '碰到炸彈！' : `本局得分 ${score}`,
            won ? '這不是運氣，是傳說。' : `本局 ${score} 分，最高紀錄 ${highScore} 分。`,
            '再玩一次',
        );
        liveRegion.textContent = won ? '恭喜完成遊戲' : `${cause === 'bomb' ? '碰到炸彈，' : ''}遊戲結束，得分 ${score}`;
        draw(true);
    }

    function sameCell(first, second) {
        return Boolean(first && second && first.x === second.x && first.y === second.y);
    }

    function placeItem(occupied = []) {
        const openCells = [];

        for (let y = 0; y < GRID_SIZE; y += 1) {
            for (let x = 0; x < GRID_SIZE; x += 1) {
                if (!snake.some((segment) => segment.x === x && segment.y === y)
                    && !occupied.some((item) => item && item.x === x && item.y === y)) {
                    openCells.push({ x, y });
                }
            }
        }

        return openCells.length ? openCells[Math.floor(Math.random() * openCells.length)] : null;
    }

    function ensureFood() {
        if (food) return;
        food = placeItem([bomb, dessert]);
        if (!food && bomb) {
            bomb = null;
            food = placeItem([dessert]);
        }
        if (!food && dessert) {
            dessert = null;
            food = placeItem();
        }
    }

    function updateBomb(next) {
        const cycle = Math.floor(playingTime() / BOMB_RELOCATION_MS);
        if (cycle <= bombCycle) return;
        bombCycle = cycle;
        if (!bomb) return;

        const nextNeighbors = Object.values(DIRECTIONS).map((step) => ({
            x: wrapCoordinate(next.x + step.x),
            y: wrapCoordinate(next.y + step.y),
        }));
        const newPosition = placeItem([food, dessert, bomb, next, ...nextNeighbors]);
        if (newPosition) bomb = newPosition;
    }

    function updateDessert() {
        const elapsed = playingTime();
        const cycle = Math.floor(elapsed / DESSERT_INTERVAL_MS);
        const withinWindow = cycle > 0 && elapsed - cycle * DESSERT_INTERVAL_MS < DESSERT_LIFETIME_MS;

        if (cycle !== dessertCycle) {
            dessertCycle = cycle;
            dessert = withinWindow ? placeItem([food, bomb]) : null;
            if (dessert) liveRegion.textContent = '限時甜點出現，10 秒後消失';
        } else if (!withinWindow && dessert) {
            dessert = null;
            liveRegion.textContent = '限時甜點已消失';
        }
        updateDessertStatus(elapsed);
    }

    function updateDessertStatus(elapsed = playingTime()) {
        const phase = elapsed % DESSERT_INTERVAL_MS;
        dessertStatus.textContent = dessert
            ? `甜點剩餘 ${Math.ceil((DESSERT_LIFETIME_MS - phase) / 1000)} 秒`
            : `下次甜點 ${Math.ceil((DESSERT_INTERVAL_MS - phase) / 1000)} 秒後`;
    }

    function setDirection(nextDirection) {
        if (!nextDirection) return;

        const reversesCurrentDirection =
            nextDirection.x + direction.x === 0 && nextDirection.y + direction.y === 0;

        if (!reversesCurrentDirection) {
            queuedDirection = nextDirection;
        }

        if (gameState === 'ready') {
            void requestRoundStart();
        }
    }

    async function requestRoundStart(forceRestart = false) {
        if (paymentPending) return;
        sound.resume();

        if (gameState === 'paused' && !forceRestart && !paymentRetryRequired) {
            togglePause();
            return;
        }

        const needsPayment = roundStarted && (paymentRetryRequired || forceRestart || gameState === 'over' || gameState === 'won');
        if (needsPayment) {
            if (gameState === 'running') {
                window.clearTimeout(timer);
                freezePlayClock();
                gameState = 'paused';
                pauseButton.textContent = '繼續';
            }
            paymentRetryRequired = true;
            pauseButton.disabled = true;
            if (!cashLinkArcade) {
                showPaymentFailure('CashLink 付款服務目前無法載入，請稍後重試。');
                return;
            }

            setPaymentPending(true);
            paymentFallback.hidden = true;
            showOverlay('PAYMENT', '等待 1,000 sat 付款', '付款完成並消耗解鎖額度後，下一局才會開始。', '付款處理中…');
            try {
                await cashLinkArcade.unlock();
                resetGame();
                paymentRetryRequired = false;
                roundStarted = true;
                startGame();
            } catch (error) {
                if (error && error.code === 'popup_blocked' && error.checkoutUrl) {
                    showPaymentFallback(error.checkoutUrl);
                }
                const message = error && error.code === 'cancelled'
                    ? '付款已取消或視窗已關閉；本局尚未開始，您可以重試。'
                    : error && error.code === 'popup_blocked'
                        ? '瀏覽器阻擋付款視窗，請使用下方完整付款頁。'
                        : '付款服務暫時無法完成；本局尚未開始，請稍後重試。';
                showPaymentFailure(message);
            } finally {
                setPaymentPending(false);
            }
            return;
        }

        if (forceRestart || gameState === 'over' || gameState === 'won') {
            resetGame();
        }
        startGame();
        roundStarted = true;
    }

    function setPaymentPending(pending) {
        paymentPending = pending;
        startButton.disabled = pending;
        restartButton.disabled = pending;
        pauseButton.disabled = pending || paymentRetryRequired || gameState === 'over' || gameState === 'won' || gameState === 'ready';
        if (pending) updateStatus('等待付款');
    }

    function showPaymentFallback(checkoutUrl) {
        paymentFallback.href = checkoutUrl;
        paymentFallback.hidden = false;
    }

    function showPaymentFailure(message) {
        showOverlay('PAYMENT', '尚未解鎖下一局', message, '重試付款');
        updateStatus('等待付款');
        liveRegion.textContent = message;
    }

    function initializeCashLink() {
        try {
            cashLinkArcade = window.CashLinkArcade.create({ publishableKey: CASHLINK_PUBLISHABLE_KEY });
        } catch {
            paymentNote.textContent = '第一局免費；CashLink 付款服務目前無法載入。';
            return;
        }

        cashLinkArcade.on('popup_blocked', ({ checkoutUrl }) => showPaymentFallback(checkoutUrl));
        cashLinkArcade.on('payment_opened', () => {
            updateStatus('等待付款');
            liveRegion.textContent = 'CashLink 付款視窗已開啟';
        });
        cashLinkArcade.on('payment_status', (order) => {
            const received = Number(order && order.received_satoshis) || 0;
            overlayMessage.textContent = received > 0
                ? `已偵測 ${received.toLocaleString()} sat，等待足額付款與解鎖。`
                : '等待 CashLink 偵測付款；付款完成前不會開始下一局。';
        });
        cashLinkArcade.on('cancelled', () => showPaymentFailure('付款已取消；本局尚未開始，您可以重試。'));

        cashLinkArcade.handshake().then((game) => {
            const price = Number(game && game.price_satoshis) || 1000;
            paymentNote.textContent = `第一局免費；之後每局需透過 CashLink 支付 ${price.toLocaleString()} sat。`;
        }).catch(() => {
            paymentNote.textContent = '第一局免費；CashLink 暫時無法確認後續局數的付款設定。';
        });
    }

    function draw(failed = false) {
        const styles = getComputedStyle(document.documentElement);
        const background = styles.getPropertyValue('--bg').trim();
        const grid = styles.getPropertyValue('--grid').trim();
        const accent = styles.getPropertyValue('--accent').trim();
        const accentStrong = styles.getPropertyValue('--accent-strong').trim();
        const foodColor = styles.getPropertyValue('--food').trim();
        const dessertColor = styles.getPropertyValue('--dessert').trim();
        const danger = styles.getPropertyValue('--danger').trim();
        const cell = canvas.width / GRID_SIZE;

        context.fillStyle = background;
        context.fillRect(0, 0, canvas.width, canvas.height);

        context.strokeStyle = grid;
        context.lineWidth = 1;
        for (let index = 1; index < GRID_SIZE; index += 1) {
            const position = index * cell;
            context.beginPath();
            context.moveTo(position, 0);
            context.lineTo(position, canvas.height);
            context.moveTo(0, position);
            context.lineTo(canvas.width, position);
            context.stroke();
        }

        drawFood(cell, foodColor);
        drawDessert(cell, dessertColor);
        drawBomb(cell, danger, background);

        snake.forEach((segment, index) => {
            const gap = index === 0 ? 2 : 3;
            context.fillStyle = failed && index === 0 ? danger : index === 0 ? accent : accentStrong;
            roundedRect(
                segment.x * cell + gap,
                segment.y * cell + gap,
                cell - gap * 2,
                cell - gap * 2,
                index === 0 ? 8 : 6,
            );
            context.fill();
        });

        drawEyes(cell, background);
    }

    function drawFood(cell, color) {
        if (!food) return;

        const centerX = food.x * cell + cell / 2;
        const centerY = food.y * cell + cell / 2;
        const pulse = 0.92 + Math.sin(Date.now() / 180) * 0.05;
        context.save();
        context.shadowColor = color;
        context.shadowBlur = 16;
        context.fillStyle = color;
        context.beginPath();
        context.arc(centerX, centerY, cell * 0.28 * pulse, 0, Math.PI * 2);
        context.fill();
        context.restore();
    }

    function drawDessert(cell, color) {
        if (!dessert) return;

        const centerX = dessert.x * cell + cell / 2;
        const centerY = dessert.y * cell + cell / 2;
        const remaining = Math.max(0, DESSERT_LIFETIME_MS - playingTime() % DESSERT_INTERVAL_MS);
        context.save();
        context.shadowColor = color;
        context.shadowBlur = 14;
        context.fillStyle = color;
        context.beginPath();
        context.moveTo(centerX, centerY - cell * .3);
        context.lineTo(centerX + cell * .3, centerY);
        context.lineTo(centerX, centerY + cell * .3);
        context.lineTo(centerX - cell * .3, centerY);
        context.closePath();
        context.fill();
        context.shadowBlur = 0;
        context.strokeStyle = color;
        context.lineWidth = 2;
        context.beginPath();
        context.arc(centerX, centerY, cell * .42, -Math.PI / 2,
            -Math.PI / 2 + Math.PI * 2 * remaining / DESSERT_LIFETIME_MS);
        context.stroke();
        context.restore();
    }

    function drawBomb(cell, color, background) {
        if (!bomb) return;

        const centerX = bomb.x * cell + cell / 2;
        const centerY = bomb.y * cell + cell / 2;
        context.save();
        context.fillStyle = color;
        context.beginPath();
        context.arc(centerX, centerY + cell * .06, cell * .25, 0, Math.PI * 2);
        context.fill();
        context.strokeStyle = color;
        context.lineWidth = 3;
        context.beginPath();
        context.moveTo(centerX, centerY - cell * .18);
        context.lineTo(centerX + cell * .13, centerY - cell * .33);
        context.stroke();
        context.strokeStyle = background;
        context.lineWidth = 2;
        context.beginPath();
        context.moveTo(centerX - cell * .09, centerY - cell * .02);
        context.lineTo(centerX + cell * .09, centerY + cell * .15);
        context.moveTo(centerX + cell * .09, centerY - cell * .02);
        context.lineTo(centerX - cell * .09, centerY + cell * .15);
        context.stroke();
        context.restore();
    }

    function drawEyes(cell, color) {
        if (!snake.length) return;

        const head = snake[0];
        const centerX = head.x * cell + cell / 2;
        const centerY = head.y * cell + cell / 2;
        const sideways = direction.x !== 0;
        const forward = cell * 0.18;
        const spread = cell * 0.15;
        const eyeRadius = Math.max(2, cell * 0.05);

        context.fillStyle = color;
        for (const side of [-1, 1]) {
            context.beginPath();
            context.arc(
                centerX + direction.x * forward + (sideways ? 0 : side * spread),
                centerY + direction.y * forward + (sideways ? side * spread : 0),
                eyeRadius,
                0,
                Math.PI * 2,
            );
            context.fill();
        }
    }

    function roundedRect(x, y, width, height, radius) {
        context.beginPath();
        context.roundRect(x, y, width, height, radius);
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
        speedElement.textContent = `×${(START_DELAY / currentDelay()).toFixed(1)}`;
        if (gameState === 'ready') updateStatus('準備');
    }

    function updateStatus(status) {
        statusElement.textContent = status;
    }

    function handleKeydown(event) {
        const keyMap = {
            ArrowUp: DIRECTIONS.up,
            w: DIRECTIONS.up,
            W: DIRECTIONS.up,
            ArrowDown: DIRECTIONS.down,
            s: DIRECTIONS.down,
            S: DIRECTIONS.down,
            ArrowLeft: DIRECTIONS.left,
            a: DIRECTIONS.left,
            A: DIRECTIONS.left,
            ArrowRight: DIRECTIONS.right,
            d: DIRECTIONS.right,
            D: DIRECTIONS.right,
        };

        if (keyMap[event.key]) {
            event.preventDefault();
            setDirection(keyMap[event.key]);
            return;
        }

        if (event.code === 'Space') {
            event.preventDefault();
            if (gameState === 'ready') void requestRoundStart();
            else togglePause();
            return;
        }

        if (event.key === 'r' || event.key === 'R') {
            event.preventDefault();
            void requestRoundStart(true);
        }
    }

    function applyStoredTheme() {
        let storedTheme = '';
        try {
            storedTheme = localStorage.getItem('casharcade-theme') || '';
        } catch {
            // System preference is the fallback.
        }

        const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
        document.documentElement.dataset.theme = storedTheme || (prefersLight ? 'light' : 'dark');
    }

    function toggleTheme() {
        const nextTheme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
        document.documentElement.dataset.theme = nextTheme;
        saveValue('casharcade-theme', nextTheme);
        window.requestAnimationFrame(() => draw(gameState === 'over'));
    }

    startButton.addEventListener('click', () => {
        if (gameState === 'paused' && !paymentRetryRequired) togglePause();
        else void requestRoundStart();
    });
    pauseButton.addEventListener('click', togglePause);
    restartButton.addEventListener('click', () => {
        void requestRoundStart(true);
    });
    themeToggle.addEventListener('click', toggleTheme);
    document.addEventListener('keydown', handleKeydown);
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) pauseGame(true);
    });

    document.querySelectorAll('[data-direction]').forEach((button) => {
        button.addEventListener('click', () => setDirection(DIRECTIONS[button.dataset.direction]));
    });

    canvas.addEventListener('pointerdown', (event) => {
        touchStart = { x: event.clientX, y: event.clientY };
    });

    canvas.addEventListener('pointerup', (event) => {
        if (!touchStart) return;
        const deltaX = event.clientX - touchStart.x;
        const deltaY = event.clientY - touchStart.y;
        touchStart = null;

        if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < 20) return;
        if (Math.abs(deltaX) > Math.abs(deltaY)) {
            setDirection(deltaX > 0 ? DIRECTIONS.right : DIRECTIONS.left);
        } else {
            setDirection(deltaY > 0 ? DIRECTIONS.down : DIRECTIONS.up);
        }
    });

    applyStoredTheme();
    highScoreElement.textContent = String(highScore).padStart(4, '0');
    resetGame();
    initializeCashLink();
})();
