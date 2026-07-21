# 書店圖片場景與互動控制改版 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 以核准的書店圖片取代示意 tilemap，加入同畫風四方向玩家、七個資料驅動互動點、白底灰字提示，以及手機右側互動按鈕。

**Architecture:** 保持「Phaser 管世界、Vue 管介面」：Phaser 使用單張 1572×1001 背景、透明矩形碰撞體、玩家 sprite 與互動標記；Vue 載入 CMS 後建立互動名稱對照，並管理既有內容視窗與觸控按鈕。場景幾何集中在純 TypeScript 設定，內容驗證、最近互動區選擇、鏡頭縮放與動畫方向都以純函式測試。

**Tech Stack:** Phaser 3.80、Vue 3.4、TypeScript 5.9、Vite 5.4、Vitest 2.1、Playwright 1.61、Zod 3.23、pngjs 7。

## Global Constraints

- 核准規格：`docs/superpowers/specs/2026-07-19-bookstore-scene-interactions-design.md`，commit `1c73801`。
- 背景來源固定為 `/Users/pai/Downloads/2.png`；實際尺寸 1572×1001、約 1.9 MB，保持原始比例，不得拉伸。
- 場景只使用一張背景圖；不拆圖、不重建 tilemap、不搬動背景家具或 NPC。
- 圖中所有人物都是不可穿越的靜態 NPC；只有右側店員對應 `info-1`，其餘 NPC 不互動。
- 玩家是獨立的新訪客角色：深色頭髮、簡單外套、小背包；比例、像素密度、輪廓、低飽和色與暖色光影必須匹配背景 NPC。
- 玩家提供上、下、左、右四方向的待機與循環走路動畫；碰撞體只覆蓋腳部。
- 七個互動 ID 固定為 `showcase-1` 至 `showcase-5`、`shelf-1`、`info-1`；最右商品為 `showcase-1`，向左依序至 `showcase-5`。
- 商品標籤讀取 `Showcase.title`；中央桌讀取 `Shelf.title`；店員固定顯示「營業資訊」。
- 七個互動點平時都顯示白色圓形背景、中深灰色驚嘆號、細灰框與柔和陰影；靠近時才展開白底深灰字名稱。
- 手機左下為搖桿、右下為「點擊」按鈕；按鈕區域外停用、區域內亮起，並支援雙手多點觸控。
- 桌機不顯示觸控控制；保留方向鍵、`E` 與靠近後直接點擊標記。
- Vue 只管理內容與 DOM overlay；Phaser 只管理世界、碰撞、目前互動區及 canvas 標記；兩者只經 `EventBridge` 通訊。
- CMS、場景與範例內容的 ID 必須雙向完全一致；缺少、重複或多餘 ID 都使 build 失敗。
- UI 文案維持 zh-TW；不得加入多人、聊天、帳號、購買、多房間或新後台。
- 不新增 runtime dependency；沿用既有 `pngjs` 做 PNG 尺寸驗證。
- 舊 Task 12 的 README commit `b18cf75` 保留；其尚未執行的示意場景真機驗收由本計畫 Task 20 的新場景真機驗收取代，不重複驗收即將移除的 tilemap。
- 每個 Task 依序完成 implement → tests → commit → fresh independent review；Critical／Important 修正後重新審查，review clean 才進下一 Task。

---

## File Structure

### 新增

- `src/game/sceneLayout.ts`：世界尺寸、出生點、透明碰撞矩形與七個互動區的唯一來源。
- `src/game/camera.ts`：依 viewport 與觸控能力計算鏡頭 zoom 的純函式。
- `src/game/playerAnimation.ts`：速度向量到面向、待機 frame 與走路 animation key 的純函式。
- `src/game/interactionLabels.ts`：由 `ContentBundle` 建立 `id → 顯示名稱`。
- `src/game/InteractionMarker.ts`：白底灰字驚嘆號、靠近標籤、啟用狀態與鄰近點擊。
- `src/assets/store-background.png`：核准的乾淨原圖。
- `src/assets/player-visitor.png`：4×4、1024×1024 透明 sprite sheet。
- `scripts/validate-scene-assets.ts`：build 前驗證背景與玩家 PNG 尺寸／透明角落。
- `tests/sceneLayout.test.ts`、`tests/camera.test.ts`、`tests/playerAnimation.test.ts`、`tests/interactionLabels.test.ts`、`tests/sceneAssets.test.ts`、`tests/TouchControls.test.ts`：新純邏輯與元件測試。

### 修改

- `src/game/zones.ts`：Zone 加入互動錨點，改為穩定選擇最近的重疊 zone。
- `src/game/mapParser.ts`：Task 13 暫時補齊 anchor，Task 16 移除。
- `src/content/validate.ts`：直接驗證 `readonly Zone[]`，檢查缺少、重複與多餘 ID。
- `scripts/validate-content.ts`：改用 `INTERACTION_ZONES`，不再讀取生成的 map。
- `scripts/sample-content.json`：擴充至五個商品。
- `src/game/BootScene.ts`：載入背景與 sprite sheet，顯示素材載入錯誤。
- `src/game/StoreScene.ts`：背景、靜態碰撞、鏡頭、玩家動畫、七個 marker 與互動狀態。
- `src/game/createGame.ts`：使用 resize canvas，接收互動名稱對照。
- `src/bridge/EventBridge.ts`：加入 `interact:request`。
- `src/ui/TouchControls.vue`：加入右側按鈕、停用狀態及觸控識別碼。
- `src/App.vue`：建立 label map、追蹤目前 zone、驅動觸控按鈕並完整清理 bridge 訂閱。
- `package.json`：`assets` 改為驗證正式資產。
- `tests/zones.test.ts`、`tests/mapParser.test.ts`、`tests/validate.test.ts`、`tests/App.test.ts`、`tests/EventBridge.test.ts`、`e2e/basic.spec.ts`：更新契約與關鍵流程。
- `README.md`：記錄新場景資產、控制方式與真機驗收。

### 移除

- `scripts/generate-placeholder-assets.ts`：正式背景與玩家取代 placeholder。
- `scripts/generate-map.ts`：圖片場景改用 `sceneLayout.ts`，不再產生 tilemap。
- `src/game/mapParser.ts` 與 `tests/mapParser.test.ts`：Task 16 切換完成後移除。

---

## Execution Activation Gate

在派 Task 13 implementer 前，controller 必須先把舊 Task 12 收到安全邊界：

1. 在 `.superpowers/sdd/task-12-report.md` 記錄 Pai 已核准新場景規格 `1c73801`，舊示意 tilemap 的實體手機驗收由本計畫 Task 20 的正式圖片場景驗收取代。
2. 建立 fresh Task 12 re-review prompt，提供原 Task 12 brief／report／review、規格 commit `1c73801` 與本計畫，請 reviewer 判定這項使用者核准的驗收變更是否足以關閉 Task 12。
3. Reviewer 若核准，立即把 `.superpowers/sdd/progress.md` 的 Task 12 更新為 complete，並記錄「舊真機 gate 由 Tasks 13–20 最終驗收取代」；同步更新 `HANDOFF.md`、HEAD、第一個未完成項 Task 13 與 clean git status。
4. Reviewer 若仍要求先驗收舊示意場景，停止在 Task 12，不派 Task 13，請 Pai 決定要保留或明確豁免舊驗收。
5. 確認所有舊 subagent 已完成、沒有 in-flight agent、規格與計畫均已 commit，才進入 Task 13。

---

### Task 13: 圖片場景幾何與最近互動區

**Files:**
- Create: `src/game/sceneLayout.ts`
- Create: `tests/sceneLayout.test.ts`
- Modify: `src/game/zones.ts`
- Modify: `src/game/mapParser.ts`
- Modify: `tests/zones.test.ts`
- Modify: `tests/mapParser.test.ts`

**Interfaces:**
- Consumes: `ZoneType = 'showcase' | 'shelf' | 'info'`。
- Produces: `WORLD_SIZE`、`PLAYER_SPAWN`、`COLLISION_RECTS`、`INTERACTION_ZONES`、`findNearestZone(px, py, zones): Zone | null`。

- [ ] **Step 1: 寫出場景配置與最近 zone 的失敗測試**

新增 `tests/sceneLayout.test.ts`：

```ts
import { describe, expect, it } from 'vitest'
import {
  COLLISION_RECTS,
  INTERACTION_ZONES,
  PLAYER_SPAWN,
  WORLD_SIZE,
} from '../src/game/sceneLayout'

describe('sceneLayout', () => {
  it('使用核准背景尺寸與右側入口出生點', () => {
    expect(WORLD_SIZE).toEqual({ width: 1572, height: 1001 })
    expect(PLAYER_SPAWN).toEqual({ x: 1205, y: 250 })
  })

  it('定義五商品、店長選書與營業資訊共七區', () => {
    expect(INTERACTION_ZONES.map((zone) => zone.id)).toEqual([
      'showcase-1',
      'showcase-2',
      'showcase-3',
      'showcase-4',
      'showcase-5',
      'shelf-1',
      'info-1',
    ])
  })

  it('商品 1 在最右側，向左依序至商品 5', () => {
    const xs = INTERACTION_ZONES
      .filter((zone) => zone.type === 'showcase')
      .map((zone) => zone.anchorX)
    expect(xs).toEqual([...xs].sort((a, b) => b - a))
  })

  it('碰撞體 ID 唯一且完全位於世界內', () => {
    expect(new Set(COLLISION_RECTS.map((rect) => rect.id)).size).toBe(COLLISION_RECTS.length)
    for (const rect of COLLISION_RECTS) {
      expect(rect.x).toBeGreaterThanOrEqual(0)
      expect(rect.y).toBeGreaterThanOrEqual(0)
      expect(rect.x + rect.width).toBeLessThanOrEqual(WORLD_SIZE.width)
      expect(rect.y + rect.height).toBeLessThanOrEqual(WORLD_SIZE.height)
    }
  })
})
```

