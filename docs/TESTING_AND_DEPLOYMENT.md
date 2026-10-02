# 測試與發布

[回到 README](../README.md) · [開發指南](DEVELOPMENT.md) · [存檔與付款](STORAGE_AND_PAYMENTS.md)

所有命令從 **CashArcade 自己的 Git 根目錄**執行，不能在 CashLink checkout 直接提交或發布本專案。這份文件是操作方法，不是一次新的測試通過報告；交付時仍需記錄本次實際執行的結果。

## 自動測試

測試使用 Node.js 內建 `node:test`，不需 npm 套件、不啟動資料庫、不連真實付款服務。先跑直接受影響的檔案，例如：

```sh
node --test tests/snake-3d.test.mjs tests/snake-payment.test.mjs
node --test tests/snake-tutorial.test.mjs tests/snake-tutorial-ui.test.mjs
node --test tests/breakout-engine.test.mjs tests/breakout-payment.test.mjs
node --test tests/missile.test.mjs tests/missile-ui.test.mjs
git diff --check
```

需要完整專案回歸時：

```sh
node --test tests/*.test.mjs
```

這是 CashArcade 的 Node 測試，不是 CashLink 的 PHP／資料庫測試流程。

| 變更範圍 | 對應測試（都在 `tests/`） | 涵蓋重點 |
| --- | --- | --- |
| 蛇的三維規則與十二關 | [snake-3d.test.mjs](../tests/snake-3d.test.mjs) | 六方向、十二關完整移動回放、出口、傳送、雷射、道具、甜點／炸彈計時與 snapshot |
| 蛇的付款與存檔 | [snake-payment.test.mjs](../tests/snake-payment.test.mjs) | 免費續關、付費入口、單次解鎖、錯誤／取消、存檔失敗與付款前後恢復 |
| 蛇的第0關與控制器 | [snake-tutorial.test.mjs](../tests/snake-tutorial.test.mjs)、[snake-tutorial-ui.test.mjs](../tests/snake-tutorial-ui.test.mjs) | 真實移動完成13個教學目標、免費重試／R、觀察、自由練習、跳過、儲存降級與正式付款隔離 |
| 蛇與飛行事件 | [game-audio-events.test.mjs](../tests/game-audio-events.test.mjs) | 拍翼、計分、加速、暫停、遊戲與音樂協調 |
| 飛行畫面 | [flappy-renderer.test.mjs](../tests/flappy-renderer.test.mjs) | 鳥形、場景、亮暗版、減少動態效果、裝飾上限 |
| 打磚塊規則／存檔 | [breakout-engine.test.mjs](../tests/breakout-engine.test.mjs) | 30 關、蓄力、多球、道具、首領與 snapshot／遷移 |
| 打磚塊空間路線 | [breakout-routes.test.mjs](../tests/breakout-routes.test.mjs) | 必要目標碰撞面可抵達、門、傳送與多幕 |
| 打磚塊畫面 | [breakout-renderer.test.mjs](../tests/breakout-renderer.test.mjs) | 三色霓虹、特殊磚辨識、主題／特效上限 |
| 打磚塊付款／頁面控制 | [breakout-payment.test.mjs](../tests/breakout-payment.test.mjs) | 免費與付費入口、快速連按、取消／錯誤、存檔失敗及重載 |
| 天盾規則 | [missile.test.mjs](../tests/missile.test.mjs) | 20 關、最近可用砲台、裝甲命中去重、城市、升級／頭目 |
| 天盾輸入／付款／存檔 | [missile-ui.test.mjs](../tests/missile-ui.test.mjs) | 單次發射、失敗 gate、checkpoint、重載、升級與配樂 |
| 天盾畫面 | [missile-renderer.test.mjs](../tests/missile-renderer.test.mjs) | 城市損壞、道具、頭目、震動與粒子生命週期 |
| 共用音效 | [audio.test.mjs](../tests/audio.test.mjs) | 延遲初始化、靜音儲存、音量、節流及聲部限制 |
| 四款配樂 | [missile-music.test.mjs](../tests/missile-music.test.mjs) | 名稱沿用天盾，但也涵蓋另三款樂譜、排程、暫停與音量 |
| 主題／網站圖示 | [theme-default.test.mjs](../tests/theme-default.test.mjs)、[site-icons.test.mjs](../tests/site-icons.test.mjs) | 預設暗版、手動偏好、ICO／PNG、manifest 與子路徑 |

