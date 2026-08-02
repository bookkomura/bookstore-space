---
task: "完成書店虛擬展示空間第一階段"
slug: 20260719-000000_bookstore-space-phase1
project: bookstore-space
effort: comprehensive
effort_source: auto
phase: plan
progress: 8/50
mode: interactive
started: 2026-07-19T00:00:00+08:00
updated: 2026-07-19T00:04:00+08:00
---

## Problem

第一階段實作目前停在內容 schema 與 loader，只有 Task 1–2 位於 `feature-phase1`。地圖、輸入、Phaser 場景、Vue overlay、CMS build pipeline、E2E、部署文件與真實瀏覽器驗證仍未完成，因此目前還不是可玩的、可 build 的靜態網站。

## Vision

使用者進入單一 2D 書店房間後，能用鍵盤或手機搖桿操控角色，靠近展示櫃、書櫃、店家資訊點並開啟對應的繁體中文介面。內容可由 Storyblok 在 build 時產生，也可在沒有 token 時以 sample 完整運行；開發、測試、build、preview 與 Cloudflare Pages 部署形成一條可重現的路徑。

## Out of Scope

- 不實作多人連線、聊天、帳號、站內購買、自建後台或多房間。
- 不在第一階段引入執行時後端；內容只在 build 時抓取。
- 不把 `public/assets/`、`public/content.json`、`dist/` 或 `node_modules/` 納入 git。
- 不重做 Task 1–2，也不改寫已通過 review 的 schema 架構。

## Principles

- 遊戲狀態與內容 UI 透過唯一 EventBridge 解耦。
- 可測邏輯抽成純函式；手感與渲染使用真實瀏覽器驗證。
- 手機優先且所有使用者文案皆為 zh-TW。
- 生成流程必須能在沒有 CMS token 時完整重現。
- 每個 Task 經獨立實作、自我檢查與 spec/quality review 後才進入下一項。

## Constraints

- Vite 5、Vue 3、TypeScript 5、Phaser 3.80、Zod、Vitest 與 Playwright 為既定技術棧。
- 地圖固定 20×15 tiles，tile 固定 32px，互動類型只允許 `showcase`、`shelf`、`info`。
- `Zone` 與 `ZoneType` 只定義於 `src/game/zones.ts`。
- 所有 Zod schema 只定義於 `src/content/schema.ts`。
- Task 3–12 必須依序執行，不可平行寫入。
- Implementer、fixer、task reviewer 與測試驗證使用 `gpt-5.6-terra`；controller 使用 `gpt-5.6-sol`。
- 最終 whole-branch review 使用 fable；Web 驗證使用 Interceptor。

## Goal

在 `feature-phase1` worktree 依計畫完成 Task 3–12，使專案成為可玩的單人 2D 書店網站：角色可移動並觸發三種互動 UI，內容可由 sample 或 Storyblok 生成，單元與桌機/手機 E2E 通過，production build 可重現，部署與素材替換方式有文件，且每個 Task 與整個分支都通過指定模型的 review。

## Criteria

### Completed foundation

- [x] ISC-1: `npm run test -- tests/smoke.test.ts` 通過一項測試。
- [x] ISC-2: Vite production build 在 Task 1 commit 可成功產出。
- [x] ISC-3: `ContentBundleSchema` 接受合法 sample content。
- [x] ISC-4: `ContentBundleSchema` 拒絕空白 showcase pages。
- [x] ISC-5: `creatorLink` 省略時 schema 仍通過。
- [x] ISC-6: 缺少 `storeInfo` 時 schema 驗證失敗。
- [x] ISC-7: `loadContent` 對非成功 HTTP 狀態拋出 zh-TW 錯誤。
- [x] ISC-8: Task 2 的 focused suite 為 5/5 通過。

### Task 3 — assets, map, parser

- [ ] ISC-9: `findZone` 對區域內座標回傳相符 zone。
- [ ] ISC-10: `findZone` 對含邊界座標回傳相符 zone。
- [ ] ISC-11: `findZone` 對區域外座標回傳 null。
- [ ] ISC-12: `parseInteractionZones` 解析合法 interactions layer。
- [ ] ISC-13: 缺少 interactions layer 時 parser 拋出錯誤。
- [ ] ISC-14: 缺少合法 type 時 parser 錯誤包含 object id。
- [ ] ISC-15: `npm run assets` 產生兩張 PNG 與 map JSON。
- [ ] ISC-16: 生成地圖解析後精確包含四個互動區。

### Task 4 — build validation