將 `tests/zones.test.ts` 改為：

```ts
import { describe, expect, it } from 'vitest'
import { findNearestZone, type Zone } from '../src/game/zones'

const zones: Zone[] = [
  {
    id: 'showcase-1', type: 'showcase',
    x: 100, y: 100, width: 80, height: 80,
    anchorX: 170, anchorY: 120,
  },
  {
    id: 'showcase-2', type: 'showcase',
    x: 140, y: 100, width: 80, height: 80,
    anchorX: 150, anchorY: 120,
  },
]

describe('findNearestZone', () => {
  it('區域不重疊時回傳包含座標的 zone', () => {
    expect(findNearestZone(110, 110, zones)?.id).toBe('showcase-1')
  })

  it('重疊時回傳互動錨點最近的 zone', () => {
    expect(findNearestZone(150, 130, zones)?.id).toBe('showcase-2')
  })

  it('等距時維持設定陣列順序', () => {
    expect(findNearestZone(160, 120, zones)?.id).toBe('showcase-1')
  })

  it('所有區域外回傳 null', () => {
    expect(findNearestZone(0, 0, zones)).toBeNull()
  })
})
```

更新 `tests/mapParser.test.ts` 第一個物件的預期值，加入：

```ts
anchorX: 128,
anchorY: 96,
```

- [ ] **Step 2: 執行測試確認 RED**

Run:

```bash
npx vitest run tests/sceneLayout.test.ts tests/zones.test.ts tests/mapParser.test.ts
```

Expected: FAIL，訊息包含找不到 `sceneLayout`、`findNearestZone` 或 Zone 缺少 `anchorX`／`anchorY`。

- [ ] **Step 3: 實作 Zone 契約與穩定最近距離選擇**

以以下內容取代 `src/game/zones.ts`：

```ts
export type ZoneType = 'showcase' | 'shelf' | 'info'

export interface Zone {
  id: string
  type: ZoneType
  x: number
  y: number
  width: number
  height: number
  anchorX: number
  anchorY: number
}

function contains(px: number, py: number, zone: Zone): boolean {
  return px >= zone.x
    && px <= zone.x + zone.width
    && py >= zone.y
    && py <= zone.y + zone.height
}

export function findNearestZone(
  px: number,
  py: number,
  zones: readonly Zone[],
): Zone | null {
  let nearest: Zone | null = null
  let nearestDistance = Number.POSITIVE_INFINITY

  for (const zone of zones) {
    if (!contains(px, py, zone)) continue
    const distance = (px - zone.anchorX) ** 2 + (py - zone.anchorY) ** 2
    if (distance < nearestDistance) {
      nearest = zone
      nearestDistance = distance
    }
  }

  return nearest
}
```

在 `src/game/mapParser.ts` 回傳物件加入中央頂緣 anchor，保持 Task 16 前的舊 map 相容：

```ts
return {
  id: obj.name,
  type: typeProp as ZoneType,
  x: obj.x,
  y: obj.y,
  width: obj.width,
  height: obj.height,
  anchorX: obj.x + obj.width / 2,
  anchorY: obj.y,
}
```

- [ ] **Step 4: 建立核准圖片的場景幾何**

新增 `src/game/sceneLayout.ts`：

```ts
import type { Zone } from './zones'

export interface Point {
  x: number
  y: number
}

export interface CollisionRect {
  id: string
  x: number
  y: number
  width: number
  height: number
}

export const WORLD_SIZE = { width: 1572, height: 1001 } as const
export const PLAYER_SPAWN: Point = { x: 1205, y: 250 }

export const COLLISION_RECTS: readonly CollisionRect[] = [
  { id: 'wall-top', x: 40, y: 17, width: 1492, height: 40 },
  { id: 'wall-bottom', x: 40, y: 944, width: 1492, height: 40 },
  { id: 'wall-left', x: 40, y: 17, width: 32, height: 967 },
  { id: 'wall-right', x: 1494, y: 17, width: 38, height: 967 },
  { id: 'stairs', x: 68, y: 54, width: 169, height: 284 },
  { id: 'shelves-top', x: 322, y: 55, width: 794, height: 216 },
  { id: 'shelves-left', x: 65, y: 333, width: 124, height: 611 },
  { id: 'counter-right', x: 1300, y: 278, width: 190, height: 666 },
  { id: 'table-center', x: 407, y: 334, width: 585, height: 205 },
  { id: 'chairs-center', x: 454, y: 510, width: 506, height: 78 },
  { id: 'table-lower-left', x: 235, y: 651, width: 240, height: 232 },
  { id: 'table-lower-middle', x: 612, y: 651, width: 260, height: 258 },
  { id: 'table-lower-right', x: 981, y: 651, width: 253, height: 232 },
  { id: 'npc-left', x: 198, y: 400, width: 75, height: 126 },
  { id: 'npc-right', x: 1228, y: 401, width: 68, height: 137 },
] as const

export const INTERACTION_ZONES: readonly Zone[] = [
  {
    id: 'showcase-1', type: 'showcase',
    x: 1025, y: 270, width: 72, height: 64,
    anchorX: 1061, anchorY: 248,
  },
  {
    id: 'showcase-2', type: 'showcase',
    x: 945, y: 270, width: 72, height: 64,
    anchorX: 981, anchorY: 248,
  },
  {
    id: 'showcase-3', type: 'showcase',
    x: 865, y: 270, width: 72, height: 64,
    anchorX: 901, anchorY: 248,
  },
  {
    id: 'showcase-4', type: 'showcase',
    x: 785, y: 270, width: 72, height: 64,
    anchorX: 821, anchorY: 248,
  },
  {
    id: 'showcase-5', type: 'showcase',
    x: 705, y: 270, width: 72, height: 64,
    anchorX: 741, anchorY: 248,
  },
  {
    id: 'shelf-1', type: 'shelf',
    x: 455, y: 588, width: 530, height: 62,
    anchorX: 720, anchorY: 548,
  },
  {
    id: 'info-1', type: 'info',
    x: 1208, y: 285, width: 92, height: 285,
    anchorX: 1324, anchorY: 300,
  },
] as const
```

- [ ] **Step 5: 執行 focused 與全套測試**

Run:

```bash
npx vitest run tests/sceneLayout.test.ts tests/zones.test.ts tests/mapParser.test.ts
npm run test
npx vue-tsc --noEmit --pretty false
```

Expected: focused tests PASS；全套至少維持目前 46 tests 全綠並加入新測試；typecheck exit 0。

- [ ] **Step 6: Commit**

```bash
git add src/game/sceneLayout.ts src/game/zones.ts src/game/mapParser.ts tests/sceneLayout.test.ts tests/zones.test.ts tests/mapParser.test.ts
git commit -m "feat: define bookstore image scene layout"
```

---

### Task 14: 五商品內容與嚴格 ID 驗證

**Files:**
- Modify: `src/content/validate.ts`
- Modify: `scripts/validate-content.ts`
- Modify: `scripts/sample-content.json`
- Modify: `tests/validate.test.ts`

**Interfaces:**
- Consumes: `INTERACTION_ZONES: readonly Zone[]`、`ContentBundle`。
- Produces: `validateContent(zones: readonly Zone[], content: ContentBundle): string[]`，會報告缺少、重複、多餘及非法資訊點。

- [ ] **Step 1: 寫出完整 ID 契約的失敗測試**

以以下內容取代 `tests/validate.test.ts`：

```ts
import { describe, expect, it } from 'vitest'
import { validateContent } from '../src/content/validate'
import { ContentBundleSchema } from '../src/content/schema'
import { INTERACTION_ZONES } from '../src/game/sceneLayout'
import sample from '../scripts/sample-content.json'

const content = ContentBundleSchema.parse(sample)

describe('validateContent', () => {
  it('七個場景互動點與內容完全對應時回傳空陣列', () => {
    expect(validateContent(INTERACTION_ZONES, content)).toEqual([])
  })

  it('缺少商品時列出該 id', () => {
    const missing = {
      ...content,
      showcases: content.showcases.filter((item) => item.id !== 'showcase-5'),
    }
    expect(validateContent(INTERACTION_ZONES, missing).join('\n')).toContain('showcase-5')
  })

  it('多出場景不存在的商品時列出該 id', () => {
    const extra = {
      ...content,
      showcases: [
        ...content.showcases,
        { ...content.showcases[0], id: 'showcase-99', title: '多餘商品' },
      ],
    }
    expect(validateContent(INTERACTION_ZONES, extra).join('\n')).toContain('showcase-99')
  })

  it('重複 CMS id 時列出重複錯誤', () => {
    const duplicate = {
      ...content,
      showcases: [...content.showcases, { ...content.showcases[0] }],
    }
    expect(validateContent(INTERACTION_ZONES, duplicate).join('\n')).toContain('重複')
  })

  it('缺少唯一 info-1 時回報場景設定錯誤', () => {
    const noInfo = INTERACTION_ZONES.filter((zone) => zone.id !== 'info-1')
    expect(validateContent(noInfo, content).join('\n')).toContain('info-1')
  })
})
```

- [ ] **Step 2: 執行測試確認 RED**

Run:

```bash
npx vitest run tests/validate.test.ts
```

