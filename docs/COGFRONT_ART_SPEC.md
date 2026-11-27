# 蒸汽前線 COGFRONT — 美術 CG 規格與提示詞

這份文件交給 Codex 生成美術 CG。遊戲目前用 Canvas 程式繪製全部角色與場景，已可完整遊玩；每張 CG 生成後放進 `cogfront/art/`，並把檔名加進 `cogfront/art/files.js`，遊戲就會自動改用圖檔，沒放的部分維持程式繪製。尺寸、格數、錨點由 `cogfront/art.js` 定義，本文件的規格表由它產生，兩者必須一致（`tests/cogfront-art-spec.test.mjs` 會檢查）。

## 交付流程

1. 先生成主角與一名發條士兵的「設定圖」（正面＋側面＋細節），確認造型後作為後續所有動作條的參考圖，確保每一格同一個角色。
2. 依下表逐檔生成。角色動作條是**橫向排列的等寬格子**，透明背景 PNG，角色一律**面向右**（敵人與頭目也畫面向右，遊戲會自動左右翻轉）。
3. 每張圖檢查：格數、總尺寸、錨點（腳底所在的水平線）、每格比例一致、沒有文字或浮水印、去背乾淨。
4. 把通過的檔名加進 `cogfront/art/files.js` 的陣列，例如 `globalThis.CogfrontArtFiles = ['hero-idle.png', 'train.png'];`，在瀏覽器實際遊玩確認對位。
5. 封面：生成 `assets/covers/cogfront.jpg`（1672×941，無文字），首頁 `index.html` 的封面改指向 jpg 並更新 `?v=`，同時把 `tests/site-covers.test.mjs` 中 cogfront.svg 的例外移除。

## 共用風格（每個提示詞前都加上）

```text
Original 2D side-scrolling game art for the steampunk lane-battle game COGFRONT. Hand-drawn cartoon silhouette style: bold dark-brown ink outline (#1a120d, 3–4 px at final size), flat painterly fills with soft two-tone cel shading, warm brass (#c99a3e), copper (#b8673a), tin grey (#b7b9b0), soot black, cloth red (#9b2f2a) and steel blue (#2f5d7a) accents; light from the upper left; silhouette must read clearly at 60 px tall.
```

角色動作條另加：

```text
Strict orthographic side view facing RIGHT, full body, centred in every cell, identical design, palette and scale in every frame, feet exactly on the anchor line, transparent background (PNG with alpha), no cast shadow, no ground, no motion-blur outside the cell.
```

所有圖檔都加上：

```text
Absolutely no text, letters, numbers, logos, UI, frame borders, grid lines or watermark. Original design — no resemblance to any existing game, film or franchise character.
```

## 角色動作條

### 黃銅隊長 Captain Brass（主角）

造型：a stocky human steam-officer in a brass boiler-chest cuirass with copper rivet bands, round steel helmet with a short red crest and one glowing amber goggle, short tattered red cape, small copper boiler backpack with a stubby chimney venting white steam, dark steel greaves; wields a large single-edged steam cleaver-sword with brass hilt and a tiny pressure gauge on the guard. Body occupies about 72% of the cell height.

| 檔名 | 格數 × 單格 | 總尺寸 | FPS | 循環 | 錨點（格內 px） |
| --- | --- | --- | --- | --- | --- |
| `hero-idle.png` | 6 × 192×192 | 1152×192 | 8 | 是 | (96, 177) |
| `hero-run.png` | 8 × 192×192 | 1536×192 | 14 | 是 | (96, 177) |
| `hero-slash1.png` | 5 × 192×192 | 960×192 | 18 | 否 | (96, 177) |
| `hero-slash2.png` | 5 × 192×192 | 960×192 | 18 | 否 | (96, 177) |
| `hero-slash3.png` | 7 × 192×192 | 1344×192 | 16 | 否 | (96, 177) |
| `hero-burst.png` | 7 × 192×192 | 1344×192 | 16 | 否 | (96, 177) |
| `hero-charge.png` | 4 × 192×192 | 768×192 | 16 | 是 | (96, 177) |
| `hero-dodge.png` | 5 × 192×192 | 960×192 | 15 | 否 | (96, 177) |
| `hero-hurt.png` | 3 × 192×192 | 576×192 | 12 | 否 | (96, 177) |
| `hero-down.png` | 6 × 192×192 | 1152×192 | 10 | 否 | (96, 177) |

**`hero-idle.png`**

```text
Original 2D side-scrolling game art for the steampunk lane-battle game COGFRONT. Hand-drawn cartoon silhouette style: bold dark-brown ink outline (#1a120d, 3–4 px at final size), flat painterly fills with soft two-tone cel shading, warm brass (#c99a3e), copper (#b8673a), tin grey (#b7b9b0), soot black, cloth red (#9b2f2a) and steel blue (#2f5d7a) accents; light from the upper left; silhouette must read clearly at 60 px tall. Strict orthographic side view facing RIGHT, full body, centred in every cell, identical design, palette and scale in every frame, feet exactly on the anchor line, transparent background (PNG with alpha), no cast shadow, no ground, no motion-blur outside the cell. Character: a stocky human steam-officer in a brass boiler-chest cuirass with copper rivet bands, round steel helmet with a short red crest and one glowing amber goggle, short tattered red cape, small copper boiler backpack with a stubby chimney venting white steam, dark steel greaves; wields a large single-edged steam cleaver-sword with brass hilt and a tiny pressure gauge on the guard. Body occupies about 72% of the cell height. Horizontal sprite strip: 6 equal cells of 192×192 px (whole image 1152×192 px), frames read left to right as a seamless looping animation: idle breathing loop, cape swaying, small steam puffs from the backpack chimney. Feet (or hover base) on the anchor line, anchor (96, 177) px inside each cell. Absolutely no text, letters, numbers, logos, UI, frame borders, grid lines or watermark. Original design — no resemblance to any existing game, film or franchise character.
```

**`hero-run.png`**

```text
Original 2D side-scrolling game art for the steampunk lane-battle game COGFRONT. Hand-drawn cartoon silhouette style: bold dark-brown ink outline (#1a120d, 3–4 px at final size), flat painterly fills with soft two-tone cel shading, warm brass (#c99a3e), copper (#b8673a), tin grey (#b7b9b0), soot black, cloth red (#9b2f2a) and steel blue (#2f5d7a) accents; light from the upper left; silhouette must read clearly at 60 px tall. Strict orthographic side view facing RIGHT, full body, centred in every cell, identical design, palette and scale in every frame, feet exactly on the anchor line, transparent background (PNG with alpha), no cast shadow, no ground, no motion-blur outside the cell. Character: a stocky human steam-officer in a brass boiler-chest cuirass with copper rivet bands, round steel helmet with a short red crest and one glowing amber goggle, short tattered red cape, small copper boiler backpack with a stubby chimney venting white steam, dark steel greaves; wields a large single-edged steam cleaver-sword with brass hilt and a tiny pressure gauge on the guard. Body occupies about 72% of the cell height. Horizontal sprite strip: 8 equal cells of 192×192 px (whole image 1536×192 px), frames read left to right as a seamless looping animation: determined forward run cycle, sword held low behind, cape streaming. Feet (or hover base) on the anchor line, anchor (96, 177) px inside each cell. Absolutely no text, letters, numbers, logos, UI, frame borders, grid lines or watermark. Original design — no resemblance to any existing game, film or franchise character.
```

**`hero-slash1.png`**

```text
Original 2D side-scrolling game art for the steampunk lane-battle game COGFRONT. Hand-drawn cartoon silhouette style: bold dark-brown ink outline (#1a120d, 3–4 px at final size), flat painterly fills with soft two-tone cel shading, warm brass (#c99a3e), copper (#b8673a), tin grey (#b7b9b0), soot black, cloth red (#9b2f2a) and steel blue (#2f5d7a) accents; light from the upper left; silhouette must read clearly at 60 px tall. Strict orthographic side view facing RIGHT, full body, centred in every cell, identical design, palette and scale in every frame, feet exactly on the anchor line, transparent background (PNG with alpha), no cast shadow, no ground, no motion-blur outside the cell. Character: a stocky human steam-officer in a brass boiler-chest cuirass with copper rivet bands, round steel helmet with a short red crest and one glowing amber goggle, short tattered red cape, small copper boiler backpack with a stubby chimney venting white steam, dark steel greaves; wields a large single-edged steam cleaver-sword with brass hilt and a tiny pressure gauge on the guard. Body occupies about 72% of the cell height. Horizontal sprite strip: 5 equal cells of 192×192 px (whole image 960×192 px), frames read left to right as a one-shot animation: fast horizontal forward cut, white slash arc trailing the blade. Feet (or hover base) on the anchor line, anchor (96, 177) px inside each cell. Absolutely no text, letters, numbers, logos, UI, frame borders, grid lines or watermark. Original design — no resemblance to any existing game, film or franchise character.
```

**`hero-slash2.png`**

```text
Original 2D side-scrolling game art for the steampunk lane-battle game COGFRONT. Hand-drawn cartoon silhouette style: bold dark-brown ink outline (#1a120d, 3–4 px at final size), flat painterly fills with soft two-tone cel shading, warm brass (#c99a3e), copper (#b8673a), tin grey (#b7b9b0), soot black, cloth red (#9b2f2a) and steel blue (#2f5d7a) accents; light from the upper left; silhouette must read clearly at 60 px tall. Strict orthographic side view facing RIGHT, full body, centred in every cell, identical design, palette and scale in every frame, feet exactly on the anchor line, transparent background (PNG with alpha), no cast shadow, no ground, no motion-blur outside the cell. Character: a stocky human steam-officer in a brass boiler-chest cuirass with copper rivet bands, round steel helmet with a short red crest and one glowing amber goggle, short tattered red cape, small copper boiler backpack with a stubby chimney venting white steam, dark steel greaves; wields a large single-edged steam cleaver-sword with brass hilt and a tiny pressure gauge on the guard. Body occupies about 72% of the cell height. Horizontal sprite strip: 5 equal cells of 192×192 px (whole image 960×192 px), frames read left to right as a one-shot animation: rising backhand cut upward, slash arc. Feet (or hover base) on the anchor line, anchor (96, 177) px inside each cell. Absolutely no text, letters, numbers, logos, UI, frame borders, grid lines or watermark. Original design — no resemblance to any existing game, film or franchise character.
```

**`hero-slash3.png`**

```text
Original 2D side-scrolling game art for the steampunk lane-battle game COGFRONT. Hand-drawn cartoon silhouette style: bold dark-brown ink outline (#1a120d, 3–4 px at final size), flat painterly fills with soft two-tone cel shading, warm brass (#c99a3e), copper (#b8673a), tin grey (#b7b9b0), soot black, cloth red (#9b2f2a) and steel blue (#2f5d7a) accents; light from the upper left; silhouette must read clearly at 60 px tall. Strict orthographic side view facing RIGHT, full body, centred in every cell, identical design, palette and scale in every frame, feet exactly on the anchor line, transparent background (PNG with alpha), no cast shadow, no ground, no motion-blur outside the cell. Character: a stocky human steam-officer in a brass boiler-chest cuirass with copper rivet bands, round steel helmet with a short red crest and one glowing amber goggle, short tattered red cape, small copper boiler backpack with a stubby chimney venting white steam, dark steel greaves; wields a large single-edged steam cleaver-sword with brass hilt and a tiny pressure gauge on the guard. Body occupies about 72% of the cell height. Horizontal sprite strip: 7 equal cells of 192×192 px (whole image 1344×192 px), frames read left to right as a one-shot animation: big overhead two-handed smash ending low in front, burst of steam and sparks at impact on the last frames. Feet (or hover base) on the anchor line, anchor (96, 177) px inside each cell. Absolutely no text, letters, numbers, logos, UI, frame borders, grid lines or watermark. Original design — no resemblance to any existing game, film or franchise character.
```

**`hero-burst.png`**

