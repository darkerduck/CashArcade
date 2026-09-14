(() => {
    'use strict';

    const WIDTH = 720;
    const HEIGHT = 540;
    const PADDLE_Y = 500;
    const PADDLE_HEIGHT = 14;
    const BALL_RADIUS = 8;
    const TOTAL_LEVELS = 3;
    const LEVELS = [
        {
            speed: 310,
            layout: [
                [1, 1, 1, 1, 1, 1, 1, 1, 1],
                [1, 1, 1, 1, 1, 1, 1, 1, 1],
                [1, 1, 1, 1, 1, 1, 1, 1, 1],
                [1, 1, 1, 1, 1, 1, 1, 1, 1],
            ],
        },
        {
            speed: 355,
            intro: '雙翼陣型展開。金色磚塊需擊中兩次，第一次會留下裂痕。',
            layout: [
                [0, 0, 2, 1, 0, 1, 2, 0, 0],
                [0, 2, 1, 1, 0, 1, 1, 2, 0],
                [2, 1, 1, 2, 0, 2, 1, 1, 2],
                [1, 1, 2, 1, 2, 1, 2, 1, 1],
                [0, 1, 1, 2, 2, 2, 1, 1, 0],
                [0, 0, 1, 1, 2, 1, 1, 0, 0],
            ],
        },
        {
            speed: 405,
            intro: '堡壘防線啟動。外牆與核心多為金色雙擊磚塊。',
            layout: [
                [2, 2, 2, 2, 2, 2, 2, 2, 2],
                [2, 1, 1, 2, 1, 2, 1, 1, 2],
                [2, 1, 2, 2, 2, 2, 2, 1, 2],
                [2, 1, 2, 0, 1, 0, 2, 1, 2],
                [2, 1, 2, 2, 2, 2, 2, 1, 2],
                [2, 1, 1, 1, 2, 1, 1, 1, 2],
                [2, 2, 2, 2, 2, 2, 2, 2, 2],
            ],
        },
    ];

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
    const levelElement = document.querySelector('#level');
    const livesElement = document.querySelector('#lives');
    const statusElement = document.querySelector('#status-text');
    const liveRegion = document.querySelector('#live-region');
    const themeToggle = document.querySelector('#theme-toggle');

    let paddle;
    let ball;
    let bricks;
    let score;
    let lives;
    let levelIndex;
    let gameState;
    let animationFrame;
    let previousTime;
    let pointerActive = false;
    const keys = { left: false, right: false };
    let highScore = readHighScore();

    function readHighScore() {
        try {
            return Number.parseInt(localStorage.getItem('casharcade-breakout-high-score') || '0', 10) || 0;
        } catch {
            return 0;
        }
    }

    function saveHighScore() {
        try {
            localStorage.setItem('casharcade-breakout-high-score', String(highScore));
        } catch {
            // The game remains playable when storage is unavailable.
        }
    }

    function resetGame() {
        cancelAnimationFrame(animationFrame);
        score = 0;
        lives = 3;
        levelIndex = 0;
        paddle = { x: WIDTH / 2 - 58, width: 116, speed: 520 };
        buildLevel();
        prepareBall();
        gameState = 'ready';
        previousTime = 0;
        pauseButton.disabled = true;
        pauseButton.textContent = '暫停';
        showOverlay('STAGE 01', '準備發球', '移動擋板，別讓能量球掉出畫面。', '開始遊戲');
        updateHud();
        draw();
    }

    function buildLevel() {
        const config = LEVELS[levelIndex];
        const columns = config.layout[0].length;
        const brickWidth = 64;
        const brickHeight = 22;
        const gap = 8;
        const startX = (WIDTH - (columns * brickWidth + (columns - 1) * gap)) / 2;
        bricks = [];

        for (let row = 0; row < config.layout.length; row += 1) {
            for (let column = 0; column < columns; column += 1) {
                const durability = config.layout[row][column];
                if (durability === 0) continue;
                bricks.push({
                    x: startX + column * (brickWidth + gap),
                    y: 74 + row * (brickHeight + gap),
                    width: brickWidth,
                    height: brickHeight,
                    hp: durability,
                    maxHp: durability,
                    row,
                });
            }
        }
    }

    function prepareBall() {
        const speed = LEVELS[levelIndex].speed;
        ball = {
            x: paddle.x + paddle.width / 2,
            y: PADDLE_Y - BALL_RADIUS - 3,
            vx: speed * .58,
            vy: -speed * .815,
            speed,
            attached: true,
        };
    }

    function startRound() {
        if (gameState === 'running') return;

        if (gameState === 'over' || gameState === 'won') resetGame();

        if (gameState === 'level-clear') {
            levelIndex += 1;
            buildLevel();
            prepareBall();
        }

        ball.attached = false;
        gameState = 'running';
        overlay.hidden = true;
        pauseButton.disabled = false;
        pauseButton.textContent = '暫停';
        updateStatus('遊戲中');
        updateHud();
        liveRegion.textContent = `第 ${levelIndex + 1} 關開始`;
        previousTime = performance.now();
        cancelAnimationFrame(animationFrame);
        animationFrame = requestAnimationFrame(loop);
    }

    function togglePause() {
        if (gameState === 'running') {
            cancelAnimationFrame(animationFrame);
            gameState = 'paused';
            pauseButton.textContent = '繼續';
            showOverlay('PAUSED', '遊戲暫停', '能量球已凍結，準備好再繼續。', '繼續遊戲');
            updateStatus('已暫停');
            liveRegion.textContent = '遊戲已暫停';
            return;
        }

        if (gameState === 'paused') startRound();
    }

    function loop(time) {
        if (gameState !== 'running') return;
        const delta = Math.min((time - previousTime) / 1000, .025);
        previousTime = time;
        update(delta);
        draw();
        if (gameState === 'running') animationFrame = requestAnimationFrame(loop);
    }

    function update(delta) {
        movePaddle(delta);
        ball.x += ball.vx * delta;
        ball.y += ball.vy * delta;

        if (ball.x - BALL_RADIUS <= 0 && ball.vx < 0) {
            ball.x = BALL_RADIUS;
            ball.vx *= -1;
        } else if (ball.x + BALL_RADIUS >= WIDTH && ball.vx > 0) {
            ball.x = WIDTH - BALL_RADIUS;
            ball.vx *= -1;
        }

        if (ball.y - BALL_RADIUS <= 0 && ball.vy < 0) {
            ball.y = BALL_RADIUS;
            ball.vy *= -1;
        }

        collideWithPaddle();
        collideWithBricks(delta);
        if (ball.y - BALL_RADIUS > HEIGHT) loseLife();
    }

    function movePaddle(delta) {
        if (keys.left !== keys.right) paddle.x += (keys.left ? -1 : 1) * paddle.speed * delta;
        paddle.x = clamp(paddle.x, 0, WIDTH - paddle.width);
    }

    function collideWithPaddle() {
        const touching = ball.vy > 0
            && ball.y + BALL_RADIUS >= PADDLE_Y
            && ball.y - BALL_RADIUS <= PADDLE_Y + PADDLE_HEIGHT
            && ball.x + BALL_RADIUS >= paddle.x
            && ball.x - BALL_RADIUS <= paddle.x + paddle.width;

        if (!touching) return;
        ball.y = PADDLE_Y - BALL_RADIUS;
        const offset = clamp((ball.x - (paddle.x + paddle.width / 2)) / (paddle.width / 2), -1, 1);
        const angle = offset * (Math.PI / 3);
        ball.vx = ball.speed * Math.sin(angle);
        ball.vy = -Math.abs(ball.speed * Math.cos(angle));
    }

    function collideWithBricks(delta) {
        const previousX = ball.x - ball.vx * delta;
        const previousY = ball.y - ball.vy * delta;

        for (let index = 0; index < bricks.length; index += 1) {
            const brick = bricks[index];
            const overlaps = ball.x + BALL_RADIUS >= brick.x
                && ball.x - BALL_RADIUS <= brick.x + brick.width
                && ball.y + BALL_RADIUS >= brick.y
                && ball.y - BALL_RADIUS <= brick.y + brick.height;
            if (!overlaps) continue;

            const cameFromTop = previousY + BALL_RADIUS <= brick.y;
            const cameFromBottom = previousY - BALL_RADIUS >= brick.y + brick.height;
            const cameFromSide = previousX + BALL_RADIUS <= brick.x || previousX - BALL_RADIUS >= brick.x + brick.width;
            if (cameFromTop || cameFromBottom || !cameFromSide) ball.vy *= -1;
            else ball.vx *= -1;

            brick.hp -= 1;
            score += brick.hp === 0 ? 10 : 5;
            highScore = Math.max(highScore, score);
            saveHighScore();
            if (brick.hp === 0) bricks.splice(index, 1);
            updateHud();
            break;
        }

        if (bricks.length === 0) completeLevel();
    }

    function completeLevel() {
        cancelAnimationFrame(animationFrame);
        if (levelIndex === TOTAL_LEVELS - 1) {
            gameState = 'won';
            pauseButton.disabled = true;
            showOverlay('ALL CLEAR', '三道防線全數突破', `最終得分 ${score}，街機紀錄已更新。`, '再玩一次');
            updateStatus('全關制霸');
            liveRegion.textContent = `恭喜完成全部關卡，得分 ${score}`;
            return;
        }

        gameState = 'level-clear';
        pauseButton.disabled = true;
        showOverlay(`STAGE 0${levelIndex + 1} CLEAR`, '防線突破', LEVELS[levelIndex + 1].intro, '進入下一關');
        updateStatus('關卡完成');
        liveRegion.textContent = `第 ${levelIndex + 1} 關完成`;
    }

    function loseLife() {
        cancelAnimationFrame(animationFrame);
        lives -= 1;
        updateHud();

        if (lives <= 0) {
            gameState = 'over';
            pauseButton.disabled = true;
            showOverlay('GAME OVER', `本局得分 ${score}`, `最高紀錄 ${highScore} 分，再挑戰一次吧。`, '再玩一次');
            updateStatus('遊戲結束');
            liveRegion.textContent = `遊戲結束，得分 ${score}`;
            return;
        }

        prepareBall();
        gameState = 'life-lost';
        pauseButton.disabled = true;
        showOverlay('BALL LOST', '再守住一次', `剩餘 ${lives} 條生命，能量球已回到擋板。`, '重新發球');
        updateStatus('等待發球');
        liveRegion.textContent = `失去一條生命，剩餘 ${lives} 條`;
        draw();
    }

    function movePaddleTo(clientX) {
        const rect = canvas.getBoundingClientRect();
        const canvasX = (clientX - rect.left) * (WIDTH / rect.width);
        paddle.x = clamp(canvasX - paddle.width / 2, 0, WIDTH - paddle.width);
        if (ball.attached) ball.x = paddle.x + paddle.width / 2;
        if (gameState !== 'running') draw();
    }

    function draw() {
        const styles = getComputedStyle(document.documentElement);
        const background = styles.getPropertyValue('--bg').trim();
        const grid = styles.getPropertyValue('--grid').trim();
        const accent = styles.getPropertyValue('--accent').trim();
        const violet = styles.getPropertyValue('--violet').trim();
        const gold = styles.getPropertyValue('--gold').trim();
        const damaged = styles.getPropertyValue('--damaged').trim();
        const reinforcedEdge = styles.getPropertyValue('--reinforced-edge').trim();
        const crack = styles.getPropertyValue('--crack').trim();

        context.fillStyle = background;
        context.fillRect(0, 0, WIDTH, HEIGHT);
        context.strokeStyle = grid;
        context.lineWidth = 1;
        for (let x = 24; x < WIDTH; x += 24) {
            context.beginPath(); context.moveTo(x, 0); context.lineTo(x, HEIGHT); context.stroke();
        }
        for (let y = 24; y < HEIGHT; y += 24) {
            context.beginPath(); context.moveTo(0, y); context.lineTo(WIDTH, y); context.stroke();
        }

        bricks.forEach((brick) => {
            context.save();
            const reinforced = brick.maxHp === 2;
            const cracked = reinforced && brick.hp === 1;
            const color = reinforced ? (cracked ? damaged : gold) : brick.row % 2 === 0 ? accent : violet;
            context.fillStyle = color;
            context.shadowColor = color;
            context.shadowBlur = 10;
            roundedRect(brick.x, brick.y, brick.width, brick.height, 5);
            context.fill();
            if (reinforced) {
                context.shadowBlur = 0;
                context.strokeStyle = reinforcedEdge;
                context.lineWidth = 2;
                roundedRect(brick.x + 1, brick.y + 1, brick.width - 2, brick.height - 2, 4);
                context.stroke();
            }
            if (cracked) drawCracks(brick, crack);
            context.restore();
        });

        context.save();
        context.fillStyle = accent;
        context.shadowColor = accent;
        context.shadowBlur = 14;
        roundedRect(paddle.x, PADDLE_Y, paddle.width, PADDLE_HEIGHT, 8);
        context.fill();
        context.fillStyle = gold;
        context.shadowColor = gold;
        context.shadowBlur = 16;
        context.beginPath();
        context.arc(ball.x, ball.y, BALL_RADIUS, 0, Math.PI * 2);
        context.fill();
        context.restore();
    }

    function drawCracks(brick, color) {
        const centerX = brick.x + brick.width / 2;
        const centerY = brick.y + brick.height / 2;
        context.strokeStyle = color;
        context.lineWidth = 2.4;
        context.lineCap = 'round';
        context.lineJoin = 'round';

        context.beginPath();
        context.moveTo(centerX - 19, brick.y + 2);
        context.lineTo(centerX - 9, centerY - 2);
        context.lineTo(centerX - 13, centerY + 4);
        context.lineTo(centerX, brick.y + brick.height - 2);
        context.stroke();

        context.beginPath();
        context.moveTo(centerX - 9, centerY - 2);
        context.lineTo(centerX + 1, centerY - 5);
        context.lineTo(centerX + 10, brick.y + 3);
        context.stroke();

        context.beginPath();
        context.moveTo(centerX - 1, centerY + 7);
        context.lineTo(centerX + 9, centerY + 2);
        context.lineTo(centerX + 20, brick.y + brick.height - 3);
        context.stroke();
    }

    function roundedRect(x, y, width, height, radius) {
        context.beginPath();
        context.roundRect(x, y, width, height, radius);
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
        levelElement.textContent = `${levelIndex + 1} / ${TOTAL_LEVELS}`;
        livesElement.textContent = Array.from({ length: 3 }, (_, index) => index < lives ? '●' : '○').join(' ');
        if (gameState === 'ready') updateStatus('準備');
    }

    function updateStatus(status) {
        statusElement.textContent = status;
    }

    function handleKeydown(event) {
        if (['ArrowLeft', 'ArrowRight', 'a', 'A', 'd', 'D', ' ', 'Spacebar'].includes(event.key)) event.preventDefault();
        if (event.key === 'ArrowLeft' || event.key === 'a' || event.key === 'A') keys.left = true;
        if (event.key === 'ArrowRight' || event.key === 'd' || event.key === 'D') keys.right = true;
        if (event.code === 'Space') {
            if (gameState === 'running' || gameState === 'paused') togglePause();
            else startRound();
        }
        if (event.key === 'r' || event.key === 'R') {
            resetGame();
            startRound();
        }
    }

    function handleKeyup(event) {
        if (event.key === 'ArrowLeft' || event.key === 'a' || event.key === 'A') keys.left = false;
        if (event.key === 'ArrowRight' || event.key === 'd' || event.key === 'D') keys.right = false;
    }

    function applyTheme() {
        let storedTheme = '';
        try { storedTheme = localStorage.getItem('casharcade-theme') || ''; } catch { /* Use system preference. */ }
        document.documentElement.dataset.theme = storedTheme || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    }

    function toggleTheme() {
        const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
        document.documentElement.dataset.theme = next;
        try { localStorage.setItem('casharcade-theme', next); } catch { /* Current page still updates. */ }
        requestAnimationFrame(draw);
    }

    startButton.addEventListener('click', () => gameState === 'paused' ? togglePause() : startRound());
    pauseButton.addEventListener('click', togglePause);
    restartButton.addEventListener('click', () => { resetGame(); startRound(); });
    themeToggle.addEventListener('click', toggleTheme);
    document.addEventListener('keydown', handleKeydown);
    document.addEventListener('keyup', handleKeyup);
    window.addEventListener('blur', () => { keys.left = false; keys.right = false; });
    canvas.addEventListener('pointerdown', (event) => { pointerActive = true; canvas.setPointerCapture(event.pointerId); movePaddleTo(event.clientX); });
    canvas.addEventListener('pointermove', (event) => { if (pointerActive || event.pointerType === 'mouse') movePaddleTo(event.clientX); });
    canvas.addEventListener('pointerup', (event) => { pointerActive = false; canvas.releasePointerCapture(event.pointerId); });
    canvas.addEventListener('pointercancel', () => { pointerActive = false; });

    applyTheme();
    resetGame();
})();