Expected: FAIL，因 `validateContent` 仍接收 map JSON，且 sample 尚未包含 `showcase-3` 至 `showcase-5`。

- [ ] **Step 3: 實作雙向與重複 ID 驗證**

以以下內容取代 `src/content/validate.ts`：

```ts
import type { Zone } from '../game/zones'
import type { ContentBundle } from './schema'

function duplicates(ids: readonly string[]): string[] {
  const seen = new Set<string>()
  const repeated = new Set<string>()
  for (const id of ids) {
    if (seen.has(id)) repeated.add(id)
    seen.add(id)
  }
  return [...repeated]
}

export function validateContent(
  zones: readonly Zone[],
  content: ContentBundle,
): string[] {
  const errors: string[] = []
  const zoneIds = zones.map((zone) => zone.id)
  const showcaseIds = content.showcases.map((item) => item.id)
  const shelfIds = content.shelves.map((item) => item.id)

  for (const id of duplicates(zoneIds)) errors.push(`場景互動點 id 重複：${id}`)
  for (const id of duplicates(showcaseIds)) errors.push(`CMS Showcase id 重複：${id}`)
  for (const id of duplicates(shelfIds)) errors.push(`CMS Shelf id 重複：${id}`)

  const showcaseSet = new Set(showcaseIds)
  const shelfSet = new Set(shelfIds)
  const zoneSet = new Set(zoneIds)

  for (const zone of zones) {
    if (zone.type === 'showcase' && !showcaseSet.has(zone.id)) {
      errors.push(`場景互動點 ${zone.id}（showcase）在 CMS 找不到對應內容`)
    }
    if (zone.type === 'shelf' && !shelfSet.has(zone.id)) {
      errors.push(`場景互動點 ${zone.id}（shelf）在 CMS 找不到對應內容`)
    }
  }

  for (const showcase of content.showcases) {
    if (!zoneSet.has(showcase.id)) {
      errors.push(`CMS Showcase「${showcase.title}」(${showcase.id}) 在場景沒有互動點`)
    }
  }
  for (const shelf of content.shelves) {
    if (!zoneSet.has(shelf.id)) {
      errors.push(`CMS Shelf「${shelf.title}」(${shelf.id}) 在場景沒有互動點`)
    }
  }

  const infoZones = zones.filter((zone) => zone.type === 'info')
  if (infoZones.length !== 1 || infoZones[0]?.id !== 'info-1') {
    errors.push('場景必須包含唯一的 info-1 營業資訊互動點')
  }

  return errors
}
```

以以下內容取代 `scripts/validate-content.ts`：

```ts
import { readFileSync } from 'node:fs'
import { ContentBundleSchema } from '../src/content/schema'
import { validateContent } from '../src/content/validate'
import { INTERACTION_ZONES } from '../src/game/sceneLayout'

const raw = JSON.parse(readFileSync('public/content.json', 'utf8'))
const parsed = ContentBundleSchema.safeParse(raw)

if (!parsed.success) {
  console.error('✗ content.json 格式錯誤：')
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join('.')}: ${issue.message}`)
  }
  process.exit(1)
}

const errors = validateContent(INTERACTION_ZONES, parsed.data)
if (errors.length > 0) {
  console.error('✗ 內容驗證失敗：')
  for (const error of errors) console.error(`  - ${error}`)
  process.exit(1)
}

console.log('✓ 內容驗證通過')
```

- [ ] **Step 4: 將 sample content 擴充為五個獨立商品**

在 `scripts/sample-content.json` 的 `showcases` 陣列中，保留現有 `showcase-1`、`showcase-2`，並追加：

```json
{
  "id": "showcase-3",
  "title": "手作陶器",
  "pages": [
    {
      "image": "https://placehold.co/600x800/d8c3a5/333?text=Pottery",
      "caption": "以台灣土料燒製的日常器皿，每件保留手工痕跡。"
    }
  ]
},
{
  "id": "showcase-4",
  "title": "植物染布品",
  "pages": [
    {
      "image": "https://placehold.co/600x800/b8c7a3/333?text=Textile",
      "caption": "以在地植物染製的小方巾與布包。"
    }
  ]
},
{
  "id": "showcase-5",
  "title": "獨立刊物選集",
  "pages": [
    {
      "image": "https://placehold.co/600x800/c8b7a6/333?text=Zine",
      "caption": "收錄地方創作者的攝影、插畫與生活書寫。"
    }
  ]
}
```

- [ ] **Step 5: 執行內容與全套驗證**

Run:

```bash
npx vitest run tests/validate.test.ts
npm run content
npm run validate
npm run test
npx vue-tsc --noEmit --pretty false
```

Expected: focused tests PASS；`content` 使用 sample fallback；`validate` 印出 `✓ 內容驗證通過`；全套 tests 與 typecheck exit 0。

- [ ] **Step 6: Commit**

```bash
git add src/content/validate.ts scripts/validate-content.ts scripts/sample-content.json tests/validate.test.ts
git commit -m "feat: validate five image-scene showcases"
```

---

### Task 15: 正式背景與同畫風玩家 sprite sheet

**Files:**
- Create: `src/assets/store-background.png`
- Create: `src/assets/player-visitor.png`
- Create: `scripts/validate-scene-assets.ts`
- Create: `tests/sceneAssets.test.ts`

**Interfaces:**
- Consumes: 核准背景 `/Users/pai/Downloads/2.png`。
- Produces: 1572×1001 背景 PNG；1024×1024、4 欄×4 列、透明背景的玩家 sheet；每格 256×256。

- [ ] **Step 1: 寫出正式素材的失敗測試**

新增 `tests/sceneAssets.test.ts`：

```ts
import { readFileSync } from 'node:fs'
import { PNG } from 'pngjs'
import { describe, expect, it } from 'vitest'

function readPng(path: string): PNG {
  return PNG.sync.read(readFileSync(path))
}

describe('scene artwork', () => {
  it('背景保持核准原圖尺寸', () => {
    const background = readPng('src/assets/store-background.png')
    expect({ width: background.width, height: background.height }).toEqual({
      width: 1572,
      height: 1001,
    })
  })

  it('玩家為 4×4 的 1024 方形透明 sprite sheet', () => {
    const player = readPng('src/assets/player-visitor.png')
    expect({ width: player.width, height: player.height }).toEqual({
      width: 1024,
      height: 1024,
    })

    const cornerAlpha = [
      player.data[3],
      player.data[(player.width - 1) * 4 + 3],
      player.data[((player.height - 1) * player.width) * 4 + 3],
      player.data[(player.width * player.height - 1) * 4 + 3],
    ]
    expect(cornerAlpha).toEqual([0, 0, 0, 0])
  })
})
```

- [ ] **Step 2: 執行測試確認 RED**

Run:

```bash
npx vitest run tests/sceneAssets.test.ts
```

Expected: FAIL with `ENOENT` for `src/assets/store-background.png`。

- [ ] **Step 3: 加入核准背景原檔**

建立 `src/assets/`，將 `/Users/pai/Downloads/2.png` 原樣複製為 `src/assets/store-background.png`。複製後執行：

```bash
cmp /Users/pai/Downloads/2.png src/assets/store-background.png
sips -g pixelWidth -g pixelHeight src/assets/store-background.png
```

Expected: `cmp` exit 0；尺寸為 1572×1001。

- [ ] **Step 4: 以背景為風格參考生成玩家 sheet**

使用 `image_gen`，引用 `/Users/pai/Downloads/2.png`，使用以下完整 prompt：

```text
Create one production sprite sheet for the controllable visitor in the referenced
top-down pixel-art bookstore. Match the reference NPCs exactly in apparent pixel
density, adult body proportions, dark outlines, muted low-saturation palette,
warm amber indoor lighting, and detailed hand-painted pixel-art texture.

Character: a distinct new bookstore visitor with dark hair, a simple charcoal
jacket, dark trousers, neutral shoes, and a small olive-brown backpack. Do not
copy any existing NPC exactly. Keep the character understated and consistent
with the room.

Output: transparent PNG, exactly 1024 by 1024, a strict 4-column by 4-row grid.
Every cell is exactly 256 by 256 with identical character scale, foot position,
padding, lighting, and registration. No grid lines, labels, shadows outside the
character, props, scenery, text, or background.

Rows from top to bottom: facing down, facing left, facing right, facing up.
Columns from left to right: idle, walk contact, walk passing, walk opposite
contact. The feet of every frame must share the same baseline. Keep all pixels
inside each cell and leave every outer corner fully transparent.
```

將核准輸出保存為 `src/assets/player-visitor.png`。若第一次輸出的格線、透明度、腳底基準或畫風不合格，只使用 Pai／controller 指出的具體差異做一次 edit generation；第二次仍不合格就停止 Task 15 並記錄阻塞，不提交不合格素材。

- [ ] **Step 5: 建立 build-time 素材驗證器**

新增 `scripts/validate-scene-assets.ts`：

```ts
import { readFileSync } from 'node:fs'
import { PNG } from 'pngjs'

function readPng(path: string): PNG {
  try {
    return PNG.sync.read(readFileSync(path))
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`${path} 無法讀取：${message}`)
  }
}

function assertSize(path: string, width: number, height: number): PNG {
  const png = readPng(path)
  if (png.width !== width || png.height !== height) {
    throw new Error(
      `${path} 尺寸必須是 ${width}×${height}，實際為 ${png.width}×${png.height}`,
    )
  }
  return png
}

const background = assertSize('src/assets/store-background.png', 1572, 1001)
const player = assertSize('src/assets/player-visitor.png', 1024, 1024)