```text
Original 2D side-scrolling game art for the steampunk lane-battle game COGFRONT. Hand-drawn cartoon silhouette style: bold dark-brown ink outline (#1a120d, 3–4 px at final size), flat painterly fills with soft two-tone cel shading, warm brass (#c99a3e), copper (#b8673a), tin grey (#b7b9b0), soot black, cloth red (#9b2f2a) and steel blue (#2f5d7a) accents; light from the upper left; silhouette must read clearly at 60 px tall. Strict orthographic side view facing RIGHT, full body, centred in every cell, identical design, palette and scale in every frame, feet exactly on the anchor line, transparent background (PNG with alpha), no cast shadow, no ground, no motion-blur outside the cell. Character: a stocky human steam-officer in a brass boiler-chest cuirass with copper rivet bands, round steel helmet with a short red crest and one glowing amber goggle, short tattered red cape, small copper boiler backpack with a stubby chimney venting white steam, dark steel greaves; wields a large single-edged steam cleaver-sword with brass hilt and a tiny pressure gauge on the guard. Body occupies about 72% of the cell height. Horizontal sprite strip: 7 equal cells of 192×192 px (whole image 1344×192 px), frames read left to right as a one-shot animation: braces and thrusts the blade forward releasing a wide cone of white pressurised steam. Feet (or hover base) on the anchor line, anchor (96, 177) px inside each cell. Absolutely no text, letters, numbers, logos, UI, frame borders, grid lines or watermark. Original design — no resemblance to any existing game, film or franchise character.
```

**`hero-charge.png`**

```text
Original 2D side-scrolling game art for the steampunk lane-battle game COGFRONT. Hand-drawn cartoon silhouette style: bold dark-brown ink outline (#1a120d, 3–4 px at final size), flat painterly fills with soft two-tone cel shading, warm brass (#c99a3e), copper (#b8673a), tin grey (#b7b9b0), soot black, cloth red (#9b2f2a) and steel blue (#2f5d7a) accents; light from the upper left; silhouette must read clearly at 60 px tall. Strict orthographic side view facing RIGHT, full body, centred in every cell, identical design, palette and scale in every frame, feet exactly on the anchor line, transparent background (PNG with alpha), no cast shadow, no ground, no motion-blur outside the cell. Character: a stocky human steam-officer in a brass boiler-chest cuirass with copper rivet bands, round steel helmet with a short red crest and one glowing amber goggle, short tattered red cape, small copper boiler backpack with a stubby chimney venting white steam, dark steel greaves; wields a large single-edged steam cleaver-sword with brass hilt and a tiny pressure gauge on the guard. Body occupies about 72% of the cell height. Horizontal sprite strip: 4 equal cells of 192×192 px (whole image 768×192 px), frames read left to right as a seamless looping animation: piston-boosted lunge, body leaning far forward, steam jet from the backpack, motion streaks behind. Feet (or hover base) on the anchor line, anchor (96, 177) px inside each cell. Absolutely no text, letters, numbers, logos, UI, frame borders, grid lines or watermark. Original design — no resemblance to any existing game, film or franchise character.
```

**`hero-dodge.png`**

```text
Original 2D side-scrolling game art for the steampunk lane-battle game COGFRONT. Hand-drawn cartoon silhouette style: bold dark-brown ink outline (#1a120d, 3–4 px at final size), flat painterly fills with soft two-tone cel shading, warm brass (#c99a3e), copper (#b8673a), tin grey (#b7b9b0), soot black, cloth red (#9b2f2a) and steel blue (#2f5d7a) accents; light from the upper left; silhouette must read clearly at 60 px tall. Strict orthographic side view facing RIGHT, full body, centred in every cell, identical design, palette and scale in every frame, feet exactly on the anchor line, transparent background (PNG with alpha), no cast shadow, no ground, no motion-blur outside the cell. Character: a stocky human steam-officer in a brass boiler-chest cuirass with copper rivet bands, round steel helmet with a short red crest and one glowing amber goggle, short tattered red cape, small copper boiler backpack with a stubby chimney venting white steam, dark steel greaves; wields a large single-edged steam cleaver-sword with brass hilt and a tiny pressure gauge on the guard. Body occupies about 72% of the cell height. Horizontal sprite strip: 5 equal cells of 192×192 px (whole image 960×192 px), frames read left to right as a one-shot animation: quick forward roll, curled into a ball then back to standing. Feet (or hover base) on the anchor line, anchor (96, 177) px inside each cell. Absolutely no text, letters, numbers, logos, UI, frame borders, grid lines or watermark. Original design — no resemblance to any existing game, film or franchise character.
```

**`hero-hurt.png`**

```text
Original 2D side-scrolling game art for the steampunk lane-battle game COGFRONT. Hand-drawn cartoon silhouette style: bold dark-brown ink outline (#1a120d, 3–4 px at final size), flat painterly fills with soft two-tone cel shading, warm brass (#c99a3e), copper (#b8673a), tin grey (#b7b9b0), soot black, cloth red (#9b2f2a) and steel blue (#2f5d7a) accents; light from the upper left; silhouette must read clearly at 60 px tall. Strict orthographic side view facing RIGHT, full body, centred in every cell, identical design, palette and scale in every frame, feet exactly on the anchor line, transparent background (PNG with alpha), no cast shadow, no ground, no motion-blur outside the cell. Character: a stocky human steam-officer in a brass boiler-chest cuirass with copper rivet bands, round steel helmet with a short red crest and one glowing amber goggle, short tattered red cape, small copper boiler backpack with a stubby chimney venting white steam, dark steel greaves; wields a large single-edged steam cleaver-sword with brass hilt and a tiny pressure gauge on the guard. Body occupies about 72% of the cell height. Horizontal sprite strip: 3 equal cells of 192×192 px (whole image 576×192 px), frames read left to right as a one-shot animation: recoils backward from a hit, grimace, small sparks off the armour. Feet (or hover base) on the anchor line, anchor (96, 177) px inside each cell. Absolutely no text, letters, numbers, logos, UI, frame borders, grid lines or watermark. Original design — no resemblance to any existing game, film or franchise character.
```

**`hero-down.png`**

```text
Original 2D side-scrolling game art for the steampunk lane-battle game COGFRONT. Hand-drawn cartoon silhouette style: bold dark-brown ink outline (#1a120d, 3–4 px at final size), flat painterly fills with soft two-tone cel shading, warm brass (#c99a3e), copper (#b8673a), tin grey (#b7b9b0), soot black, cloth red (#9b2f2a) and steel blue (#2f5d7a) accents; light from the upper left; silhouette must read clearly at 60 px tall. Strict orthographic side view facing RIGHT, full body, centred in every cell, identical design, palette and scale in every frame, feet exactly on the anchor line, transparent background (PNG with alpha), no cast shadow, no ground, no motion-blur outside the cell. Character: a stocky human steam-officer in a brass boiler-chest cuirass with copper rivet bands, round steel helmet with a short red crest and one glowing amber goggle, short tattered red cape, small copper boiler backpack with a stubby chimney venting white steam, dark steel greaves; wields a large single-edged steam cleaver-sword with brass hilt and a tiny pressure gauge on the guard. Body occupies about 72% of the cell height. Horizontal sprite strip: 6 equal cells of 192×192 px (whole image 1152×192 px), frames read left to right as a one-shot animation: collapses to one knee, then falls on his side, steam hissing out of the backpack. Feet (or hover base) on the anchor line, anchor (96, 177) px inside each cell. Absolutely no text, letters, numbers, logos, UI, frame borders, grid lines or watermark. Original design — no resemblance to any existing game, film or franchise character.
```

### 發條劍兵 Clockwork Swordsman

造型：a small wind-up clockwork soldier: rounded tin body, steel-blue sash, round helmet with a dark visor slit, large brass wind-up key on the back, short saber. Cute but sturdy toy-soldier proportions.

| 檔名 | 格數 × 單格 | 總尺寸 | FPS | 循環 | 錨點（格內 px） |
| --- | --- | --- | --- | --- | --- |
| `troop-sword-walk.png` | 8 × 128×128 | 1024×128 | 12 | 是 | (64, 118) |
| `troop-sword-attack.png` | 6 × 128×128 | 768×128 | 14 | 否 | (64, 118) |
| `troop-sword-down.png` | 5 × 128×128 | 640×128 | 10 | 否 | (64, 118) |

**`troop-sword-walk.png`**

```text
Original 2D side-scrolling game art for the steampunk lane-battle game COGFRONT. Hand-drawn cartoon silhouette style: bold dark-brown ink outline (#1a120d, 3–4 px at final size), flat painterly fills with soft two-tone cel shading, warm brass (#c99a3e), copper (#b8673a), tin grey (#b7b9b0), soot black, cloth red (#9b2f2a) and steel blue (#2f5d7a) accents; light from the upper left; silhouette must read clearly at 60 px tall. Strict orthographic side view facing RIGHT, full body, centred in every cell, identical design, palette and scale in every frame, feet exactly on the anchor line, transparent background (PNG with alpha), no cast shadow, no ground, no motion-blur outside the cell. Character: a small wind-up clockwork soldier: rounded tin body, steel-blue sash, round helmet with a dark visor slit, large brass wind-up key on the back, short saber. Cute but sturdy toy-soldier proportions. Horizontal sprite strip: 8 equal cells of 128×128 px (whole image 1024×128 px), frames read left to right as a seamless looping animation: marching walk cycle, wind-up key turning. Feet (or hover base) on the anchor line, anchor (64, 118) px inside each cell. Absolutely no text, letters, numbers, logos, UI, frame borders, grid lines or watermark. Original design — no resemblance to any existing game, film or franchise character.
```

**`troop-sword-attack.png`**

```text
Original 2D side-scrolling game art for the steampunk lane-battle game COGFRONT. Hand-drawn cartoon silhouette style: bold dark-brown ink outline (#1a120d, 3–4 px at final size), flat painterly fills with soft two-tone cel shading, warm brass (#c99a3e), copper (#b8673a), tin grey (#b7b9b0), soot black, cloth red (#9b2f2a) and steel blue (#2f5d7a) accents; light from the upper left; silhouette must read clearly at 60 px tall. Strict orthographic side view facing RIGHT, full body, centred in every cell, identical design, palette and scale in every frame, feet exactly on the anchor line, transparent background (PNG with alpha), no cast shadow, no ground, no motion-blur outside the cell. Character: a small wind-up clockwork soldier: rounded tin body, steel-blue sash, round helmet with a dark visor slit, large brass wind-up key on the back, short saber. Cute but sturdy toy-soldier proportions. Horizontal sprite strip: 6 equal cells of 128×128 px (whole image 768×128 px), frames read left to right as a one-shot animation: quick saber chop forward. Feet (or hover base) on the anchor line, anchor (64, 118) px inside each cell. Absolutely no text, letters, numbers, logos, UI, frame borders, grid lines or watermark. Original design — no resemblance to any existing game, film or franchise character.
```

**`troop-sword-down.png`**

```text
Original 2D side-scrolling game art for the steampunk lane-battle game COGFRONT. Hand-drawn cartoon silhouette style: bold dark-brown ink outline (#1a120d, 3–4 px at final size), flat painterly fills with soft two-tone cel shading, warm brass (#c99a3e), copper (#b8673a), tin grey (#b7b9b0), soot black, cloth red (#9b2f2a) and steel blue (#2f5d7a) accents; light from the upper left; silhouette must read clearly at 60 px tall. Strict orthographic side view facing RIGHT, full body, centred in every cell, identical design, palette and scale in every frame, feet exactly on the anchor line, transparent background (PNG with alpha), no cast shadow, no ground, no motion-blur outside the cell. Character: a small wind-up clockwork soldier: rounded tin body, steel-blue sash, round helmet with a dark visor slit, large brass wind-up key on the back, short saber. Cute but sturdy toy-soldier proportions. Horizontal sprite strip: 5 equal cells of 128×128 px (whole image 640×128 px), frames read left to right as a one-shot animation: jerks, then falls apart into gears, springs and bolts. Feet (or hover base) on the anchor line, anchor (64, 118) px inside each cell. Absolutely no text, letters, numbers, logos, UI, frame borders, grid lines or watermark. Original design — no resemblance to any existing game, film or franchise character.
```

### 鉚釘槍兵 Rivet Lancer

造型：same clockwork-soldier family as the swordsman, slightly taller, holding a long riveted pike with a steel leaf head pointed forward.

| 檔名 | 格數 × 單格 | 總尺寸 | FPS | 循環 | 錨點（格內 px） |
| --- | --- | --- | --- | --- | --- |
| `troop-lancer-walk.png` | 8 × 128×128 | 1024×128 | 12 | 是 | (64, 118) |
| `troop-lancer-attack.png` | 6 × 128×128 | 768×128 | 14 | 否 | (64, 118) |
| `troop-lancer-down.png` | 5 × 128×128 | 640×128 | 10 | 否 | (64, 118) |

**`troop-lancer-walk.png`**

