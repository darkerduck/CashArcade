# CashArcade

一座純前端的瀏覽器街機。

🎮 **選擇遊戲：** <https://darkerduck.github.io/CashArcade/>

## 遊戲

- [霓虹貪吃蛇](https://darkerduck.github.io/CashArcade/snake/)：使用方向鍵、`WASD` 或觸控操作，穿越邊界。普通食物得 10 分並增長一節；每遊玩 20 秒出現一次的限時甜點得 20 分並增長兩節，10 秒後消失；炸彈每遊玩 30 秒換位，碰到即結束本局。暫停時兩種計時都會停止。
- [霓虹打磚塊](https://darkerduck.github.io/CashArcade/breakout/)：使用方向鍵、A/D、滑鼠或觸控控制擋板，突破矩形、雙翼與堡壘三道防線。第二、三關的金色磚塊需擊中兩次，第一次命中會留下裂痕。
- [霓虹飛行](https://darkerduck.github.io/CashArcade/flappy/)：使用 `Space`、方向鍵、W、滑鼠或觸控拍翼，穿越逐步加速並縮小間隙的無盡能源閘門。

三款遊戲都支援亮暗主題、暫停、重新開始與瀏覽器本機最高分。

## 音效

三款遊戲使用 Web Audio API 即時合成短音效，不使用背景音樂、外部音訊素材或音訊套件。音效預設開啟，首次操作遊戲後才會發聲；每款遊戲的標題列都可獨立切換靜音，設定保存在該瀏覽器。瀏覽器不支援音訊或阻止播放時，遊戲仍可正常操作。

## 打磚塊「再來一局」

打磚塊每個分頁工作階段首次遊玩免費。再玩一次、重新開始、R，以及結束畫面的 Space 都共用 CashLink Arcade SDK 付款 gate，只有 `await arcade.unlock()` 確認額度已消耗後才開新局。價格、付款用途「再來一局」與收款目的地由 CashLink 伺服器決定。

暫停、繼續、失去生命後重新發球及換關不收費。同一分頁重載會恢復本局為暫停狀態；付款中重載則由玩家手動恢復原訂單，不會在載入時自動建單。Popup 被擋可開啟付款頁，返回後再按恢復按鈕，仍須等待 SDK 成功解鎖。取消與網路錯誤不開新局，也不清除 SDK 原訂單。

SDK 管理訂單秘密與冪等鍵；遊戲只保留本局的分頁儲存 checkpoint。付款頁連結的 fragment 含憑證，只交給玩家開啟，不送入日誌、query string 或分析服務。沒有獎金、抽獎、代幣或可兌現獎勵。純前端 gate 可以被修改，不是防作弊或具金錢獎勵遊戲的授權邊界。

付款服務使用 `https://linkincash.cc` 的 localhost 公開預覽入口，不代表 CashLink 正式 production；正式收費上線前應確認服務可用性與付款／隱私條款。真實付款驗收需另行授權。

## 技術

CashArcade 使用 HTML、CSS、JavaScript 與 Canvas 製作，不包含框架或追蹤程式。打磚塊與貪吃蛇載入 CashLink Arcade SDK，霓虹飛行不使用付款服務。SDK 與 API 文件：<https://linkincash.cc/docs/arcade-api>。