const corners = [
  player.data[3],
  player.data[(player.width - 1) * 4 + 3],
  player.data[((player.height - 1) * player.width) * 4 + 3],
  player.data[(player.width * player.height - 1) * 4 + 3],
]
if (corners.some((alpha) => alpha !== 0)) {
  throw new Error('src/assets/player-visitor.png 四個外角必須完全透明')
}

console.log(
  `✓ 場景素材通過：背景 ${background.width}×${background.height}，玩家 4×4 sprite sheet`,
)
```

- [ ] **Step 6: 驗證檔案與視覺風格**

Run:

```bash
npx vitest run tests/sceneAssets.test.ts
npx tsx scripts/validate-scene-assets.ts
git diff --check
```

Expected: tests PASS；腳本印出 `✓ 場景素材通過`；diff check 無輸出。

Controller 必須將玩家 idle-down frame 與背景中至少兩名成人 NPC 以相同顯示高度並排截圖，檢查比例、像素密度、輪廓、色調與暖色光影。Pai 明確確認畫風通過後才能 commit。

- [ ] **Step 7: Commit**

```bash
git add src/assets/store-background.png src/assets/player-visitor.png scripts/validate-scene-assets.ts tests/sceneAssets.test.ts
git commit -m "feat: add approved bookstore scene artwork"
```

---

### Task 16: 圖片背景、透明碰撞與響應式鏡頭

**Files:**
- Create: `src/game/camera.ts`
- Create: `tests/camera.test.ts`
- Modify: `src/game/BootScene.ts`
- Modify: `src/game/StoreScene.ts`
- Modify: `src/game/createGame.ts`
- Modify: `package.json`
- Delete: `scripts/generate-placeholder-assets.ts`
- Delete: `scripts/generate-map.ts`
- Delete: `src/game/mapParser.ts`
- Delete: `tests/mapParser.test.ts`

**Interfaces:**
- Consumes: Task 13 的 `WORLD_SIZE`、`PLAYER_SPAWN`、`COLLISION_RECTS`、`INTERACTION_ZONES`；Task 15 的兩張 PNG。
- Produces: `calculateCameraZoom(viewportWidth, viewportHeight, isTouch): number`；可從入口移動、受家具／NPC 阻擋、resize 不重置狀態的圖片場景。

- [ ] **Step 1: 寫出鏡頭 cover 與手機放大的失敗測試**

新增 `tests/camera.test.ts`：

```ts
import { describe, expect, it } from 'vitest'
import { calculateCameraZoom } from '../src/game/camera'

describe('calculateCameraZoom', () => {
  it('桌機採 cover zoom，畫面不露出世界外', () => {
    expect(calculateCameraZoom(1440, 900, false)).toBeCloseTo(1440 / 1572)
  })

  it('小桌機不把玩家縮得低於 0.65', () => {
    expect(calculateCameraZoom(640, 480, false)).toBe(0.65)
  })

  it('手機至少使用 1 倍局部跟隨', () => {
    expect(calculateCameraZoom(390, 844, true)).toBe(1)
    expect(calculateCameraZoom(844, 390, true)).toBe(1)
  })

  it('較大觸控 viewport 仍使用 cover zoom', () => {
    expect(calculateCameraZoom(1800, 1200, true)).toBeCloseTo(1200 / 1001)
  })
})
```

- [ ] **Step 2: 執行測試確認 RED**

Run:

```bash
npx vitest run tests/camera.test.ts
```

Expected: FAIL with `Cannot find module '../src/game/camera'`。

- [ ] **Step 3: 實作純鏡頭計算**

新增 `src/game/camera.ts`：

```ts
import { WORLD_SIZE } from './sceneLayout'

export function calculateCameraZoom(
  viewportWidth: number,
  viewportHeight: number,
  isTouch: boolean,
): number {
  if (
    !Number.isFinite(viewportWidth)
    || !Number.isFinite(viewportHeight)
    || viewportWidth <= 0
    || viewportHeight <= 0
  ) return 1

  const cover = Math.max(
    viewportWidth / WORLD_SIZE.width,
    viewportHeight / WORLD_SIZE.height,
  )

  return isTouch ? Math.max(1, cover) : Math.max(0.65, cover)
}
```

- [ ] **Step 4: 將 BootScene 切換至正式背景與 sprite sheet**

以以下內容取代 `src/game/BootScene.ts`：

```ts
import Phaser from 'phaser'

const backgroundUrl = new URL('../assets/store-background.png', import.meta.url).href
const playerUrl = new URL('../assets/player-visitor.png', import.meta.url).href

export class BootScene extends Phaser.Scene {
  private assetFailed = false

  constructor() {
    super('boot')
  }

  preload() {
    const { width, height } = this.scale
    const barBg = this.add.rectangle(width / 2, height / 2, 204, 16, 0x444444)
    const bar = this.add
      .rectangle(width / 2 - 100, height / 2, 0, 12, 0xd8c9a3)
      .setOrigin(0, 0.5)

    this.load.on('progress', (value: number) => {
      bar.width = 200 * value
    })
    this.load.once('loaderror', () => {
      this.assetFailed = true
    })
    this.load.once('complete', () => {
      bar.destroy()
      barBg.destroy()
    })

    this.load.image('store-background', backgroundUrl)
    this.load.spritesheet('player', playerUrl, {
      frameWidth: 256,
      frameHeight: 256,
    })
  }

  create() {
    if (this.assetFailed) {
      this.add
        .text(
          this.scale.width / 2,
          this.scale.height / 2,
          '場景素材載入失敗，請重新整理再試一次。',
          { color: '#f5efe0', fontSize: '18px', align: 'center' },
        )
        .setOrigin(0.5)
      return
    }

    this.scene.start('store')
  }
}
```

- [ ] **Step 5: 將 Phaser canvas 改為 viewport resize 模式**

以以下內容取代 `src/game/createGame.ts`：

```ts
import Phaser from 'phaser'
import { BootScene } from './BootScene'
import { StoreScene } from './StoreScene'

export function createGame(parent: HTMLElement): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: '#090909',
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    physics: { default: 'arcade' },
    scene: [BootScene, StoreScene],
  })
}
```

- [ ] **Step 6: 以背景、靜態矩形與新 layout 取代 tilemap**

以以下內容取代 `src/game/StoreScene.ts`；Task 17 會在此基礎加入動畫，Task 18 會將暫時提示換成正式 marker：

```ts
import Phaser from 'phaser'
import { bridge } from '../bridge/EventBridge'
import { calculateCameraZoom } from './camera'
import { touchInput } from './inputState'
import { computeVelocity } from './movement'
import {
  COLLISION_RECTS,
  INTERACTION_ZONES,
  PLAYER_SPAWN,
  WORLD_SIZE,
} from './sceneLayout'
import { findNearestZone, type Zone } from './zones'

const SPEED = 160
// Pai approved 0.72 from the true-size scene comparison.
const PLAYER_SCALE = 0.72