```text
Original 2D side-scrolling game art for the steampunk lane-battle game COGFRONT. Hand-drawn cartoon silhouette style: bold dark-brown ink outline (#1a120d, 3–4 px at final size), flat painterly fills with soft two-tone cel shading, warm brass (#c99a3e), copper (#b8673a), tin grey (#b7b9b0), soot black, cloth red (#9b2f2a) and steel blue (#2f5d7a) accents; light from the upper left; silhouette must read clearly at 60 px tall. Strict orthographic side view facing RIGHT, full body, centred in every cell, identical design, palette and scale in every frame, feet exactly on the anchor line, transparent background (PNG with alpha), no cast shadow, no ground, no motion-blur outside the cell. Character: same clockwork-soldier family as the swordsman, slightly taller, holding a long riveted pike with a steel leaf head pointed forward. Horizontal sprite strip: 8 equal cells of 128×128 px (whole image 1024×128 px), frames read left to right as a seamless looping animation: marching with the pike levelled. Feet (or hover base) on the anchor line, anchor (64, 118) px inside each cell. Absolutely no text, letters, numbers, logos, UI, frame borders, grid lines or watermark. Original design — no resemblance to any existing game, film or franchise character.
```

**`troop-lancer-attack.png`**

```text
Original 2D side-scrolling game art for the steampunk lane-battle game COGFRONT. Hand-drawn cartoon silhouette style: bold dark-brown ink outline (#1a120d, 3–4 px at final size), flat painterly fills with soft two-tone cel shading, warm brass (#c99a3e), copper (#b8673a), tin grey (#b7b9b0), soot black, cloth red (#9b2f2a) and steel blue (#2f5d7a) accents; light from the upper left; silhouette must read clearly at 60 px tall. Strict orthographic side view facing RIGHT, full body, centred in every cell, identical design, palette and scale in every frame, feet exactly on the anchor line, transparent background (PNG with alpha), no cast shadow, no ground, no motion-blur outside the cell. Character: same clockwork-soldier family as the swordsman, slightly taller, holding a long riveted pike with a steel leaf head pointed forward. Horizontal sprite strip: 6 equal cells of 128×128 px (whole image 768×128 px), frames read left to right as a one-shot animation: powerful forward pike thrust and recover. Feet (or hover base) on the anchor line, anchor (64, 118) px inside each cell. Absolutely no text, letters, numbers, logos, UI, frame borders, grid lines or watermark. Original design — no resemblance to any existing game, film or franchise character.
```

**`troop-lancer-down.png`**

```text
Original 2D side-scrolling game art for the steampunk lane-battle game COGFRONT. Hand-drawn cartoon silhouette style: bold dark-brown ink outline (#1a120d, 3–4 px at final size), flat painterly fills with soft two-tone cel shading, warm brass (#c99a3e), copper (#b8673a), tin grey (#b7b9b0), soot black, cloth red (#9b2f2a) and steel blue (#2f5d7a) accents; light from the upper left; silhouette must read clearly at 60 px tall. Strict orthographic side view facing RIGHT, full body, centred in every cell, identical design, palette and scale in every frame, feet exactly on the anchor line, transparent background (PNG with alpha), no cast shadow, no ground, no motion-blur outside the cell. Character: same clockwork-soldier family as the swordsman, slightly taller, holding a long riveted pike with a steel leaf head pointed forward. Horizontal sprite strip: 5 equal cells of 128×128 px (whole image 640×128 px), frames read left to right as a one-shot animation: falls apart into gears, pike clattering down. Feet (or hover base) on the anchor line, anchor (64, 118) px inside each cell. Absolutely no text, letters, numbers, logos, UI, frame borders, grid lines or watermark. Original design — no resemblance to any existing game, film or franchise character.
```

### 蒸汽火槍手 Steam Musketeer

造型：clockwork soldier in a long coat carrying a brass steam musket with a small pressure tank under the barrel.

| 檔名 | 格數 × 單格 | 總尺寸 | FPS | 循環 | 錨點（格內 px） |
| --- | --- | --- | --- | --- | --- |
| `troop-musket-walk.png` | 8 × 128×128 | 1024×128 | 12 | 是 | (64, 118) |
| `troop-musket-attack.png` | 6 × 128×128 | 768×128 | 14 | 否 | (64, 118) |
| `troop-musket-down.png` | 5 × 128×128 | 640×128 | 10 | 否 | (64, 118) |

**`troop-musket-walk.png`**

```text
Original 2D side-scrolling game art for the steampunk lane-battle game COGFRONT. Hand-drawn cartoon silhouette style: bold dark-brown ink outline (#1a120d, 3–4 px at final size), flat painterly fills with soft two-tone cel shading, warm brass (#c99a3e), copper (#b8673a), tin grey (#b7b9b0), soot black, cloth red (#9b2f2a) and steel blue (#2f5d7a) accents; light from the upper left; silhouette must read clearly at 60 px tall. Strict orthographic side view facing RIGHT, full body, centred in every cell, identical design, palette and scale in every frame, feet exactly on the anchor line, transparent background (PNG with alpha), no cast shadow, no ground, no motion-blur outside the cell. Character: clockwork soldier in a long coat carrying a brass steam musket with a small pressure tank under the barrel. Horizontal sprite strip: 8 equal cells of 128×128 px (whole image 1024×128 px), frames read left to right as a seamless looping animation: walking with musket at the shoulder. Feet (or hover base) on the anchor line, anchor (64, 118) px inside each cell. Absolutely no text, letters, numbers, logos, UI, frame borders, grid lines or watermark. Original design — no resemblance to any existing game, film or franchise character.
```

**`troop-musket-attack.png`**

```text
Original 2D side-scrolling game art for the steampunk lane-battle game COGFRONT. Hand-drawn cartoon silhouette style: bold dark-brown ink outline (#1a120d, 3–4 px at final size), flat painterly fills with soft two-tone cel shading, warm brass (#c99a3e), copper (#b8673a), tin grey (#b7b9b0), soot black, cloth red (#9b2f2a) and steel blue (#2f5d7a) accents; light from the upper left; silhouette must read clearly at 60 px tall. Strict orthographic side view facing RIGHT, full body, centred in every cell, identical design, palette and scale in every frame, feet exactly on the anchor line, transparent background (PNG with alpha), no cast shadow, no ground, no motion-blur outside the cell. Character: clockwork soldier in a long coat carrying a brass steam musket with a small pressure tank under the barrel. Horizontal sprite strip: 6 equal cells of 128×128 px (whole image 768×128 px), frames read left to right as a one-shot animation: aim and fire: muzzle flash and steam puff on frame 2, recoil after. Feet (or hover base) on the anchor line, anchor (64, 118) px inside each cell. Absolutely no text, letters, numbers, logos, UI, frame borders, grid lines or watermark. Original design — no resemblance to any existing game, film or franchise character.
```

**`troop-musket-down.png`**

```text
Original 2D side-scrolling game art for the steampunk lane-battle game COGFRONT. Hand-drawn cartoon silhouette style: bold dark-brown ink outline (#1a120d, 3–4 px at final size), flat painterly fills with soft two-tone cel shading, warm brass (#c99a3e), copper (#b8673a), tin grey (#b7b9b0), soot black, cloth red (#9b2f2a) and steel blue (#2f5d7a) accents; light from the upper left; silhouette must read clearly at 60 px tall. Strict orthographic side view facing RIGHT, full body, centred in every cell, identical design, palette and scale in every frame, feet exactly on the anchor line, transparent background (PNG with alpha), no cast shadow, no ground, no motion-blur outside the cell. Character: clockwork soldier in a long coat carrying a brass steam musket with a small pressure tank under the barrel. Horizontal sprite strip: 5 equal cells of 128×128 px (whole image 640×128 px), frames read left to right as a one-shot animation: falls apart into gears, musket dropping. Feet (or hover base) on the anchor line, anchor (64, 118) px inside each cell. Absolutely no text, letters, numbers, logos, UI, frame borders, grid lines or watermark. Original design — no resemblance to any existing game, film or franchise character.
```

### 鍋爐盾衛 Boiler Shieldbearer

造型：larger, broader clockwork soldier wrapped in boiler plating, holding a big round boiler-lid shield with rivets in front, short mace.

| 檔名 | 格數 × 單格 | 總尺寸 | FPS | 循環 | 錨點（格內 px） |
| --- | --- | --- | --- | --- | --- |
| `troop-shield-walk.png` | 8 × 128×128 | 1024×128 | 12 | 是 | (64, 118) |
| `troop-shield-attack.png` | 6 × 128×128 | 768×128 | 14 | 否 | (64, 118) |
| `troop-shield-down.png` | 5 × 128×128 | 640×128 | 10 | 否 | (64, 118) |

**`troop-shield-walk.png`**

```text
Original 2D side-scrolling game art for the steampunk lane-battle game COGFRONT. Hand-drawn cartoon silhouette style: bold dark-brown ink outline (#1a120d, 3–4 px at final size), flat painterly fills with soft two-tone cel shading, warm brass (#c99a3e), copper (#b8673a), tin grey (#b7b9b0), soot black, cloth red (#9b2f2a) and steel blue (#2f5d7a) accents; light from the upper left; silhouette must read clearly at 60 px tall. Strict orthographic side view facing RIGHT, full body, centred in every cell, identical design, palette and scale in every frame, feet exactly on the anchor line, transparent background (PNG with alpha), no cast shadow, no ground, no motion-blur outside the cell. Character: larger, broader clockwork soldier wrapped in boiler plating, holding a big round boiler-lid shield with rivets in front, short mace. Horizontal sprite strip: 8 equal cells of 128×128 px (whole image 1024×128 px), frames read left to right as a seamless looping animation: heavy stomping walk behind the shield. Feet (or hover base) on the anchor line, anchor (64, 118) px inside each cell. Absolutely no text, letters, numbers, logos, UI, frame borders, grid lines or watermark. Original design — no resemblance to any existing game, film or franchise character.
```

**`troop-shield-attack.png`**

```text
Original 2D side-scrolling game art for the steampunk lane-battle game COGFRONT. Hand-drawn cartoon silhouette style: bold dark-brown ink outline (#1a120d, 3–4 px at final size), flat painterly fills with soft two-tone cel shading, warm brass (#c99a3e), copper (#b8673a), tin grey (#b7b9b0), soot black, cloth red (#9b2f2a) and steel blue (#2f5d7a) accents; light from the upper left; silhouette must read clearly at 60 px tall. Strict orthographic side view facing RIGHT, full body, centred in every cell, identical design, palette and scale in every frame, feet exactly on the anchor line, transparent background (PNG with alpha), no cast shadow, no ground, no motion-blur outside the cell. Character: larger, broader clockwork soldier wrapped in boiler plating, holding a big round boiler-lid shield with rivets in front, short mace. Horizontal sprite strip: 6 equal cells of 128×128 px (whole image 768×128 px), frames read left to right as a one-shot animation: shield bash forward. Feet (or hover base) on the anchor line, anchor (64, 118) px inside each cell. Absolutely no text, letters, numbers, logos, UI, frame borders, grid lines or watermark. Original design — no resemblance to any existing game, film or franchise character.
```

**`troop-shield-down.png`**

```text
Original 2D side-scrolling game art for the steampunk lane-battle game COGFRONT. Hand-drawn cartoon silhouette style: bold dark-brown ink outline (#1a120d, 3–4 px at final size), flat painterly fills with soft two-tone cel shading, warm brass (#c99a3e), copper (#b8673a), tin grey (#b7b9b0), soot black, cloth red (#9b2f2a) and steel blue (#2f5d7a) accents; light from the upper left; silhouette must read clearly at 60 px tall. Strict orthographic side view facing RIGHT, full body, centred in every cell, identical design, palette and scale in every frame, feet exactly on the anchor line, transparent background (PNG with alpha), no cast shadow, no ground, no motion-blur outside the cell. Character: larger, broader clockwork soldier wrapped in boiler plating, holding a big round boiler-lid shield with rivets in front, short mace. Horizontal sprite strip: 5 equal cells of 128×128 px (whole image 640×128 px), frames read left to right as a one-shot animation: topples backward, plates popping off, gears scattering. Feet (or hover base) on the anchor line, anchor (64, 118) px inside each cell. Absolutely no text, letters, numbers, logos, UI, frame borders, grid lines or watermark. Original design — no resemblance to any existing game, film or franchise character.
```

### 扳手技師 Wrench Mechanic

造型：clockwork engineer with goggles, toolbox backpack, oversized wrench, green status lamp on the chest.

| 檔名 | 格數 × 單格 | 總尺寸 | FPS | 循環 | 錨點（格內 px） |
| --- | --- | --- | --- | --- | --- |
| `troop-mechanic-walk.png` | 8 × 128×128 | 1024×128 | 12 | 是 | (64, 118) |
| `troop-mechanic-attack.png` | 6 × 128×128 | 768×128 | 14 | 否 | (64, 118) |
| `troop-mechanic-down.png` | 5 × 128×128 | 640×128 | 10 | 否 | (64, 118) |