- [ ] ISC-17: 完整對應的地圖與內容產生零 validation errors。
- [ ] ISC-18: 地圖存在未知 CMS id 時錯誤包含該 id。
- [ ] ISC-19: CMS id 未出現在地圖時錯誤包含該 id。
- [ ] ISC-20: validation CLI 有錯時以 exit code 1 結束。

### Task 5 — bridge and input

- [ ] ISC-21: EventBridge emit 將 typed payload 傳給 handler。
- [ ] ISC-22: EventBridge unsubscribe 後 handler 不再觸發。
- [ ] ISC-23: 無 handler 的 emit 不拋出例外。
- [ ] ISC-24: 對角移動速度不超過指定 speed。
- [ ] ISC-25: 類比小幅輸入按比例縮放速度。
- [ ] ISC-26: joystick 超出半徑時向量 clamp 為 1。

### Task 6 — Phaser scene

- [ ] ISC-27: 真實瀏覽器顯示 640×480 書店 canvas。
- [ ] ISC-28: 方向鍵可移動角色且牆面碰撞有效。
- [ ] ISC-29: 角色進入互動區時顯示 zh-TW 提示。
- [ ] ISC-30: UI 開啟期間 StoreScene 將角色速度歸零。

### Tasks 7–8 — Vue overlays

- [ ] ISC-31: BookViewer 顯示標題、頁面內容與頁碼。
- [ ] ISC-32: BookViewer 上下頁按鈕遵守首尾邊界。
- [ ] ISC-33: creator link 只在最後一頁且有值時出現。
- [ ] ISC-34: 圖片 error 後出現可操作的重試 UI。
- [ ] ISC-35: ShelfPanel 顯示全部書籍與短評。
- [ ] ISC-36: StoreInfoCard 顯示地址、營業時間與兩個連結。
- [ ] ISC-37: TouchControls 結束或取消觸控後輸入歸零。

### Task 9 — integration

- [ ] ISC-38: bridge showcase 事件開啟相符 BookViewer。
- [ ] ISC-39: bridge shelf 事件開啟相符 ShelfPanel。
- [ ] ISC-40: bridge info 事件開啟 StoreInfoCard。
- [ ] ISC-41: 關閉 overlay 後 bridge 發出 `ui:closed`。
- [ ] ISC-42: Interceptor 驗證整合頁無 console error 與 asset 404。

### Tasks 10–12 — content, E2E, deploy

- [ ] ISC-43: Storyblok 三種 component 映射為合法 ContentBundle。
- [ ] ISC-44: 無 token 時 `npm run content` 複製 sample。
- [ ] ISC-45: Task 11 desktop 三個 E2E probes 全數通過。
- [ ] ISC-46: Task 11 mobile 三個 E2E probes 全數通過。
- [ ] ISC-47: `npm run build` 依序完成 assets、content、validate、Vite。
- [ ] ISC-48: Interceptor 驗證 preview 與 dev 互動行為一致。
- [ ] ISC-49: README 記錄開發、部署、CMS 與素材替換流程。
- [ ] ISC-50: Anti: branch 不加入任何已宣告的生成物或 scope 外功能。

## Test Strategy

| ISC | Type | Check | Threshold | Tool |
|---|---|---|---|---|
| ISC-1–8 | unit/build evidence | 既有 commits 與 reports | 既有 review clean | git log + report read |
| ISC-9–14 | unit | zone/parser edge cases | 6/6 pass | Vitest focused suite |
| ISC-15–16 | generated artifact | files exist and parser count | 3 files, 4 zones | npm assets + tsx probe |
| ISC-17–20 | unit/CLI | id parity and exit status | expected errors only | Vitest + npm validate |
| ISC-21–26 | unit | typed events and vector math | all focused tests pass | Vitest |
| ISC-27–30 | live UI | rendering, movement, collision, pause | checklist passes | Interceptor |
| ISC-31–37 | component unit | overlay behavior | focused tests pass | Vue Test Utils + Vitest |
| ISC-38–42 | integration/live UI | bridge-to-overlay behavior | all flows visible, zero console/404 | Interceptor |
| ISC-43–44 | unit/CLI | Storyblok mapping and fallback | focused tests pass, output exists | Vitest + npm content |
| ISC-45–46 | E2E | desktop/mobile projects | 6/6 pass | Playwright |
| ISC-47 | production build | complete build pipeline | exit 0 | npm run build |
| ISC-48 | preview live UI | production-equivalent flows | checklist passes | Interceptor |
| ISC-49 | file inspection | required README sections | all sections found | rg |
| ISC-50 | anti-probe | ignored/generated/scope scan | zero tracked violations | git ls-files + rg |

## Features