export class StoreScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private currentZone: Zone | null = null
  private hint!: Phaser.GameObjects.Text
  private uiOpen = false
  private bridgeUnsubscribers: (() => void)[] = []

  constructor() {
    super('store')
  }

  create() {
    this.removeListeners()
    this.currentZone = null
    this.uiOpen = false

    this.add.image(0, 0, 'store-background').setOrigin(0).setDepth(0)
    this.physics.world.setBounds(0, 0, WORLD_SIZE.width, WORLD_SIZE.height)

    const obstacles = this.physics.add.staticGroup()
    for (const rect of COLLISION_RECTS) {
      const obstacle = this.add
        .rectangle(
          rect.x + rect.width / 2,
          rect.y + rect.height / 2,
          rect.width,
          rect.height,
          0x000000,
          0,
        )
        .setVisible(false)
      this.physics.add.existing(obstacle, true)
      obstacles.add(obstacle)
    }

    this.player = this.physics.add
      .sprite(PLAYER_SPAWN.x, PLAYER_SPAWN.y, 'player', 0)
      .setScale(PLAYER_SCALE)
      .setDepth(10)
      .setCollideWorldBounds(true)

    const body = this.player.body as Phaser.Physics.Arcade.Body
    body.setSize(64, 40)
    body.setOffset(96, 196)
    this.physics.add.collider(this.player, obstacles)

    this.cameras.main
      .startFollow(this.player, true, 0.12, 0.12)
      .setBounds(0, 0, WORLD_SIZE.width, WORLD_SIZE.height)
    this.resizeCamera()
    this.scale.on('resize', this.resizeCamera, this)

    this.hint = this.add
      .text(0, 0, '按 E 互動', {
        fontSize: '14px',
        color: '#4b5563',
        backgroundColor: '#ffffff',
        padding: { x: 8, y: 4 },
      })
      .setOrigin(0.5, 1)
      .setDepth(20)
      .setVisible(false)
      .setInteractive({ useHandCursor: true })
    this.hint.on('pointerdown', this.triggerInteract, this)

    this.cursors = this.input.keyboard!.createCursorKeys()
    this.input.keyboard!.on('keydown-E', this.triggerInteract, this)
    this.bridgeUnsubscribers = [
      bridge.on('ui:opened', () => {
        this.uiOpen = true
        touchInput.x = 0
        touchInput.y = 0
      }),
      bridge.on('ui:closed', () => {
        this.uiOpen = false
      }),
    ]

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.removeListeners, this)
    this.events.once(Phaser.Scenes.Events.DESTROY, this.removeListeners, this)
  }

  private resizeCamera() {
    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0
    this.cameras.main.setZoom(
      calculateCameraZoom(this.scale.width, this.scale.height, isTouch),
    )
  }

  private removeListeners() {
    this.bridgeUnsubscribers.forEach((unsubscribe) => unsubscribe())
    this.bridgeUnsubscribers = []
    this.scale.off('resize', this.resizeCamera, this)
    this.input.keyboard?.off('keydown-E', this.triggerInteract, this)
    touchInput.x = 0
    touchInput.y = 0
  }

  private triggerInteract() {
    if (!this.currentZone || this.uiOpen) return
    bridge.emit('interact', {
      id: this.currentZone.id,
      type: this.currentZone.type,
    })
  }

  update() {
    if (this.uiOpen) {
      this.player.setVelocity(0, 0)
      return
    }

    const direction = {
      x: (this.cursors.left.isDown ? -1 : 0)
        + (this.cursors.right.isDown ? 1 : 0)
        + touchInput.x,
      y: (this.cursors.up.isDown ? -1 : 0)
        + (this.cursors.down.isDown ? 1 : 0)
        + touchInput.y,
    }
    const velocity = computeVelocity(direction, SPEED)
    this.player.setVelocity(velocity.x, velocity.y)

    const body = this.player.body as Phaser.Physics.Arcade.Body
    const zone = findNearestZone(
      body.center.x,
      body.center.y,
      INTERACTION_ZONES,
    )

    if (zone?.id === this.currentZone?.id) return
    if (this.currentZone) {
      bridge.emit('zone:exit', { id: this.currentZone.id })
    }
    if (zone) {
      bridge.emit('zone:enter', { id: zone.id, type: zone.type })
      this.hint.setPosition(zone.anchorX, zone.anchorY).setVisible(true)
    } else {
      this.hint.setVisible(false)
    }
    this.currentZone = zone
  }
}
```

- [ ] **Step 7: 切換 build 資產腳本並移除 placeholder／tilemap**

將 `package.json` 的 `assets` 改為：

```json
"assets": "tsx scripts/validate-scene-assets.ts"
```

刪除以下檔案：

```text
scripts/generate-placeholder-assets.ts
scripts/generate-map.ts
src/game/mapParser.ts
tests/mapParser.test.ts
```

執行：

```bash
rg "generate-map|generate-placeholder-assets|mapParser|tilemapTiledJSON|tileset" src scripts tests package.json
```

Expected: 無輸出。

- [ ] **Step 8: 執行自動與瀏覽器 smoke 驗證**

Run:

```bash
npx vitest run tests/camera.test.ts tests/sceneLayout.test.ts tests/zones.test.ts
npm run build
npm run test
npx vue-tsc --noEmit --pretty false
```

Expected: 全部 exit 0；build 不再產生 tilemap／placeholder。

啟動 `npm run dev` 後，在桌機與 390×844 viewport 檢查：

```text
背景為核准書店圖片；出生點在右側入口；鏡頭不露出世界外；
角色可沿通道移動；牆壁、中央桌、下方桌椅、左右書櫃、櫃檯與靜態 NPC 均不可穿越；
resize／旋轉不重置玩家位置。
```

- [ ] **Step 9: Commit**

```bash
git add package.json src/game/BootScene.ts src/game/StoreScene.ts src/game/createGame.ts src/game/camera.ts tests/camera.test.ts
git add -u scripts/generate-placeholder-assets.ts scripts/generate-map.ts src/game/mapParser.ts tests/mapParser.test.ts
git commit -m "feat: render bookstore image scene with collisions"
```

---

### Task 17: 四方向玩家待機與走路動畫

**Files:**
- Create: `src/game/playerAnimation.ts`
- Create: `tests/playerAnimation.test.ts`
- Modify: `src/game/StoreScene.ts`

**Interfaces:**
- Consumes: Task 15 的 4×4 frame 順序；Task 16 的 `player` 與 velocity。
- Produces: `facingFromVelocity(vx, vy, previous): Facing`、`idleFrame(facing): number`、`walkAnimation(facing): string`。

- [ ] **Step 1: 寫出方向、frame 與穩定待機的失敗測試**

新增 `tests/playerAnimation.test.ts`：

```ts
import { describe, expect, it } from 'vitest'
import {
  facingFromVelocity,
  idleFrame,
  walkAnimation,
} from '../src/game/playerAnimation'

describe('playerAnimation', () => {
  it('以主軸速度決定四方向', () => {
    expect(facingFromVelocity(80, 20, 'down')).toBe('right')
    expect(facingFromVelocity(-80, 20, 'down')).toBe('left')
    expect(facingFromVelocity(20, -80, 'down')).toBe('up')
    expect(facingFromVelocity(20, 80, 'up')).toBe('down')
  })

  it('停止時保留上一個面向', () => {
    expect(facingFromVelocity(0, 0, 'left')).toBe('left')
  })

  it('四方向對應每列第一格與 walk key', () => {
    expect(idleFrame('down')).toBe(0)
    expect(idleFrame('left')).toBe(4)
    expect(idleFrame('right')).toBe(8)
    expect(idleFrame('up')).toBe(12)
    expect(walkAnimation('up')).toBe('walk-up')
  })
})
```

- [ ] **Step 2: 執行測試確認 RED**

Run:

```bash
npx vitest run tests/playerAnimation.test.ts
```

Expected: FAIL with `Cannot find module '../src/game/playerAnimation'`。

- [ ] **Step 3: 實作 frame 契約**

新增 `src/game/playerAnimation.ts`：

```ts
export type Facing = 'down' | 'left' | 'right' | 'up'

const ROW_START: Record<Facing, number> = {
  down: 0,
  left: 4,
  right: 8,
  up: 12,
}

export function facingFromVelocity(
  vx: number,
  vy: number,
  previous: Facing,
): Facing {
  if (vx === 0 && vy === 0) return previous
  if (Math.abs(vx) > Math.abs(vy)) return vx < 0 ? 'left' : 'right'
  return vy < 0 ? 'up' : 'down'
}

export function idleFrame(facing: Facing): number {
  return ROW_START[facing]
}

export function walkAnimation(facing: Facing): string {
  return `walk-${facing}`
}

export function walkFrames(facing: Facing): number[] {
  const start = ROW_START[facing]
  return [start + 1, start + 2, start + 3, start + 2]
}
```

- [ ] **Step 4: 在 StoreScene 註冊並驅動動畫**

在 `src/game/StoreScene.ts` 加入 import：

```ts
import {
  facingFromVelocity,
  idleFrame,
  walkAnimation,
  walkFrames,
  type Facing,
} from './playerAnimation'
```

加入 field：

```ts
private facing: Facing = 'down'
```

在建立玩家後呼叫：

```ts
this.createPlayerAnimations()
this.player.setFrame(idleFrame(this.facing))
```

加入兩個 method：

```ts
private createPlayerAnimations() {
  for (const facing of ['down', 'left', 'right', 'up'] as const) {
    const key = walkAnimation(facing)
    if (this.anims.exists(key)) continue
    this.anims.create({
      key,
      frames: walkFrames(facing).map((frame) => ({ key: 'player', frame })),
      frameRate: 8,
      repeat: -1,
    })
  }
}

private updatePlayerAnimation(vx: number, vy: number) {
  this.facing = facingFromVelocity(vx, vy, this.facing)
  if (vx === 0 && vy === 0) {
    this.player.anims.stop()
    this.player.setFrame(idleFrame(this.facing))
    return
  }
  this.player.anims.play(walkAnimation(this.facing), true)
}
```

在 `uiOpen` 分支改為：

```ts
this.player.setVelocity(0, 0)
this.updatePlayerAnimation(0, 0)
return
```

在正常 update 設定 velocity 後加入：

```ts
this.updatePlayerAnimation(velocity.x, velocity.y)
```

- [ ] **Step 5: 執行測試、typecheck 與四方向視覺驗收**

Run:

```bash
npx vitest run tests/playerAnimation.test.ts
npm run test
npx vue-tsc --noEmit --pretty false
```

Expected: 全部 exit 0。

瀏覽器依序按右、左、上、下並放開，確認：

```text
每個方向播放正確列；腳底不跳動；停止後保持最後面向的 idle；
開啟任一 overlay 時立即停止，不滑步；玩家顯示比例與背景 NPC 一致。
```

- [ ] **Step 6: Commit**

```bash
git add src/game/playerAnimation.ts src/game/StoreScene.ts tests/playerAnimation.test.ts
git commit -m "feat: animate bookstore visitor in four directions"
```

---

### Task 18: 白底灰字互動標記與 CMS 動態名稱

**Files:**
- Create: `src/game/interactionLabels.ts`
- Create: `src/game/InteractionMarker.ts`
- Create: `tests/interactionLabels.test.ts`
- Modify: `src/game/StoreScene.ts`
- Modify: `src/game/createGame.ts`
- Modify: `src/bridge/EventBridge.ts`
- Modify: `src/App.vue`
- Modify: `tests/EventBridge.test.ts`
- Modify: `tests/App.test.ts`

**Interfaces:**
- Consumes: `ContentBundle`、`INTERACTION_ZONES`、Task 17 的 StoreScene。
- Produces: `InteractionLabels = Readonly<Record<string, string>>`、`buildInteractionLabels(content)`、`formatMarkerLabel(title)`、`InteractionMarker.setActive(active)`、bridge event `interact:request`。

- [ ] **Step 1: 寫出名稱對照、長標題與 action request 的失敗測試**

新增 `tests/interactionLabels.test.ts`：

```ts
import { describe, expect, it } from 'vitest'
import { ContentBundleSchema } from '../src/content/schema'
import {
  buildInteractionLabels,
  formatMarkerLabel,
} from '../src/game/interactionLabels'
import sample from '../scripts/sample-content.json'

