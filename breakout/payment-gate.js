/* CashLink owns order secrets, idempotency, price and credit consumption. */
(() => {
    'use strict';

    const PUBLISHABLE_KEY = 'clgame_1B2urqXhsmgm1tz3HmqppmCd3VElMeIXOUDGV5HUpwmSTReR';
    const PLAYED_KEY = 'casharcade.breakout.played.v1';
    const PENDING_KEY = 'casharcade.breakout.replay-pending.v1';

    function create({ onStatus, onBusy, onCheckout }) {
        let arcade;
        let ready = false;
        let busy = false;
        let connecting;

        function pending() {
            try {
                return sessionStorage.getItem(PENDING_KEY) === '1'
                    || localStorage.getItem(`cashlink.arcade.v1.${PUBLISHABLE_KEY}`) !== null;
            } catch {
                return true; // Storage uncertainty must never grant a free replacement round.
            }
        }

        function hasPlayed() {
            try { return sessionStorage.getItem(PLAYED_KEY) === '1'; } catch { return true; }
        }

        function markPlayed() {
            sessionStorage.setItem(PLAYED_KEY, '1');
        }

        function reportError(error) {
            const code = error && error.code;
            if (code === 'popup_blocked') {
                onCheckout(error.checkoutUrl);
                onStatus('付款視窗被阻擋。可開啟付款頁；返回後按「恢復／重試再來一局」確認原訂單。');
            } else if (code === 'cancelled') {
                onStatus('已取消，沒有開始新局。原訂單與未使用額度保留，可稍後恢復。');
            } else if (['invalid_request', 'invalid_credential', 'idempotency_conflict'].includes(code)) {
                onStatus('訂單或憑證無法確認。請使用 CashLink 恢復碼或障礙回報；不要清除瀏覽器資料或再次付款。');
            } else if (code === 'rate_limited' || code === 'temporarily_unavailable') {
                onStatus('付款服務暫時無法使用。請稍後重試原訂單，不要再次付款。');
            } else {
                onStatus('連線或瀏覽器儲存失敗，沒有開始新局。請恢復連線後重試；不要清除訂單資料。');
            }
        }

        function initialize() {
            if (ready) return Promise.resolve(true);
            if (connecting) return connecting;
            onStatus('正在連線 CashLink；首次遊玩免費，再來一局須完成付款解鎖。');
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
                            if (order && order.credit_status === 'available') {
                                onStatus('付款額度可用，請在 CashLink 付款頁按「繼續遊戲」；確認消耗額度後才開始新局。');
                            } else {
                                onStatus('正在等待 CashLink 確認原訂單。狀態未知時不要重複付款。');
                            }
                        });
                        arcade.on('cancelled', () => onStatus('已取消，原訂單保留；本局不會重開。'));
                        // The event alone is not authorization. Only the awaited unlock result commits a round.
                        arcade.on('unlocked', () => onStatus('解鎖已確認，正在準備新局。'));
                    }
                    const game = await arcade.handshake();
                    if (!game || game.origin !== 'https://darkerduck.github.io' || game.unlock_description !== '再來一局') {
                        throw new Error('Payment purpose mismatch');
                    }
                    ready = true;
                    onStatus(pending() ? '偵測到未完成付款。按「恢復／重試再來一局」恢復原訂單。' : '首次遊玩免費；重新開始、再玩一次與 R 的付款用途為「再來一局」。');
                    return true;
                } catch (error) {
                    reportError(error);
                    return false;
                }
            })().finally(() => { connecting = null; });
            return connecting;
        }

        async function unlock(commit) {
            if (busy) return false;
            if (!ready) {
                await initialize();
                // A second explicit gesture is required so unlock can open its popup synchronously.
                if (ready) onStatus('連線完成，請再按一次「恢復／重試再來一局」開啟付款。');
                return false;
            }
            busy = true;
            onBusy(true);
            onCheckout(null);
            try {
                sessionStorage.setItem(PENDING_KEY, '1');
                onStatus('付款用途：再來一局。請在 CashLink 確認價格與付款；新局尚未開始。');
                // No await precedes this call: retain the click/keyboard popup activation.
                const result = await arcade.unlock();
                if (!result || result.credit_status !== 'consumed') throw new Error('Unlock not consumed');
                commit(); // Synchronously checkpoint the replacement round before clearing our intent.
                sessionStorage.removeItem(PENDING_KEY);
                onCheckout(null);
                onStatus('「再來一局」已解鎖；暫停、繼續、重新發球與換關不會再次收費。');
                return true;
            } catch (error) {
                reportError(error);
                return false;
            } finally {
                busy = false;
                onBusy(false);
            }
        }

        return { initialize, unlock, pending, hasPlayed, markPlayed, acknowledgeCheckpoint() { try { sessionStorage.removeItem(PENDING_KEY); } catch { /* Remain fail-closed. */ } }, get busy() { return busy; }, cancel() { if (busy && arcade) arcade.cancel(); } };
    }

    window.CashArcadeReplayGate = Object.freeze({ create });
})();
