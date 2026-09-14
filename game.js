(() => {
    'use strict';

    const GRID_SIZE = 20;
    const START_DELAY = 150;
    const MIN_DELAY = 70;
    const SPEED_STEP = 8;
    const SCORE_STEP = 10;
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
    const pauseButton = document.querySelector('#pause-button');
    const restartButton = document.querySelector('#restart-button');
    const scoreElement = document.querySelector('#score');
    const highScoreElement = document.querySelector('#high-score');
    const speedElement = document.querySelector('#speed');
    const statusElement = document.querySelector('#status-text');
    const liveRegion = document.querySelector('#live-region');
    const themeToggle = document.querySelector('#theme-toggle');

    let snake;
    let food;
    let direction;
    let queuedDirection;
    let score;
    let foodsEaten;
    let timer;
    let gameState;
    let touchStart;
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
        gameState = 'ready';
        food = placeFood();
        pauseButton.disabled = true;
        pauseButton.textContent = '暫停';
        showOverlay('READY?', '準備開玩', '使用方向鍵、WASD 或下方按鈕控制。', '開始遊戲');
        updateHud();
        draw();
    }

    function startGame() {
        if (gameState === 'running') return;

        if (gameState === 'over' || gameState === 'won') {
            resetGame();
        }

        gameState = 'running';
        overlay.hidden = true;
        pauseButton.disabled = false;
        pauseButton.textContent = '暫停';
        updateStatus('遊戲中');
        liveRegion.textContent = '遊戲開始';
        scheduleTick();
    }

    function togglePause() {
        if (gameState === 'running') {
            window.clearTimeout(timer);
            gameState = 'paused';
            pauseButton.textContent = '繼續';
            showOverlay('PAUSED', '遊戲暫停', '休息一下。按空白鍵或按鈕繼續。', '繼續遊戲');
            updateStatus('已暫停');
            liveRegion.textContent = '遊戲已暫停';
            return;
        }

        if (gameState === 'paused') {
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

        direction = queuedDirection;
        const head = snake[0];
        const next = {
            x: wrapCoordinate(head.x + direction.x),
            y: wrapCoordinate(head.y + direction.y),
        };
        const ateFood = next.x === food.x && next.y === food.y;
        const collisionBody = ateFood ? snake : snake.slice(0, -1);
        const hitSelf = collisionBody.some((segment) => segment.x === next.x && segment.y === next.y);

        if (hitSelf) {
            finishGame(false);
            return;
        }

        snake.unshift(next);

        if (ateFood) {
            score += SCORE_STEP;
            foodsEaten += 1;
            highScore = Math.max(highScore, score);
            saveValue('casharcade-high-score', highScore);

            if (snake.length === GRID_SIZE * GRID_SIZE) {
                finishGame(true);
                return;
            }

            food = placeFood();
            liveRegion.textContent = `得分 ${score}`;
        } else {
            snake.pop();
        }

        updateHud();
        draw();
        scheduleTick();
    }

    function wrapCoordinate(value) {
        return (value + GRID_SIZE) % GRID_SIZE;
    }

    function finishGame(won) {
        window.clearTimeout(timer);
        gameState = won ? 'won' : 'over';
        pauseButton.disabled = true;
        updateStatus(won ? '全盤制霸' : '遊戲結束');
        showOverlay(
            won ? 'PERFECT!' : 'GAME OVER',
            won ? '你填滿了整座街機' : `本局得分 ${score}`,
            won ? '這不是運氣，是傳說。' : `最高紀錄 ${highScore} 分，再挑戰一次吧。`,
            '再玩一次',
        );
        liveRegion.textContent = won ? '恭喜完成遊戲' : `遊戲結束，得分 ${score}`;
        draw(true);
    }

    function placeFood() {
        const openCells = [];

        for (let y = 0; y < GRID_SIZE; y += 1) {
            for (let x = 0; x < GRID_SIZE; x += 1) {
                if (!snake.some((segment) => segment.x === x && segment.y === y)) {
                    openCells.push({ x, y });
                }
            }
        }

        return openCells[Math.floor(Math.random() * openCells.length)] || { x: 0, y: 0 };
    }

    function setDirection(nextDirection) {
        if (!nextDirection) return;

        const reversesCurrentDirection =
            nextDirection.x + direction.x === 0 && nextDirection.y + direction.y === 0;

        if (!reversesCurrentDirection) {
            queuedDirection = nextDirection;
        }

        if (gameState === 'ready') {
            startGame();
        }
    }

    function draw(failed = false) {
        const styles = getComputedStyle(document.documentElement);
        const background = styles.getPropertyValue('--bg').trim();
        const grid = styles.getPropertyValue('--grid').trim();
        const accent = styles.getPropertyValue('--accent').trim();
        const accentStrong = styles.getPropertyValue('--accent-strong').trim();
        const foodColor = styles.getPropertyValue('--food').trim();
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
            if (gameState === 'ready') startGame();
            else togglePause();
            return;
        }

        if (event.key === 'r' || event.key === 'R') {
            event.preventDefault();
            resetGame();
            startGame();
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
        if (gameState === 'paused') togglePause();
        else startGame();
    });
    pauseButton.addEventListener('click', togglePause);
    restartButton.addEventListener('click', () => {
        resetGame();
        startGame();
    });
    themeToggle.addEventListener('click', toggleTheme);
    document.addEventListener('keydown', handleKeydown);

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
})();