const content = ContentBundleSchema.parse(sample)

describe('interactionLabels', () => {
  it('以 CMS title 建立五商品、書單與固定營業資訊名稱', () => {
    const labels = buildInteractionLabels(content)
    expect(labels['showcase-1']).toBe(content.showcases[0].title)
    expect(labels['showcase-5']).toBe('獨立刊物選集')
    expect(labels['shelf-1']).toBe(content.shelves[0].title)
    expect(labels['info-1']).toBe('營業資訊')
  })

  it('十一至二十字分成兩行', () => {
    expect(formatMarkerLabel('一二三四五六七八九十一二')).toBe(
      '一二三四五六七八九十\n一二',
    )
  })

  it('超過二十字時第二行以省略號結束', () => {
    expect(formatMarkerLabel('一二三四五六七八九十一二三四五六七八九十二一')).toBe(
      '一二三四五六七八九十\n一二三四五六七八九…',
    )
  })
})
```

在 `tests/EventBridge.test.ts` 加入：

```ts
it('interact:request 可在沒有 payload 時觸發', () => {
  const b = new EventBridge()
  const fn = vi.fn()
  b.on('interact:request', fn)
  b.emit('interact:request')
  expect(fn).toHaveBeenCalledOnce()
})
```

在 `tests/App.test.ts` 的第一個測試中，於 `createGame` assertion 後加入：

```ts
expect(mocks.createGame).toHaveBeenCalledWith(
  expect.any(HTMLElement),
  expect.objectContaining({
    'showcase-1': '手工蠟燭系列',
    'shelf-1': '店主精選',
    'info-1': '營業資訊',
  }),
)
```

- [ ] **Step 2: 執行測試確認 RED**

Run:

```bash
npx vitest run tests/interactionLabels.test.ts tests/EventBridge.test.ts tests/App.test.ts
```

Expected: FAIL，因 label helpers 與 `interact:request` 尚不存在，且 `createGame` 仍只接收 parent。

- [ ] **Step 3: 實作內容名稱對照與最多兩行格式**

新增 `src/game/interactionLabels.ts`：

```ts
import type { ContentBundle } from '../content/schema'

export type InteractionLabels = Readonly<Record<string, string>>

export function buildInteractionLabels(
  content: ContentBundle,
): InteractionLabels {
  return Object.freeze({
    ...Object.fromEntries(
      content.showcases.map((showcase) => [showcase.id, showcase.title]),
    ),
    ...Object.fromEntries(
      content.shelves.map((shelf) => [shelf.id, shelf.title]),
    ),
    'info-1': '營業資訊',
  })
}

export function formatMarkerLabel(title: string): string {
  const characters = Array.from(title.trim())
  if (characters.length <= 10) return characters.join('')
  const first = characters.slice(0, 10).join('')
  if (characters.length <= 20) {
    return `${first}\n${characters.slice(10).join('')}`
  }
  return `${first}\n${characters.slice(10, 19).join('')}…`
}
```

- [ ] **Step 4: 建立白底灰字 marker 元件**

新增 `src/game/InteractionMarker.ts`：

```ts
import Phaser from 'phaser'
import { formatMarkerLabel } from './interactionLabels'

export class InteractionMarker {
  private readonly container: Phaser.GameObjects.Container
  private readonly glow: Phaser.GameObjects.Arc
  private readonly label: Phaser.GameObjects.Text
  private active = false

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    title: string,
    onInteract: () => void,
  ) {
    const shadow = scene.add.circle(0, 3, 21, 0x000000, 0.28)
    this.glow = scene.add.circle(0, 0, 27, 0xffffff, 0.28).setVisible(false)
    const bubble = scene.add
      .circle(0, 0, 21, 0xffffff)
      .setStrokeStyle(2, 0x9ca3af)
    const bang = scene.add
      .text(0, -1, '!', {
        color: '#616161',
        fontFamily: 'Arial, sans-serif',
        fontSize: '28px',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
    this.label = scene.add
      .text(31, 0, formatMarkerLabel(title), {
        color: '#4b5563',
        backgroundColor: '#ffffff',
        fontFamily: 'Arial, sans-serif',
        fontSize: '16px',
        lineSpacing: 2,
        padding: { x: 10, y: 7 },
      })
      .setOrigin(0, 0.5)
      .setVisible(false)

    this.container = scene.add
      .container(x, y, [shadow, this.glow, bubble, bang, this.label])
      .setDepth(30)
      .setSize(240, 56)
      .setInteractive(
        new Phaser.Geom.Rectangle(-24, -28, 240, 56),
        Phaser.Geom.Rectangle.Contains,
      )
      .on('pointerdown', () => {
        if (this.active) onInteract()
      })
  }

  setActive(active: boolean) {
    this.active = active
    this.glow.setVisible(active)
    this.label.setVisible(active)
    this.container.setScale(active ? 1.08 : 1)
  }

  destroy() {
    this.container.destroy(true)
  }
}
```

- [ ] **Step 5: 擴充 EventBridge 並把名稱注入 StoreScene**

在 `src/bridge/EventBridge.ts` 的 `BridgeEvents` 加入：

```ts
'interact:request': undefined
```

以以下內容取代 `src/game/createGame.ts`：

```ts
import Phaser from 'phaser'
import { BootScene } from './BootScene'
import type { InteractionLabels } from './interactionLabels'
import { StoreScene } from './StoreScene'

export function createGame(
  parent: HTMLElement,
  labels: InteractionLabels,
): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: '#090909',
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    physics: { default: 'arcade' },
    scene: [BootScene, new StoreScene(labels)],
  })
}
```

在 `src/game/StoreScene.ts`：

1. 加入 imports：

```ts
import { InteractionMarker } from './InteractionMarker'
import type { InteractionLabels } from './interactionLabels'
```

2. 以 marker map 取代 `hint` field：

```ts
private markers = new Map<string, InteractionMarker>()
```

3. 將 constructor 改為：

```ts
constructor(private readonly labels: InteractionLabels) {
  super('store')
}
```

4. 移除 `hint` 建立區塊，改為：

```ts
for (const zone of INTERACTION_ZONES) {
  const label = this.labels[zone.id]
  if (!label) throw new Error(`互動點 ${zone.id} 缺少顯示名稱`)
  this.markers.set(
    zone.id,
    new InteractionMarker(
      this,
      zone.anchorX,
      zone.anchorY,
      label,
      () => {
        if (this.currentZone?.id === zone.id) this.triggerInteract()
      },
    ),
  )
}
```

5. 在 `bridgeUnsubscribers` 加入：

```ts
bridge.on('interact:request', () => this.triggerInteract()),
```

6. 將 zone 切換區塊改為：

```ts
if (zone?.id === this.currentZone?.id) return
if (this.currentZone) {
  this.markers.get(this.currentZone.id)?.setActive(false)
  bridge.emit('zone:exit', { id: this.currentZone.id })
}
if (zone) {
  this.markers.get(zone.id)?.setActive(true)
  bridge.emit('zone:enter', { id: zone.id, type: zone.type })
}
this.currentZone = zone
```

7. 在 `removeListeners()` 加入：

```ts
for (const marker of this.markers.values()) marker.destroy()
this.markers.clear()
```

- [ ] **Step 6: 由 App 建立並傳入 CMS label map**

在 `src/App.vue` script 加入：

```ts
import { buildInteractionLabels } from './game/interactionLabels'
```

將：

```ts
game = createGame(container.value)
```

改為：

```ts
game = createGame(container.value, buildInteractionLabels(content.value))
```

- [ ] **Step 7: 執行自動與瀏覽器 marker 驗證**

Run:

```bash
npx vitest run tests/interactionLabels.test.ts tests/EventBridge.test.ts tests/App.test.ts
npm run test
npx vue-tsc --noEmit --pretty false
```

Expected: 全部 exit 0。

瀏覽器確認：

```text
七個驚嘆號遠處皆可見；背景白、驚嘆號中深灰、有細灰框與陰影；
靠近只啟用最近一個，顯示 CMS 標題；離開即收合；
未靠近時滑鼠點擊無效，靠近後可開啟正確內容；
商品最右至最左依序為 showcase-1 至 showcase-5。
```

- [ ] **Step 8: Commit**

```bash
git add src/game/interactionLabels.ts src/game/InteractionMarker.ts src/game/StoreScene.ts src/game/createGame.ts src/bridge/EventBridge.ts src/App.vue tests/interactionLabels.test.ts tests/EventBridge.test.ts tests/App.test.ts
git commit -m "feat: add dynamic bookstore interaction markers"
```

---

### Task 19: 手機右側互動鍵與雙指觸控

**Files:**
- Modify: `src/ui/TouchControls.vue`
- Modify: `src/App.vue`
- Create: `tests/TouchControls.test.ts`
- Modify: `tests/App.test.ts`

**Interfaces:**
- Consumes: `zone:enter`、`zone:exit`、`interact:request`、`ui:opened`／`ui:closed`。
- Produces: `<TouchControls :can-interact :disabled @interact>`；左側 joystick 維持觸控 identifier，右側 button 只在有效 zone 啟用。

- [ ] **Step 1: 寫出按鈕狀態、事件與多指隔離的失敗測試**

新增 `tests/TouchControls.test.ts`：

```ts
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { touchInput } from '../src/game/inputState'
import TouchControls from '../src/ui/TouchControls.vue'

