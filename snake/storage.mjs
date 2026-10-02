import { SnakeGame } from './engine.mjs?v=2';
export const SAVE_KEY = 'casharcade-snake-3d-campaign-v1';
export const PAID_KEY = 'casharcade-snake-3d-paid-backup-v1';
export const BEST_KEY = 'casharcade-snake-3d-high-score';
export const PUBLISHABLE_KEY = 'clgame_Z8DkWrGouzFoSO4z1uC0SrKkQWpoSx8GJGWrHmN6MDm9Rx4L';
export const freshRecord = () => ({ version: 1, paidSerial: 0, played: false, replay: 'open', intent: null, game: new SnakeGame().snapshot() });
export function validRecord(e) {
    return !!e && e.version === 1 && typeof e.played === 'boolean' && ['open', 'pending', 'paid-ready'].includes(e.replay)
        && (e.paidSerial === undefined || Number.isSafeInteger(e.paidSerial) && e.paidSerial >= 0)
        && (e.replay === 'pending' ? ['retry', 'new'].includes(e.intent) : e.intent === null)
        && (e.game?.mode ?? 'campaign') === 'campaign' && SnakeGame.valid(e.game);
}
export class CampaignStore {
    constructor(local, session) { this.local = local; this.session = session; }
    write(record) {
        if (!validRecord(record)) throw new Error('Invalid campaign record');
        const data = JSON.stringify(record); this.local.setItem(SAVE_KEY, data);
        if (this.local.getItem(SAVE_KEY) !== data) throw new Error('Checkpoint not retained');
    }
    backup(record) {
        const data = JSON.stringify(record); this.session.setItem(PAID_KEY, data);
        if (this.session.getItem(PAID_KEY) !== data) throw new Error('Paid backup not retained');
    }
    clearBackup() { try { this.session.removeItem(PAID_KEY); } catch { /* Durable local receipt already exists. */ } }
    load() {
        const saved = this.local.getItem(SAVE_KEY);
        const current = saved ? JSON.parse(saved) : null;
        if (current && !validRecord(current)) throw new Error('Invalid saved campaign');
        const backup = this.session.getItem(PAID_KEY);
        if (backup) {
            const e = JSON.parse(backup);
            if (!validRecord(e) || e.replay !== 'paid-ready') throw new Error('Invalid paid recovery');
            // A stale session receipt must not rewind an already-started paid round.
            if (current && (current.paidSerial || 0) >= (e.paidSerial || 0)) { this.clearBackup(); return current; }
            this.write(e); this.clearBackup(); return e;
        }
        if (current) return current;
        const fresh = freshRecord();
        // Preserve an old Snake SDK order rather than silently granting a free replacement.
        if (this.local.getItem(`cashlink.arcade.v1.${PUBLISHABLE_KEY}`)) {
            fresh.played = true; fresh.replay = 'pending'; fresh.intent = 'new';
        }
        return fresh;
    }
}

// All start paths go through this coordinator. Rendering/audio cannot grant a round.
export class Campaign {
    constructor(store, gate) {
        this.store = store; this.gate = gate; this.record = store.load();
        this.game = SnakeGame.restore(this.record.game); this.busy = false; this.consumed = null;
    }
    save() { this.record.game = this.game.snapshot(); this.store.write(this.record); }
    install(record) { this.record = record; this.game = SnakeGame.restore(record.game); }
    async request(intent = 'continue') {
        if (this.busy) return false;
        this.busy = true;
        try {
            if (this.consumed) {
                this.store.write(this.consumed); this.install(this.consumed); this.consumed = null; this.store.clearBackup(); return true;
            }
            if (this.record.replay === 'paid-ready') return true;
            const continuing = intent === 'continue' && ['ready', 'paused'].includes(this.game.state);
            const next = intent === 'next' && this.game.state === 'level-clear';
            if (this.record.replay === 'open' && (continuing || next || !this.record.played)) {
                const game = next ? new SnakeGame(this.game.levelIndex + 1, this.game.score) : this.game;
                const record = { ...this.record, version: 1, played: true, replay: 'open', intent: null, game: game.snapshot() };
                this.store.write(record); this.record = record; this.game = game; return true;
            }
            this.game.pause();
            if (this.record.replay !== 'pending') {
                const record = { ...this.record, played: true, replay: 'pending', intent: intent === 'new' ? 'new' : 'retry', game: this.game.snapshot() };
                this.store.write(record); this.record = record;
            } else this.save(); // Test storage before even opening the original order.
            return await this.gate.unlock(() => {
                const replacement = this.record.intent === 'new' ? new SnakeGame() : new SnakeGame(this.game.levelIndex, this.game.startScore);
                this.consumed = { version: 1, paidSerial: (this.record.paidSerial || 0) + 1, played: true, replay: 'paid-ready', intent: null, game: replacement.snapshot() };
                let backup = false;
                try { this.store.backup(this.consumed); backup = true; } catch { /* Try the durable store next. */ }
                try { this.store.write(this.consumed); }
                catch { throw { code: 'checkpoint_unavailable', backedUp: backup }; }
                this.install(this.consumed); this.consumed = null; this.store.clearBackup();
            });
        } finally { this.busy = false; }
    }
    begin() {
        if (this.record.replay === 'pending') return false;
        this.record.replay = 'open'; this.record.played = true; this.record.intent = null;
        this.game.start(); this.save(); return true;
    }
}
