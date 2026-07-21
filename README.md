# 書店虛擬展示空間

2D 遊戲化書店逛展網站。角色走動、展示櫃翻書、書櫃書單、實體店資訊。
設計文件：`docs/superpowers/specs/2026-07-19-bookstore-scene-interactions-design.md`

## 開發

```bash
npm install
npm run assets    # 驗證正式素材
npm run content   # 產生 content.json（無 token 用 sample）
npm run dev
```

測試：`npm run test`（單元）、`npm run e2e`（Playwright，先 `npx playwright install chromium`）

## 部署（Cloudflare Pages）

1. Cloudflare Pages 連 git repo
2. Build command：`npm run build`；Output directory：`dist`
3. 環境變數：`STORYBLOK_TOKEN`（Storyblok Content API token，無則用 sample 內容）
4. Storyblok webhook：Settings → Webhooks → Story published/unpublished → 貼上 Cloudflare Pages 的 Deploy Hook URL（內容更新自動重新部署）

## Storyblok 內容模型

Component 名稱與欄位（story slug = 地圖互動點 id）：

- `showcase`：title (Text)、pages (Blocks：image (Asset)、caption (Textarea))、creator_link (Link，選填)
- `shelf`：title (Text)、books (Blocks：cover (Asset)、title (Text)、note (Textarea))
- `store_info`（單一 story，slug 任意）：address、hours (Text)、instagram、map_link (Link)
- `newsletter`：[電子報 CMS contract](docs/storyblok/newsletter-component.md)。只有已發布的電子報 story 會在下一次 build 後出現在檔案室；本機未設定 `STORYBLOK_TOKEN` 時使用 sample fixture。

## 圖片場景資產

- `src/assets/store-background.png`：核准的 1572×1001 書店背景原圖。
- `src/assets/player-visitor.png`：1024×1024、4×4 玩家 sprite sheet。
- 玩家 sheet 的列順序為下、左、右、上；欄順序為待機、接觸、經過、反向接觸。
- `npm run assets` 只驗證正式素材，不會重新產生或覆寫圖片。

## 操作方式

- 電腦：方向鍵移動；靠近白底灰字驚嘆號後按 `E`，或直接點擊已啟用標記。
- 手機：左下搖桿移動；靠近互動點後，右下「點擊」按鈕會亮起。
- 商品 1 位於上方展示櫃最右側，向左依序至商品 5；中央長桌是店長選書，右側店員是營業資訊。

## 場景驗收

部署前需在桌機、iOS Safari 與 Android Chrome 確認：七個互動點可到達、家具與 NPC 不可穿越、玩家四方向動畫正確、左右觸控可同時操作、直橫旋轉不重置玩家或破壞版面。

## 第二階段預留

多人同場：`src/bridge/EventBridge.ts` 為唯一事件通道，屆時加 position-sync adapter
（Supabase Realtime）廣播角色座標，場景層不需重寫。