function touch(identifier: number, clientX: number, clientY: number): Touch {
  return { identifier, clientX, clientY } as Touch
}

function dispatchTouch(
  element: Element,
  type: string,
  touches: Touch[],
  changedTouches: Touch[] = touches,
) {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperties(event, {
    touches: { value: touches },
    changedTouches: { value: changedTouches },
  })
  element.dispatchEvent(event)
}

afterEach(() => {
  touchInput.x = 0
  touchInput.y = 0
})

describe('TouchControls', () => {
  it('區域外停用，區域內啟用並 emit interact', async () => {
    const wrapper = mount(TouchControls, {
      props: { canInteract: false, disabled: false },
    })
    const button = wrapper.get('[data-testid="interact-button"]')
    expect(button.attributes('disabled')).toBeDefined()

    await wrapper.setProps({ canInteract: true })
    expect(button.attributes('disabled')).toBeUndefined()
    await button.trigger('click')
    expect(wrapper.emitted('interact')).toHaveLength(1)
  })

  it('第二根手指不取代 joystick 的 identifier', () => {
    const wrapper = mount(TouchControls, {
      props: { canInteract: true, disabled: false },
    })
    const joystick = wrapper.get('[data-testid="joystick"]').element
    const left = touch(1, 100, 100)
    const right = touch(2, 350, 700)

    dispatchTouch(joystick, 'touchstart', [left], [left])
    dispatchTouch(
      joystick,
      'touchmove',
      [touch(1, 140, 100), right],
      [touch(1, 140, 100)],
    )

    expect(touchInput.x).toBeCloseTo(1)
    expect(touchInput.y).toBeCloseTo(0)
  })

  it('overlay 停用控制時立即清除 joystick 向量', async () => {
    const wrapper = mount(TouchControls, {
      props: { canInteract: true, disabled: false },
    })
    touchInput.x = 1
    await wrapper.setProps({ disabled: true })
    await nextTick()
    expect(touchInput).toEqual({ x: 0, y: 0 })
  })
})
```

- [ ] **Step 2: 執行測試確認 RED**

Run:

```bash
npx vitest run tests/TouchControls.test.ts
```

Expected: FAIL，因 props、右側按鈕與 `data-testid="joystick"` 尚不存在。

- [ ] **Step 3: 實作可區分觸控 identifier 的左右控制**

以以下內容取代 `src/ui/TouchControls.vue`：

```vue
<script setup lang="ts">
import { onUnmounted, ref, watch } from 'vue'
import { touchInput } from '../game/inputState'
import { joystickVector } from '../game/joystick'

const props = defineProps<{
  canInteract: boolean
  disabled: boolean
}>()
const emit = defineEmits<{ interact: [] }>()

const RADIUS = 40
const touchId = ref<number | null>(null)
const origin = ref({ x: 0, y: 0 })
const knob = ref({ x: 0, y: 0 })

function findTouch(list: TouchList, identifier: number): Touch | null {
  for (let index = 0; index < list.length; index++) {
    const item = list[index]
    if (item?.identifier === identifier) return item
  }
  return null
}

function resetJoystick() {
  touchId.value = null
  knob.value = { x: 0, y: 0 }
  touchInput.x = 0
  touchInput.y = 0
}

function onStart(event: TouchEvent) {
  if (props.disabled || touchId.value !== null) return
  const touch = event.changedTouches[0]
  if (!touch) return
  touchId.value = touch.identifier
  origin.value = { x: touch.clientX, y: touch.clientY }
}

function onMove(event: TouchEvent) {
  if (props.disabled || touchId.value === null) return
  const touch = findTouch(event.touches, touchId.value)
  if (!touch) return
  const vector = joystickVector(
    origin.value,
    { x: touch.clientX, y: touch.clientY },
    RADIUS,
  )
  knob.value = { x: vector.x * RADIUS, y: vector.y * RADIUS }
  touchInput.x = vector.x
  touchInput.y = vector.y
}

function onEnd(event: TouchEvent) {
  if (touchId.value === null) return
  if (findTouch(event.changedTouches, touchId.value)) resetJoystick()
}

function interact() {
  if (props.canInteract && !props.disabled) emit('interact')
}

watch(() => props.disabled, (disabled) => {
  if (disabled) resetJoystick()
})
onUnmounted(resetJoystick)
</script>

<template>
  <div
    class="joystick"
    data-testid="joystick"
    :aria-disabled="disabled"
    @touchstart.prevent="onStart"
    @touchmove.prevent="onMove"
    @touchend.prevent="onEnd"
    @touchcancel.prevent="onEnd"
  >
    <div class="base">
      <div
        class="knob"
        :style="{ transform: `translate(${knob.x}px, ${knob.y}px)` }"
      />
    </div>
  </div>

  <button
    type="button"
    class="interact"
    data-testid="interact-button"
    :class="{ ready: canInteract && !disabled }"
    :disabled="!canInteract || disabled"
    aria-label="點擊互動"
    @click="interact"
  >
    點擊
  </button>
</template>

<style scoped>
.joystick {
  position: fixed;
  left: 24px;
  bottom: max(24px, env(safe-area-inset-bottom));
  z-index: 50;
  touch-action: none;
}
.base {
  width: 96px;
  height: 96px;
  border: 2px solid rgba(255, 255, 255, 0.4);
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
}
.knob {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.6);
}
.interact {
  position: fixed;
  right: 24px;
  bottom: max(28px, env(safe-area-inset-bottom));
  z-index: 50;
  width: 76px;
  height: 76px;
  border: 2px solid rgba(255, 255, 255, 0.35);
  border-radius: 50%;
  background: rgba(75, 85, 99, 0.58);
  color: rgba(255, 255, 255, 0.58);
  font-size: 16px;
  font-weight: 700;
  transition: transform 120ms ease, box-shadow 120ms ease, background 120ms ease;
}
.interact.ready {
  border-color: #fff7d6;
  background: #d8b866;
  color: #2f2818;
  box-shadow: 0 0 0 5px rgba(255, 247, 214, 0.2), 0 0 22px rgba(216, 184, 102, 0.8);
  transform: scale(1.06);
}
.interact:disabled { cursor: default; }
</style>
```

- [ ] **Step 4: 讓 App 追蹤目前 zone 並驅動右側按鈕**

以以下內容取代 `src/App.vue` 的 `<script setup>`：

```vue
<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { bridge, type BridgeEvents } from './bridge/EventBridge'
import { loadContent } from './content/loadContent'
import type { ContentBundle, Shelf, Showcase } from './content/schema'
import { createGame } from './game/createGame'
import { buildInteractionLabels } from './game/interactionLabels'
import BookViewer from './ui/BookViewer.vue'
import ShelfPanel from './ui/ShelfPanel.vue'
import StoreInfoCard from './ui/StoreInfoCard.vue'
import TouchControls from './ui/TouchControls.vue'

const container = ref<HTMLElement>()
const content = ref<ContentBundle | null>(null)
const loadError = ref(false)
const activeShowcase = ref<Showcase | null>(null)
const activeShelf = ref<Shelf | null>(null)
const showInfo = ref(false)
const currentZone = ref<BridgeEvents['zone:enter'] | null>(null)
const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0
const uiOpen = computed(
  () => Boolean(activeShowcase.value || activeShelf.value || showInfo.value),
)

let game: ReturnType<typeof createGame> | null = null
let bridgeUnsubscribers: (() => void)[] = []
let isUnmounted = false

function openInteraction({ id, type }: BridgeEvents['interact']) {
  const currentContent = content.value
  if (!currentContent) return

  if (type === 'showcase') {
    activeShowcase.value =
      currentContent.showcases.find((showcase) => showcase.id === id) ?? null
  } else if (type === 'shelf') {
    activeShelf.value =
      currentContent.shelves.find((shelf) => shelf.id === id) ?? null
  } else if (type === 'info') {
    showInfo.value = true
  }

  if (uiOpen.value) bridge.emit('ui:opened')
}

onMounted(async () => {
  try {
    content.value = await loadContent()
  } catch {
    if (!isUnmounted) loadError.value = true
    return
  }

  if (isUnmounted || !container.value) return
  bridgeUnsubscribers = [
    bridge.on('interact', openInteraction),
    bridge.on('zone:enter', (zone) => {
      currentZone.value = zone
    }),
    bridge.on('zone:exit', ({ id }) => {
      if (currentZone.value?.id === id) currentZone.value = null
    }),
  ]
  game = createGame(
    container.value,
    buildInteractionLabels(content.value),
  )
})

onUnmounted(() => {
  isUnmounted = true
  bridgeUnsubscribers.forEach((unsubscribe) => unsubscribe())
  bridgeUnsubscribers = []
  game?.destroy(true)
})

function requestInteract() {
  if (currentZone.value && !uiOpen.value) bridge.emit('interact:request')
}

function closeAll() {
  activeShowcase.value = null
  activeShelf.value = null
  showInfo.value = false
  bridge.emit('ui:closed')
}
</script>
```

將 template 的 TouchControls 改為：

```vue
<TouchControls
  v-if="isTouch"
  :can-interact="Boolean(currentZone)"
  :disabled="uiOpen"
  @interact="requestInteract"
