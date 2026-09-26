/* CashLink owns order secrets, idempotency, price and credit consumption. */
(() => {
    'use strict';

    const PUBLISHABLE_KEY = 'clgame_ODUJZzp6UAAZFIWqreRHWOGQuQHhuwj6ESOzo9UYWX5V14Z8';

    function create({ onStatus, onBusy, onCheckout }) {
        let arcade, ready = false, busy = false, connecting;

        function reportError(error) {
            const code = error && error.code;
            if (code === 'popup_blocked') {
                onCheckout(error.checkoutUrl);
                onStatus('付款視窗被阻擋。可開啟 CashLink 付款頁；返回後按「恢復付款」確認原訂單。');
            } else if (code === 'cancelled') {
                onStatus('付款已取消；尚未開始新局。原訂單與未使用額度保留，可稍後恢復。');
            } else if (code === 'checkpoint_unavailable') {
                onStatus('付款額度已消耗，但本機存檔失敗。請勿再次付款；先允許瀏覽器儲存並保留本頁，以便恢復遊戲。');
            } else if (['invalid_request', 'invalid_credential', 'idempotency_conflict'].includes(code)) {
                onStatus('訂單或憑證無法確認。請使用 CashLink 恢復碼或回報問題；不要清除瀏覽器資料或再次付款。');
            } else if (code === 'rate_limited' || code === 'temporarily_unavailable') {
                onStatus('付款服務暫時無法使用。請稍後恢復原訂單，不要再次付款。');
            } else {
                onStatus('連線或付款狀態無法確認；新局尚未開始。請恢復原訂單，不要清除訂單資料。');
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
                        arcade.on('payment_status', (order) => {
                            if (!busy) return;
                            onStatus(order && order.credit_status === 'available'
                                ? '付款額度已可用；請在 CashLink 付款頁按「繼續遊戲」，消耗額度後才會開始新局。'
                                : '正在等待 CashLink 確認原訂單；狀態不明時請勿重複付款。');
                        });
                        arcade.on('cancelled', () => onStatus('已取消付款流程；原訂單仍可恢復。'));
                        // SDK events are informational. Only the awaited consumed result authorizes play.
                        arcade.on('unlocked', () => onStatus('解鎖已確認，正在準備新局。'));
                    }
                    const game = await arcade.handshake();
                    if (!game || game.origin !== 'https://darkerduck.github.io' || game.unlock_description !== '再來一局') {
                        throw new Error('Payment purpose or origin mismatch');
                    }
                    ready = true;
                    onStatus('首次遊玩免費；只有防線失守後再開局須以 CashLink 解鎖「再來一局」。價格以付款頁為準。');
                    return true;
                } catch {
                    onStatus('CashLink 目前無法連線或驗證付款用途；免費玩法仍可繼續，失敗後請稍後恢復付款。');
                    return false;
                }
            })().finally(() => { connecting = null; });
            return connecting;
        }

        async function unlock(commit) {
            if (busy) return false;
            if (!ready) {
                const connected = await initialize();
                // A new click is needed for the popup's user activation after an awaited handshake.
                if (connected) onStatus('連線完成，請再按一次「恢復付款」開啟 CashLink 付款視窗。');
                else onStatus('CashLink 尚未連線或付款用途不符；本局不會重開。請稍後恢復原訂單，勿再次付款。');
                return false;
            }
            busy = true; onBusy(true); onCheckout(null);
            try {
                onStatus('付款用途：再來一局。請在 CashLink 確認價格；解鎖前不會開始新局。');
                // No await precedes unlock: keep this click or keypress's popup activation.
                const result = await arcade.unlock();
                if (!result || result.credit_status !== 'consumed') throw new Error('Unlock not consumed');
                commit();
                onCheckout(null);
                onStatus('「再來一局」已解鎖；暫停、繼續及過關不會再次收費。');
                return true;
            } catch (error) {
                reportError(error);
                return false;
            } finally {
                busy = false; onBusy(false);
            }
        }

        return { initialize, unlock, cancel() { if (busy && arcade) arcade.cancel(); }, get busy() { return busy; } };
    }

    window.CashArcadeMissileGate = Object.freeze({ create });
})();
