# 開發指南

[回到 README](../README.md) · [測試與發布](TESTING_AND_DEPLOYMENT.md) · [存檔與付款](STORAGE_AND_PAYMENTS.md)

## 執行環境

這是獨立的靜態網站，遊玩使用現代瀏覽器的 Canvas 2D、WebGL2、Pointer Events、Web Audio、Web Storage 與 `requestAnimationFrame`。貪吃蛇使用 vendored Three.js r186，其餘使用原生 Canvas；沒有前端框架、套件安裝、編譯、後端或環境變數。CashLink 只透過外部 SDK 接入部分重開流程，不需要把 CashLink 原始碼複製進來。

本機預覽方法見 [README](../README.md)。伺服器的網站根目錄必須是 CashArcade repository 根目錄，才能解析 `../audio.js`、封面與共用素材。遊玩不需 Node.js；開發測試請準備 Node.js 22 或更新版本，使用內建 `node:test`，不用 `npm install`。Python 3 只是 README 範例使用的靜態伺服器，也可替換為既有 HTTP 預覽工具。

## 檔案分工

| 路徑 | 職責 |
| --- | --- |
| [index.html](../index.html)、[style.css](../style.css)、[app.js](../app.js) | 首頁四張遊戲卡、版面、共用主題偏好 |
| [audio.js](../audio.js) | 四款遊戲共用的短音效合成、音效靜音、聲部上限與峰值限制 |
| [music.js](../music.js)、[music-scores.js](../music-scores.js)、[music.css](../music.css) | 配樂合成／排程與控制；蛇、飛行、打磚塊的原創樂譜 |
| [snake/game.js](../snake/game.js)、[snake/audio-events.mjs](../snake/audio-events.mjs) | 六方向輸入、介面、保存協調、音效與四階段配樂 |
| [snake/levels.mjs](../snake/levels.mjs)、[snake/engine.mjs](../snake/engine.mjs) | 十二關地形／種子、純三維規則、機關／道具、固定步進及 snapshot |
| [snake/tutorial.mjs](../snake/tutorial.mjs) | 獨立第0關、固定引導目標、免費重試、自由練習及教學存檔；無SDK依賴 |
| [snake/renderer.mjs](../snake/renderer.mjs)、[vendor/three-r186](../vendor/three-r186) | Three.js 立體場景、插值、實例化、反射／光暈、固定與觀察鏡頭 |
| [snake/storage.mjs](../snake/storage.mjs)、[snake/payment.mjs](../snake/payment.mjs) | 完整戰役存檔、已解鎖備援、單一重試 gate 與 SDK 恢復 |
| [flappy/game.js](../flappy/game.js)、[flappy/renderer.js](../flappy/renderer.js) | 飛行規則／輸入與獨立的小鳥、閘門、視差場景繪製 |
| [breakout/levels.js](../breakout/levels.js) | 30 個固定關卡、陣型、提示、配色、磚塊耐久、16 種道具 |
| [breakout/engine.js](../breakout/engine.js) | 純遊戲狀態、重力、多球、掃掠碰撞、機關、事件與 snapshot |
| [breakout/renderer.js](../breakout/renderer.js) | Canvas、粒子、霓虹流光、減少動態效果與低負荷裝飾模式 |
| [breakout/storage.js](../breakout/storage.js) | 存檔驗證、舊版遷移、寫入讀回確認、已付款備援 |
| [breakout/game.js](../breakout/game.js)、[breakout/payment-gate.js](../breakout/payment-gate.js) | 頁面控制、存檔／音訊協調、單一新局入口及 SDK 解鎖 |
| [missile/engine.js](../missile/engine.js)、[missile/renderer.js](../missile/renderer.js) | 20 關資料、砲台／敵人／城市／道具規則，以及 Canvas 特效 |
| [missile/game.js](../missile/game.js)、[missile/payment-gate.js](../missile/payment-gate.js) | 戰役 checkpoint、關間選擇、輸入、失敗後再玩付款與恢復 |
| [missile/score.js](../missile/score.js)、[missile/music.js](../missile/music.js) | 天盾的 20 關樂譜與共用配樂引擎轉接介面 |
| [assets/covers](../assets/covers)、[assets/brand](../assets/brand)、[brand.css](../brand.css) | 已確認的五張封面、Logo／圖示、共用頁首圖像樣式 |
| [site.webmanifest](../site.webmanifest)、[favicon.ico](../favicon.ico) | 相對作用範圍與圖示；目前沒有 Service Worker／離線快取 |
| [tests](../tests) | Node 假環境測試、關卡對照頁與原生音訊量測頁 |

