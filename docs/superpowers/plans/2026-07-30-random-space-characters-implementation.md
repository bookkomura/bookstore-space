# 隨機空間角色實作計畫

> **執行方式：** 由主代理依序實作並整合；角色 sprite sheet 由獨立子代理製作。

**目標：** 每次成功建立空間場景時，從既有男觀光客、女觀光客、友善外星人、大黃狗、橘貓五種外觀等機率抽取其一。重整頁面或重新建立場景時重新抽取；停留期間不變。角色外觀以外的控制、碰撞和互動完全共用。

**架構：** 以 `playerAppearance.ts` 集中宣告角色池、紋理鍵、資產 URL 與可注入亂數的選擇函式。BootScene 預載所有角色資產；StoreScene 在 `create()` 只抽取一次並將選出的紋理鍵貫穿 sprite 建立和動畫鍵。動畫鍵必須含角色紋理鍵，避免 Phaser 的全域動畫快取在場景重新進入後沿用舊角色的 frame。

**技術：** Vue 3、TypeScript、Phaser 3、Vitest、sharp、imagegen

---

### Task 1：定義角色池與隨機選擇契約

**Files:**
- Create: `src/game/playerAppearance.ts`
- Create: `tests/playerAppearance.test.ts`

1. 在 `tests/playerAppearance.test.ts` 撰寫測試：`PLAYER_APPEARANCES` 恰有五個指定 ID、`selectPlayerAppearance(random)` 以 0、0.2、0.4、0.6、0.8 分別抽到每一個角色，並以接近 1 的值覆蓋最後一個角色。
2. 執行 `npm test -- tests/playerAppearance.test.ts`，確認在模組尚不存在時失敗。
3. 建立 `src/game/playerAppearance.ts`，匯出：
   - 五筆固定順序的角色資料：`visitor-male`、`visitor-female`、`friendly-alien`、`big-yellow-dog`、`orange-cat`。
   - 對應的唯一 Phaser texture key、`new URL(..., import.meta.url).href` 資產 URL，以及 `frameWidth: 256`、`frameHeight: 256`。
   - `RandomSource` 和 `selectPlayerAppearance(random = Math.random)`，用 `Math.min(length - 1, Math.floor(random() * length))` 保證邊界安全。
4. 再執行同一測試，確認通過。

### Task 2：以選中外觀載入和顯示玩家

**Files:**
- Modify: `src/game/BootScene.ts`
- Modify: `src/game/StoreScene.ts`
- Modify: `src/game/playerAnimation.ts`
- Modify: `tests/playerAnimation.test.ts`
- Modify: `tests/StoreScene.test.ts`

1. 在 `tests/playerAnimation.test.ts` 先調整／新增測試，要求動畫鍵同時含傳入的 texture key 與方向，並仍回傳原有四個 frame 陣列。
2. 在 `tests/StoreScene.test.ts` 新增可注入的外觀選擇器測試：
   - `create()` 使用選中的 texture key 建立 sprite；
   - 同一 scene 的 `update()` 不會重新抽選；
   - 再次 `create()` 模擬重新進入時會重新呼叫選擇器；
   - 每個角色仍使用既有 `PLAYER_SCALE`、64×40 碰撞 body 和同一速度／互動路徑。
3. 執行 `npm test -- tests/playerAnimation.test.ts tests/StoreScene.test.ts`，確認測試因舊 API／未抽選而失敗。
4. 將 `BootScene.preload()` 的單一 `load.spritesheet('player', ...)` 改為迭代 `PLAYER_APPEARANCES`，以每筆自己的 texture key 載入相同 frame 設定。
5. 將 `StoreScene` 接受一個預設為 `selectPlayerAppearance` 的選擇函式；每次 `create()` 開始時抽選並保存在 scene 的 private 欄位。
6. 以選中 texture key 建立 player sprite；將 `createPlayerAnimations` 改為接受 texture key，並以該 key 產生 frames。
7. 修改 `walkAnimation(textureKey, facing)`，回傳例如 `player-orange-cat-walk-left` 的角色專屬動畫鍵；更新所有播放點與測試。
8. 重跑兩個測試檔，確認通過。

### Task 3：接入四張角色 sprite sheet 並擴充資產檢查

**Files:**
- Add (由 sprite 子代理製作): `src/assets/player-visitor-female.png`
- Add (由 sprite 子代理製作): `src/assets/player-friendly-alien.png`
- Add (由 sprite 子代理製作): `src/assets/player-big-yellow-dog.png`
- Add (由 sprite 子代理製作): `src/assets/player-orange-cat.png`
- Modify: `tests/sceneAssets.test.ts`
- Modify: `scripts/validate-scene-assets.ts`

1. 在 `tests/sceneAssets.test.ts` 先把既有單張 `player-visitor.png` 的驗證改為迭代全部五張 player sheet，保留 1024×1024、RGBA、透明角落、每格 baseline 和水平中心的檢查。
2. 執行 `npm test -- tests/sceneAssets.test.ts`，確認因新增四張資產不存在而失敗。
3. 將四張 1024×1024、透明背景、4×4（256px frame）的 production sprite sheet 加入 `src/assets/`；既有 `player-visitor.png` 保持不變。
4. 將 `scripts/validate-scene-assets.ts` 的 player sheet 檢查改為同一份五檔清單，讓 `npm run assets` 也會阻擋不合格的新資產。
5. 重跑 `npm test -- tests/sceneAssets.test.ts` 與 `npm run assets`，確認通過。

### Task 4：整合驗證與視覺檢查

**Files:**
- Modify only if validation exposes a concrete defect.

1. 執行完整單元測試：`npm test`。
2. 執行型別與正式建置：`npm run build`。
3. 啟動開發伺服器並以瀏覽器檢查：重新整理多次時角色只能是五種之一；同一頁面停留和移動時不會變身；角色能移動、碰撞、開啟互動；外星人、狗、貓的視覺邊界不超過既有男觀光客。
4. 檢查 `git diff --check` 與 `git status --short`，只納入本功能所需檔案。
5. 將完成內容分成合理提交（邏輯／測試與資產可同一功能提交），提交前確認測試和建置輸出均為本次最新結果。