```yaml
- name: PlaceholderMapAndParser
  satisfies: [ISC-9, ISC-10, ISC-11, ISC-12, ISC-13, ISC-14, ISC-15, ISC-16]
  depends_on: []
  parallelizable: false
- name: BuildValidation
  satisfies: [ISC-17, ISC-18, ISC-19, ISC-20]
  depends_on: [PlaceholderMapAndParser]
  parallelizable: false
- name: BridgeAndInput
  satisfies: [ISC-21, ISC-22, ISC-23, ISC-24, ISC-25, ISC-26]
  depends_on: [PlaceholderMapAndParser]
  parallelizable: false
- name: PhaserScene
  satisfies: [ISC-27, ISC-28, ISC-29, ISC-30]
  depends_on: [BridgeAndInput]
  parallelizable: false
- name: VueOverlays
  satisfies: [ISC-31, ISC-32, ISC-33, ISC-34, ISC-35, ISC-36, ISC-37]
  depends_on: []
  parallelizable: false
- name: ApplicationIntegration
  satisfies: [ISC-38, ISC-39, ISC-40, ISC-41, ISC-42]
  depends_on: [PhaserScene, VueOverlays]
  parallelizable: false
- name: ContentPipeline
  satisfies: [ISC-43, ISC-44]
  depends_on: [BuildValidation]
  parallelizable: false
- name: BrowserVerification
  satisfies: [ISC-45, ISC-46, ISC-48]
  depends_on: [ApplicationIntegration, ContentPipeline]
  parallelizable: false
- name: DeployDocumentation
  satisfies: [ISC-47, ISC-49, ISC-50]
  depends_on: [BrowserVerification]
  parallelizable: false
```

## Decisions

- 2026-07-19 00:00: Task 1–2 以 ledger 與 commits 為完成依據，不重新派工。
- 2026-07-19 00:00: 依 Pai 指定，controller 使用 gpt-5.6-sol；implementer、fixer、測試驗證與 task review 全用 gpt-5.6-terra。
- 2026-07-19 00:00: Task 3–12 嚴格串行，因後續 Task 消費前一 Task 的明確介面。
- 2026-07-19 00:00: E5 以 50 個可實際執行的 binary probes 表達；不為達 256 數量而拆出無獨立失敗模式的假準則。
- 2026-07-19 00:00: 巢狀 `codex exec` 會受當前 Codex runtime 限制；使用同模型的多代理執行器派發 Terra，保留模型與 fresh-context 約束。
- 2026-07-19 00:02: IterativeDepth 未新增 scope；生成物追蹤、dev/preview 漂移、手機 UI 互斥與 console/404 風險已由既有 ISC 覆蓋。
- 2026-07-19 00:02: ApertureOscillation 將 Task 6 定義為 scene smoke gate，Task 9 才是完整 Vue–Phaser integration gate。
- 2026-07-19 00:02: FirstPrinciples 將 plan 範例碼分類為可修正的 soft constraint；產品 scope、公開介面、Task 順序、模型分工與既有 commits 為本次不可變約束。
- 2026-07-19 00:03: Advisor 指出後續 brief 可能因前一 Task 的實際介面而陳舊；每個 review clean 後，controller 必須把下一份 brief 與當前 tree 做一次相容性核對。
- 2026-07-19 00:03: 同一 Task 最多兩輪 Terra fix/re-review；仍有 Critical/Important 或同一阻塞重現時，不降低標準，改由 controller 升級阻塞。
- 2026-07-19 00:03: Terra implementer 與 Terra reviewer 的盲點具相關性；task gates 只算局部證據，最終 fable 與 Cato cross-model audit 承擔 whole-branch 反相關檢查。
- 2026-07-19 00:04: Controller context-hygiene gate 觸發於 Task 3 派工前；本 session 不開始 Task 3，先以 HANDOFF、ledger、ISA 與 git 建立安全恢復點。
- 2026-07-19 00:04: 跨 session 記憶以 repo artifacts 與 git 為準；新 gpt-5.6-sol controller 必須從第一個未完成 Task 恢復，不依賴壓縮後聊天上下文。
- 2026-08-02 23:44: 本 session 開始前先核對此 ISA 與 `git log` 現況——實際 main 分支已遠遠超出 Task 3–12 pipeline（heart sutra reveal、showcase 排序、creator 連結、image loader 等多項功能皆已 ship），無 `feature-phase1` worktree、無 Terra/Sol controller 在跑。此 ISA 的 Task 3–12 serial pipeline 判定為 stale/orphaned，非目前開發模式的真實反映；本次不重跑或回填該 50-ISC 結構，僅新增本次獨立 UI 功能的區塊。
- 2026-08-02 23:44: 本次任務（載入畫面 wordmark）依 `design_handoff_loading_screen/README.md` 為 high-fidelity、「nothing invented」的規格交付，設計決策已在 handoff 定案；直接執行實作與驗證，不派發 IterativeDepth/RedTeam/Council 等重量分析型 capability——那些工具的邊際價值在此任務為零，show-your-math 見下方 LEARN。

