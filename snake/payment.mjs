import { PUBLISHABLE_KEY } from './storage.mjs';
// Preserve the existing Snake registration's wording, verified by handshake.
const REPLAY_PURPOSES = new Set(['再來一局', '死亡或勝利後解鎖下一局遊戲']);
export function checkoutURL(value) {
    try {
        const u = new URL(value);
        return u.origin === 'https://linkincash.cc' && /^\/arcade\/checkout\/[A-Za-z0-9_-]+\/?$/.test(u.pathname)
            && !u.username && !u.password && !u.search ? u.href : null;
    } catch { return null; }
}
export class ReplayGate {
    constructor({ factory, status = () => {}, checkout = () => {}, busy = () => {}, now = () => Date.now() }) {
        this.factory = factory; this.status = status; this.checkout = value => checkout(checkoutURL(value)); this.onBusy = busy;
        this.ready = false; this.busy = false; this.connecting = null; this.arcade = null;
        this.now = now; this.retryAt = 0;
    }
    coolingDown() {
        if (this.now() >= this.retryAt) return false;
        this.status(`CashLink 正在恢復服務，請 ${Math.ceil((this.retryAt - this.now()) / 1000)} 秒後手動恢復原訂單；不會自動建單。`); return true;
    }
    backoff(error) {
        if (['rate_limited', 'temporarily_unavailable'].includes(error?.code) || [429, 503].includes(error?.status)) {
            const seconds = Number.isSafeInteger(error.retryAfter) && error.retryAfter > 0 ? error.retryAfter : 30;
            this.retryAt = this.now() + seconds * 1000;
        }
    }
    initialize() {
        if (this.ready) return Promise.resolve(true);
        if (this.connecting) return this.connecting;
        if (this.coolingDown()) return Promise.resolve(false);
        this.connecting = (async () => {
            try {
                if (!this.arcade) {
                    this.arcade = await this.factory(PUBLISHABLE_KEY);
                    this.arcade.on('popup_blocked', e => this.checkout(e.checkoutUrl));
                    this.arcade.on('payment_status', () => { if (this.busy) this.status('等待 CashLink 確認原訂單；請勿重複付款。'); });
                }
                const game = await this.arcade.handshake();
                if (game?.origin !== 'https://darkerduck.github.io' || !REPLAY_PURPOSES.has(game?.unlock_description)) throw new Error('Wrong payment registration');
                this.ready = true;
                const price = Number.isSafeInteger(game.price_satoshis) && game.price_satoshis > 0 ? ` ${game.price_satoshis.toLocaleString()} sat` : '';
                this.status(`首個戰役免費；之後重試或新戰役須解鎖「再來一局」。CashLink${price} · 登記用途：${game.unlock_description}。以付款頁為準。`);
                return true;
            } catch (error) {
                this.backoff(error);
                this.status('CashLink 暫時無法連線或驗證。首個戰役與已保存的同一局可繼續；付費重試暫不可用。'); return false;
            } finally { this.connecting = null; }
        })();
        return this.connecting;
    }
    async unlock(commit) {
        if (this.busy) return false;
        if (this.coolingDown()) return false;
        if (!this.ready) {
            if (await this.initialize()) this.status('連線完成，請再按「恢復付款」以開啟原訂單。');
            return false;
        }
        this.busy = true; this.onBusy(true); this.checkout(null);
        try {
            // Must be called within the initiating gesture; no awaited work before this line.
            const result = await this.arcade.unlock();
            if (result?.credit_status !== 'consumed') throw new Error('Credit not consumed');
            commit(); this.checkout(null); this.status('已解鎖。過關、暫停與恢復同一局不會再次收費。'); return true;
        } catch (error) {
            this.backoff(error);
            if (error?.code === 'popup_blocked') { this.checkout(error.checkoutUrl); this.status('付款視窗遭阻擋。開啟下方完整付款頁後，再按「恢復付款」確認原訂單。'); }
            else if (error?.code === 'cancelled') this.status('付款已取消，原訂單保留；本局尚未重開，可手動恢復。');
            else if (error?.code === 'checkpoint_unavailable') this.status('已解鎖但存檔失敗。請保留本頁、允許儲存，再按「恢復已解鎖局」；不要再次付款。');
            else this.status('網路、訂單或額度狀態尚未確認；沒有開始新局。請恢復原訂單，勿重複付款或清除資料。');
            return false;
        } finally { this.busy = false; this.onBusy(false); }
    }
    cancel() { if (this.busy) this.arcade?.cancel(); }
}

export function sdkFactory(publishableKey) {
    if (globalThis.CashLinkArcade) return Promise.resolve(globalThis.CashLinkArcade.create({ publishableKey }));
    return new Promise((resolve, reject) => {
        const script = document.createElement('script'); script.src = 'https://linkincash.cc/arcade/sdk/v1.js'; script.referrerPolicy = 'no-referrer';
        script.onload = () => { try { resolve(globalThis.CashLinkArcade.create({ publishableKey })); } catch (e) { reject(e); } };
        script.onerror = () => { script.remove(); reject(new Error('SDK unavailable')); }; document.head.append(script);
    });
}
