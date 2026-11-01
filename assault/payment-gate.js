/* CashLink owns the price, destination, order secret, and credit consumption. */
(() => {
    'use strict';
    const PUBLISHABLE_KEY = 'clgame_31Kgzczh8V6D0U7FCjxMzsdgMV3bPcQoVMGmNlZAulBOTnbw';
    const PURPOSES = ['再來一局', '死亡後再來一局'];

    function create({ onStatus, onBusy, onCheckout }) {
        let arcade, ready = false, busy = false, connecting;
        function report(error) {
            const code = error?.code;
            if (code === 'popup_blocked') {
                onCheckout(error.checkoutUrl);
                onStatus('付款視窗遭阻擋。可開啟 CashLink 付款頁；返回後按「恢復付款」確認原訂單。');
            } else if (code === 'cancelled') {
                onStatus('付款已取消；戰機仍失聯。原訂單與未使用額度保留，可稍後恢復。');
            } else if (code === 'checkpoint_unavailable') {
                onStatus('額度已消耗，但本機存檔失敗。請保留本頁並恢復瀏覽器儲存；不要再次付款。');
            } else if (['invalid_request', 'invalid_credential', 'idempotency_conflict'].includes(code)) {
                onStatus('無法確認原訂單。請使用 CashLink 恢復碼或回報問題；不要清除瀏覽器付款資料。');
            } else if (code === 'rate_limited' || code === 'temporarily_unavailable') {
                onStatus('付款服務暫時無法使用。請稍後恢復原訂單，不要重複付款。');
            } else {
                onStatus('網路或付款狀態無法確認；尚未開始新局。請稍後恢復原訂單。');
            }
        }
        function initialize() {
            if (ready) return Promise.resolve(true);
            if (connecting) return connecting;
            connecting = (async () => {
                try {
                    if (!window.CashLinkArcade) {
                        await new Promise((resolve, reject) => {
                            const script = document.createElement('script');
                            script.src = 'https://linkincash.cc/arcade/sdk/v1.js';
                            script.referrerPolicy = 'no-referrer';
                            script.onload = resolve;
                            script.onerror = () => reject(new Error('SDK unavailable'));
                            document.head.appendChild(script);
                        });
                    }
                    if (!arcade) {
                        arcade = CashLinkArcade.create({ publishableKey: PUBLISHABLE_KEY });
                        arcade.on('popup_blocked', ({ checkoutUrl }) => onCheckout(checkoutUrl));
                        arcade.on('payment_status', order => {
                            if (!busy) return;
                            onStatus(order?.credit_status === 'available'
                                ? '額度已可用；請在 CashLink 付款頁按「繼續遊戲」，消耗後才開始新局。'
                                : '正在確認原訂單；狀態未知時請勿重複付款。');
                        });
                        arcade.on('cancelled', () => onStatus('已取消付款流程；原訂單仍可恢復。'));
                        arcade.on('unlocked', () => onStatus('解鎖已確認，正在保存新局。'));
                    }
                    const game = await arcade.handshake();
                    if (game?.origin !== 'https://darkerduck.github.io' || !PURPOSES.includes(game.unlock_description)) {
                        onStatus('CashLink 的網站或付款用途設定不符；死亡後的新局暫不可解鎖。');
                        return false;
                    }
                    ready = true;
                    onStatus('首次遊玩免費；只有死亡後再開局須由 CashLink 解鎖。價格以付款頁為準。');
                    return true;
                } catch (error) {
                    report(error);
                    return false;
                }
            })().finally(() => { connecting = null; });
            return connecting;
        }
        async function unlock(commit) {
            if (busy) return false;
            if (!ready) {
                const connected = await initialize();
                if (connected) onStatus('連線完成，請再按一次「恢復付款」開啟付款視窗。');
                return false;
            }
            busy = true; onBusy(true); onCheckout(null);
            try {
                onStatus('付款用途：死亡後再來一局。請確認 CashLink 顯示的價格；新局尚未開始。');
                // Keep the popup call in this click or keypress; do not await before it.
                const result = await arcade.unlock();
                if (result?.credit_status !== 'consumed') throw new Error('Credit was not consumed');
                commit();
                onCheckout(null);
                onStatus('已解鎖再來一局；暫停、繼續與正常過關不收費。');
                return true;
            } catch (error) {
                report(error);
                return false;
            } finally {
                busy = false; onBusy(false);
            }
        }
        return { initialize, unlock, cancel() { if (busy) arcade?.cancel(); }, get busy() { return busy; } };
    }
    globalThis.CashArcadeAssaultGate = Object.freeze({ create });
})();