**`troop-mechanic-walk.png`**

```text
Original 2D side-scrolling game art for the steampunk lane-battle game COGFRONT. Hand-drawn cartoon silhouette style: bold dark-brown ink outline (#1a120d, 3–4 px at final size), flat painterly fills with soft two-tone cel shading, warm brass (#c99a3e), copper (#b8673a), tin grey (#b7b9b0), soot black, cloth red (#9b2f2a) and steel blue (#2f5d7a) accents; light from the upper left; silhouette must read clearly at 60 px tall. Strict orthographic side view facing RIGHT, full body, centred in every cell, identical design, palette and scale in every frame, feet exactly on the anchor line, transparent background (PNG with alpha), no cast shadow, no ground, no motion-blur outside the cell. Character: clockwork engineer with goggles, toolbox backpack, oversized wrench, green status lamp on the chest. Horizontal sprite strip: 8 equal cells of 128×128 px (whole image 1024×128 px), frames read left to right as a seamless looping animation: brisk walk, toolbox bouncing. Feet (or hover base) on the anchor line, anchor (64, 118) px inside each cell. Absolutely no text, letters, numbers, logos, UI, frame borders, grid lines or watermark. Original design — no resemblance to any existing game, film or franchise character.
```

**`troop-mechanic-attack.png`**

```text
Original 2D side-scrolling game art for the steampunk lane-battle game COGFRONT. Hand-drawn cartoon silhouette style: bold dark-brown ink outline (#1a120d, 3–4 px at final size), flat painterly fills with soft two-tone cel shading, warm brass (#c99a3e), copper (#b8673a), tin grey (#b7b9b0), soot black, cloth red (#9b2f2a) and steel blue (#2f5d7a) accents; light from the upper left; silhouette must read clearly at 60 px tall. Strict orthographic side view facing RIGHT, full body, centred in every cell, identical design, palette and scale in every frame, feet exactly on the anchor line, transparent background (PNG with alpha), no cast shadow, no ground, no motion-blur outside the cell. Character: clockwork engineer with goggles, toolbox backpack, oversized wrench, green status lamp on the chest. Horizontal sprite strip: 6 equal cells of 128×128 px (whole image 768×128 px), frames read left to right as a one-shot animation: wrench swing that also emits a small green repair sparkle. Feet (or hover base) on the anchor line, anchor (64, 118) px inside each cell. Absolutely no text, letters, numbers, logos, UI, frame borders, grid lines or watermark. Original design — no resemblance to any existing game, film or franchise character.
```

**`troop-mechanic-down.png`**

```text
Original 2D side-scrolling game art for the steampunk lane-battle game COGFRONT. Hand-drawn cartoon silhouette style: bold dark-brown ink outline (#1a120d, 3–4 px at final size), flat painterly fills with soft two-tone cel shading, warm brass (#c99a3e), copper (#b8673a), tin grey (#b7b9b0), soot black, cloth red (#9b2f2a) and steel blue (#2f5d7a) accents; light from the upper left; silhouette must read clearly at 60 px tall. Strict orthographic side view facing RIGHT, full body, centred in every cell, identical design, palette and scale in every frame, feet exactly on the anchor line, transparent background (PNG with alpha), no cast shadow, no ground, no motion-blur outside the cell. Character: clockwork engineer with goggles, toolbox backpack, oversized wrench, green status lamp on the chest. Horizontal sprite strip: 5 equal cells of 128×128 px (whole image 640×128 px), frames read left to right as a one-shot animation: sits down and falls apart into gears. Feet (or hover base) on the anchor line, anchor (64, 118) px inside each cell. Absolutely no text, letters, numbers, logos, UI, frame borders, grid lines or watermark. Original design — no resemblance to any existing game, film or franchise character.
```

### 廢鐵無人機 Scrap Drone

造型：a rusty floating spherical scrap drone with one red glowing eye, a small spinning rotor on top and two hooked claws, hovering about one body-height above the anchor line.

| 檔名 | 格數 × 單格 | 總尺寸 | FPS | 循環 | 錨點（格內 px） |
| --- | --- | --- | --- | --- | --- |
| `enemy-drone-walk.png` | 8 × 128×128 | 1024×128 | 12 | 是 | (64, 118) |
| `enemy-drone-attack.png` | 6 × 128×128 | 768×128 | 14 | 否 | (64, 118) |
| `enemy-drone-down.png` | 5 × 128×128 | 640×128 | 10 | 否 | (64, 118) |

**`enemy-drone-walk.png`**

```text
Original 2D side-scrolling game art for the steampunk lane-battle game COGFRONT. Hand-drawn cartoon silhouette style: bold dark-brown ink outline (#1a120d, 3–4 px at final size), flat painterly fills with soft two-tone cel shading, warm brass (#c99a3e), copper (#b8673a), tin grey (#b7b9b0), soot black, cloth red (#9b2f2a) and steel blue (#2f5d7a) accents; light from the upper left; silhouette must read clearly at 60 px tall. Strict orthographic side view facing RIGHT, full body, centred in every cell, identical design, palette and scale in every frame, feet exactly on the anchor line, transparent background (PNG with alpha), no cast shadow, no ground, no motion-blur outside the cell. Character: a rusty floating spherical scrap drone with one red glowing eye, a small spinning rotor on top and two hooked claws, hovering about one body-height above the anchor line. Horizontal sprite strip: 8 equal cells of 128×128 px (whole image 1024×128 px), frames read left to right as a seamless looping animation: hovering flight loop with rotor spinning and slight bob. Feet (or hover base) on the anchor line, anchor (64, 118) px inside each cell. Absolutely no text, letters, numbers, logos, UI, frame borders, grid lines or watermark. Original design — no resemblance to any existing game, film or franchise character.
```

**`enemy-drone-attack.png`**

```text
Original 2D side-scrolling game art for the steampunk lane-battle game COGFRONT. Hand-drawn cartoon silhouette style: bold dark-brown ink outline (#1a120d, 3–4 px at final size), flat painterly fills with soft two-tone cel shading, warm brass (#c99a3e), copper (#b8673a), tin grey (#b7b9b0), soot black, cloth red (#9b2f2a) and steel blue (#2f5d7a) accents; light from the upper left; silhouette must read clearly at 60 px tall. Strict orthographic side view facing RIGHT, full body, centred in every cell, identical design, palette and scale in every frame, feet exactly on the anchor line, transparent background (PNG with alpha), no cast shadow, no ground, no motion-blur outside the cell. Character: a rusty floating spherical scrap drone with one red glowing eye, a small spinning rotor on top and two hooked claws, hovering about one body-height above the anchor line. Horizontal sprite strip: 6 equal cells of 128×128 px (whole image 768×128 px), frames read left to right as a one-shot animation: lunges and snaps its claws. Feet (or hover base) on the anchor line, anchor (64, 118) px inside each cell. Absolutely no text, letters, numbers, logos, UI, frame borders, grid lines or watermark. Original design — no resemblance to any existing game, film or franchise character.
```

**`enemy-drone-down.png`**

```text
Original 2D side-scrolling game art for the steampunk lane-battle game COGFRONT. Hand-drawn cartoon silhouette style: bold dark-brown ink outline (#1a120d, 3–4 px at final size), flat painterly fills with soft two-tone cel shading, warm brass (#c99a3e), copper (#b8673a), tin grey (#b7b9b0), soot black, cloth red (#9b2f2a) and steel blue (#2f5d7a) accents; light from the upper left; silhouette must read clearly at 60 px tall. Strict orthographic side view facing RIGHT, full body, centred in every cell, identical design, palette and scale in every frame, feet exactly on the anchor line, transparent background (PNG with alpha), no cast shadow, no ground, no motion-blur outside the cell. Character: a rusty floating spherical scrap drone with one red glowing eye, a small spinning rotor on top and two hooked claws, hovering about one body-height above the anchor line. Horizontal sprite strip: 5 equal cells of 128×128 px (whole image 640×128 px), frames read left to right as a one-shot animation: sparks, rotor stops, drops and breaks apart. Feet (or hover base) on the anchor line, anchor (64, 118) px inside each cell. Absolutely no text, letters, numbers, logos, UI, frame borders, grid lines or watermark. Original design — no resemblance to any existing game, film or franchise character.
```

### 鋸輪跑者 Saw Runner

造型：a lean rust-red unicycle robot balancing on one spoked wheel, small round head with a red visor, one arm ending in a large spinning circular saw blade.

| 檔名 | 格數 × 單格 | 總尺寸 | FPS | 循環 | 錨點（格內 px） |
| --- | --- | --- | --- | --- | --- |
| `enemy-saw-walk.png` | 8 × 128×128 | 1024×128 | 12 | 是 | (64, 118) |
| `enemy-saw-attack.png` | 6 × 128×128 | 768×128 | 14 | 否 | (64, 118) |
| `enemy-saw-down.png` | 5 × 128×128 | 640×128 | 10 | 否 | (64, 118) |

**`enemy-saw-walk.png`**

```text
Original 2D side-scrolling game art for the steampunk lane-battle game COGFRONT. Hand-drawn cartoon silhouette style: bold dark-brown ink outline (#1a120d, 3–4 px at final size), flat painterly fills with soft two-tone cel shading, warm brass (#c99a3e), copper (#b8673a), tin grey (#b7b9b0), soot black, cloth red (#9b2f2a) and steel blue (#2f5d7a) accents; light from the upper left; silhouette must read clearly at 60 px tall. Strict orthographic side view facing RIGHT, full body, centred in every cell, identical design, palette and scale in every frame, feet exactly on the anchor line, transparent background (PNG with alpha), no cast shadow, no ground, no motion-blur outside the cell. Character: a lean rust-red unicycle robot balancing on one spoked wheel, small round head with a red visor, one arm ending in a large spinning circular saw blade. Horizontal sprite strip: 8 equal cells of 128×128 px (whole image 1024×128 px), frames read left to right as a seamless looping animation: rolling forward, wheel spokes turning, saw spinning. Feet (or hover base) on the anchor line, anchor (64, 118) px inside each cell. Absolutely no text, letters, numbers, logos, UI, frame borders, grid lines or watermark. Original design — no resemblance to any existing game, film or franchise character.
```

**`enemy-saw-attack.png`**

```text
Original 2D side-scrolling game art for the steampunk lane-battle game COGFRONT. Hand-drawn cartoon silhouette style: bold dark-brown ink outline (#1a120d, 3–4 px at final size), flat painterly fills with soft two-tone cel shading, warm brass (#c99a3e), copper (#b8673a), tin grey (#b7b9b0), soot black, cloth red (#9b2f2a) and steel blue (#2f5d7a) accents; light from the upper left; silhouette must read clearly at 60 px tall. Strict orthographic side view facing RIGHT, full body, centred in every cell, identical design, palette and scale in every frame, feet exactly on the anchor line, transparent background (PNG with alpha), no cast shadow, no ground, no motion-blur outside the cell. Character: a lean rust-red unicycle robot balancing on one spoked wheel, small round head with a red visor, one arm ending in a large spinning circular saw blade. Horizontal sprite strip: 6 equal cells of 128×128 px (whole image 768×128 px), frames read left to right as a one-shot animation: thrusts the spinning saw forward with sparks. Feet (or hover base) on the anchor line, anchor (64, 118) px inside each cell. Absolutely no text, letters, numbers, logos, UI, frame borders, grid lines or watermark. Original design — no resemblance to any existing game, film or franchise character.
```

**`enemy-saw-down.png`**

```text
Original 2D side-scrolling game art for the steampunk lane-battle game COGFRONT. Hand-drawn cartoon silhouette style: bold dark-brown ink outline (#1a120d, 3–4 px at final size), flat painterly fills with soft two-tone cel shading, warm brass (#c99a3e), copper (#b8673a), tin grey (#b7b9b0), soot black, cloth red (#9b2f2a) and steel blue (#2f5d7a) accents; light from the upper left; silhouette must read clearly at 60 px tall. Strict orthographic side view facing RIGHT, full body, centred in every cell, identical design, palette and scale in every frame, feet exactly on the anchor line, transparent background (PNG with alpha), no cast shadow, no ground, no motion-blur outside the cell. Character: a lean rust-red unicycle robot balancing on one spoked wheel, small round head with a red visor, one arm ending in a large spinning circular saw blade. Horizontal sprite strip: 5 equal cells of 128×128 px (whole image 640×128 px), frames read left to right as a one-shot animation: wobbles, falls over, wheel spinning freely, parts scatter. Feet (or hover base) on the anchor line, anchor (64, 118) px inside each cell. Absolutely no text, letters, numbers, logos, UI, frame borders, grid lines or watermark. Original design — no resemblance to any existing game, film or franchise character.
```