## Changelog

- 2026-07-19 | conjectured: 交接文字足以在新 session 安全恢復工作
  refuted by: 對話記憶無法保證在 compaction 後仍保留每一個 Task 的 review 與 commit 邊界
  learned: ledger、task brief、report、review package 與 git commits 必須共同構成可恢復狀態
  criterion now: ISC-50 之外，每個 Task 僅在 review clean 並寫入 ledger 後才視為完成

- 2026-08-02 | conjectured: 此 project ISA 的 Task 3–12 pipeline 仍是 bookstore-space 目前的權威開發狀態
  refuted by: git log 顯示 main 已合併多個與該 pipeline 無關、更晚的功能分支，pipeline 描述的 controller/Terra/Sol 派工模式未在本 repo 實際使用
  learned: 長壽 project ISA 若沒有持續在每個 session 回寫，會與有機演進的 repo 快速失準；下次任務應先跑一次 `Skill("ISA", "check completeness")` 或等效 git 對照，再決定要延續舊 ISC 表還是另開區塊
  criterion now: 新功能（如本次載入畫面）在 ISA 內另立小節記錄，不強行套入已失準的 Task 3–12 骨架

## Loading Screen Wordmark (2026-08-02)

依 `~/Downloads/design_handoff_loading_screen/README.md`（設計已定案，2a/1b）：

- [x] LS-1: `EventBridge.ts` 的 `BridgeEvents` 新增 `boot:progress`(number)、`boot:complete`(undefined)、`boot:error`(undefined)。
- [x] LS-2: `BootScene.ts` 移除 Phaser 矩形進度條，`preload()` 改為 emit `boot:progress`；`create()` 依 `assetFailed` emit `boot:complete` 或 `boot:error`。
- [x] LS-3: 新增 `src/ui/BootLoading.vue`——ink bloom、小村閱讀逐字 stagger（0/180/360/540ms）、204×16 進度條（fill `calc(200px * var(--progress))`）、狀態列（`正在整理書架⋯⋯` / 錯誤文案）、`prefers-reduced-motion` 停用動畫。
- [x] LS-4: `App.vue` 新增 `bootProgress`/`bootReady`/`bootError` refs，掛載即訂閱 boot 事件（在 `loadContent()` 之前），`<Transition name="boot-loading">` 包裹 `BootLoading`，fade-out 180ms 對齊 `PoemUploadOverlay` 的 `ink-loading` 模式。
- [x] LS-5: Anti: 不修改既有 `interact`/`zone:*`/`ui:*` bridge 行為與既有 overlay 元件。
- [x] LS-6: `npx vue-tsc --noEmit` 除既有與本次無關的 `StoreScene.test.ts` 兩筆錯誤外無新增錯誤（stash 對照確認為既存）。
- [x] LS-7: `npx vitest run` 全數 132/132 通過（含新增 `BootLoading.test.ts` 3 筆、`App.test.ts` 新增 2 筆）。
- [x] LS-8: 真實瀏覽器（`http://localhost:5173`，既有 dev server）載入後場景正常啟動、無 console error，證實 boot 事件鏈路端到端運作。
- [DEFERRED-VERIFY] LS-9: 載入中動畫畫面的即時截圖——本機資產已被瀏覽器快取，`load complete` 在可觀測的螢幕截圖往返時間內即完成，無法用目前工具組截到轉場中畫面；已用元件層 unit test（LS-7 涵蓋 wordmark 文字、aria-valuenow、進度寬度、錯誤文案）取代。Follow-up：下次若需視覺回歸，用 `Skill("Interceptor")` 搭配 network throttling 或暫時 mock `load.once('complete')` 延遲重試。

## Verification

- ISC-1: Task 1 report — smoke test 1/1 passed.
- ISC-2: Commit `4689a14` task review approved build evidence.
- ISC-3: Task 2 report — valid sample parse passed.
- ISC-4: Task 2 report — empty pages rejection passed.
- ISC-5: Task 2 report — optional creatorLink passed.
- ISC-6: Task 2 report — missing storeInfo rejection passed.
- ISC-7: Task 2 report — HTTP failure path test passed.
- ISC-8: Task 2 ledger — focused suite 5/5 and review adjudicated clean.
- Controller baseline: `npm run test` — 2 test files, 5 tests passed before Task 3 dispatch.
- Handoff boundary: collaboration agent list contained only `/root`; no Terra implementer or reviewer was in flight.
