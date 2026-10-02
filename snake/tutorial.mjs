import { SnakeGame, DIRECTIONS, equal } from './engine.mjs?v=3';

export const TUTORIAL_KEY = 'casharcade-snake-3d-tutorial-v1';
const clone = value => JSON.parse(JSON.stringify(value));
const step = (name, detail, direction, x, y, z, focus = '') => ({ name, detail, direction, target: { x, y, z }, focus });
export const LESSONS = Object.freeze([
    step('持續前進與取食', '開始後會持續前進。先吃前方金色能量；到達教學目標會自動停住。', 'right', 6, 0, 1),
    step('向後轉彎', '按 S／↓，朝 +Z 移動。鍵盤和亮起的觸控按鈕都可操作。', 'back', 6, 0, 5),
    step('向左轉彎', '按 A／←，朝 −X 移動；放開按鍵後仍會繼續前進。', 'left', 2, 0, 5),
    step('向前轉彎', '按 W／↑，朝 −Z 移動。小圖上方就是這個方向。', 'forward', 2, 0, 2, 'map'),
    step('向右轉彎', '按 D／→，朝 +X 移動。六面外牆都不能穿越，碰到自己也會結束。', 'right', 5, 0, 2),
    step('持續上升', '按 E／升，持續往上兩格。看高度刻度和空心目標：金色能量在頂層。', 'rise', 5, 2, 2, 'altitude'),
    { name: '不能直接反向', detail: '剛才向上，現在試按 Q／降：立即反向會被拒絕。必須先轉往另一個軸向。', kind: 'reverse', direction: 'dive', focus: 'altitude' },
    step('先轉向，再下降', '先按 D／→ 橫移，避開自己的身體，之後才可以下降。', 'right', 7, 2, 2),
    step('持續下降', '現在按 Q／降，回到最下層。目標高度與小圖會隨蛇頭高度更新。', 'dive', 7, 0, 2, 'altitude'),
    { name: '暫停與旋轉觀察', detail: '按 P／Space 或「開始觀察」。拖曳、縮放或按「旋轉視角」，實際改變鏡頭後再繼續；返回時會復原標準視角。', kind: 'observe', focus: 'map' },
    step('轉向出口路線', '剛才向下，先按 D／→ 橫移一格，才能再向上。繼續時會恢復標準視角並倒數一秒。', 'right', 8, 0, 2),
    step('前往頂層出口', '按 E／升回到頂層。六面封閉，不要一直往上；抵達目標會停住。', 'rise', 8, 2, 2, 'altitude'),
    { ...step('進入綠色出口', '按 S／↓ 沿 +Z 進入同高度的綠色出口。完成後留在免費自由練習，不自動開始戰役。', 'back', 8, 2, 8, 'map'), kind: 'exit' },
]);

function validRecord(r) {
    const tutorial = s => s?.mode === 'tutorial' && SnakeGame.valid(s);
    return r && r.version === 1 && Number.isInteger(r.lesson) && r.lesson >= 0 && r.lesson <= LESSONS.length
        && ['completed', 'skipped', 'waiting'].every(k => typeof r[k] === 'boolean')
        && (r.active === undefined || typeof r.active === 'boolean')
        && r.completed === (r.lesson === LESSONS.length) && tutorial(r.game) && tutorial(r.entry)
        && r.game.tutorialPractice === r.completed && r.entry.tutorialPractice === r.completed;
}

