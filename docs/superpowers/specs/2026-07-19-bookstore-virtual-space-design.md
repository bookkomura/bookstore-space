# 書店虛擬展示空間 — 設計文件

日期：2026-07-19
狀態：已與 Pai 確認（brainstorming 四段逐段核准）

## 1. 目標與範圍

為朋友的實體書店建立遊戲化線上展示空間（類 Gather.town 形式）。客人操控角色在 2D 書店場景走動，走到展示櫃前可翻閱「書」（逐頁圖片＋作者描述，展示文創商品如手工蠟燭），走到書櫃前可看店主精選書單。

**分階段**：

- **第一階段（本設計）**：單人逛展。單一房間，5–10 個互動點，保留擴充彈性。
- **第二階段（未來）**：多人同場——看得到其他客人角色走動。本設計預留擴充口，不實作。

**轉換目標**：純展示為主；每個商品預留創作者 IG 導購連結欄位；場景內設實體店資訊點（地址、營業時間、地圖）。

**裝置**：手機優先（IG/FB 連結、店內 QR code 進站），電腦鍵盤操作亦完整支援。

**美術**：現成免費素材包（Kenney、itch.io 免費 pixel art tileset）。

**明確不做（第一階段）**：多人連線、聊天、帳號系統、站內購買、自建管理後台、多房間地圖。

## 2. 技術選型（方案 A，三案比較後定案）

| 層 | 選擇 | 理由 |
|----|------|------|
| 遊戲場景 | Phaser 3 | 手機觸控成熟、tilemap 支援完整、生態大；第二階段多人不需重寫 |
| UI 層 | Vue 3 | Pai 主力技術；內容密集介面用 DOM 比 canvas 容易十倍，天然支援無障礙 |
| 地圖編輯 | Tiled | 免費、Phaser 原生支援、互動點用 object layer 標註 |
| 內容管理 | Headless CMS：Storyblok（首選，視覺化介面對非工程師友善；備選 Sanity） | 朋友自主上傳照片、寫描述，不經工程師 |
| 部署 | Cloudflare Pages | 免費、靜態、台灣延遲低 |

落選方案：B（Gather/WorkAdventure 現成平台＋嵌入頁）——開發量最小但受制於平台、客製受限；C（無引擎 DOM 場景）——失去「走動」核心體驗，第二階段多人難做。

## 3. 整體架構

```
┌─────────────────────────────────────────┐
│  瀏覽器（手機優先）                        │
│  ┌───────────────┐  ┌────────────────┐  │
│  │ Phaser 3 場景層 │  │ Vue 3 UI 層     │  │
│  │ - Tiled 地圖    │◄─┤ - 翻書 overlay  │  │
│  │ - 角色走動/觸控  │  │ - 書單面板      │  │
│  │ - 互動點偵測    │──►│ - 店家資訊卡    │  │
│  └───────────────┘  └────────────────┘  │
└────────────────┬────────────────────────┘
                 │ build 時抓取
        ┌────────▼────────┐
        │  Headless CMS    │
        └─────────────────┘
```

核心決策：

1. **Phaser 管「世界」，Vue 管「介面」**。事件橋接：角色進入互動範圍 → Phaser 發事件 → Vue 開對應 UI；UI 開啟時凍結角色輸入。
2. **靜態部署，無自建後端**。CMS 內容 build 時抓成 `content.json`；朋友改內容 → CMS webhook → 重新 build → 上線（約 1–2 分鐘）。
3. **互動點資料驅動**。Tiled object 標 `id`＋`type`，CMS 同 `id` 對應內容。加櫃子 = 地圖放物件＋CMS 加條目，零程式碼修改。
4. **第二階段擴充口**：角色位置同步預留 adapter 介面（介面先定義、第一階段空實作），之後接 Supabase Realtime 廣播位置，場景層不重寫。

## 4. 元件拆解

### Phaser 場景層

| 模組 | 職責 |
|------|------|
| `BootScene` | 載入素材、進度條 |
| `StoreScene` | 主場景：載 Tiled 地圖、生成互動點 |
| `Player` | 角色移動＋動畫。輸入抽象成介面（觸控搖桿／點擊尋路／鍵盤共用） |
| `InteractionZone` | 互動區偵測。走近顯示提示，觸發時發 `interact:{id}` |
| `EventBridge` | Phaser ↔ Vue 唯一通道（單一 event emitter） |

### Vue UI 層

| 元件 | 職責 |
|------|------|
| `BookViewer` | 翻書 overlay：左右滑動翻頁，每頁圖片＋描述，末頁創作者 IG 連結（有值才渲染） |
| `ShelfPanel` | 書櫃書單：封面＋短評清單 |
| `StoreInfoCard` | 實體店資訊：地址、營業時間、地圖連結、IG |
| `TouchControls` | 虛擬搖桿，僅觸控裝置顯示 |

### CMS 內容模型

```
Showcase（展示櫃/一本書）
├─ id            對應 Tiled 互動點
├─ title         商品名
├─ pages[]       每頁 = { image, caption(作者描述) }
└─ creatorLink   創作者 IG（選填，導購預留）

Shelf（書櫃）
├─ id
├─ title         書單名（如「店主精選」）
└─ books[]       每本 = { cover, title, note }

StoreInfo（單例）
└─ 地址 / 營業時間 / IG / 地圖連結
```

互動點類型三種：`showcase`、`shelf`、`info`。新增類型 = 一個 Vue 元件＋一種 CMS 模型。

## 5. 資料流

**內容更新**：朋友在 CMS 編輯 → webhook 觸發 Cloudflare Pages build → build script 抓 CMS API 產出 `content.json`（圖片走 CMS CDN）→ 部署。

選 build 時抓取而非執行時 API：載入快（弱網友善）、CMS 免費額度不被流量消耗、內容錯誤在 build 階段即失敗。

**客人端載入**：

1. `BootScene`：地圖 tileset＋角色 sprite＋`content.json`（場景素材先載）
2. 商品照片 lazy load——走近互動點才載（10 櫃 × 10 頁全預載會達數十 MB，手機不可行）
3. 翻頁時預載當前頁＋下一頁

## 6. 錯誤處理

| 情境 | 處理 |
|------|------|
| Tiled id ↔ CMS id 不一致 | build 驗證腳本比對，不一致 build fail，列出缺漏 id |
| 商品照片載入失敗 | 佔位圖＋重試按鈕，不整頁掛掉 |
| CMS 必填欄位漏填（如 pages 空陣列） | build 驗證擋下 |
| 選填欄位空值（creatorLink 等） | UI 不渲染該區塊 |
| 舊手機無 WebGL | Phaser 自動 fallback Canvas renderer |
| 直橫螢幕切換 | 場景 resize 置中；UI overlay CSS 響應式 |

## 7. 測試策略

- **build 驗證腳本**（最重要防線）：id 比對、必填欄位、圖片 URL 可達性——朋友改壞內容擋在部署前
- **單元測試（Vitest）**：EventBridge 事件流、InteractionZone 進出判定、content parser
- **E2E（Playwright，少量關鍵路徑）**：進站 → 走到展示櫃 → 開書 → 翻頁 → 關閉；手機 viewport
- **手動驗收**：真機 iOS Safari＋Android Chrome——觸控手感、翻頁順暢度

Phaser 場景邏輯不追求覆蓋率；火力集中在資料正確性與 Phaser↔Vue 橋接。
