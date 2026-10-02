# 存檔與付款

[回到 README](../README.md) · [玩家指南](PLAYER_GUIDE.md) · [測試與發布](TESTING_AND_DEPLOYMENT.md)

這份文件描述 repository 目前實作，不承諾外部服務隨時可用。SDK 協定的權威來源為 [CashLink Arcade API 文件](https://linkincash.cc/docs/arcade-api)；外部文件無法連線時，仍可用 repository 的假 SDK 測試檢查本地整合。

## 收費操作對照

| 遊戲 | 免費操作 | 需解鎖的新局 | 重載行為 |
| --- | --- | --- | --- |
| 貪吃蛇 3D | 第0關全部操作／死亡重試、首個正式戰役、正常過關、暫停／觀察／繼續、恢復同一局 | 玩過首個正式戰役後，正式關卡重試、R、新戰役、失敗／勝利後再玩 | 完整三維本局先暫停；付款意圖與已解鎖待恢復狀態一併保存 |
| 打磚塊 | 從開始／發球入口開第一局、恢復有效存檔、暫停／繼續、扣命後發球、換關 | 重新開始、R、再玩一次、結束後的 Space／Enter 等新局路徑 | 最近成功保存的完整本局，先暫停；付款待處理由玩家恢復 |
| 霓虹飛行 | 所有遊玩與重開 | 無，未載入付款 SDK | 不保存本局；只保留最高分與偏好 |
| 霓虹天盾 | 首次戰役、失敗前主動重試／新戰役、暫停／繼續、關間升級、通關後再玩 | 六城全毀後的重試、R、新戰役與失敗後開始 | 本關起點或關間升級階段；失敗／付款狀態一併保存 |

打磚塊的「重新開始」／R 會直接走新局 gate，即使尚未從免費開始按鈕開過第一局也一樣。天盾付款一旦待處理，會保留當時選的「重試本關」或「新戰役」，其他按鈕不改換原訂單意圖。

三款付費整合的付款用途均為「再來一局」。貪吃蛇原有註冊的回傳文案為「死亡或勝利後解鎖下一局遊戲」，本次保留該設定，亦接受「再來一局」；不接受其他用途。價格與用途由握手回傳值顯示，不寫死金額，收款資訊以 CashLink 付款頁為準。沒有獎金、抽獎、代幣或可兌現獎勵。

## 本機資料與保存範圍

資料沒有帳號同步或雲端備份。`localStorage` 依 Origin 分隔，同網域的不同遊戲路徑使用獨立鍵隔離；`sessionStorage` 還限於分頁生命週期，關閉後不應視為可靠備份。無痕模式、容量限制或清除網站資料都可能使紀錄失效。不要同時在多個分頁操作同一遊戲的付款／存檔；目前沒有跨分頁遊戲鎖。

| 儲存位置 | 鍵 | 用途 |
| --- | --- | --- |
| localStorage | `casharcade-theme` | 四款遊戲與首頁共用亮暗偏好；無偏好預設暗版 |
| localStorage | `casharcade-high-score` | 舊平面貪吃蛇最高分，保留但不混入 3D 戰役 |
| localStorage | `casharcade-snake-3d-high-score` | 三維貪吃蛇戰役最高分 |
| localStorage | `casharcade-snake-3d-tutorial-v1` | 第0關步驟、完成／跳過標記、當前練習局、步驟起點與速度偏好；不影響正式存檔或付費資格 |
| localStorage | `casharcade-snake-3d-campaign-v1` | 三維完整本局、played、replay、intent 與 paidSerial |
| sessionStorage | `casharcade-snake-3d-paid-backup-v1` | 貪吃蛇已消耗額度後、尚待提交的新局備援 |
| localStorage | `casharcade-breakout-high-score` | 打磚塊最高分 |
| localStorage | `casharcade-flappy-high-score` | 飛行最高分 |
| localStorage | `casharcade-missile-high-score` | 天盾最高分 |
| localStorage | `casharcade-{game}-sound-muted` | 個別音效靜音，`1` 為靜音 |
| localStorage | `casharcade-{game}-music-muted` | 個別配樂靜音，`1` 為靜音 |
| localStorage | `casharcade-{game}-music-volume` | 配樂音量的 0–1 數值字串，預設 `0.65` |
| localStorage | `casharcade.breakout.round.v2` | 打磚塊完整 snapshot 與 `played`／`pending`／`paidReady` |
| sessionStorage | `casharcade.breakout.round.v1` | 舊打磚塊存檔的遷移來源 |
| sessionStorage | `casharcade.breakout.played.v1` | 打磚塊已開始過遊戲的輔助記錄 |
| sessionStorage | `casharcade.breakout.replay-pending.v1` | 打磚塊付款待處理輔助記錄 |
| sessionStorage | `casharcade.breakout.paid-backup.v2` | 打磚塊已消耗額度後的新局備援 |
| localStorage | `casharcade-missile-checkpoint` | 天盾 v2 envelope：關卡 checkpoint 與 replay 狀態 |
| sessionStorage | `casharcade.missile.loss-lock.v1` | 天盾失敗記錄的分頁備援 |
| sessionStorage | `casharcade.missile.paid-recovery.v1` | 天盾已消耗額度、尚待完整保存的新局備援 |
| localStorage，由 SDK 管理 | `cashlink.arcade.v1.<publishableKey>` | SDK 恢復資料；蛇／打磚塊只探測此鍵存在，不解析或自行修改內容 |

`{game}` 代表 `snake`、`breakout`、`flappy` 或 `missile`，不是實際鍵中的大括號。SDK 格式由外部版本管理，不能把上表當作可自行重建訂單的規格。

### 霓虹貪吃蛇 3D

第0關使用獨立教學模式與存檔；正式存檔不接受教學快照，舊快照缺少模式欄位時仍視為正式戰役。教學不呼叫unlock、不寫正式最高分，也不修改played、replay、paidSerial或訂單。進入前保存並暫停正式原局；付款中或已消耗額度尚未可靠保存時禁止切換。完成／跳過教學仍保留首次免費正式戰役；返回失敗／待付款原局不免費重置。教學儲存失敗可在當頁練習，正式付款的儲存保護不放寬。

教學快照的 `tutorialSpeed` 保存0.5–2倍速度偏好；缺少此欄位的舊教學存檔預設為0.5倍。即時調速保留格間移動進度，不額外移動或計分；偏好延續至自由練習、免費重試及重新教學，不寫入正式戰役快照。

[storage.mjs](../snake/storage.mjs) 的 v1 記錄包含 `game.snapshot()`、`played`、`replay`、`intent` 與 `paidSerial`。每個邏輯步及重要轉換保存，遊玩計時約每 250 ms 補存；重載完整恢復蛇身、方向、物件、計時、道具與種子，以暫停狀態等玩家繼續。異常關閉最多回到最近成功保存的位置。

付款狀態為 `open` → `pending` → `paid-ready` → 開始後 `open`。`pending` 持久保留原本 retry／new 意圖，執行中的 busy 鎖限制單次 SDK 呼叫；取消或錯誤不開新局、不自動重建訂單。只有 consumed 回傳才建立替代局，先存分頁備援、本機存檔並讀回核對，再提交。遞增 `paidSerial` 防止舊備援覆蓋後續進度。

儲存失敗不開新付款；已消耗額度若存檔失敗，保留記憶體候選局與可用備援，恢復時不再解鎖。兩種儲存皆失敗時必須保留原分頁。存檔損壞不會自動刪除；其他分頁更新戰役會令本頁暫停並要求重載，但這不是跨分頁交易鎖。

### 打磚塊

[storage.js](../breakout/storage.js) 驗證生命、關卡、多球、磚塊、機關與效果等欄位；[game.js](../breakout/game.js) 在遊玩中約每 250 ms，以及重要事件／暫停／離頁時嘗試保存。異常關閉只能回到最近成功保存的位置，不能保證最後一畫格已寫入。

`version: 2` 的 envelope 包住 `game.snapshot()`，並保存 `played`、`pending`、`paidReady`。舊 v1 有效存檔保留原磚陣與進度，當關完成後再接新關卡；付款待處理及結束狀態不能透過遷移變成免費新局。存檔驗證失敗會阻止開局，不會自動刪除壞資料。

付費解鎖成功後先準備新局，嘗試寫入分頁備援，再寫本機 checkpoint 並讀回確認，最後才取代原局與清除付款意圖。若完整保存失敗，保留已授權候選局／可用備援，後續恢復不再呼叫第二次 `unlock()`。這仍依賴瀏覽器資料可讀，不能保證清除網站資料後救回進度。

### 霓虹天盾

[game.js](../missile/game.js) 的 envelope 為 `{ version: 2, checkpoint, replay }`；其中 checkpoint 仍使用引擎的 v1 結構，包含 `phase`、關卡、分數、城市、爆炸半徑、裝填時間與種子。不要把外層版本與引擎版本混為一談。

`phase` 為 `stage` 或 `upgrade`。重試／重載從關卡起點還原，不保存局中所有飛彈；升級選擇先保存下一關再部署。舊版有效的裸 checkpoint 仍可恢復，第十關未完成戰役會接續至後十關。

`replay.state` 的轉移為：正常 `open` → 城市全毀 `lost` → 玩家請求新局 `payment-pending` → 額度已消耗且存檔完成 `paid-ready`。取消／錯誤保持待處理狀態，`intent` 保留 `retry` 或 `new`。恢復後新的關卡記錄可回到 `open`；下次再次失敗才重新要求解鎖。最終通關會移除戰役 checkpoint，保留最高分與偏好。

### 儲存不可用

音訊／主題偏好寫入失敗可只維持當頁狀態，但不能將這種降級套用到付費存檔。蛇、打磚塊與天盾無法確認必要進度或付款意圖時，會阻止相關開局並顯示原因。不要為了讓按鈕可點而移除保存前置檢查。

## SDK 與單一付款入口

SDK URL：`https://linkincash.cc/arcade/sdk/v1.js`。各遊戲 publishable key 是可公開的前端識別，不是管理密鑰；實際設定位置：

- 貪吃蛇：[snake/storage.mjs](../snake/storage.mjs) 的 `PUBLISHABLE_KEY`；控制器 `requestRound()` → `Campaign.request()` 集中開始路徑，由 [payment.mjs](../snake/payment.mjs) 解鎖。
- 打磚塊：[breakout/payment-gate.js](../breakout/payment-gate.js) 的 `PUBLISHABLE_KEY`；控制器 `requestNewGame()` 集中提交新局。
- 天盾：[missile/payment-gate.js](../missile/payment-gate.js) 的 `PUBLISHABLE_KEY`；控制器 `requestStart()` 分流免費／收費，再由 `requestPaid()` 提交。

三款付款遊戲的共同保護：

1. 預先 `handshake()`，核對回傳 `origin === 'https://darkerduck.github.io'`、付款用途。打磚塊／天盾要求「再來一局」；蛇另接受上文原有註冊文案。Origin 不含 `/CashArcade/` 路徑。
2. 凍結舊局、清理輸入、保存付款意圖；快速連按由 busy 狀態阻止第二個解鎖請求。
3. 由玩家明確操作呼叫 `await arcade.unlock()`；若剛完成重連 handshake，要求再次按下，保留 popup 所需的使用者操作。
4. 只接受回傳 `credit_status === 'consumed'` 後提交新局。`unlocked` 事件、偵測到款項或 `available` 額度都只是提示，不足以開始。
5. 成功保存新局後才切換遊戲狀態。音效、配樂、暫停／繼續和免費換關不呼叫付款入口。

三款控制器只展示 `https://linkincash.cc/arcade/checkout/<ID>` 的付款頁，拒絕其他 Origin、query、username 或 password。fragment 可能含訂單憑證，不能記錄、轉放 query 或送到分析服務。

`linkincash.cc` 是 CashLink macOS localhost 的公開預覽入口，不是正式 production；GitHub Pages 靜態網站成功部署不代表付款預覽服務可用。本機 `127.0.0.1` 與其他 fork 的 Origin 不同，不能假設原 publishable key 在那裡也能付款。請勿為本機測試鬆綁正式頁面的核對邏輯。

## 付款問題與復原

以下恢復介面適用於貪吃蛇 3D、打磚塊與天盾。

| 狀況 | 應採取的動作 | 不應做的事 |
| --- | --- | --- |
| `popup_blocked` | 使用頁面顯示、已驗證的 CashLink 付款連結；回來後按恢復／重試，等待原訂單確認 | 自行拼接付款 URL 或把帶 fragment 的網址貼到公開 issue |
| `cancelled`／關閉付款視窗 | 原局與訂單保留，準備好後明確按恢復 | 把取消誤認為已退款、已刪單或可免費開始 |
| 斷線、503、`temporarily_unavailable`、`rate_limited` | 等服務／連線恢復，再恢復原訂單 | 為了排錯清除儲存或重複付款 |
| handshake Origin／用途不符 | 保留原局，由維護者核對註冊設定；沒有通過就不開收費新局 | 只看回傳有物件就接受解鎖 |
| 已付款但未開始／`checkpoint_unavailable` | 保留原分頁，允許必要儲存，按恢復保存已解鎖進度；若仍失敗聯絡 CashLink | 再付一次以嘗試解決存檔問題 |
| 付款中重載 | 頁面顯示待恢復，玩家明確操作後續接原訂單 | 在載入時自動呼叫 `unlock()` |
| 憑證／冪等衝突或狀態無法判定 | 使用 CashLink 恢復碼／問題回報；只提供經遮蔽的非敏感資訊 | 公開付款憑證、瀏覽器儲存 dump、cookies 或私密資料 |

## 目前差異與限制

本機備援不是伺服器存檔；清除網站資料、兩種儲存同時失敗後關閉分頁，或 SDK 消耗額度與本機提交之間遭強制終止，仍可能需要 CashLink 端協助核對。不要把瀏覽器備援描述成跨裝置、跨分頁原子交易或任何情況下都能恢復。

純前端資料和 gate 可被使用者改寫，最高分亦不是可信排行榜；這些機制不是防作弊或有金錢獎勵的授權邊界。本專案不包含退款／結算管理、CashLink 後端或真實支付測試憑證。所有自動測試使用假 SDK；真實付款驗收須另行授權。