各遊戲自己的 `index.html` 與 `style.css` 負責頁面及響應式版面。不要把首頁導覽、付款與物理規則都塞進 renderer。

## 邏輯尺寸與更新方式

| 遊戲 | 邏輯畫布 | 遊戲更新 |
| --- | --- | --- |
| 貪吃蛇 | 10 × 10 × 3 至 14 × 14 × 5 三維格點 | 10 ms 固定模擬；正式每格 250–160 ms、教學預設800ms（原400ms的0.5–2倍可調），渲染獨立插值 |
| 打磚塊 | 720 × 540 | 引擎 120 Hz 固定物理步進、掃掠碰撞；控制器安排畫格 |
| 霓虹飛行 | 720 × 540 | 畫格 delta 更新重力／閘門；renderer 與碰撞圈分離 |
| 霓虹天盾 | 960 × 720 | 引擎按 delta 更新戰役；控制器處理畫格與單次按壓 |

CSS 顯示尺寸不等於遊戲座標。修改拖曳／瞄準時，先用 Canvas 的 `getBoundingClientRect()` 把 client 座標轉回邏輯尺寸；高像素密度與手機縮放不能改變碰撞規則。

物理、計分、道具及勝敗由引擎／控制器決定，renderer 只呈現結果。視覺粒子、鏡頭震動或音訊失敗不能改變分數、消耗解鎖或推進關卡。主題使用 `casharcade-theme`，無偏好時固定暗版。

## 維護關卡與機關

貪吃蛇使用 ES modules 與相對路徑 import map。`snake/levels.mjs` 的十二關包含三維牆體、出口、傳送門、雷射、炸彈數、配樂章節與種子；`engine.mjs` 不依賴 DOM／WebGL。改關卡時要用完整移動回放驗證可通關，不能只測連通性。每步 snapshot 包含蛇身、方向、物件、遊玩時鐘、道具和隨機種子；恢復後一律先暫停。Three.js 固定版與 MIT 授權位於 `vendor/three-r186/`，不使用執行期 CDN。

打磚塊在 `createLevel(index, wave)` 逐關定義，index 為 0–29；`TITLES`、`TIPS`、`PALETTES`、`PATTERNS` 要保持對應。新增機關要同步碰撞、snapshot／restore、存檔驗證與 renderer；不可破壞物不能算清關目標。第 29 關三幕與第 30 關核心分段都有進度旗標，不能只改初始陣型。道具機率／保證掉落以該關資料為準。

天盾的 `LEVELS` 在 `missile/engine.js`，包含名稱、敵人數、基速、間隔、波數、齊射數、陣型與敵人種類；畫面關卡為 1–20。調整關數時，也要檢查 checkpoint 驗證、最後關勝利、升級上限、頭目邏輯與樂譜對應。

打磚塊引擎提供 CommonJS 匯出供 Node 測試使用；天盾測試則以 `node:vm` 載入並讀取 `scope.NeonDefense`，沒有 CommonJS 匯出。瀏覽器分別使用 `NeonBreakout`／`NeonDefense` 全域介面。除蛇的 module 控制器外，現有 HTML 使用有順序的 `defer` script，新增檔案時保留資料／引擎／渲染／存檔先於頁面控制器，音效／配樂引擎先於呼叫端。不要把這些 script 隨意改成 `async`。

## 音效與配樂介面

短音效由 `CashArcadeAudio.create({ storageKey, toggleButton, outputLevel, musicMix })` 建立：

- `play(effectName, delay = 0)`：只接受 `audio.js` 的 `EFFECTS` 白名單，delay 單位秒、限制在 0–1；未知音效安靜忽略。
- `resume()`、`toggleMuted()`、`isMuted()`：在玩家操作時喚醒及切換音效。取消靜音會播放確認音。
- `musicOutput()`：提供延遲建立的 `{ context, destination }` 給配樂共用；不代表開始遊戲或付款成功。

