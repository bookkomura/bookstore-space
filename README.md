# 書店虛擬展示空間

2D 遊戲化書店逛展網站。角色走動、展示櫃翻書、書櫃書單、實體店資訊。
設計文件：`docs/superpowers/specs/2026-07-19-bookstore-virtual-space-design.md`

## 開發

```bash
npm install
npm run assets    # 產生佔位素材與地圖（首次必跑）
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

## 換正式美術素材

替換 `scripts/generate-*` 的產出：`public/assets/tileset.png`（32px tiles）、
`player.png`（32×32）、`map.json`（Tiled 匯出 JSON，需含 `interactions` object layer，
物件 name = 內容 id、自訂屬性 type = showcase/shelf/info）。格式不變，程式碼零修改。

## 第二階段預留

多人同場：`src/bridge/EventBridge.ts` 為唯一事件通道，屆時加 position-sync adapter
（Supabase Realtime）廣播角色座標，場景層不需重寫。