/>
```

- [ ] **Step 5: 更新 App 測試的 touch props 與 bridge cleanup**

在 `tests/App.test.ts` 增加一個 cleanup 測試：

```ts
it('unmount 後忽略 zone 與 interact 事件', async () => {
  mocks.loadContent.mockResolvedValue(content)
  const wrapper = await mountApp()
  wrapper.unmount()

  bridge.emit('zone:enter', { id: 'showcase-1', type: 'showcase' })
  bridge.emit('interact', { id: 'showcase-1', type: 'showcase' })
  await flushPromises()

  expect(wrapper.find('[data-testid="book-viewer"]').exists()).toBe(false)
})
```

- [ ] **Step 6: 執行 focused、全套與手機元件驗證**

Run:

```bash
npx vitest run tests/TouchControls.test.ts tests/App.test.ts tests/EventBridge.test.ts
npm run test
npx vue-tsc --noEmit --pretty false
```

Expected: 全部 exit 0。

在觸控 viewport 檢查：

```text
左下搖桿與右下點擊鍵同時出現；區域外按鈕灰暗且 disabled；
進入 zone 後按鈕亮起；點擊開啟正確內容；overlay 開啟時左右控制均停用；
按住左側 joystick 的同時，以第二根手指按右側按鈕仍會觸發一次互動。
```

- [ ] **Step 7: Commit**

```bash
git add src/ui/TouchControls.vue src/App.vue tests/TouchControls.test.ts tests/App.test.ts
git commit -m "feat: add mobile interaction action control"
```

---

### Task 20: E2E、文件、效能與實體手機驗收

**Files:**
- Modify: `e2e/basic.spec.ts`
- Modify: `README.md`
- Read: `src/main.ts`

**Interfaces:**
- Consumes: Tasks 13–19 完成後的公開 UI、dev-only `window.__bridge`、正式背景與玩家。
- Produces: 桌機實際步行 E2E、手機按鈕 wiring E2E、旋轉檢查、更新文件及完整驗收證據。

- [ ] **Step 1: 先寫桌機實際步行與手機 action 的失敗 E2E**

將 `e2e/basic.spec.ts` 的 global 宣告擴充為：

```ts
declare global {
  interface Window {
    __bridge: {
      emit: (event: string, payload?: unknown) => void
      on: (event: string, handler: () => void) => () => void
    }
    __interactionRequests?: number
  }
}
```

加入以下 tests：

```ts
test('從入口實際走到最左商品並按 E 開啟 showcase-5', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('canvas')).toBeVisible({ timeout: 10_000 })

  await page.keyboard.down('ArrowRight')
  await page.waitForTimeout(2_800)
  await page.keyboard.up('ArrowRight')
  await page.keyboard.press('e')

  const viewer = page.getByTestId('book-viewer')
  await expect(viewer).toBeVisible()
  await expect(viewer).toContainText('獨立刊物選集')
})

test('手機 action 在 zone 外停用，zone 內送出 request', async ({ page, isMobile }) => {
  test.skip(!isMobile, '只在 mobile project 執行')
  await page.goto('/')
  await expect(page.locator('canvas')).toBeVisible({ timeout: 10_000 })

  const action = page.getByTestId('interact-button')
  await expect(action).toBeDisabled()

  await page.evaluate(() => {
    window.__interactionRequests = 0
    window.__bridge.on('interact:request', () => {
      window.__interactionRequests = (window.__interactionRequests ?? 0) + 1
    })
    window.__bridge.emit('zone:enter', {
      id: 'showcase-1',
      type: 'showcase',
    })
  })

  await expect(action).toBeEnabled()
  await action.click()
  await expect.poll(
    () => page.evaluate(() => window.__interactionRequests),
  ).toBe(1)

  await page.evaluate(() => {
    window.__bridge.emit('zone:exit', { id: 'showcase-1' })
  })
  await expect(action).toBeDisabled()
})

test('手機直橫旋轉後 canvas 與控制仍在 viewport 內', async ({ page, isMobile }) => {
  test.skip(!isMobile, '只在 mobile project 執行')
  await page.goto('/')
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.locator('canvas')).toBeVisible()
  await expect(page.getByTestId('joystick')).toBeInViewport()
  await expect(page.getByTestId('interact-button')).toBeInViewport()

  await page.setViewportSize({ width: 844, height: 390 })
  await expect(page.locator('canvas')).toBeVisible()
  await expect(page.getByTestId('joystick')).toBeInViewport()
  await expect(page.getByTestId('interact-button')).toBeInViewport()
})
```

- [ ] **Step 2: 執行 E2E 確認測試會抓到未完成或座標偏差**

Run:

```bash
npm run e2e
```

Expected: 若 Tasks 13–19 尚未完整接通，新增 tests FAIL；若只剩場景座標誤差，實際步行 test 會以 `book-viewer` 未出現明確失敗。

- [ ] **Step 3: 驗證既有 dev bridge 不進 production**

確認 `src/main.ts` 保持以下既有 dev-only guard，不修改 production 行為：

```ts
if (import.meta.env.DEV) {
  ;(window as unknown as { __bridge: typeof bridge }).__bridge = bridge
}
```

不得移除 `import.meta.env.DEV` 條件。執行 production build 後，用：

```bash
rg "__bridge" dist
```

Expected: 無輸出。

- [ ] **Step 4: 更新 README 的正式場景與控制說明**

在 `README.md` 加入以下章節：

```markdown
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
```

- [ ] **Step 5: 執行完整自動驗證**

Run:

```bash
npm run assets
npm run content
npm run validate
npm run test
npx vue-tsc --noEmit --pretty false
npm run build
npm run e2e
git diff --check
git status --short --branch
```

Expected:

```text
asset validator PASS；
sample content 與七個 ID validation PASS；
所有 Vitest tests PASS；
vue-tsc exit 0；
Vite production build exit 0；
Playwright desktop／mobile projects 全部 PASS；
git diff --check 無輸出；
git status 只列本 Task 預期檔案。
```

- [ ] **Step 6: 執行桌機與行動 viewport 視覺驗收**

以 production build 啟動 preview，逐一記錄截圖與 console：

```text
桌機：從入口實際走到 showcase-1..5、shelf-1、info-1；
桌機：確認遠處 marker、靠近 label、E、鄰近點擊、overlay freeze／resume；
390×844：確認跟隨鏡頭、左搖桿、右 action、白灰 marker、內容視窗；
844×390：確認旋轉後鏡頭、控制與內容視窗均在畫面內；
所有畫面：背景比例正確、不露出世界外、console 無 error／warning。
```

另外比較 `dist/assets`：背景輸出不得比來源 PNG 大；若 Vite 原樣輸出 1.9 MB PNG即接受，不在本 Task 新增影像轉碼 dependency。

- [ ] **Step 7: 在同一 Wi-Fi 啟動真機驗收 server**

Run:

```bash
npm run dev -- --host 0.0.0.0
```

在 iOS Safari 與 Android Chrome 各完成：

```text
1. 從左上入口用搖桿走到七個互動點。
2. 左手持續控制搖桿，右手在按鈕亮起時點擊，內容只開啟一次。
3. 五商品名稱依 CMS 顯示；中央桌顯示 Shelf.title；店員顯示營業資訊。
4. 商品可翻頁，關閉後玩家恢復；overlay 開啟期間背景不移動。
5. 直向轉橫向再轉回直向，玩家位置不重置，控制與內容不破版。
6. 玩家與背景 NPC 的比例、像素密度、輪廓、色調與光影一致。
```

兩種真機都通過後，把裝置／瀏覽器版本、六項結果與截圖路徑寫入 Task 20 report。任一項失敗，依實際重現結果派 fresh fixer；修正、重新測試與 commit 後再做 fresh re-review。

- [ ] **Step 8: Commit**

```bash
git add e2e/basic.spec.ts README.md
git commit -m "test: verify bookstore image scene interactions"
```

- [ ] **Step 9: Fresh task review 與 whole-branch gate**

Task 20 commit 後：

```text
1. 以 Task 13 base..Task 20 HEAD 產生 review package。
2. Fresh independent reviewer 逐條比對核准規格、Tasks 13–20 commits、測試與真機證據。
3. Critical／Important 必須由 fresh fixer 修正並 commit，再由 fresh reviewer re-review。
4. Review clean 後立即更新 progress.md 與 HANDOFF.md：Task 12 舊真機 gate 已被本次新場景驗收取代；Tasks 13–20 complete；記錄第一個未完成 Task、HEAD、tests、review 與 git status。
5. 再執行 feature branch 全範圍 review；通過後才使用 finishing-a-development-branch，詢問 Pai 要 merge、開 PR 或保留 branch。
```

---

## Plan Self-Review Checklist

- [x] Spec §§1–5：Task 15 提供正式背景／同畫風玩家；Task 16 提供世界、碰撞、出生與鏡頭；Task 17 提供四方向動畫。
- [x] Spec §§6–7：Task 13 固定七區與左右順序；Task 18 提供白底灰字 marker、最近 zone 與 CMS 名稱。
- [x] Spec §§8–9：Task 18 保持 EventBridge 單一通道；Task 19 提供右側按鈕、雙指操作與完整 cleanup。
- [x] Spec §§10–11：Task 14 提供五商品與缺少／重複／多餘 ID build failure；Task 16 提供素材載入錯誤。
- [x] Spec §§12–13：Tasks 13–19 提供 unit/component gates；Task 20 提供 E2E、production preview、iOS／Android 真機與視覺驗收。
- [x] `Zone.anchorX`／`anchorY`、`InteractionLabels`、`interact:request`、`buildInteractionLabels`、`calculateCameraZoom` 與動畫 key 在所有 Tasks 名稱一致。
- [x] Tasks 13–19 都有獨立 RED → GREEN → full verification → commit 邊界；Task 20 是新增 E2E／文件／真機 acceptance gate，允許新增 E2E 在既有功能正確時直接 PASS。