### 鉚錘巨漢 Rivet Brute

造型：a hunched heavy iron golem covered in rust and rivets, small head with red eye slit, thick legs, one huge riveted hammer arm.

| 檔名 | 格數 × 單格 | 總尺寸 | FPS | 循環 | 錨點（格內 px） |
| --- | --- | --- | --- | --- | --- |
| `enemy-brute-walk.png` | 8 × 160×160 | 1280×160 | 12 | 是 | (80, 147) |
| `enemy-brute-attack.png` | 6 × 160×160 | 960×160 | 14 | 否 | (80, 147) |
| `enemy-brute-down.png` | 5 × 160×160 | 800×160 | 10 | 否 | (80, 147) |

**`enemy-brute-walk.png`**

```text
Original 2D side-scrolling game art for the steampunk lane-battle game COGFRONT. Hand-drawn cartoon silhouette style: bold dark-brown ink outline (#1a120d, 3–4 px at final size), flat painterly fills with soft two-tone cel shading, warm brass (#c99a3e), copper (#b8673a), tin grey (#b7b9b0), soot black, cloth red (#9b2f2a) and steel blue (#2f5d7a) accents; light from the upper left; silhouette must read clearly at 60 px tall. Strict orthographic side view facing RIGHT, full body, centred in every cell, identical design, palette and scale in every frame, feet exactly on the anchor line, transparent background (PNG with alpha), no cast shadow, no ground, no motion-blur outside the cell. Character: a hunched heavy iron golem covered in rust and rivets, small head with red eye slit, thick legs, one huge riveted hammer arm. Horizontal sprite strip: 8 equal cells of 160×160 px (whole image 1280×160 px), frames read left to right as a seamless looping animation: slow heavy stomping walk. Feet (or hover base) on the anchor line, anchor (80, 147) px inside each cell. Absolutely no text, letters, numbers, logos, UI, frame borders, grid lines or watermark. Original design — no resemblance to any existing game, film or franchise character.
```

**`enemy-brute-attack.png`**

```text
Original 2D side-scrolling game art for the steampunk lane-battle game COGFRONT. Hand-drawn cartoon silhouette style: bold dark-brown ink outline (#1a120d, 3–4 px at final size), flat painterly fills with soft two-tone cel shading, warm brass (#c99a3e), copper (#b8673a), tin grey (#b7b9b0), soot black, cloth red (#9b2f2a) and steel blue (#2f5d7a) accents; light from the upper left; silhouette must read clearly at 60 px tall. Strict orthographic side view facing RIGHT, full body, centred in every cell, identical design, palette and scale in every frame, feet exactly on the anchor line, transparent background (PNG with alpha), no cast shadow, no ground, no motion-blur outside the cell. Character: a hunched heavy iron golem covered in rust and rivets, small head with red eye slit, thick legs, one huge riveted hammer arm. Horizontal sprite strip: 6 equal cells of 160×160 px (whole image 960×160 px), frames read left to right as a one-shot animation: raises the hammer high and slams it down in front. Feet (or hover base) on the anchor line, anchor (80, 147) px inside each cell. Absolutely no text, letters, numbers, logos, UI, frame borders, grid lines or watermark. Original design — no resemblance to any existing game, film or franchise character.
```

**`enemy-brute-down.png`**

```text
Original 2D side-scrolling game art for the steampunk lane-battle game COGFRONT. Hand-drawn cartoon silhouette style: bold dark-brown ink outline (#1a120d, 3–4 px at final size), flat painterly fills with soft two-tone cel shading, warm brass (#c99a3e), copper (#b8673a), tin grey (#b7b9b0), soot black, cloth red (#9b2f2a) and steel blue (#2f5d7a) accents; light from the upper left; silhouette must read clearly at 60 px tall. Strict orthographic side view facing RIGHT, full body, centred in every cell, identical design, palette and scale in every frame, feet exactly on the anchor line, transparent background (PNG with alpha), no cast shadow, no ground, no motion-blur outside the cell. Character: a hunched heavy iron golem covered in rust and rivets, small head with red eye slit, thick legs, one huge riveted hammer arm. Horizontal sprite strip: 5 equal cells of 160×160 px (whole image 800×160 px), frames read left to right as a one-shot animation: kneels, then crumbles into plates and bolts. Feet (or hover base) on the anchor line, anchor (80, 147) px inside each cell. Absolutely no text, letters, numbers, logos, UI, frame borders, grid lines or watermark. Original design — no resemblance to any existing game, film or franchise character.
```

### 步行砲台 Tripod Gun-Walker

造型：a three-legged spindly walker carrying a rusty round turret with a mortar barrel angled up-forward and a red sensor eye.

| 檔名 | 格數 × 單格 | 總尺寸 | FPS | 循環 | 錨點（格內 px） |
| --- | --- | --- | --- | --- | --- |
| `enemy-walker-walk.png` | 8 × 160×160 | 1280×160 | 12 | 是 | (80, 147) |
| `enemy-walker-attack.png` | 6 × 160×160 | 960×160 | 14 | 否 | (80, 147) |
| `enemy-walker-down.png` | 5 × 160×160 | 800×160 | 10 | 否 | (80, 147) |

**`enemy-walker-walk.png`**

```text
Original 2D side-scrolling game art for the steampunk lane-battle game COGFRONT. Hand-drawn cartoon silhouette style: bold dark-brown ink outline (#1a120d, 3–4 px at final size), flat painterly fills with soft two-tone cel shading, warm brass (#c99a3e), copper (#b8673a), tin grey (#b7b9b0), soot black, cloth red (#9b2f2a) and steel blue (#2f5d7a) accents; light from the upper left; silhouette must read clearly at 60 px tall. Strict orthographic side view facing RIGHT, full body, centred in every cell, identical design, palette and scale in every frame, feet exactly on the anchor line, transparent background (PNG with alpha), no cast shadow, no ground, no motion-blur outside the cell. Character: a three-legged spindly walker carrying a rusty round turret with a mortar barrel angled up-forward and a red sensor eye. Horizontal sprite strip: 8 equal cells of 160×160 px (whole image 1280×160 px), frames read left to right as a seamless looping animation: tripod stepping gait. Feet (or hover base) on the anchor line, anchor (80, 147) px inside each cell. Absolutely no text, letters, numbers, logos, UI, frame borders, grid lines or watermark. Original design — no resemblance to any existing game, film or franchise character.
```

**`enemy-walker-attack.png`**

```text
Original 2D side-scrolling game art for the steampunk lane-battle game COGFRONT. Hand-drawn cartoon silhouette style: bold dark-brown ink outline (#1a120d, 3–4 px at final size), flat painterly fills with soft two-tone cel shading, warm brass (#c99a3e), copper (#b8673a), tin grey (#b7b9b0), soot black, cloth red (#9b2f2a) and steel blue (#2f5d7a) accents; light from the upper left; silhouette must read clearly at 60 px tall. Strict orthographic side view facing RIGHT, full body, centred in every cell, identical design, palette and scale in every frame, feet exactly on the anchor line, transparent background (PNG with alpha), no cast shadow, no ground, no motion-blur outside the cell. Character: a three-legged spindly walker carrying a rusty round turret with a mortar barrel angled up-forward and a red sensor eye. Horizontal sprite strip: 6 equal cells of 160×160 px (whole image 960×160 px), frames read left to right as a one-shot animation: barrel recoils firing a shell with muzzle flash and smoke. Feet (or hover base) on the anchor line, anchor (80, 147) px inside each cell. Absolutely no text, letters, numbers, logos, UI, frame borders, grid lines or watermark. Original design — no resemblance to any existing game, film or franchise character.
```

**`enemy-walker-down.png`**

```text
Original 2D side-scrolling game art for the steampunk lane-battle game COGFRONT. Hand-drawn cartoon silhouette style: bold dark-brown ink outline (#1a120d, 3–4 px at final size), flat painterly fills with soft two-tone cel shading, warm brass (#c99a3e), copper (#b8673a), tin grey (#b7b9b0), soot black, cloth red (#9b2f2a) and steel blue (#2f5d7a) accents; light from the upper left; silhouette must read clearly at 60 px tall. Strict orthographic side view facing RIGHT, full body, centred in every cell, identical design, palette and scale in every frame, feet exactly on the anchor line, transparent background (PNG with alpha), no cast shadow, no ground, no motion-blur outside the cell. Character: a three-legged spindly walker carrying a rusty round turret with a mortar barrel angled up-forward and a red sensor eye. Horizontal sprite strip: 5 equal cells of 160×160 px (whole image 800×160 px), frames read left to right as a one-shot animation: legs buckle, turret falls and smokes. Feet (or hover base) on the anchor line, anchor (80, 147) px inside each cell. Absolutely no text, letters, numbers, logos, UI, frame borders, grid lines or watermark. Original design — no resemblance to any existing game, film or franchise character.
```

### 地雷甲蟲 Mine Beetle

造型：a low domed mechanical beetle with segmented rusty shell, six thin legs, lit fuse and blinking red lamp on top.

| 檔名 | 格數 × 單格 | 總尺寸 | FPS | 循環 | 錨點（格內 px） |
| --- | --- | --- | --- | --- | --- |
| `enemy-beetle-walk.png` | 8 × 112×112 | 896×112 | 12 | 是 | (56, 103) |
| `enemy-beetle-attack.png` | 6 × 112×112 | 672×112 | 14 | 否 | (56, 103) |
| `enemy-beetle-down.png` | 5 × 112×112 | 560×112 | 10 | 否 | (56, 103) |

**`enemy-beetle-walk.png`**

```text
Original 2D side-scrolling game art for the steampunk lane-battle game COGFRONT. Hand-drawn cartoon silhouette style: bold dark-brown ink outline (#1a120d, 3–4 px at final size), flat painterly fills with soft two-tone cel shading, warm brass (#c99a3e), copper (#b8673a), tin grey (#b7b9b0), soot black, cloth red (#9b2f2a) and steel blue (#2f5d7a) accents; light from the upper left; silhouette must read clearly at 60 px tall. Strict orthographic side view facing RIGHT, full body, centred in every cell, identical design, palette and scale in every frame, feet exactly on the anchor line, transparent background (PNG with alpha), no cast shadow, no ground, no motion-blur outside the cell. Character: a low domed mechanical beetle with segmented rusty shell, six thin legs, lit fuse and blinking red lamp on top. Horizontal sprite strip: 8 equal cells of 112×112 px (whole image 896×112 px), frames read left to right as a seamless looping animation: fast scuttle cycle, lamp blinking. Feet (or hover base) on the anchor line, anchor (56, 103) px inside each cell. Absolutely no text, letters, numbers, logos, UI, frame borders, grid lines or watermark. Original design — no resemblance to any existing game, film or franchise character.
```

**`enemy-beetle-attack.png`**

```text
Original 2D side-scrolling game art for the steampunk lane-battle game COGFRONT. Hand-drawn cartoon silhouette style: bold dark-brown ink outline (#1a120d, 3–4 px at final size), flat painterly fills with soft two-tone cel shading, warm brass (#c99a3e), copper (#b8673a), tin grey (#b7b9b0), soot black, cloth red (#9b2f2a) and steel blue (#2f5d7a) accents; light from the upper left; silhouette must read clearly at 60 px tall. Strict orthographic side view facing RIGHT, full body, centred in every cell, identical design, palette and scale in every frame, feet exactly on the anchor line, transparent background (PNG with alpha), no cast shadow, no ground, no motion-blur outside the cell. Character: a low domed mechanical beetle with segmented rusty shell, six thin legs, lit fuse and blinking red lamp on top. Horizontal sprite strip: 6 equal cells of 112×112 px (whole image 672×112 px), frames read left to right as a one-shot animation: rears up, lamp flashes white (pre-explosion). Feet (or hover base) on the anchor line, anchor (56, 103) px inside each cell. Absolutely no text, letters, numbers, logos, UI, frame borders, grid lines or watermark. Original design — no resemblance to any existing game, film or franchise character.
```

**`enemy-beetle-down.png`**