測試多使用固定時鐘、假 DOM、假 AudioContext 或假 SDK。Node 測試通過不代表真實瀏覽器能播放聲音、手機一定無溢出或真實付款成功。蛇的固定種子回放以實際方向輸入逐步通關、不依賴道具；這證明指定路線可完成，不代表所有路線與玩家操作都能過關。

## 瀏覽器驗收工具

先依 [README](../README.md) 啟動本機 HTTP 預覽，再開啟：

| 本機頁面 | 用途 |
| --- | --- |
| [貪吃蛇三維對照](http://127.0.0.1:4173/tests/snake-gallery.html) | 十二關代表場景、單關完整回放、五道具、context 恢復、FPS／繪製成本與原生音效量測 |
| [打磚塊關卡對照](http://127.0.0.1:4173/tests/breakout-gallery.html) | 30 關初始／機關啟動後共 60 畫面、亮暗切換、PNG 對照圖、音效時長／RMS／峰值 |
| [三款配樂試聽](http://127.0.0.1:4173/tests/arcade-music.html) | 打磚塊 30 關／首領／三幕，蛇與飛行的加速編曲及密集混音 |
| [天盾配樂試聽](http://127.0.0.1:4173/tests/missile-music.html) | 20 關、兩個頭目階段、原生合成輸出與大音效疊加 |

這四頁不載入付款 SDK，也不保存正式遊戲進度。量測使用瀏覽器 `OfflineAudioContext`；貪吃蛇頁直接顯示時長、RMS、peak、clipped，其餘試聽頁可產生播放器與臨時 WAV。打磚塊對照由程式直接啟動機關建立樣本，不是 30 關真實手動通關紀錄；蛇的回放模式則經實際移動和碰撞規則完成本關。

涉及畫面或操作的改動，至少檢查：

1. 桌面與 390px 寬度，暗／亮主題下 Canvas、文字、按鈕及付款區沒有橫向溢出。
2. 滑鼠、鍵盤、觸控；按鍵自動重複、按住／放開、失焦、隱藏分頁及全螢幕進出。
3. 首次操作後出聲，音效／配樂分別靜音、音量及跨重載偏好；密集遊戲與真實輸出裝置都要確認。
4. 修改特效時檢查「減少動態效果」及低效能密集場景；裝飾降級不能改規則。
5. 用隔離測試瀏覽器資料檢查存檔／付款狀態，不覆蓋玩家真實進度，不以真實付款代替假 SDK 測試。
6. Console 無新增錯誤，Network 的必要靜態檔案成功載入；SDK 故障要獨立記錄。

只改文件時，核對程式事實、相對連結、命令／檔案名稱與 `git diff --check` 即可；沒有執行的玩法或付款驗收不要寫成已通過。

## GitHub Pages 設定

| 項目 | 目前設定 |
| --- | --- |
| Repository | [darkerduck/CashArcade](https://github.com/darkerduck/CashArcade) |
| 發布方式 | Deploy from a branch |
| Branch／folder | `main`／`/(root)` |
| 公開首頁 | [CashArcade](https://darkerduck.github.io/CashArcade/) |
| 遊戲路徑 | `/CashArcade/snake/`、`/CashArcade/breakout/`、`/CashArcade/flappy/`、`/CashArcade/missile/` |

`docs/` 是維護文件，不要把 Pages 來源切到 `/docs`。沒有套件編譯產物、`dist/` 或本專案自訂的 `.github/workflows` 測試設定；目前推送不會自動替你跑 Node 測試。GitHub 仍會產生 Pages build/deployment 工作，不能把這種部署工作當成遊戲測試。

需要檢查設定時，在 GitHub 的 Settings → Pages 查看。分支來源與建置行為參考 [GitHub 官方 Pages 發布文件](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)。一般內容更新不需要重新設定 Pages。

## 提交與發布步驟

1. 確認 remote 與未提交變更，取得遠端最新狀態，保留其他工作的內容：

   ```sh
   git rev-parse --show-toplevel
   git remote -v
   git status --short --branch
   git fetch origin
   git log --oneline HEAD..origin/main
   ```

   remote 必須是 CashArcade。新功能可使用 `codex/描述` 工作分支；獲准直接發布 main 時，先確認工作目錄乾淨，再 `git merge --ff-only origin/main`。無法 fast-forward 就先處理差異，不 force push。

2. 執行本次相關驗證、同步說明與必要資源版本，檢查 diff。逐一 `git add` 本次相關檔案，`git diff --cached` 確認沒有密鑰、CashLink 原始碼、個人存檔或付款資料，再 commit。

3. 在已核准、已整合變更的 `main` 推送：

   ```sh
   git push origin main
   git rev-parse HEAD
   ```

4. 若已安裝並登入 GitHub CLI，可用唯讀查詢核對 Pages 設定及最新建置；也可直接看 repository 的 Actions／Pages 畫面：

   ```sh
   gh api repos/darkerduck/CashArcade/pages --jq '{html_url,status,source}'
   gh api repos/darkerduck/CashArcade/pages/builds/latest --jq '{status,commit,error}'
   ```

   最新 build 的 `commit` 應與推送的 SHA 相符，且 `status` 為 `built`；舊 commit 的成功狀態不能用來宣稱新版已發布。若遠端已有更新提交，也需確認其中包含本次變更。`queued`／`building` 時等待再查，`errored` 時讀錯誤，不持續盲目重推。

5. 匿名開啟首頁及受影響遊戲，確認已更新的 CSS／JS／圖像與本次 commit 一致。需要精確比對時，以 GET 讀取靜態檔案後核對內容或 SHA-256；只看到 HTTP 200 不代表版本正確。文件在 [GitHub 文件目錄](https://github.com/darkerduck/CashArcade/tree/main/docs) 閱讀，遊戲入口維持不變。

## 發布與執行排錯

| 問題 | 檢查方向 |
| --- | --- |
| clone／push 驗證失敗 | 確認 GitHub 帳號與 CashArcade 寫入權限；透過官方登入流程恢復，不把 token 放進 remote URL、文件或 log |
| `4173` 被占用 | 使用另一個未占用連接埠，並同步修改本機瀏覽網址；不停止不明服務 |
| 本機正常、Pages 資源 404 | 檔名大小寫、相對路徑、檔案是否已提交、Pages 是否仍是 main 根目錄 |
| HTML 新了、圖示／JS 還舊 | 檢查 HTML 版本引用與實際回應內容；必要時重新載入靜態資源，勿把清除所有網站資料當成清快取 |
| Pages 已 built、付款仍失敗 | Pages 與 `linkincash.cc` SDK 是不同服務；核對 SDK 回應、Origin 與用途，依[付款復原](STORAGE_AND_PAYMENTS.md)處理 |
| 測試全綠，但聲音仍有異常 | 使用試聽頁做原生輸出量測，檢查瀏覽器播放限制、獨立開關、輸出裝置與藍牙延遲 |

若發布內容需要回復，先確認受影響 commit 與存檔相容性，再以新的回復 commit 走同一驗證流程；避免 reset／force push 抹掉後續工作。尤其存檔版本變更不能只回復前端檔案就假定舊版可讀。