// This controller has no SDK or Campaign dependency and never writes campaign keys.
export class Tutorial {
    constructor(local = null) {
        this.local = local; this.lesson = 0; this.completed = false; this.skipped = false; this.active = false;
        this.waiting = true; this.observed = false; this.viewStart = null; this.events = []; this.revision = 0; this.persistent = true;
        this.game = SnakeGame.tutorial(); this.prepare();
        try {
            const text = local?.getItem(TUTORIAL_KEY);
            if (text) {
                const r = JSON.parse(text);
                if (!validRecord(r)) throw new Error('Invalid tutorial');
                this.lesson = r.lesson; this.completed = r.completed; this.skipped = r.skipped; this.waiting = r.waiting; this.active = r.active ?? false;
                this.game = SnakeGame.restore(r.game); this.entry = clone(r.entry);
            }
            if (!local) this.persistent = false;
        } catch { this.persistent = false; }
    }
    get current() { return LESSONS[this.lesson] || { name: '自由練習', detail: '慢速練習六方向。死亡、R 與重試皆免費；可隨時進入或返回正式戰役。' }; }
    setSpeed(multiplier) {
        if (!this.game.setTutorialSpeed(multiplier)) return false;
        this.entry.tutorialSpeed = multiplier; this.revision++; this.save(); return true;
    }
    prepare() {
        const lesson = this.current;
        this.waiting = true; this.observed = false; this.viewStart = null;
        this.game.pause(); this.game.state = 'ready'; this.game.queue = []; this.game.moveElapsed = 0; this.game.remainder = 0;
        this.game.previous = clone(this.game.snake);
        this.game.tutorialExitOpen = lesson.kind === 'exit';
        this.game.food = lesson.target && lesson.kind !== 'exit' ? clone(lesson.target) : null;
        this.entry = this.game.snapshot(); this.revision++; this.game.revision++;
        if (lesson.kind === 'exit') this.events.push({ type: 'exit-open', at: clone(this.game.level.exit) });
    }
    finishLesson() {
        this.lesson++;
        if (this.lesson === LESSONS.length) {
            const speed = this.game.tutorialSpeed;
            this.completed = true; this.game = SnakeGame.tutorial(); this.game.tutorialPractice = true;
            this.game.setTutorialSpeed(speed);
            this.waiting = true; this.entry = this.game.snapshot(); this.revision++;
        } else this.prepare();
    }
    prepareStart() {
        if (this.game.state === 'failed' || ['reverse', 'observe'].includes(this.current.kind)) return false;
        if (this.waiting && !this.completed && this.current.direction) this.game.input(this.current.direction);
        return true;
    }
    begin() {
        if (!this.prepareStart()) return false;
        this.waiting = false; this.game.start(); this.revision++; return true;
    }
    input(direction) {
        if (this.game.state === 'failed') return false;
        if (this.waiting && !this.completed) {
            if (direction !== this.current.direction) return false;
            if (this.current.kind === 'reverse') {
                if (this.game.input(direction)) return false;
                this.finishLesson(); return true;
            }
            return equal(DIRECTIONS[direction], this.game.direction) || this.game.input(direction);
        }
        return this.game.state === 'running' && this.game.input(direction);
    }
    startObservation() {
        if (this.current.kind !== 'observe' || this.game.state === 'failed') return false;
        this.waiting = false; this.game.state = 'paused'; this.viewStart = null; this.observed = false;
        this.game.revision++; this.revision++; return true;
    }
    observe(position) {
        if (this.current.kind !== 'observe' || this.waiting || this.game.state !== 'paused' || this.observed) return false;
        if (!this.viewStart) { this.viewStart = position.slice(); return false; }
        if (position.some((value, i) => Math.abs(value - this.viewStart[i]) > .03)) { this.observed = true; this.revision++; return true; }
        return false;
    }
    resumeObservation() {
        if (this.current.kind !== 'observe' || !this.observed) return false;
        this.finishLesson(); return true;
    }
    pause() { this.game.pause(); }
    retry() {
        this.game = SnakeGame.restore(this.entry); this.game.state = 'ready'; this.game.snake = this.game.snake.slice(0, 4);
        this.game.previous = clone(this.game.snake); this.game.growth = 0; this.game.queue = [];
        this.game.score = this.game.startScore = 0; this.game.moveElapsed = this.game.remainder = 0; this.game.reason = '';
        this.waiting = true; this.observed = false; this.viewStart = null; this.revision++; this.save();
    }
    restartLessons() {
        const speed = this.game.tutorialSpeed;
        this.lesson = 0; this.completed = false; this.game = SnakeGame.tutorial(); this.game.setTutorialSpeed(speed);
        this.events = []; this.prepare(); this.save();
    }
    advance(milliseconds) {
        let left = milliseconds;
        while (left > 0 && this.game.state === 'running') {
            const delta = Math.min(left, 10); left -= delta; this.game.advance(delta); this.events.push(...this.game.drain());
            if (!this.completed && this.current.target && equal(this.game.snake[0], this.current.target)) {
                this.finishLesson(); this.save(); break;
            }
        }
    }
    drain() { return this.events.splice(0); }
    snapshot() { return { version: 1, lesson: this.lesson, completed: this.completed, skipped: this.skipped, active: this.active,
        waiting: this.waiting, game: this.game.snapshot(), entry: clone(this.entry) }; }
    save() {
        try {
            const data = JSON.stringify(this.snapshot()); this.local.setItem(TUTORIAL_KEY, data);
            this.persistent = this.local.getItem(TUTORIAL_KEY) === data;
        } catch { this.persistent = false; }
        return this.persistent;
    }
    enter() { this.active = true; }
    leave() { this.active = false; if (!this.completed) this.skipped = true; this.save(); }
}

export function shouldOfferTutorial(campaign, tutorial) {
    return tutorial.active || !!campaign && !campaign.record.played && campaign.record.replay === 'open'
        && campaign.game.steps === 0 && !tutorial.completed && !tutorial.skipped;
}
export function canEnterTutorial({ busy, countdown, gate, campaign }) {
    return !busy && !countdown && !gate.busy && !campaign?.busy && !campaign?.consumed;
}