```text
Original 2D side-scrolling game art for the steampunk lane-battle game COGFRONT. Hand-drawn cartoon silhouette style: bold dark-brown ink outline (#1a120d, 3–4 px at final size), flat painterly fills with soft two-tone cel shading, warm brass (#c99a3e), copper (#b8673a), tin grey (#b7b9b0), soot black, cloth red (#9b2f2a) and steel blue (#2f5d7a) accents; light from the upper left; silhouette must read clearly at 60 px tall. Strict orthographic side view facing RIGHT, full body, centred in every cell, identical design, palette and scale in every frame, feet exactly on the anchor line, transparent background (PNG with alpha), no cast shadow, no ground, no motion-blur outside the cell. Character: a low domed mechanical beetle with segmented rusty shell, six thin legs, lit fuse and blinking red lamp on top. Horizontal sprite strip: 5 equal cells of 112×112 px (whole image 560×112 px), frames read left to right as a one-shot animation: flips over, legs twitch, shell cracks. Feet (or hover base) on the anchor line, anchor (56, 103) px inside each cell. Absolutely no text, letters, numbers, logos, UI, frame borders, grid lines or watermark. Original design — no resemblance to any existing game, film or franchise character.
```

### 鍋爐巨像 Boiler Colossus（第 4 關頭目）

造型：a towering boiler golem: barrel-shaped riveted rust body, glowing furnace mouth in the chest, twin smokestacks on the shoulders venting black smoke, pillar legs, one piston arm ending in a giant hammer fist, small helmeted head with a red visor. Fills about 85% of the cell height.

| 檔名 | 格數 × 單格 | 總尺寸 | FPS | 循環 | 錨點（格內 px） |
| --- | --- | --- | --- | --- | --- |
| `boss-colossus-idle.png` | 6 × 512×512 | 3072×512 | 8 | 是 | (256, 488) |
| `boss-colossus-slam.png` | 8 × 512×512 | 4096×512 | 10 | 否 | (256, 488) |
| `boss-colossus-vent.png` | 6 × 512×512 | 3072×512 | 10 | 是 | (256, 488) |
| `boss-colossus-down.png` | 8 × 512×512 | 4096×512 | 8 | 否 | (256, 488) |

**`boss-colossus-idle.png`**

```text
Original 2D side-scrolling game art for the steampunk lane-battle game COGFRONT. Hand-drawn cartoon silhouette style: bold dark-brown ink outline (#1a120d, 3–4 px at final size), flat painterly fills with soft two-tone cel shading, warm brass (#c99a3e), copper (#b8673a), tin grey (#b7b9b0), soot black, cloth red (#9b2f2a) and steel blue (#2f5d7a) accents; light from the upper left; silhouette must read clearly at 60 px tall. Strict orthographic side view facing RIGHT, full body, centred in every cell, identical design, palette and scale in every frame, feet exactly on the anchor line, transparent background (PNG with alpha), no cast shadow, no ground, no motion-blur outside the cell. Character: a towering boiler golem: barrel-shaped riveted rust body, glowing furnace mouth in the chest, twin smokestacks on the shoulders venting black smoke, pillar legs, one piston arm ending in a giant hammer fist, small helmeted head with a red visor. Fills about 85% of the cell height. Horizontal sprite strip: 6 equal cells of 512×512 px (whole image 3072×512 px), frames read left to right as a seamless looping animation: menacing idle, furnace glow pulsing, smoke from stacks. Feet (or hover base) on the anchor line, anchor (256, 488) px inside each cell. Absolutely no text, letters, numbers, logos, UI, frame borders, grid lines or watermark. Original design — no resemblance to any existing game, film or franchise character.
```

**`boss-colossus-slam.png`**

```text
Original 2D side-scrolling game art for the steampunk lane-battle game COGFRONT. Hand-drawn cartoon silhouette style: bold dark-brown ink outline (#1a120d, 3–4 px at final size), flat painterly fills with soft two-tone cel shading, warm brass (#c99a3e), copper (#b8673a), tin grey (#b7b9b0), soot black, cloth red (#9b2f2a) and steel blue (#2f5d7a) accents; light from the upper left; silhouette must read clearly at 60 px tall. Strict orthographic side view facing RIGHT, full body, centred in every cell, identical design, palette and scale in every frame, feet exactly on the anchor line, transparent background (PNG with alpha), no cast shadow, no ground, no motion-blur outside the cell. Character: a towering boiler golem: barrel-shaped riveted rust body, glowing furnace mouth in the chest, twin smokestacks on the shoulders venting black smoke, pillar legs, one piston arm ending in a giant hammer fist, small helmeted head with a red visor. Fills about 85% of the cell height. Horizontal sprite strip: 8 equal cells of 512×512 px (whole image 4096×512 px), frames read left to right as a one-shot animation: raises the hammer fist high over 5 frames then slams it into the ground in front with dust and shock lines. Feet (or hover base) on the anchor line, anchor (256, 488) px inside each cell. Absolutely no text, letters, numbers, logos, UI, frame borders, grid lines or watermark. Original design — no resemblance to any existing game, film or franchise character.
```

**`boss-colossus-vent.png`**

```text
Original 2D side-scrolling game art for the steampunk lane-battle game COGFRONT. Hand-drawn cartoon silhouette style: bold dark-brown ink outline (#1a120d, 3–4 px at final size), flat painterly fills with soft two-tone cel shading, warm brass (#c99a3e), copper (#b8673a), tin grey (#b7b9b0), soot black, cloth red (#9b2f2a) and steel blue (#2f5d7a) accents; light from the upper left; silhouette must read clearly at 60 px tall. Strict orthographic side view facing RIGHT, full body, centred in every cell, identical design, palette and scale in every frame, feet exactly on the anchor line, transparent background (PNG with alpha), no cast shadow, no ground, no motion-blur outside the cell. Character: a towering boiler golem: barrel-shaped riveted rust body, glowing furnace mouth in the chest, twin smokestacks on the shoulders venting black smoke, pillar legs, one piston arm ending in a giant hammer fist, small helmeted head with a red visor. Fills about 85% of the cell height. Horizontal sprite strip: 6 equal cells of 512×512 px (whole image 3072×512 px), frames read left to right as a seamless looping animation: leans forward, furnace mouth opens and blasts a long jet of scalding steam forward. Feet (or hover base) on the anchor line, anchor (256, 488) px inside each cell. Absolutely no text, letters, numbers, logos, UI, frame borders, grid lines or watermark. Original design — no resemblance to any existing game, film or franchise character.
```

**`boss-colossus-down.png`**

```text
Original 2D side-scrolling game art for the steampunk lane-battle game COGFRONT. Hand-drawn cartoon silhouette style: bold dark-brown ink outline (#1a120d, 3–4 px at final size), flat painterly fills with soft two-tone cel shading, warm brass (#c99a3e), copper (#b8673a), tin grey (#b7b9b0), soot black, cloth red (#9b2f2a) and steel blue (#2f5d7a) accents; light from the upper left; silhouette must read clearly at 60 px tall. Strict orthographic side view facing RIGHT, full body, centred in every cell, identical design, palette and scale in every frame, feet exactly on the anchor line, transparent background (PNG with alpha), no cast shadow, no ground, no motion-blur outside the cell. Character: a towering boiler golem: barrel-shaped riveted rust body, glowing furnace mouth in the chest, twin smokestacks on the shoulders venting black smoke, pillar legs, one piston arm ending in a giant hammer fist, small helmeted head with a red visor. Fills about 85% of the cell height. Horizontal sprite strip: 8 equal cells of 512×512 px (whole image 4096×512 px), frames read left to right as a one-shot animation: furnace sputters out, body cracks, collapses forward in a heap of plates and smoke. Feet (or hover base) on the anchor line, anchor (256, 488) px inside each cell. Absolutely no text, letters, numbers, logos, UI, frame borders, grid lines or watermark. Original design — no resemblance to any existing game, film or franchise character.
```

### 飛艇要塞「灰燼號」 Airship Fortress Ashen（第 8 關頭目）

造型：an armoured rust-red dirigible with a riveted envelope and fabric stripes, rear propeller, hanging cables down to a heavy iron gondola that floats just above the ground line, the gondola has lit portholes and two forward cannons. The gondola bottom sits on the anchor line.

| 檔名 | 格數 × 單格 | 總尺寸 | FPS | 循環 | 錨點（格內 px） |
| --- | --- | --- | --- | --- | --- |
| `boss-airship-idle.png` | 6 × 768×384 | 4608×384 | 8 | 是 | (384, 372) |
| `boss-airship-bombs.png` | 6 × 768×384 | 4608×384 | 10 | 否 | (384, 372) |
| `boss-airship-down.png` | 8 × 768×384 | 6144×384 | 8 | 否 | (384, 372) |

**`boss-airship-idle.png`**

```text
Original 2D side-scrolling game art for the steampunk lane-battle game COGFRONT. Hand-drawn cartoon silhouette style: bold dark-brown ink outline (#1a120d, 3–4 px at final size), flat painterly fills with soft two-tone cel shading, warm brass (#c99a3e), copper (#b8673a), tin grey (#b7b9b0), soot black, cloth red (#9b2f2a) and steel blue (#2f5d7a) accents; light from the upper left; silhouette must read clearly at 60 px tall. Strict orthographic side view facing RIGHT, full body, centred in every cell, identical design, palette and scale in every frame, feet exactly on the anchor line, transparent background (PNG with alpha), no cast shadow, no ground, no motion-blur outside the cell. Character: an armoured rust-red dirigible with a riveted envelope and fabric stripes, rear propeller, hanging cables down to a heavy iron gondola that floats just above the ground line, the gondola has lit portholes and two forward cannons. The gondola bottom sits on the anchor line. Horizontal sprite strip: 6 equal cells of 768×384 px (whole image 4608×384 px), frames read left to right as a seamless looping animation: slow bobbing hover, propeller spinning, lamps flickering. Feet (or hover base) on the anchor line, anchor (384, 372) px inside each cell. Absolutely no text, letters, numbers, logos, UI, frame borders, grid lines or watermark. Original design — no resemblance to any existing game, film or franchise character.
```

**`boss-airship-bombs.png`**

```text
Original 2D side-scrolling game art for the steampunk lane-battle game COGFRONT. Hand-drawn cartoon silhouette style: bold dark-brown ink outline (#1a120d, 3–4 px at final size), flat painterly fills with soft two-tone cel shading, warm brass (#c99a3e), copper (#b8673a), tin grey (#b7b9b0), soot black, cloth red (#9b2f2a) and steel blue (#2f5d7a) accents; light from the upper left; silhouette must read clearly at 60 px tall. Strict orthographic side view facing RIGHT, full body, centred in every cell, identical design, palette and scale in every frame, feet exactly on the anchor line, transparent background (PNG with alpha), no cast shadow, no ground, no motion-blur outside the cell. Character: an armoured rust-red dirigible with a riveted envelope and fabric stripes, rear propeller, hanging cables down to a heavy iron gondola that floats just above the ground line, the gondola has lit portholes and two forward cannons. The gondola bottom sits on the anchor line. Horizontal sprite strip: 6 equal cells of 768×384 px (whole image 4608×384 px), frames read left to right as a one-shot animation: bomb bay doors open under the envelope and drop round bombs. Feet (or hover base) on the anchor line, anchor (384, 372) px inside each cell. Absolutely no text, letters, numbers, logos, UI, frame borders, grid lines or watermark. Original design — no resemblance to any existing game, film or franchise character.
```

**`boss-airship-down.png`**

```text
Original 2D side-scrolling game art for the steampunk lane-battle game COGFRONT. Hand-drawn cartoon silhouette style: bold dark-brown ink outline (#1a120d, 3–4 px at final size), flat painterly fills with soft two-tone cel shading, warm brass (#c99a3e), copper (#b8673a), tin grey (#b7b9b0), soot black, cloth red (#9b2f2a) and steel blue (#2f5d7a) accents; light from the upper left; silhouette must read clearly at 60 px tall. Strict orthographic side view facing RIGHT, full body, centred in every cell, identical design, palette and scale in every frame, feet exactly on the anchor line, transparent background (PNG with alpha), no cast shadow, no ground, no motion-blur outside the cell. Character: an armoured rust-red dirigible with a riveted envelope and fabric stripes, rear propeller, hanging cables down to a heavy iron gondola that floats just above the ground line, the gondola has lit portholes and two forward cannons. The gondola bottom sits on the anchor line. Horizontal sprite strip: 8 equal cells of 768×384 px (whole image 6144×384 px), frames read left to right as a one-shot animation: envelope ruptures with fire and smoke, airship tilts and sinks. Feet (or hover base) on the anchor line, anchor (384, 372) px inside each cell. Absolutely no text, letters, numbers, logos, UI, frame borders, grid lines or watermark. Original design — no resemblance to any existing game, film or franchise character.
```

## 基地與閘門