每組 tone 為 `[起始 Hz, 結束 Hz, 秒數, 延後秒數, 音量, 波形, 可選保持秒數]`；`noise` 是 `[秒數, 音量, 低通 Hz]`，`minGap` 是毫秒。新音色要有清楚起音與足夠時長，並測試單音與密集混音；不能只靠提高全站增益。既有 +18 dB 合成增益、限制器及最多 40 聲部需一起考量。

配樂由 `CashArcadeMusic.create()` 接收 UI 元素、`score`、`storagePrefix` 及可選 `audioOutput`，回傳 `start(level, phase)`、`pause()`、`resume()`、`phase(value)`、`duck()`、`wake()`。樂譜提供 `profile(level, phase)` 及 `notesForStep(profile, index)`。階段變化於下一小節接續，重開／換關重設樂句，暫停後續播不能重複建立排程。

蛇、飛行及打磚塊傳入 `sound.musicOutput`，共用音訊 context 與最終混音限制；天盾目前透過 `NeonDefenseMusic` 轉接，共用合成器但不傳這個音效匯流排。音樂開關、音量與音效靜音是獨立儲存鍵。待命、重載提示、付款、失敗及勝利不啟動背景配樂，音樂程式不得直接呼叫 `unlock()`。

## 路徑、圖像與版本

公開網站位於 `/CashArcade/`，所以站內資源使用 `./`、`../`；不要用 `/audio.js` 或 `/snake/` 這類會跑到網域根目錄的絕對路徑。付款 Origin 是網域層級，和遊戲路徑不同，詳見[付款文件](STORAGE_AND_PAYMENTS.md)。

封面保留 `assets/covers/{snake,breakout,flappy,missile,assault}.jpg`。Logo 原始圖與生成提示見 [README 的品牌素材說明](../README.md#brand)，不要把來源不明的圖像、音樂或字型放進專案。配樂／音效即時合成，試聽頁下載的 WAV 是臨時產物，不是遊戲執行需要的素材。

修改正式靜態資源時，同步檢查所有引用頁的 `?v=`；共用音訊或圖示可能同時被四款遊戲、首頁及驗收頁引用。只調整版本號不能取代部署內容核對。Manifest 為 `display: browser`，不可僅因存在 manifest 就聲稱支援離線遊玩。

### 遊戲封面規範

所有現有與未來的遊戲封面不得包含文字、字母、數字、標題、標語、Logo、介面或水印。遊戲名稱、編號及說明由網頁另外呈現，不烙印於圖片中。獨立的網站 Logo、favicon 與其他網站圖示不受此封面規範限制。

新封面使用 imagegen 內建工具，將已確認的打磚塊、天盾與霓虹飛行圖片標示為風格參考，不覆寫參考圖。採橫式約 16:9、深藍背景、青藍／桃紅／紫色霓虹光效、金色點綴與立體材質；不得以平面線稿或像素風取代此系列的封面風格。完整規範亦列於 [README](../README.md#遊戲封面規範)。

生成提示必須明列禁止文字、字母、數字、標題、標語、Logo、介面與水印。人工檢查整張輸出及遊戲卡尺寸縮圖：不得出現任何上述內容，主體仍須清楚；不合格時針對問題修正並重新驗收。先提供預覽時，不更動首頁圖片引用，也不覆寫或發布現有封面。

首頁霓虹強襲使用[已確認的無文字 JPEG 封面](../assets/covers/assault.jpg)，[生成提示](../assets/covers/assault-prompt.txt)隨素材保存。舊 `assault.svg` 含英文標題與標語，僅保留為歷史稿、不供首頁使用；不得在後續生成中沿用其文字。圖片更新時同步調整引用版本並核對公開資源。

## 變更交付

1. 先同步遠端並檢查 worktree，只修改本次需求的 CashArcade 檔案。
2. 規則變動更新玩家說明；持久資料變動更新存檔文件、遷移與相關測試；音訊變動量測真實合成輸出。
3. 依[測試對照表](TESTING_AND_DEPLOYMENT.md)執行直接受影響測試，再做相應桌面／390px、亮暗版驗收。
4. 提交與發布後記錄 commit、執行過的驗證及未驗項目。不要把假 SDK 通過寫成真實付款成功。

目前 repository 根目錄沒有 `LICENSE` 檔案；公開可讀不等於已授予任意再散布授權。若要對外宣告授權，先由擁有者決定並補上正式檔案。第三方 Three.js 的 MIT 授權另保留於其 vendor 目錄，不代表本專案其餘內容的授權。