| 檔名 | 尺寸 | 錨點 | 內容 |
| --- | --- | --- | --- |
| `train.png` | 480×300 | (240, 288) | 我方基地：一列蒸汽火車頭，面向右。圓筒鍋爐、鉚釘銅帶、駕駛室在左、煙囪在右前方、排障器、三組大動輪、駕駛室窗透暖光、車頂插一面鋼藍旗。Side view, wheels on the anchor line. |
| `gate.png` | 360×420 | (180, 410) | 叛軍鑄造閘門：左右兩座鐵塔夾著巨大鉚釘鐵門，門板縫隙透出熔爐橘光，門中央是生鏽齒輪徽記與紅色獨眼，塔頂有一門迫擊砲。Side/front 3/4 view facing left toward the player is acceptable, base on the anchor line. |
| `gate-damaged.png` | 360×420 | (180, 410) | 同一座閘門的受損版本：門板裂開、齒輪徽記歪斜、多處冒煙與火花，輪廓與尺寸必須與完整版完全對齊，方便直接替換。 |

**`train.png`**

```text
Original 2D side-scrolling game art for the steampunk lane-battle game COGFRONT. Hand-drawn cartoon silhouette style: bold dark-brown ink outline (#1a120d, 3–4 px at final size), flat painterly fills with soft two-tone cel shading, warm brass (#c99a3e), copper (#b8673a), tin grey (#b7b9b0), soot black, cloth red (#9b2f2a) and steel blue (#2f5d7a) accents; light from the upper left; silhouette must read clearly at 60 px tall. Single prop on a transparent background, 480×300 px, base resting on the line at y=288 px. 我方基地：一列蒸汽火車頭，面向右。圓筒鍋爐、鉚釘銅帶、駕駛室在左、煙囪在右前方、排障器、三組大動輪、駕駛室窗透暖光、車頂插一面鋼藍旗。Side view, wheels on the anchor line. Absolutely no text, letters, numbers, logos, UI, frame borders, grid lines or watermark. Original design — no resemblance to any existing game, film or franchise character.
```

**`gate.png`**

```text
Original 2D side-scrolling game art for the steampunk lane-battle game COGFRONT. Hand-drawn cartoon silhouette style: bold dark-brown ink outline (#1a120d, 3–4 px at final size), flat painterly fills with soft two-tone cel shading, warm brass (#c99a3e), copper (#b8673a), tin grey (#b7b9b0), soot black, cloth red (#9b2f2a) and steel blue (#2f5d7a) accents; light from the upper left; silhouette must read clearly at 60 px tall. Single prop on a transparent background, 360×420 px, base resting on the line at y=410 px. 叛軍鑄造閘門：左右兩座鐵塔夾著巨大鉚釘鐵門，門板縫隙透出熔爐橘光，門中央是生鏽齒輪徽記與紅色獨眼，塔頂有一門迫擊砲。Side/front 3/4 view facing left toward the player is acceptable, base on the anchor line. Absolutely no text, letters, numbers, logos, UI, frame borders, grid lines or watermark. Original design — no resemblance to any existing game, film or franchise character.
```

**`gate-damaged.png`**

```text
Original 2D side-scrolling game art for the steampunk lane-battle game COGFRONT. Hand-drawn cartoon silhouette style: bold dark-brown ink outline (#1a120d, 3–4 px at final size), flat painterly fills with soft two-tone cel shading, warm brass (#c99a3e), copper (#b8673a), tin grey (#b7b9b0), soot black, cloth red (#9b2f2a) and steel blue (#2f5d7a) accents; light from the upper left; silhouette must read clearly at 60 px tall. Single prop on a transparent background, 360×420 px, base resting on the line at y=410 px. 同一座閘門的受損版本：門板裂開、齒輪徽記歪斜、多處冒煙與火花，輪廓與尺寸必須與完整版完全對齊，方便直接替換。 Absolutely no text, letters, numbers, logos, UI, frame borders, grid lines or watermark. Original design — no resemblance to any existing game, film or franchise character.
```

## 背景視差圖層

每個區域 5 層。`far`、`mid`、`ground`、`front` 必須**左右無縫平鋪**（最左與最右邊緣可以直接接上）；`far`、`mid`、`front` 上方與空白處透明，`sky` 是不透明整張。地平線（地面頂端）在遊戲畫面 y=438／540。

### 城郊鐵道（第 1–3 關）

氛圍：dusk over a railway suburb: purple-to-orange sunset sky, big low sun, brick row houses, water towers, chimneys and telegraph poles, warm amber window light。參考色：#2b1b3d → #b8604a → #f4bf7c sky, buildings #6e4049 / #4a2c30。

| 檔名 | 尺寸 | 視差 | 平鋪 |
| --- | --- | --- | --- |
| `bg-outskirts-sky.jpg` | 1920×1080 | 0 | 否 |
| `bg-outskirts-far.png` | 2400×600 | 0.15 | 左右無縫 |
| `bg-outskirts-mid.png` | 2400×700 | 0.45 | 左右無縫 |
| `bg-outskirts-ground.png` | 1024×256 | 1 | 左右無縫 |
| `bg-outskirts-front.png` | 2048×400 | 1.3 | 左右無縫 |

**`bg-outskirts-sky.jpg`**

```text
Original 2D side-scrolling game art for the steampunk lane-battle game COGFRONT. Hand-drawn cartoon silhouette style: bold dark-brown ink outline (#1a120d, 3–4 px at final size), flat painterly fills with soft two-tone cel shading, warm brass (#c99a3e), copper (#b8673a), tin grey (#b7b9b0), soot black, cloth red (#9b2f2a) and steel blue (#2f5d7a) accents; light from the upper left; silhouette must read clearly at 60 px tall. Parallax background layer, 1920×1080 px. Scene: dusk over a railway suburb: purple-to-orange sunset sky, big low sun, brick row houses, water towers, chimneys and telegraph poles, warm amber window light. Layer content: full sky backdrop with sun or glow, clouds and a few distant airship silhouettes, no buildings below the lower third. Painterly but simple shapes so characters stay readable in front. Absolutely no text, letters, numbers, logos, UI, frame borders, grid lines or watermark. Original design — no resemblance to any existing game, film or franchise character.
```

**`bg-outskirts-far.png`**

```text
Original 2D side-scrolling game art for the steampunk lane-battle game COGFRONT. Hand-drawn cartoon silhouette style: bold dark-brown ink outline (#1a120d, 3–4 px at final size), flat painterly fills with soft two-tone cel shading, warm brass (#c99a3e), copper (#b8673a), tin grey (#b7b9b0), soot black, cloth red (#9b2f2a) and steel blue (#2f5d7a) accents; light from the upper left; silhouette must read clearly at 60 px tall. Parallax background layer, 2400×600 px, seamlessly tileable left-to-right, transparent where empty. Scene: dusk over a railway suburb: purple-to-orange sunset sky, big low sun, brick row houses, water towers, chimneys and telegraph poles, warm amber window light. Layer content: distant skyline silhouettes (chimney forest, domes, towers) in flat haze colour, tiny lit windows, top half transparent. Painterly but simple shapes so characters stay readable in front. Absolutely no text, letters, numbers, logos, UI, frame borders, grid lines or watermark. Original design — no resemblance to any existing game, film or franchise character.
```

**`bg-outskirts-mid.png`**

```text
Original 2D side-scrolling game art for the steampunk lane-battle game COGFRONT. Hand-drawn cartoon silhouette style: bold dark-brown ink outline (#1a120d, 3–4 px at final size), flat painterly fills with soft two-tone cel shading, warm brass (#c99a3e), copper (#b8673a), tin grey (#b7b9b0), soot black, cloth red (#9b2f2a) and steel blue (#2f5d7a) accents; light from the upper left; silhouette must read clearly at 60 px tall. Parallax background layer, 2400×700 px, seamlessly tileable left-to-right, transparent where empty. Scene: dusk over a railway suburb: purple-to-orange sunset sky, big low sun, brick row houses, water towers, chimneys and telegraph poles, warm amber window light. Layer content: mid-distance buildings with more detail: windows, pipes, gears, signage shapes without letters; bottom aligned to the ground line; transparent sky. Painterly but simple shapes so characters stay readable in front. Absolutely no text, letters, numbers, logos, UI, frame borders, grid lines or watermark. Original design — no resemblance to any existing game, film or franchise character.
```

**`bg-outskirts-ground.png`**

```text
Original 2D side-scrolling game art for the steampunk lane-battle game COGFRONT. Hand-drawn cartoon silhouette style: bold dark-brown ink outline (#1a120d, 3–4 px at final size), flat painterly fills with soft two-tone cel shading, warm brass (#c99a3e), copper (#b8673a), tin grey (#b7b9b0), soot black, cloth red (#9b2f2a) and steel blue (#2f5d7a) accents; light from the upper left; silhouette must read clearly at 60 px tall. Parallax background layer, 1024×256 px, seamlessly tileable left-to-right. Scene: dusk over a railway suburb: purple-to-orange sunset sky, big low sun, brick row houses, water towers, chimneys and telegraph poles, warm amber window light. Layer content: battlefield ground texture seen from the side: railway track with sleepers along the top band, gravel and dirt below, slight perspective; fully opaque. Painterly but simple shapes so characters stay readable in front. Absolutely no text, letters, numbers, logos, UI, frame borders, grid lines or watermark. Original design — no resemblance to any existing game, film or franchise character.
```

**`bg-outskirts-front.png`**

```text
Original 2D side-scrolling game art for the steampunk lane-battle game COGFRONT. Hand-drawn cartoon silhouette style: bold dark-brown ink outline (#1a120d, 3–4 px at final size), flat painterly fills with soft two-tone cel shading, warm brass (#c99a3e), copper (#b8673a), tin grey (#b7b9b0), soot black, cloth red (#9b2f2a) and steel blue (#2f5d7a) accents; light from the upper left; silhouette must read clearly at 60 px tall. Parallax background layer, 2048×400 px, seamlessly tileable left-to-right, transparent where empty. Scene: dusk over a railway suburb: purple-to-orange sunset sky, big low sun, brick row houses, water towers, chimneys and telegraph poles, warm amber window light. Layer content: foreground silhouettes passing close to the camera: a few dark iron posts, hanging chains, pipe valves and wisps of steam, mostly transparent so the battle stays visible. Painterly but simple shapes so characters stay readable in front. Absolutely no text, letters, numbers, logos, UI, frame borders, grid lines or watermark. Original design — no resemblance to any existing game, film or franchise character.
```

### 齒輪工業區（第 4–6 關）

氛圍：overcast industrial district: soot blue-grey sky, saw-tooth factory roofs, gantry cranes, giant gears on walls, pipes and catwalks, pale smog。參考色：#18202c → #4f5d72 → #a8a497 sky, buildings #3c4654 / #2b323d。

| 檔名 | 尺寸 | 視差 | 平鋪 |
| --- | --- | --- | --- |
| `bg-works-sky.jpg` | 1920×1080 | 0 | 否 |
| `bg-works-far.png` | 2400×600 | 0.15 | 左右無縫 |
| `bg-works-mid.png` | 2400×700 | 0.45 | 左右無縫 |
| `bg-works-ground.png` | 1024×256 | 1 | 左右無縫 |
| `bg-works-front.png` | 2048×400 | 1.3 | 左右無縫 |

**`bg-works-sky.jpg`**

```text
Original 2D side-scrolling game art for the steampunk lane-battle game COGFRONT. Hand-drawn cartoon silhouette style: bold dark-brown ink outline (#1a120d, 3–4 px at final size), flat painterly fills with soft two-tone cel shading, warm brass (#c99a3e), copper (#b8673a), tin grey (#b7b9b0), soot black, cloth red (#9b2f2a) and steel blue (#2f5d7a) accents; light from the upper left; silhouette must read clearly at 60 px tall. Parallax background layer, 1920×1080 px. Scene: overcast industrial district: soot blue-grey sky, saw-tooth factory roofs, gantry cranes, giant gears on walls, pipes and catwalks, pale smog. Layer content: full sky backdrop with sun or glow, clouds and a few distant airship silhouettes, no buildings below the lower third. Painterly but simple shapes so characters stay readable in front. Absolutely no text, letters, numbers, logos, UI, frame borders, grid lines or watermark. Original design — no resemblance to any existing game, film or franchise character.
```

**`bg-works-far.png`**

```text
Original 2D side-scrolling game art for the steampunk lane-battle game COGFRONT. Hand-drawn cartoon silhouette style: bold dark-brown ink outline (#1a120d, 3–4 px at final size), flat painterly fills with soft two-tone cel shading, warm brass (#c99a3e), copper (#b8673a), tin grey (#b7b9b0), soot black, cloth red (#9b2f2a) and steel blue (#2f5d7a) accents; light from the upper left; silhouette must read clearly at 60 px tall. Parallax background layer, 2400×600 px, seamlessly tileable left-to-right, transparent where empty. Scene: overcast industrial district: soot blue-grey sky, saw-tooth factory roofs, gantry cranes, giant gears on walls, pipes and catwalks, pale smog. Layer content: distant skyline silhouettes (chimney forest, domes, towers) in flat haze colour, tiny lit windows, top half transparent. Painterly but simple shapes so characters stay readable in front. Absolutely no text, letters, numbers, logos, UI, frame borders, grid lines or watermark. Original design — no resemblance to any existing game, film or franchise character.
```

**`bg-works-mid.png`**

```text
Original 2D side-scrolling game art for the steampunk lane-battle game COGFRONT. Hand-drawn cartoon silhouette style: bold dark-brown ink outline (#1a120d, 3–4 px at final size), flat painterly fills with soft two-tone cel shading, warm brass (#c99a3e), copper (#b8673a), tin grey (#b7b9b0), soot black, cloth red (#9b2f2a) and steel blue (#2f5d7a) accents; light from the upper left; silhouette must read clearly at 60 px tall. Parallax background layer, 2400×700 px, seamlessly tileable left-to-right, transparent where empty. Scene: overcast industrial district: soot blue-grey sky, saw-tooth factory roofs, gantry cranes, giant gears on walls, pipes and catwalks, pale smog. Layer content: mid-distance buildings with more detail: windows, pipes, gears, signage shapes without letters; bottom aligned to the ground line; transparent sky. Painterly but simple shapes so characters stay readable in front. Absolutely no text, letters, numbers, logos, UI, frame borders, grid lines or watermark. Original design — no resemblance to any existing game, film or franchise character.
```

**`bg-works-ground.png`**

```text
Original 2D side-scrolling game art for the steampunk lane-battle game COGFRONT. Hand-drawn cartoon silhouette style: bold dark-brown ink outline (#1a120d, 3–4 px at final size), flat painterly fills with soft two-tone cel shading, warm brass (#c99a3e), copper (#b8673a), tin grey (#b7b9b0), soot black, cloth red (#9b2f2a) and steel blue (#2f5d7a) accents; light from the upper left; silhouette must read clearly at 60 px tall. Parallax background layer, 1024×256 px, seamlessly tileable left-to-right. Scene: overcast industrial district: soot blue-grey sky, saw-tooth factory roofs, gantry cranes, giant gears on walls, pipes and catwalks, pale smog. Layer content: battlefield ground texture seen from the side: railway track with sleepers along the top band, gravel and dirt below, slight perspective; fully opaque. Painterly but simple shapes so characters stay readable in front. Absolutely no text, letters, numbers, logos, UI, frame borders, grid lines or watermark. Original design — no resemblance to any existing game, film or franchise character.
```

**`bg-works-front.png`**

```text
Original 2D side-scrolling game art for the steampunk lane-battle game COGFRONT. Hand-drawn cartoon silhouette style: bold dark-brown ink outline (#1a120d, 3–4 px at final size), flat painterly fills with soft two-tone cel shading, warm brass (#c99a3e), copper (#b8673a), tin grey (#b7b9b0), soot black, cloth red (#9b2f2a) and steel blue (#2f5d7a) accents; light from the upper left; silhouette must read clearly at 60 px tall. Parallax background layer, 2048×400 px, seamlessly tileable left-to-right, transparent where empty. Scene: overcast industrial district: soot blue-grey sky, saw-tooth factory roofs, gantry cranes, giant gears on walls, pipes and catwalks, pale smog. Layer content: foreground silhouettes passing close to the camera: a few dark iron posts, hanging chains, pipe valves and wisps of steam, mostly transparent so the battle stays visible. Painterly but simple shapes so characters stay readable in front. Absolutely no text, letters, numbers, logos, UI, frame borders, grid lines or watermark. Original design — no resemblance to any existing game, film or franchise character.
```

### 熔爐要塞（第 7–8 關）

氛圍：fortress foundry at night: deep red sky lit by furnaces, molten glow, iron walls, chain bridges, slag heaps, embers in the air。參考色：#180909 → #6a1d15 → #e2652d sky, structures #4d1b15 / #2e1210。

| 檔名 | 尺寸 | 視差 | 平鋪 |
| --- | --- | --- | --- |
| `bg-foundry-sky.jpg` | 1920×1080 | 0 | 否 |
| `bg-foundry-far.png` | 2400×600 | 0.15 | 左右無縫 |
| `bg-foundry-mid.png` | 2400×700 | 0.45 | 左右無縫 |
| `bg-foundry-ground.png` | 1024×256 | 1 | 左右無縫 |
| `bg-foundry-front.png` | 2048×400 | 1.3 | 左右無縫 |

**`bg-foundry-sky.jpg`**

```text
Original 2D side-scrolling game art for the steampunk lane-battle game COGFRONT. Hand-drawn cartoon silhouette style: bold dark-brown ink outline (#1a120d, 3–4 px at final size), flat painterly fills with soft two-tone cel shading, warm brass (#c99a3e), copper (#b8673a), tin grey (#b7b9b0), soot black, cloth red (#9b2f2a) and steel blue (#2f5d7a) accents; light from the upper left; silhouette must read clearly at 60 px tall. Parallax background layer, 1920×1080 px. Scene: fortress foundry at night: deep red sky lit by furnaces, molten glow, iron walls, chain bridges, slag heaps, embers in the air. Layer content: full sky backdrop with sun or glow, clouds and a few distant airship silhouettes, no buildings below the lower third. Painterly but simple shapes so characters stay readable in front. Absolutely no text, letters, numbers, logos, UI, frame borders, grid lines or watermark. Original design — no resemblance to any existing game, film or franchise character.
```

**`bg-foundry-far.png`**

```text
Original 2D side-scrolling game art for the steampunk lane-battle game COGFRONT. Hand-drawn cartoon silhouette style: bold dark-brown ink outline (#1a120d, 3–4 px at final size), flat painterly fills with soft two-tone cel shading, warm brass (#c99a3e), copper (#b8673a), tin grey (#b7b9b0), soot black, cloth red (#9b2f2a) and steel blue (#2f5d7a) accents; light from the upper left; silhouette must read clearly at 60 px tall. Parallax background layer, 2400×600 px, seamlessly tileable left-to-right, transparent where empty. Scene: fortress foundry at night: deep red sky lit by furnaces, molten glow, iron walls, chain bridges, slag heaps, embers in the air. Layer content: distant skyline silhouettes (chimney forest, domes, towers) in flat haze colour, tiny lit windows, top half transparent. Painterly but simple shapes so characters stay readable in front. Absolutely no text, letters, numbers, logos, UI, frame borders, grid lines or watermark. Original design — no resemblance to any existing game, film or franchise character.
```

**`bg-foundry-mid.png`**

```text
Original 2D side-scrolling game art for the steampunk lane-battle game COGFRONT. Hand-drawn cartoon silhouette style: bold dark-brown ink outline (#1a120d, 3–4 px at final size), flat painterly fills with soft two-tone cel shading, warm brass (#c99a3e), copper (#b8673a), tin grey (#b7b9b0), soot black, cloth red (#9b2f2a) and steel blue (#2f5d7a) accents; light from the upper left; silhouette must read clearly at 60 px tall. Parallax background layer, 2400×700 px, seamlessly tileable left-to-right, transparent where empty. Scene: fortress foundry at night: deep red sky lit by furnaces, molten glow, iron walls, chain bridges, slag heaps, embers in the air. Layer content: mid-distance buildings with more detail: windows, pipes, gears, signage shapes without letters; bottom aligned to the ground line; transparent sky. Painterly but simple shapes so characters stay readable in front. Absolutely no text, letters, numbers, logos, UI, frame borders, grid lines or watermark. Original design — no resemblance to any existing game, film or franchise character.
```

**`bg-foundry-ground.png`**

```text
Original 2D side-scrolling game art for the steampunk lane-battle game COGFRONT. Hand-drawn cartoon silhouette style: bold dark-brown ink outline (#1a120d, 3–4 px at final size), flat painterly fills with soft two-tone cel shading, warm brass (#c99a3e), copper (#b8673a), tin grey (#b7b9b0), soot black, cloth red (#9b2f2a) and steel blue (#2f5d7a) accents; light from the upper left; silhouette must read clearly at 60 px tall. Parallax background layer, 1024×256 px, seamlessly tileable left-to-right. Scene: fortress foundry at night: deep red sky lit by furnaces, molten glow, iron walls, chain bridges, slag heaps, embers in the air. Layer content: battlefield ground texture seen from the side: railway track with sleepers along the top band, gravel and dirt below, slight perspective; fully opaque. Painterly but simple shapes so characters stay readable in front. Absolutely no text, letters, numbers, logos, UI, frame borders, grid lines or watermark. Original design — no resemblance to any existing game, film or franchise character.
```

**`bg-foundry-front.png`**

```text
Original 2D side-scrolling game art for the steampunk lane-battle game COGFRONT. Hand-drawn cartoon silhouette style: bold dark-brown ink outline (#1a120d, 3–4 px at final size), flat painterly fills with soft two-tone cel shading, warm brass (#c99a3e), copper (#b8673a), tin grey (#b7b9b0), soot black, cloth red (#9b2f2a) and steel blue (#2f5d7a) accents; light from the upper left; silhouette must read clearly at 60 px tall. Parallax background layer, 2048×400 px, seamlessly tileable left-to-right, transparent where empty. Scene: fortress foundry at night: deep red sky lit by furnaces, molten glow, iron walls, chain bridges, slag heaps, embers in the air. Layer content: foreground silhouettes passing close to the camera: a few dark iron posts, hanging chains, pipe valves and wisps of steam, mostly transparent so the battle stays visible. Painterly but simple shapes so characters stay readable in front. Absolutely no text, letters, numbers, logos, UI, frame borders, grid lines or watermark. Original design — no resemblance to any existing game, film or franchise character.
```

## 介面圖示

96×96 透明 PNG，圓角方形銅框內一個清楚符號，用於兵種列與技能鍵。

| 檔名 | 圖案 |
| --- | --- |
| `icon-sword.png` | a short saber crossed with a wind-up key |
| `icon-lancer.png` | a riveted pike head |
| `icon-musket.png` | a brass steam musket with a puff of steam |
| `icon-shield.png` | a round riveted boiler-lid shield |
| `icon-mechanic.png` | a big wrench with a green spark |
| `icon-burst.png` | a cone of white steam blasting from a blade |
| `icon-charge.png` | a piston with a forward motion arrow shape (no letters) |
| `icon-overdrive.png` | a pressure gauge with the needle in the red zone and orange glow |
| `icon-dodge.png` | a curved roll arrow made of steam |

```text
Original 2D side-scrolling game art for the steampunk lane-battle game COGFRONT. Hand-drawn cartoon silhouette style: bold dark-brown ink outline (#1a120d, 3–4 px at final size), flat painterly fills with soft two-tone cel shading, warm brass (#c99a3e), copper (#b8673a), tin grey (#b7b9b0), soot black, cloth red (#9b2f2a) and steel blue (#2f5d7a) accents; light from the upper left; silhouette must read clearly at 60 px tall. Square game UI icon 96×96 px on transparent background, brass rounded-square bezel with rivets, single centred symbol: {圖案}. Absolutely no text, letters, numbers, logos, UI, frame borders, grid lines or watermark. Original design — no resemblance to any existing game, film or franchise character.
```

## 封面

`assets/covers/cogfront.jpg`，1672×941，JPEG，無文字（遵守首頁封面規範）。這款依需求**不用霓虹風格**，以本作手繪剪影＋視差風格呈現。提示詞同時存於 `assets/covers/cogfront-prompt.txt`。

```text
Cinematic 16:9 original cover art for COGFRONT, a steampunk side-scrolling lane-battle game, in hand-drawn cartoon silhouette style with bold dark ink outlines and painterly cel shading. Low side view of a railway battlefield at sunset: in the centre foreground a stocky brass-armoured steam captain with red cape and a big steam cleaver-sword mid-swing, white slash arc and sparks; behind him a line of small wind-up clockwork soldiers with pikes, muskets and a boiler-lid shield following into battle; on the right rust-red rebel machines (saw unicycle robot, riveted hammer golem, floating scrap drone) charging; background factory chimneys, saw-tooth roofs and a huge armoured dirigible against a purple-to-orange sky with a big low sun; steam clouds, embers, warm brass and copper palette. Strong readable silhouettes at thumbnail size. Absolutely no letters, numbers, logos, titles, HUD, borders or watermark. Full bleed.
```
