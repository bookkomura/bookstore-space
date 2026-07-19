# 書店虛擬展示空間 第一階段 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立單人 2D 書店逛展網站——角色走動、展示櫃翻書、書櫃書單、實體店資訊，內容由 CMS 驅動。

**Architecture:** Phaser 3 負責場景（Tiled 地圖、角色移動、互動點偵測），Vue 3 負責內容 UI（翻書 overlay、書單、店資訊），兩層以單一 EventBridge 溝通。內容 build 時抓成 `public/content.json`，靜態部署 Cloudflare Pages，無自建後端。

**Tech Stack:** Vite 5 + Vue 3 + TypeScript 5 + Phaser 3.80 + Zod + Vitest + @vue/test-utils + Playwright + pngjs（佔位素材產生）+ tsx（跑 TS 腳本）

## Global Constraints

- 專案根目錄：`/Users/pai/projects/bookstore-space`（已 git init，spec 已 commit）
- 手機優先：所有 UI overlay 直式手機可完整操作；觸控裝置顯示虛擬搖桿
- UI 文案一律 zh-TW
- 互動點類型只有三種：`showcase`、`shelf`、`info`
- Tile 尺寸 32px；第一階段單一房間地圖 20×15 tiles
- 第一階段明確不做：多人連線、聊天、帳號、站內購買、自建後台、多房間
- 佔位素材（tileset/player/map）由腳本產生，之後換免費素材包時僅替換 `public/assets/` 檔案，格式不變
- 生成物不進 git：`public/assets/`、`public/content.json`、`dist/`、`node_modules/`
- `creatorLink` 為選填欄位——空值時 UI 不渲染該區塊
- 所有 zod schema 定義集中在 `src/content/schema.ts`，其他模組只 import 不重複定義

---

## File Structure

```
bookstore-space/
├─ index.html / package.json / vite.config.ts / tsconfig.json / playwright.config.ts
├─ scripts/
│  ├─ generate-placeholder-assets.ts   # pngjs 產 tileset.png / player.png
│  ├─ generate-map.ts                  # 產 Tiled 格式 map.json（含 interactions object layer）
│  ├─ fetch-content.ts                 # Storyblok → content.json；無 token 時用 sample
│  ├─ sample-content.json              # 本地開發用範例內容
│  └─ validate-content.ts              # CLI：build 驗證（id 比對＋schema）
├─ public/                              # assets/ 與 content.json 由腳本生成（gitignore）
├─ src/
│  ├─ main.ts / App.vue
│  ├─ content/  schema.ts · loadContent.ts · validate.ts · storyblok.ts
│  ├─ bridge/   EventBridge.ts
│  ├─ game/     createGame.ts · BootScene.ts · StoreScene.ts · movement.ts ·
│  │            zones.ts · mapParser.ts · inputState.ts · joystick.ts
│  └─ ui/       BookViewer.vue · ShelfPanel.vue · StoreInfoCard.vue · TouchControls.vue
├─ tests/       *.test.ts（單元測試）
└─ e2e/         basic.spec.ts
```

---

### Task 1: 專案腳手架

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.ts`, `src/App.vue`, `.gitignore`, `tests/smoke.test.ts`

**Interfaces:**
- Produces: 可執行的 `npm run dev` / `npm run test` / `vite build`；後續所有 task 在此結構上疊加

- [ ] **Step 1: 初始化 npm 與安裝依賴**

```bash
cd /Users/pai/projects/bookstore-space
npm init -y
npm i vue@^3.4 phaser@^3.80 zod@^3.23
npm i -D vite@^5 @vitejs/plugin-vue typescript@^5 vue-tsc vitest@^2 @vue/test-utils jsdom pngjs @types/pngjs tsx @playwright/test
```

- [ ] **Step 2: 寫設定檔**

`package.json` 的 scripts 區塊改為：

```json
{
  "scripts": {
    "dev": "vite",
    "assets": "tsx scripts/generate-placeholder-assets.ts && tsx scripts/generate-map.ts",
    "content": "tsx scripts/fetch-content.ts",
    "validate": "tsx scripts/validate-content.ts",
    "build": "npm run assets && npm run content && npm run validate && vite build",
    "test": "vitest run",
    "e2e": "playwright test"
  }
}
```

`vite.config.ts`：

```ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'jsdom',
    globals: true,
  },
})
```

（`test` 欄位給 Vitest 用；在檔案開頭加 `/// <reference types="vitest/config" />`）

`tsconfig.json`：

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "jsx": "preserve",
    "lib": ["ES2022", "DOM"],
    "types": ["vitest/globals"],
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["src", "tests", "scripts", "e2e"]
}
```

`.gitignore`：

```
node_modules/
dist/
public/assets/
public/content.json
test-results/
playwright-report/
```

`index.html`：

```html
<!doctype html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no" />
  <title>書店虛擬展示空間</title>
  <style>html,body{margin:0;height:100%;overflow:hidden;background:#222}</style>
</head>
<body>
  <div id="app"></div>
  <script type="module" src="/src/main.ts"></script>
</body>
</html>
```

`src/main.ts`：

```ts
import { createApp } from 'vue'
import App from './App.vue'

createApp(App).mount('#app')
```

`src/App.vue`（暫時的殼，Task 9 完整替換）：

```vue
<template>
  <div>書店虛擬展示空間</div>
</template>
```

- [ ] **Step 3: 寫 smoke test**

`tests/smoke.test.ts`：

```ts
import { describe, it, expect } from 'vitest'

describe('環境', () => {
  it('vitest 可執行', () => {
    expect(1 + 1).toBe(2)
  })
})
```

- [ ] **Step 4: 驗證**

Run: `npm run test` → 預期 PASS（1 test）
Run: `npx vite build` → 預期成功產出 `dist/`

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: scaffold vite + vue + phaser + vitest project"
```

---

### Task 2: 內容 Schema 與 Loader

**Files:**
- Create: `src/content/schema.ts`, `src/content/loadContent.ts`, `scripts/sample-content.json`
- Test: `tests/schema.test.ts`

**Interfaces:**
- Produces:
  - `ContentBundleSchema`（zod）與 types `Showcase`, `Shelf`, `StoreInfo`, `ContentBundle`, `Page`, `ShelfBook`
  - `loadContent(url?: string): Promise<ContentBundle>` — fetch＋zod 驗證

- [ ] **Step 1: 寫 failing test**

`tests/schema.test.ts`：

```ts
import { describe, it, expect } from 'vitest'
import { ContentBundleSchema } from '../src/content/schema'
import sample from '../scripts/sample-content.json'

describe('ContentBundleSchema', () => {
  it('接受合法的 sample content', () => {
    expect(() => ContentBundleSchema.parse(sample)).not.toThrow()
  })

  it('拒絕 pages 為空陣列的 showcase', () => {
    const bad = structuredClone(sample) as any
    bad.showcases[0].pages = []
    expect(() => ContentBundleSchema.parse(bad)).toThrow()
  })

  it('creatorLink 可省略', () => {
    const ok = structuredClone(sample) as any
    delete ok.showcases[0].creatorLink
    expect(() => ContentBundleSchema.parse(ok)).not.toThrow()
  })

  it('拒絕缺 storeInfo 的 bundle', () => {
    const bad = structuredClone(sample) as any
    delete bad.storeInfo
    expect(() => ContentBundleSchema.parse(bad)).toThrow()
  })
})
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npm run test -- tests/schema.test.ts`
Expected: FAIL（找不到 `../src/content/schema` 與 sample-content.json）

- [ ] **Step 3: 實作**

`src/content/schema.ts`：

```ts
import { z } from 'zod'

export const PageSchema = z.object({
  image: z.string().url(),
  caption: z.string(),
})

export const ShowcaseSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  pages: z.array(PageSchema).min(1),
  creatorLink: z.string().url().optional(),
})

export const ShelfBookSchema = z.object({
  cover: z.string().url(),
  title: z.string().min(1),
  note: z.string(),
})

export const ShelfSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  books: z.array(ShelfBookSchema).min(1),
})

export const StoreInfoSchema = z.object({
  address: z.string().min(1),
  hours: z.string().min(1),
  instagram: z.string().url(),
  mapLink: z.string().url(),
})

export const ContentBundleSchema = z.object({
  showcases: z.array(ShowcaseSchema),
  shelves: z.array(ShelfSchema),
  storeInfo: StoreInfoSchema,
})

export type Page = z.infer<typeof PageSchema>
export type Showcase = z.infer<typeof ShowcaseSchema>
export type ShelfBook = z.infer<typeof ShelfBookSchema>
export type Shelf = z.infer<typeof ShelfSchema>
export type StoreInfo = z.infer<typeof StoreInfoSchema>
export type ContentBundle = z.infer<typeof ContentBundleSchema>
```

`src/content/loadContent.ts`：

```ts
import { ContentBundleSchema, type ContentBundle } from './schema'

export async function loadContent(url = '/content.json'): Promise<ContentBundle> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`無法載入內容：${res.status}`)
  return ContentBundleSchema.parse(await res.json())
}
```

`scripts/sample-content.json`：

```json
{
  "showcases": [
    {
      "id": "showcase-1",
      "title": "手工蠟燭系列",
      "creatorLink": "https://instagram.com/example_creator",
      "pages": [
        { "image": "https://placehold.co/600x800/f5e6c8/333?text=Candle+1", "caption": "海鹽香氛蠟燭——以台東海岸的氣味為靈感，手工澆製。" },
        { "image": "https://placehold.co/600x800/e8d5b5/333?text=Candle+2", "caption": "森林苔蘚蠟燭——雨後森林的濕潤氣息。" },
        { "image": "https://placehold.co/600x800/d9c4a0/333?text=Candle+3", "caption": "製作過程：每一顆都經過三次澆蠟與修整。" }
      ]
    },
    {
      "id": "showcase-2",
      "title": "插畫明信片",
      "pages": [
        { "image": "https://placehold.co/600x800/c8dcf5/333?text=Postcard+1", "caption": "台東系列——金崙海岸的日出。" },
        { "image": "https://placehold.co/600x800/b5cde8/333?text=Postcard+2", "caption": "台東系列——鹿野高台的熱氣球。" }
      ]
    }
  ],
  "shelves": [
    {
      "id": "shelf-1",
      "title": "店主精選",
      "books": [
        { "cover": "https://placehold.co/300x420/a3d8b0/333?text=Book+1", "title": "我可能錯了", "note": "店主今年讀過最平靜的一本書。" },
        { "cover": "https://placehold.co/300x420/90c9a0/333?text=Book+2", "title": "射鵰英雄傳", "note": "永遠的江湖入門。" }
      ]
    }
  ],
  "storeInfo": {
    "address": "台東市中山路 123 號",
    "hours": "週三至週日 11:00–19:00",
    "instagram": "https://instagram.com/example_bookstore",
    "mapLink": "https://maps.google.com/?q=台東市中山路123號"
  }
}
```

在 `tsconfig.json` 的 `compilerOptions` 加 `"resolveJsonModule": true`。

- [ ] **Step 4: 跑測試確認通過**

Run: `npm run test -- tests/schema.test.ts`
Expected: PASS（4 tests）

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: content schema, loader, and sample content"
```

---

### Task 3: 佔位素材與地圖產生腳本 ＋ 地圖 Parser

**Files:**
- Create: `scripts/generate-placeholder-assets.ts`, `scripts/generate-map.ts`, `src/game/mapParser.ts`, `src/game/zones.ts`
- Test: `tests/mapParser.test.ts`, `tests/zones.test.ts`

**Interfaces:**
- Produces:
  - `public/assets/tileset.png`（64×32，兩個 32px tile：floor、wall）、`public/assets/player.png`（32×32）、`public/assets/map.json`（Tiled 格式）
  - `type ZoneType = 'showcase' | 'shelf' | 'info'`（定義在 `src/game/zones.ts`）
  - `interface Zone { id: string; type: ZoneType; x: number; y: number; width: number; height: number }`
  - `findZone(px: number, py: number, zones: Zone[]): Zone | null`
  - `parseInteractionZones(mapJson: unknown): Zone[]` — 讀 Tiled `interactions` object layer

- [ ] **Step 1: 寫 failing tests**

`tests/zones.test.ts`：

```ts
import { describe, it, expect } from 'vitest'
import { findZone, type Zone } from '../src/game/zones'

const zones: Zone[] = [
  { id: 'showcase-1', type: 'showcase', x: 100, y: 100, width: 64, height: 64 },
  { id: 'shelf-1', type: 'shelf', x: 300, y: 100, width: 64, height: 64 },
]

describe('findZone', () => {
  it('點在區域內回傳該 zone', () => {
    expect(findZone(110, 110, zones)?.id).toBe('showcase-1')
  })
  it('點在邊界上（含）回傳該 zone', () => {
    expect(findZone(100, 100, zones)?.id).toBe('showcase-1')
    expect(findZone(164, 164, zones)?.id).toBe('showcase-1')
  })
  it('點在所有區域外回傳 null', () => {
    expect(findZone(0, 0, zones)).toBeNull()
  })
})
```

`tests/mapParser.test.ts`：

```ts
import { describe, it, expect } from 'vitest'
import { parseInteractionZones } from '../src/game/mapParser'

const tiledMap = {
  layers: [
    { type: 'tilelayer', name: 'ground', data: [1] },
    {
      type: 'objectgroup',
      name: 'interactions',
      objects: [
        {
          name: 'showcase-1', x: 96, y: 96, width: 64, height: 64,
          properties: [{ name: 'type', type: 'string', value: 'showcase' }],
        },
        {
          name: 'info-1', x: 200, y: 96, width: 32, height: 32,
          properties: [{ name: 'type', type: 'string', value: 'info' }],
        },
      ],
    },
  ],
}

describe('parseInteractionZones', () => {
  it('抽出 interactions 層的物件為 Zone', () => {
    const zones = parseInteractionZones(tiledMap)
    expect(zones).toHaveLength(2)
    expect(zones[0]).toEqual({ id: 'showcase-1', type: 'showcase', x: 96, y: 96, width: 64, height: 64 })
  })
  it('沒有 interactions 層時丟出錯誤', () => {
    expect(() => parseInteractionZones({ layers: [] })).toThrow('interactions')
  })
  it('物件缺 type 屬性時丟出錯誤並指名 id', () => {
    const bad = {
      layers: [{ type: 'objectgroup', name: 'interactions', objects: [{ name: 'x-1', x: 0, y: 0, width: 1, height: 1, properties: [] }] }],
    }
    expect(() => parseInteractionZones(bad)).toThrow('x-1')
  })
})
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npm run test -- tests/zones.test.ts tests/mapParser.test.ts`
Expected: FAIL（模組不存在）

- [ ] **Step 3: 實作 zones 與 mapParser**

`src/game/zones.ts`：

```ts
export type ZoneType = 'showcase' | 'shelf' | 'info'

export interface Zone {
  id: string
  type: ZoneType
  x: number
  y: number
  width: number
  height: number
}

export function findZone(px: number, py: number, zones: Zone[]): Zone | null {
  for (const z of zones) {
    if (px >= z.x && px <= z.x + z.width && py >= z.y && py <= z.y + z.height) return z
  }
  return null
}
```

`src/game/mapParser.ts`：

```ts
import type { Zone, ZoneType } from './zones'

const ZONE_TYPES: ZoneType[] = ['showcase', 'shelf', 'info']

interface TiledObject {
  name: string
  x: number
  y: number
  width: number
  height: number
  properties?: { name: string; value: unknown }[]
}

export function parseInteractionZones(mapJson: unknown): Zone[] {
  const map = mapJson as { layers?: { type: string; name: string; objects?: TiledObject[] }[] }
  const layer = map.layers?.find((l) => l.type === 'objectgroup' && l.name === 'interactions')
  if (!layer) throw new Error('地圖缺少 interactions object layer')

  return (layer.objects ?? []).map((obj) => {
    const typeProp = obj.properties?.find((p) => p.name === 'type')?.value
    if (!ZONE_TYPES.includes(typeProp as ZoneType)) {
      throw new Error(`互動點 ${obj.name} 缺少合法的 type 屬性（showcase/shelf/info）`)
    }
    return {
      id: obj.name,
      type: typeProp as ZoneType,
      x: obj.x,
      y: obj.y,
      width: obj.width,
      height: obj.height,
    }
  })
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npm run test -- tests/zones.test.ts tests/mapParser.test.ts`
Expected: PASS（6 tests）

- [ ] **Step 5: 寫素材產生腳本**

`scripts/generate-placeholder-assets.ts`：

```ts
import { PNG } from 'pngjs'
import { mkdirSync, writeFileSync } from 'node:fs'

function fillRect(png: PNG, x0: number, y0: number, w: number, h: number, [r, g, b]: number[]) {
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      const i = (png.width * y + x) << 2
      png.data[i] = r; png.data[i + 1] = g; png.data[i + 2] = b; png.data[i + 3] = 255
    }
  }
}

mkdirSync('public/assets', { recursive: true })

// tileset.png：tile 1 = 地板(淺米), tile 2 = 牆(深棕)
const tileset = new PNG({ width: 64, height: 32 })
fillRect(tileset, 0, 0, 32, 32, [216, 201, 163])
fillRect(tileset, 32, 0, 32, 32, [107, 79, 42])
writeFileSync('public/assets/tileset.png', PNG.sync.write(tileset))

// player.png：紅色方塊＋深色邊框
const player = new PNG({ width: 32, height: 32 })
fillRect(player, 0, 0, 32, 32, [90, 40, 40])
fillRect(player, 2, 2, 28, 28, [224, 85, 85])
writeFileSync('public/assets/player.png', PNG.sync.write(player))

console.log('✓ 佔位素材已產生：public/assets/{tileset,player}.png')
```

`scripts/generate-map.ts`：

```ts
import { writeFileSync, mkdirSync } from 'node:fs'

const W = 20, H = 15, TILE = 32
const FLOOR = 1, WALL = 2

const ground = Array(W * H).fill(FLOOR)
const walls = Array.from({ length: W * H }, (_, i) => {
  const x = i % W, y = Math.floor(i / W)
  return x === 0 || y === 0 || x === W - 1 || y === H - 1 ? WALL : 0
})

const prop = (value: string) => [{ name: 'type', type: 'string', value }]

const map = {
  type: 'map', version: '1.10', orientation: 'orthogonal', renderorder: 'right-down',
  width: W, height: H, tilewidth: TILE, tileheight: TILE, infinite: false,
  tilesets: [{
    firstgid: 1, name: 'tileset', image: 'tileset.png',
    imagewidth: 64, imageheight: 32, tilewidth: TILE, tileheight: TILE,
    tilecount: 2, columns: 2, margin: 0, spacing: 0,
  }],
  layers: [
    { type: 'tilelayer', name: 'ground', width: W, height: H, x: 0, y: 0, opacity: 1, visible: true, data: ground },
    { type: 'tilelayer', name: 'walls', width: W, height: H, x: 0, y: 0, opacity: 1, visible: true, data: walls },
    {
      type: 'objectgroup', name: 'interactions', x: 0, y: 0, opacity: 1, visible: true,
      objects: [
        { id: 1, name: 'showcase-1', x: 96, y: 96, width: 64, height: 64, rotation: 0, visible: true, properties: prop('showcase') },
        { id: 2, name: 'showcase-2', x: 480, y: 96, width: 64, height: 64, rotation: 0, visible: true, properties: prop('showcase') },
        { id: 3, name: 'shelf-1', x: 96, y: 320, width: 64, height: 64, rotation: 0, visible: true, properties: prop('shelf') },
        { id: 4, name: 'info-1', x: 480, y: 320, width: 64, height: 64, rotation: 0, visible: true, properties: prop('info') },
      ],
    },
  ],
}

mkdirSync('public/assets', { recursive: true })
writeFileSync('public/assets/map.json', JSON.stringify(map, null, 2))
console.log('✓ 地圖已產生：public/assets/map.json')
```

- [ ] **Step 6: 執行腳本驗證**

Run: `npm run assets`
Expected: 兩行 ✓ 訊息；`ls public/assets` 出現 `tileset.png player.png map.json`

驗證產出的地圖可被 parser 讀取：

Run: `npx tsx -e "import {parseInteractionZones} from './src/game/mapParser'; import {readFileSync} from 'fs'; console.log(parseInteractionZones(JSON.parse(readFileSync('public/assets/map.json','utf8'))).length)"`
Expected: 輸出 `4`

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: placeholder asset/map generators, zone types, map parser"
```

---

### Task 4: Build 驗證腳本

**Files:**
- Create: `src/content/validate.ts`, `scripts/validate-content.ts`
- Test: `tests/validate.test.ts`

**Interfaces:**
- Consumes: `parseInteractionZones`（Task 3）、`ContentBundle`（Task 2）
- Produces:
  - `validateContent(mapJson: unknown, content: ContentBundle): string[]` — 回傳錯誤訊息陣列，空陣列 = 通過
  - CLI `npm run validate`：錯誤時 exit code 1 並列出所有缺漏 id

- [ ] **Step 1: 寫 failing test**

`tests/validate.test.ts`：

```ts
import { describe, it, expect } from 'vitest'
import { validateContent } from '../src/content/validate'
import { ContentBundleSchema } from '../src/content/schema'
import sample from '../scripts/sample-content.json'

const mapWith = (objects: { name: string; type: string }[]) => ({
  layers: [{
    type: 'objectgroup', name: 'interactions',
    objects: objects.map((o, i) => ({
      name: o.name, x: i * 100, y: 0, width: 64, height: 64,
      properties: [{ name: 'type', type: 'string', value: o.type }],
    })),
  }],
})

const content = ContentBundleSchema.parse(sample)
// sample 內容：showcase-1, showcase-2, shelf-1

describe('validateContent', () => {
  it('地圖與內容完全對應時回傳空陣列', () => {
    const map = mapWith([
      { name: 'showcase-1', type: 'showcase' },
      { name: 'showcase-2', type: 'showcase' },
      { name: 'shelf-1', type: 'shelf' },
      { name: 'info-1', type: 'info' },
    ])
    expect(validateContent(map, content)).toEqual([])
  })

  it('地圖互動點在 CMS 找不到內容時列出該 id', () => {
    const map = mapWith([{ name: 'showcase-99', type: 'showcase' }])
    const errors = validateContent(map, content)
    expect(errors.some((e) => e.includes('showcase-99'))).toBe(true)
  })

  it('CMS 內容在地圖上沒有互動點時列出該 id', () => {
    const map = mapWith([
      { name: 'showcase-1', type: 'showcase' },
      { name: 'showcase-2', type: 'showcase' },
    ])
    const errors = validateContent(map, content)
    expect(errors.some((e) => e.includes('shelf-1'))).toBe(true)
  })
})
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npm run test -- tests/validate.test.ts`
Expected: FAIL（模組不存在）

- [ ] **Step 3: 實作**

`src/content/validate.ts`：

```ts
import { parseInteractionZones } from '../game/mapParser'
import type { ContentBundle } from './schema'

export function validateContent(mapJson: unknown, content: ContentBundle): string[] {
  const errors: string[] = []
  const zones = parseInteractionZones(mapJson)

  const showcaseIds = new Set(content.showcases.map((s) => s.id))
  const shelfIds = new Set(content.shelves.map((s) => s.id))

  for (const z of zones) {
    if (z.type === 'showcase' && !showcaseIds.has(z.id))
      errors.push(`地圖互動點 ${z.id}（showcase）在 CMS 找不到對應內容`)
    if (z.type === 'shelf' && !shelfIds.has(z.id))
      errors.push(`地圖互動點 ${z.id}（shelf）在 CMS 找不到對應內容`)
  }

  const zoneIds = new Set(zones.map((z) => z.id))
  for (const s of content.showcases)
    if (!zoneIds.has(s.id)) errors.push(`CMS Showcase「${s.title}」(${s.id}) 在地圖上沒有互動點`)
  for (const s of content.shelves)
    if (!zoneIds.has(s.id)) errors.push(`CMS Shelf「${s.title}」(${s.id}) 在地圖上沒有互動點`)

  return errors
}
```

`scripts/validate-content.ts`：

```ts
import { readFileSync } from 'node:fs'
import { ContentBundleSchema } from '../src/content/schema'
import { validateContent } from '../src/content/validate'

const map = JSON.parse(readFileSync('public/assets/map.json', 'utf8'))
const raw = JSON.parse(readFileSync('public/content.json', 'utf8'))

const parsed = ContentBundleSchema.safeParse(raw)
if (!parsed.success) {
  console.error('✗ content.json 格式錯誤：')
  for (const issue of parsed.error.issues) console.error(`  - ${issue.path.join('.')}: ${issue.message}`)
  process.exit(1)
}

const errors = validateContent(map, parsed.data)
if (errors.length > 0) {
  console.error('✗ 內容驗證失敗：')
  for (const e of errors) console.error(`  - ${e}`)
  process.exit(1)
}
console.log('✓ 內容驗證通過')
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npm run test -- tests/validate.test.ts`
Expected: PASS（3 tests）

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: build-time content validation (map ids vs CMS ids)"
```

---

### Task 5: EventBridge 與輸入狀態

**Files:**
- Create: `src/bridge/EventBridge.ts`, `src/game/inputState.ts`, `src/game/movement.ts`, `src/game/joystick.ts`
- Test: `tests/EventBridge.test.ts`, `tests/movement.test.ts`, `tests/joystick.test.ts`

**Interfaces:**
- Consumes: `ZoneType`（Task 3 的 `src/game/zones.ts`）
- Produces:
  - `interface BridgeEvents { 'interact': { id: string; type: ZoneType }; 'zone:enter': { id: string; type: ZoneType }; 'zone:exit': { id: string }; 'ui:opened': undefined; 'ui:closed': undefined }`
  - `class EventBridge` 的 `on(event, fn): () => void`（回傳取消訂閱函式）與 `emit(event, payload?)`
  - `export const bridge = new EventBridge()`（單例）
  - `export const touchInput = { x: 0, y: 0 }`（TouchControls 寫、StoreScene 讀）
  - `computeVelocity(dir: {x:number;y:number}, speed: number): {x:number;y:number}`（正規化、對角不加速）
  - `joystickVector(origin: {x:number;y:number}, current: {x:number;y:number}, radius: number): {x:number;y:number}`（回傳 -1~1 的正規化向量）

- [ ] **Step 1: 寫 failing tests**

`tests/EventBridge.test.ts`：

```ts
import { describe, it, expect, vi } from 'vitest'
import { EventBridge } from '../src/bridge/EventBridge'

describe('EventBridge', () => {
  it('emit 觸發已註冊的 handler 並帶 payload', () => {
    const b = new EventBridge()
    const fn = vi.fn()
    b.on('interact', fn)
    b.emit('interact', { id: 'showcase-1', type: 'showcase' })
    expect(fn).toHaveBeenCalledWith({ id: 'showcase-1', type: 'showcase' })
  })

  it('on 回傳的函式可取消訂閱', () => {
    const b = new EventBridge()
    const fn = vi.fn()
    const off = b.on('ui:closed', fn)
    off()
    b.emit('ui:closed')
    expect(fn).not.toHaveBeenCalled()
  })

  it('無 handler 時 emit 不丟錯', () => {
    const b = new EventBridge()
    expect(() => b.emit('ui:opened')).not.toThrow()
  })
})
```

`tests/movement.test.ts`：

```ts
import { describe, it, expect } from 'vitest'
import { computeVelocity } from '../src/game/movement'

describe('computeVelocity', () => {
  it('無輸入回傳零向量', () => {
    expect(computeVelocity({ x: 0, y: 0 }, 160)).toEqual({ x: 0, y: 0 })
  })
  it('單軸輸入回傳全速', () => {
    expect(computeVelocity({ x: 1, y: 0 }, 160)).toEqual({ x: 160, y: 0 })
  })
  it('對角輸入不超速（正規化）', () => {
    const v = computeVelocity({ x: 1, y: 1 }, 160)
    expect(Math.hypot(v.x, v.y)).toBeCloseTo(160)
  })
  it('小於 1 的輸入按比例縮放（搖桿輕推）', () => {
    const v = computeVelocity({ x: 0.5, y: 0 }, 160)
    expect(v.x).toBeCloseTo(80)
  })
})
```

`tests/joystick.test.ts`：

```ts
import { describe, it, expect } from 'vitest'
import { joystickVector } from '../src/game/joystick'

describe('joystickVector', () => {
  it('拖到半徑一半回傳 0.5', () => {
    const v = joystickVector({ x: 100, y: 100 }, { x: 120, y: 100 }, 40)
    expect(v.x).toBeCloseTo(0.5)
    expect(v.y).toBeCloseTo(0)
  })
  it('拖超過半徑時 clamp 到 1', () => {
    const v = joystickVector({ x: 100, y: 100 }, { x: 300, y: 100 }, 40)
    expect(v.x).toBeCloseTo(1)
  })
  it('原地不動回傳零向量', () => {
    expect(joystickVector({ x: 100, y: 100 }, { x: 100, y: 100 }, 40)).toEqual({ x: 0, y: 0 })
  })
})
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npm run test -- tests/EventBridge.test.ts tests/movement.test.ts tests/joystick.test.ts`
Expected: FAIL（模組不存在）

- [ ] **Step 3: 實作**

`src/bridge/EventBridge.ts`：

```ts
import type { ZoneType } from '../game/zones'

export interface BridgeEvents {
  'interact': { id: string; type: ZoneType }
  'zone:enter': { id: string; type: ZoneType }
  'zone:exit': { id: string }
  'ui:opened': undefined
  'ui:closed': undefined
}

type Handler<T> = (payload: T) => void

export class EventBridge {
  private handlers = new Map<keyof BridgeEvents, Set<Handler<never>>>()

  on<K extends keyof BridgeEvents>(event: K, fn: Handler<BridgeEvents[K]>): () => void {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set())
    this.handlers.get(event)!.add(fn as Handler<never>)
    return () => this.handlers.get(event)?.delete(fn as Handler<never>)
  }

  emit<K extends keyof BridgeEvents>(
    event: K,
    ...args: BridgeEvents[K] extends undefined ? [] : [BridgeEvents[K]]
  ): void {
    this.handlers.get(event)?.forEach((fn) => (fn as Handler<BridgeEvents[K]>)(args[0] as BridgeEvents[K]))
  }
}

export const bridge = new EventBridge()
```

`src/game/inputState.ts`：

```ts
// TouchControls 寫入、StoreScene 每 frame 讀取的共享觸控向量（-1~1）
export const touchInput = { x: 0, y: 0 }
```

`src/game/movement.ts`：

```ts
export function computeVelocity(dir: { x: number; y: number }, speed: number): { x: number; y: number } {
  const len = Math.hypot(dir.x, dir.y)
  if (len === 0) return { x: 0, y: 0 }
  const magnitude = Math.min(len, 1)
  return { x: (dir.x / len) * magnitude * speed, y: (dir.y / len) * magnitude * speed }
}
```

`src/game/joystick.ts`：

```ts
export function joystickVector(
  origin: { x: number; y: number },
  current: { x: number; y: number },
  radius: number,
): { x: number; y: number } {
  const dx = current.x - origin.x
  const dy = current.y - origin.y
  const len = Math.hypot(dx, dy)
  if (len === 0) return { x: 0, y: 0 }
  const clamped = Math.min(len, radius)
  return { x: (dx / len) * (clamped / radius), y: (dy / len) * (clamped / radius) }
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npm run test -- tests/EventBridge.test.ts tests/movement.test.ts tests/joystick.test.ts`
Expected: PASS（10 tests）

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: typed event bridge, input state, movement and joystick math"
```

---

### Task 6: Phaser 場景（Boot、Store、角色移動、互動觸發）

**Files:**
- Create: `src/game/BootScene.ts`, `src/game/StoreScene.ts`, `src/game/createGame.ts`

**Interfaces:**
- Consumes: `bridge`（Task 5）、`computeVelocity`、`touchInput`、`findZone`、`parseInteractionZones`
- Produces: `createGame(parent: HTMLElement): Phaser.Game` — App.vue 在 Task 9 呼叫

備註：場景邏輯不寫單元測試（依 spec，遊戲手感靠真機驗）；可測邏輯已在 Task 3/5 抽成純函式。本 task 驗證方式為 dev server 手動操作。

- [ ] **Step 1: 實作 BootScene**

`src/game/BootScene.ts`：

```ts
import Phaser from 'phaser'

export class BootScene extends Phaser.Scene {
  constructor() { super('boot') }

  preload() {
    const { width, height } = this.scale
    const barBg = this.add.rectangle(width / 2, height / 2, 204, 16, 0x444444)
    const bar = this.add.rectangle(width / 2 - 100, height / 2, 0, 12, 0xd8c9a3).setOrigin(0, 0.5)
    this.load.on('progress', (v: number) => { bar.width = 200 * v })
    this.load.on('complete', () => { bar.destroy(); barBg.destroy() })

    this.load.image('tiles', '/assets/tileset.png')
    this.load.image('player', '/assets/player.png')
    this.load.tilemapTiledJSON('map', '/assets/map.json')
  }

  create() { this.scene.start('store') }
}
```

- [ ] **Step 2: 實作 StoreScene**

`src/game/StoreScene.ts`：

```ts
import Phaser from 'phaser'
import { bridge } from '../bridge/EventBridge'
import { computeVelocity } from './movement'
import { touchInput } from './inputState'
import { findZone, type Zone } from './zones'
import { parseInteractionZones } from './mapParser'

const SPEED = 160
const SPAWN = { x: 320, y: 240 }

export class StoreScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private zones: Zone[] = []
  private currentZone: Zone | null = null
  private hint!: Phaser.GameObjects.Text
  private uiOpen = false

  constructor() { super('store') }

  create() {
    const map = this.make.tilemap({ key: 'map' })
    const tiles = map.addTilesetImage('tileset', 'tiles')!
    map.createLayer('ground', tiles)
    const walls = map.createLayer('walls', tiles)!
    walls.setCollision(2)

    this.player = this.physics.add.sprite(SPAWN.x, SPAWN.y, 'player')
    this.physics.add.collider(this.player, walls)
    this.cameras.main.startFollow(this.player)
    this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels)

    this.zones = parseInteractionZones(this.cache.tilemap.get('map')!.data)

    this.hint = this.add
      .text(0, 0, '點擊翻閱', { fontSize: '14px', backgroundColor: '#000000', padding: { x: 8, y: 4 } })
      .setOrigin(0.5, 1)
      .setDepth(10)
      .setVisible(false)
      .setInteractive({ useHandCursor: true })
    this.hint.on('pointerdown', () => this.triggerInteract())
    this.cursors = this.input.keyboard!.createCursorKeys()
    this.input.keyboard!.on('keydown-E', () => this.triggerInteract())

    bridge.on('ui:opened', () => { this.uiOpen = true })
    bridge.on('ui:closed', () => { this.uiOpen = false })
  }

  private triggerInteract() {
    if (!this.currentZone || this.uiOpen) return
    bridge.emit('interact', { id: this.currentZone.id, type: this.currentZone.type })
  }

  update() {
    if (this.uiOpen) { this.player.setVelocity(0, 0); return }

    const dir = {
      x: (this.cursors.left.isDown ? -1 : 0) + (this.cursors.right.isDown ? 1 : 0) + touchInput.x,
      y: (this.cursors.up.isDown ? -1 : 0) + (this.cursors.down.isDown ? 1 : 0) + touchInput.y,
    }
    const v = computeVelocity(dir, SPEED)
    this.player.setVelocity(v.x, v.y)

    const zone = findZone(this.player.x, this.player.y, this.zones)
    if (zone !== this.currentZone) {
      if (this.currentZone) bridge.emit('zone:exit', { id: this.currentZone.id })
      if (zone) {
        bridge.emit('zone:enter', { id: zone.id, type: zone.type })
        this.hint.setPosition(zone.x + zone.width / 2, zone.y - 8).setVisible(true)
      } else {
        this.hint.setVisible(false)
      }
      this.currentZone = zone
    }
  }
}
```

- [ ] **Step 3: 實作 createGame**

`src/game/createGame.ts`：

```ts
import Phaser from 'phaser'
import { BootScene } from './BootScene'
import { StoreScene } from './StoreScene'

export function createGame(parent: HTMLElement): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO, // WebGL 不支援時自動 fallback Canvas
    parent,
    width: 640,
    height: 480,
    backgroundColor: '#222222',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    physics: { default: 'arcade' },
    scene: [BootScene, StoreScene],
  })
}
```

- [ ] **Step 4: 暫接 App.vue 手動驗證**

把 `src/App.vue` 換成：

```vue
<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { createGame } from './game/createGame'

const container = ref<HTMLElement>()
let game: ReturnType<typeof createGame> | null = null

onMounted(() => { game = createGame(container.value!) })
onUnmounted(() => { game?.destroy(true) })
</script>

<template>
  <div ref="container" class="game" />
</template>

<style>
.game { width: 100vw; height: 100vh; }
</style>
```

Run: `npm run assets && npm run dev` → 瀏覽器開 http://localhost:5173
Expected: 看到米色地板＋深棕牆的房間，紅色方塊角色，方向鍵可移動、撞牆停下；走進左上互動區出現「點擊翻閱」提示；按 E 無反應（正常——UI 層 Task 9 才接）。開 DevTools console 確認無紅字錯誤。

Run: `npm run test`
Expected: 既有測試全 PASS（場景不影響單元測試）

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: phaser boot/store scenes with player movement and interaction zones"
```

---

### Task 7: BookViewer 翻書元件

**Files:**
- Create: `src/ui/BookViewer.vue`
- Test: `tests/BookViewer.test.ts`

**Interfaces:**
- Consumes: `Showcase` type（Task 2）
- Produces: `<BookViewer :showcase="Showcase" @close />` — props `showcase: Showcase`，emit `close`（無參數）。data-testid：`book-viewer`、`prev`、`next`、`close`、`retry`、`creator-link`

- [ ] **Step 1: 寫 failing test**

`tests/BookViewer.test.ts`：

```ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import BookViewer from '../src/ui/BookViewer.vue'
import type { Showcase } from '../src/content/schema'

const showcase: Showcase = {
  id: 'showcase-1',
  title: '手工蠟燭',
  creatorLink: 'https://instagram.com/creator',
  pages: [
    { image: 'https://example.com/1.jpg', caption: '第一頁描述' },
    { image: 'https://example.com/2.jpg', caption: '第二頁描述' },
  ],
}

describe('BookViewer', () => {
  it('顯示標題與第一頁', () => {
    const w = mount(BookViewer, { props: { showcase } })
    expect(w.text()).toContain('手工蠟燭')
    expect(w.text()).toContain('第一頁描述')
    expect(w.text()).toContain('1 / 2')
  })

  it('下一頁/上一頁切換，邊界時按鈕 disabled', async () => {
    const w = mount(BookViewer, { props: { showcase } })
    expect(w.get('[data-testid="prev"]').attributes('disabled')).toBeDefined()
    await w.get('[data-testid="next"]').trigger('click')
    expect(w.text()).toContain('第二頁描述')
    expect(w.get('[data-testid="next"]').attributes('disabled')).toBeDefined()
  })

  it('最後一頁才顯示創作者連結', async () => {
    const w = mount(BookViewer, { props: { showcase } })
    expect(w.find('[data-testid="creator-link"]').exists()).toBe(false)
    await w.get('[data-testid="next"]').trigger('click')
    expect(w.get('[data-testid="creator-link"]').attributes('href')).toBe('https://instagram.com/creator')
  })

  it('無 creatorLink 時最後一頁不渲染連結', async () => {
    const w = mount(BookViewer, { props: { showcase: { ...showcase, creatorLink: undefined } } })
    await w.get('[data-testid="next"]').trigger('click')
    expect(w.find('[data-testid="creator-link"]').exists()).toBe(false)
  })

  it('圖片載入失敗顯示重試，按重試恢復 img', async () => {
    const w = mount(BookViewer, { props: { showcase } })
    await w.get('img').trigger('error')
    expect(w.text()).toContain('圖片載入失敗')
    await w.get('[data-testid="retry"]').trigger('click')
    expect(w.find('img').exists()).toBe(true)
  })

  it('點關閉 emit close', async () => {
    const w = mount(BookViewer, { props: { showcase } })
    await w.get('[data-testid="close"]').trigger('click')
    expect(w.emitted('close')).toHaveLength(1)
  })
})
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npm run test -- tests/BookViewer.test.ts`
Expected: FAIL（元件不存在）

- [ ] **Step 3: 實作**

`src/ui/BookViewer.vue`：

```vue
<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { Showcase } from '../content/schema'

const props = defineProps<{ showcase: Showcase }>()
const emit = defineEmits<{ close: [] }>()

const pageIndex = ref(0)
const failed = ref<Record<number, boolean>>({})
const retryKey = ref(0)

const page = computed(() => props.showcase.pages[pageIndex.value])
const isLast = computed(() => pageIndex.value === props.showcase.pages.length - 1)

function next() { if (!isLast.value) pageIndex.value++ }
function prev() { if (pageIndex.value > 0) pageIndex.value-- }
function retry() {
  failed.value[pageIndex.value] = false
  retryKey.value++
}

// 預載下一頁圖片
watch(pageIndex, (i) => {
  const nextPage = props.showcase.pages[i + 1]
  if (nextPage) { const img = new Image(); img.src = nextPage.image }
}, { immediate: true })

// 手機左右滑動翻頁
let startX = 0
function onTouchStart(e: TouchEvent) { startX = e.touches[0].clientX }
function onTouchEnd(e: TouchEvent) {
  const dx = e.changedTouches[0].clientX - startX
  if (dx < -50) next()
  else if (dx > 50) prev()
}
</script>

<template>
  <div class="overlay" data-testid="book-viewer" @touchstart="onTouchStart" @touchend="onTouchEnd">
    <header>
      <h2>{{ showcase.title }}</h2>
      <button data-testid="close" aria-label="關閉" @click="emit('close')">✕</button>
    </header>

    <div class="page">
      <img
        v-if="!failed[pageIndex]"
        :key="`${pageIndex}-${retryKey}`"
        :src="page.image"
        :alt="page.caption"
        @error="failed[pageIndex] = true"
      />
      <div v-else class="placeholder">
        <p>圖片載入失敗</p>
        <button data-testid="retry" @click="retry">重試</button>
      </div>
      <p class="caption">{{ page.caption }}</p>
    </div>

    <footer>
      <button data-testid="prev" :disabled="pageIndex === 0" @click="prev">上一頁</button>
      <span>{{ pageIndex + 1 }} / {{ showcase.pages.length }}</span>
      <button data-testid="next" :disabled="isLast" @click="next">下一頁</button>
    </footer>

    <a
      v-if="isLast && showcase.creatorLink"
      data-testid="creator-link"
      class="creator"
      :href="showcase.creatorLink"
      target="_blank"
      rel="noopener"
    >創作者 IG →</a>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed; inset: 0; z-index: 100;
  background: rgba(20, 16, 10, 0.92); color: #f5efe0;
  display: flex; flex-direction: column; padding: 16px;
}
header { display: flex; justify-content: space-between; align-items: center; }
header h2 { margin: 0; font-size: 1.2rem; }
header button { background: none; border: none; color: inherit; font-size: 1.5rem; padding: 8px; }
.page { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 0; }
.page img { max-width: 100%; max-height: 70%; object-fit: contain; border-radius: 4px; }
.placeholder { text-align: center; padding: 48px 24px; background: #333; border-radius: 4px; }
.caption { margin-top: 12px; text-align: center; line-height: 1.6; max-width: 32em; }
footer { display: flex; justify-content: center; align-items: center; gap: 16px; padding: 12px 0; }
footer button { padding: 8px 20px; border-radius: 20px; border: 1px solid #f5efe0; background: none; color: inherit; }
footer button:disabled { opacity: 0.3; }
.creator { text-align: center; color: #f0b860; padding-bottom: 8px; }
</style>
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npm run test -- tests/BookViewer.test.ts`
Expected: PASS（6 tests）

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: BookViewer overlay with swipe paging, retry, creator link"
```

---

### Task 8: ShelfPanel、StoreInfoCard、TouchControls

**Files:**
- Create: `src/ui/ShelfPanel.vue`, `src/ui/StoreInfoCard.vue`, `src/ui/TouchControls.vue`
- Test: `tests/ShelfPanel.test.ts`, `tests/StoreInfoCard.test.ts`

**Interfaces:**
- Consumes: `Shelf`, `StoreInfo` types（Task 2）；`joystickVector`、`touchInput`（Task 5）
- Produces:
  - `<ShelfPanel :shelf="Shelf" @close />`、`<StoreInfoCard :info="StoreInfo" @close />` — 都 emit `close`，data-testid `close`
  - `<TouchControls />` — 無 props；touchstart/move/end 寫入 `touchInput`，touchend 歸零

- [ ] **Step 1: 寫 failing tests**

`tests/ShelfPanel.test.ts`：

```ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ShelfPanel from '../src/ui/ShelfPanel.vue'
import type { Shelf } from '../src/content/schema'

const shelf: Shelf = {
  id: 'shelf-1',
  title: '店主精選',
  books: [
    { cover: 'https://example.com/b1.jpg', title: '我可能錯了', note: '最平靜的一本書' },
    { cover: 'https://example.com/b2.jpg', title: '射鵰英雄傳', note: '江湖入門' },
  ],
}

describe('ShelfPanel', () => {
  it('顯示書單標題與所有書', () => {
    const w = mount(ShelfPanel, { props: { shelf } })
    expect(w.text()).toContain('店主精選')
    expect(w.text()).toContain('我可能錯了')
    expect(w.text()).toContain('江湖入門')
    expect(w.findAll('img')).toHaveLength(2)
  })
  it('點關閉 emit close', async () => {
    const w = mount(ShelfPanel, { props: { shelf } })
    await w.get('[data-testid="close"]').trigger('click')
    expect(w.emitted('close')).toHaveLength(1)
  })
})
```

`tests/StoreInfoCard.test.ts`：

```ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import StoreInfoCard from '../src/ui/StoreInfoCard.vue'
import type { StoreInfo } from '../src/content/schema'

const info: StoreInfo = {
  address: '台東市中山路 123 號',
  hours: '週三至週日 11:00–19:00',
  instagram: 'https://instagram.com/store',
  mapLink: 'https://maps.google.com/?q=x',
}

describe('StoreInfoCard', () => {
  it('顯示地址、時間與連結', () => {
    const w = mount(StoreInfoCard, { props: { info } })
    expect(w.text()).toContain('台東市中山路 123 號')
    expect(w.text()).toContain('11:00–19:00')
    expect(w.get('[data-testid="ig-link"]').attributes('href')).toBe(info.instagram)
    expect(w.get('[data-testid="map-link"]').attributes('href')).toBe(info.mapLink)
  })
  it('點關閉 emit close', async () => {
    const w = mount(StoreInfoCard, { props: { info } })
    await w.get('[data-testid="close"]').trigger('click')
    expect(w.emitted('close')).toHaveLength(1)
  })
})
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npm run test -- tests/ShelfPanel.test.ts tests/StoreInfoCard.test.ts`
Expected: FAIL（元件不存在）

- [ ] **Step 3: 實作三個元件**

`src/ui/ShelfPanel.vue`：

```vue
<script setup lang="ts">
import type { Shelf } from '../content/schema'

defineProps<{ shelf: Shelf }>()
const emit = defineEmits<{ close: [] }>()
</script>

<template>
  <div class="overlay" data-testid="shelf-panel">
    <header>
      <h2>{{ shelf.title }}</h2>
      <button data-testid="close" aria-label="關閉" @click="emit('close')">✕</button>
    </header>
    <ul>
      <li v-for="book in shelf.books" :key="book.title">
        <img :src="book.cover" :alt="book.title" loading="lazy" />
        <div>
          <h3>{{ book.title }}</h3>
          <p>{{ book.note }}</p>
        </div>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed; inset: 0; z-index: 100; overflow-y: auto;
  background: rgba(20, 16, 10, 0.92); color: #f5efe0; padding: 16px;
}
header { display: flex; justify-content: space-between; align-items: center; }
header button { background: none; border: none; color: inherit; font-size: 1.5rem; padding: 8px; }
ul { list-style: none; padding: 0; display: flex; flex-direction: column; gap: 16px; }
li { display: flex; gap: 12px; }
li img { width: 80px; height: 112px; object-fit: cover; border-radius: 4px; flex-shrink: 0; }
li h3 { margin: 0 0 4px; }
li p { margin: 0; line-height: 1.5; opacity: 0.85; }
</style>
```

`src/ui/StoreInfoCard.vue`：

```vue
<script setup lang="ts">
import type { StoreInfo } from '../content/schema'

defineProps<{ info: StoreInfo }>()
const emit = defineEmits<{ close: [] }>()
</script>

<template>
  <div class="overlay" data-testid="store-info">
    <div class="card">
      <button data-testid="close" aria-label="關閉" @click="emit('close')">✕</button>
      <h2>來實體店逛逛</h2>
      <p>{{ info.address }}</p>
      <p>{{ info.hours }}</p>
      <div class="links">
        <a data-testid="map-link" :href="info.mapLink" target="_blank" rel="noopener">地圖導航</a>
        <a data-testid="ig-link" :href="info.instagram" target="_blank" rel="noopener">Instagram</a>
      </div>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed; inset: 0; z-index: 100;
  background: rgba(0, 0, 0, 0.6);
  display: flex; align-items: center; justify-content: center; padding: 24px;
}
.card {
  position: relative; background: #f5efe0; color: #322718;
  border-radius: 8px; padding: 24px 32px; max-width: 360px; width: 100%;
}
.card button { position: absolute; top: 8px; right: 8px; background: none; border: none; font-size: 1.3rem; }
.links { display: flex; gap: 16px; margin-top: 16px; }
.links a { color: #7a5220; font-weight: 600; }
</style>
```

`src/ui/TouchControls.vue`：

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { joystickVector } from '../game/joystick'
import { touchInput } from '../game/inputState'

const RADIUS = 40
const active = ref(false)
const origin = ref({ x: 0, y: 0 })
const knob = ref({ x: 0, y: 0 })

function onStart(e: TouchEvent) {
  active.value = true
  origin.value = { x: e.touches[0].clientX, y: e.touches[0].clientY }
}
function onMove(e: TouchEvent) {
  if (!active.value) return
  const current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
  const v = joystickVector(origin.value, current, RADIUS)
  knob.value = { x: v.x * RADIUS, y: v.y * RADIUS }
  touchInput.x = v.x
  touchInput.y = v.y
}
function onEnd() {
  active.value = false
  knob.value = { x: 0, y: 0 }
  touchInput.x = 0
  touchInput.y = 0
}
</script>

<template>
  <div
    class="joystick"
    data-testid="touch-controls"
    @touchstart.prevent="onStart"
    @touchmove.prevent="onMove"
    @touchend="onEnd"
    @touchcancel="onEnd"
  >
    <div class="base">
      <div class="knob" :style="{ transform: `translate(${knob.x}px, ${knob.y}px)` }" />
    </div>
  </div>
</template>

<style scoped>
.joystick { position: fixed; left: 24px; bottom: 24px; z-index: 50; touch-action: none; }
.base {
  width: 96px; height: 96px; border-radius: 50%;
  background: rgba(255, 255, 255, 0.15); border: 2px solid rgba(255, 255, 255, 0.4);
  display: flex; align-items: center; justify-content: center;
}
.knob { width: 40px; height: 40px; border-radius: 50%; background: rgba(255, 255, 255, 0.6); }
</style>
```

（TouchControls 的向量運算已由 `tests/joystick.test.ts` 覆蓋，元件本身不另寫 jsdom 觸控模擬。）

- [ ] **Step 4: 跑測試確認通過**

Run: `npm run test -- tests/ShelfPanel.test.ts tests/StoreInfoCard.test.ts`
Expected: PASS（4 tests）

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: shelf panel, store info card, touch joystick"
```

---

### Task 9: App 整合（Phaser ↔ Vue 接線）

**Files:**
- Modify: `src/App.vue`（整檔替換）, `src/main.ts`

**Interfaces:**
- Consumes: `createGame`（Task 6）、`bridge`（Task 5）、`loadContent`（Task 2）、四個 UI 元件（Task 7/8）
- Produces: 完整可玩的單機版；dev mode 下 `window.__bridge` 供 E2E 使用

- [ ] **Step 1: 實作 App.vue**

整檔替換 `src/App.vue`：

```vue
<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { createGame } from './game/createGame'
import { bridge } from './bridge/EventBridge'
import { loadContent } from './content/loadContent'
import type { ContentBundle, Showcase, Shelf } from './content/schema'
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
const isTouch = 'ontouchstart' in window

let game: ReturnType<typeof createGame> | null = null
let offInteract: (() => void) | null = null

onMounted(async () => {
  try {
    content.value = await loadContent()
  } catch {
    loadError.value = true
    return
  }
  game = createGame(container.value!)

  offInteract = bridge.on('interact', ({ id, type }) => {
    const c = content.value
    if (!c) return
    if (type === 'showcase') activeShowcase.value = c.showcases.find((s) => s.id === id) ?? null
    else if (type === 'shelf') activeShelf.value = c.shelves.find((s) => s.id === id) ?? null
    else if (type === 'info') showInfo.value = true
    if (activeShowcase.value || activeShelf.value || showInfo.value) bridge.emit('ui:opened')
  })
})

onUnmounted(() => {
  offInteract?.()
  game?.destroy(true)
})

function closeAll() {
  activeShowcase.value = null
  activeShelf.value = null
  showInfo.value = false
  bridge.emit('ui:closed')
}
</script>

<template>
  <div v-if="loadError" class="error">
    <p>內容載入失敗，請重新整理再試一次。</p>
  </div>
  <template v-else>
    <div ref="container" class="game" />
    <TouchControls v-if="isTouch" />
    <BookViewer v-if="activeShowcase" :showcase="activeShowcase" @close="closeAll" />
    <ShelfPanel v-if="activeShelf" :shelf="activeShelf" @close="closeAll" />
    <StoreInfoCard v-if="showInfo && content" :info="content.storeInfo" @close="closeAll" />
  </template>
</template>

<style>
.game { width: 100vw; height: 100vh; }
.error { color: #f5efe0; display: flex; height: 100vh; align-items: center; justify-content: center; }
</style>
```

`src/main.ts` 整檔替換：

```ts
import { createApp } from 'vue'
import App from './App.vue'
import { bridge } from './bridge/EventBridge'

if (import.meta.env.DEV) {
  // E2E 測試用：讓 Playwright 能直接觸發 bridge 事件
  ;(window as unknown as { __bridge: typeof bridge }).__bridge = bridge
}

createApp(App).mount('#app')
```

- [ ] **Step 2: 產生內容並手動驗證完整流程**

Run: `npm run assets && npm run content`（無 STORYBLOK_TOKEN 時自動用 sample——若 Task 10 尚未做，先手動 `cp scripts/sample-content.json public/content.json`）
Run: `npm run dev`

Expected 手動檢查清單：
1. 角色走到左上互動區 → 「點擊翻閱」提示 → 按 E → BookViewer 開啟，顯示「手工蠟燭系列」
2. 翻到最後一頁 → 出現「創作者 IG →」
3. 開啟 overlay 時按方向鍵角色不動；關閉後恢復移動
4. 走到左下 shelf-1 → 按 E → 書單面板
5. 走到右下 info-1 → 按 E → 店家資訊卡
6. DevTools console 無紅字

- [ ] **Step 3: 跑全部測試**

Run: `npm run test`
Expected: 全 PASS

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: wire phaser scene to vue overlays via event bridge"
```

---

### Task 10: Storyblok 內容抓取腳本

**Files:**
- Create: `src/content/storyblok.ts`, `scripts/fetch-content.ts`
- Test: `tests/storyblok.test.ts`

**Interfaces:**
- Consumes: `ContentBundleSchema`（Task 2）
- Produces:
  - `mapStoriesToBundle(stories: unknown[]): ContentBundle` — Storyblok stories → ContentBundle（component 名稱約定：`showcase`、`shelf`、`store_info`；story 的 `slug` 作為互動點 id）
  - CLI `npm run content`：有 `STORYBLOK_TOKEN` 時抓 API，無 token 時複製 sample，兩者都寫入 `public/content.json`

- [ ] **Step 1: 寫 failing test**

`tests/storyblok.test.ts`：

```ts
import { describe, it, expect } from 'vitest'
import { mapStoriesToBundle } from '../src/content/storyblok'

const stories = [
  {
    slug: 'showcase-1',
    content: {
      component: 'showcase',
      title: '手工蠟燭',
      creator_link: { url: 'https://instagram.com/c' },
      pages: [
        { image: { filename: 'https://a.storyblok.com/f/1.jpg' }, caption: '描述一' },
      ],
    },
  },
  {
    slug: 'shelf-1',
    content: {
      component: 'shelf',
      title: '店主精選',
      books: [{ cover: { filename: 'https://a.storyblok.com/f/b.jpg' }, title: '書名', note: '短評' }],
    },
  },
  {
    slug: 'store-info',
    content: {
      component: 'store_info',
      address: '台東市中山路 123 號',
      hours: '週三至週日 11:00–19:00',
      instagram: { url: 'https://instagram.com/store' },
      map_link: { url: 'https://maps.google.com/?q=x' },
    },
  },
]

describe('mapStoriesToBundle', () => {
  it('把三種 component 映射成 ContentBundle', () => {
    const bundle = mapStoriesToBundle(stories)
    expect(bundle.showcases[0]).toEqual({
      id: 'showcase-1',
      title: '手工蠟燭',
      creatorLink: 'https://instagram.com/c',
      pages: [{ image: 'https://a.storyblok.com/f/1.jpg', caption: '描述一' }],
    })
    expect(bundle.shelves[0].id).toBe('shelf-1')
    expect(bundle.storeInfo.address).toBe('台東市中山路 123 號')
  })

  it('creator_link 空值時省略 creatorLink', () => {
    const noLink = structuredClone(stories) as any
    noLink[0].content.creator_link = { url: '' }
    const bundle = mapStoriesToBundle(noLink)
    expect(bundle.showcases[0].creatorLink).toBeUndefined()
  })

  it('缺 store_info story 時丟出錯誤', () => {
    expect(() => mapStoriesToBundle(stories.slice(0, 2))).toThrow('store_info')
  })
})
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npm run test -- tests/storyblok.test.ts`
Expected: FAIL（模組不存在）

- [ ] **Step 3: 實作**

`src/content/storyblok.ts`：

```ts
import { ContentBundleSchema, type ContentBundle } from './schema'

interface SbAsset { filename?: string }
interface SbLink { url?: string }
interface SbStory {
  slug: string
  content: {
    component: string
    [key: string]: unknown
  }
}

export function mapStoriesToBundle(rawStories: unknown[]): ContentBundle {
  const stories = rawStories as SbStory[]

  const showcases = stories
    .filter((s) => s.content.component === 'showcase')
    .map((s) => {
      const link = (s.content.creator_link as SbLink | undefined)?.url
      return {
        id: s.slug,
        title: s.content.title as string,
        pages: (s.content.pages as { image: SbAsset; caption: string }[]).map((p) => ({
          image: p.image.filename ?? '',
          caption: p.caption,
        })),
        ...(link ? { creatorLink: link } : {}),
      }
    })

  const shelves = stories
    .filter((s) => s.content.component === 'shelf')
    .map((s) => ({
      id: s.slug,
      title: s.content.title as string,
      books: (s.content.books as { cover: SbAsset; title: string; note: string }[]).map((b) => ({
        cover: b.cover.filename ?? '',
        title: b.title,
        note: b.note,
      })),
    }))

  const infoStory = stories.find((s) => s.content.component === 'store_info')
  if (!infoStory) throw new Error('CMS 缺少 store_info（實體店資訊）')
  const c = infoStory.content
  const storeInfo = {
    address: c.address as string,
    hours: c.hours as string,
    instagram: ((c.instagram as SbLink)?.url ?? '') as string,
    mapLink: ((c.map_link as SbLink)?.url ?? '') as string,
  }

  return ContentBundleSchema.parse({ showcases, shelves, storeInfo })
}
```

`scripts/fetch-content.ts`：

```ts
import { copyFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { mapStoriesToBundle } from '../src/content/storyblok'

mkdirSync('public', { recursive: true })
const token = process.env.STORYBLOK_TOKEN

if (!token) {
  copyFileSync('scripts/sample-content.json', 'public/content.json')
  console.log('✓ 無 STORYBLOK_TOKEN，使用 sample content')
  process.exit(0)
}

const url = `https://api.storyblok.com/v2/cdn/stories?version=published&per_page=100&token=${token}`
const res = await fetch(url)
if (!res.ok) {
  console.error(`✗ Storyblok API 失敗：${res.status}`)
  process.exit(1)
}
const { stories } = (await res.json()) as { stories: unknown[] }
const bundle = mapStoriesToBundle(stories)
writeFileSync('public/content.json', JSON.stringify(bundle, null, 2))
console.log(`✓ 已從 Storyblok 抓取 ${bundle.showcases.length} 個展示櫃、${bundle.shelves.length} 個書櫃`)
```

- [ ] **Step 4: 跑測試與腳本驗證**

Run: `npm run test -- tests/storyblok.test.ts`
Expected: PASS（3 tests）

Run: `npm run content`（無 token）
Expected: `✓ 無 STORYBLOK_TOKEN，使用 sample content`；`public/content.json` 存在

Run: `npm run validate`
Expected: `✓ 內容驗證通過`（sample ids 與 generate-map 的互動點一致：showcase-1、showcase-2、shelf-1；info-1 不需內容比對）

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: storyblok fetch script with sample-content fallback"
```

---

### Task 11: Playwright E2E

**Files:**
- Create: `playwright.config.ts`, `e2e/basic.spec.ts`

**Interfaces:**
- Consumes: dev server（`npm run dev`）、`window.__bridge`（Task 9）、UI data-testid（Task 7/8）

備註：E2E 不模擬走路（鍵盤驅動 canvas 太 flaky）——movement 已有單元測試＋Task 9 手動清單。E2E 驗證的是「bridge 事件 → UI 開關」整條接線與手機 viewport 渲染。

- [ ] **Step 1: 寫設定與測試**

`playwright.config.ts`：

```ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: 'e2e',
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
  },
  use: { baseURL: 'http://localhost:5173' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['iPhone 13'] } },
  ],
})
```

`e2e/basic.spec.ts`：

```ts
import { test, expect } from '@playwright/test'

declare global {
  interface Window {
    __bridge: { emit: (event: string, payload?: unknown) => void }
  }
}

test('遊戲載入並渲染 canvas', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('canvas')).toBeVisible({ timeout: 10_000 })
})

test('interact 事件開啟翻書、翻頁、關閉', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('canvas')).toBeVisible({ timeout: 10_000 })

  await page.evaluate(() => {
    window.__bridge.emit('interact', { id: 'showcase-1', type: 'showcase' })
  })

  const viewer = page.getByTestId('book-viewer')
  await expect(viewer).toBeVisible()
  await expect(viewer).toContainText('手工蠟燭系列')

  await page.getByTestId('next').click()
  await expect(viewer).toContainText('2 / 3')

  await page.getByTestId('close').click()
  await expect(viewer).not.toBeVisible()
})

test('shelf 與 info 事件開啟對應面板', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('canvas')).toBeVisible({ timeout: 10_000 })

  await page.evaluate(() => window.__bridge.emit('interact', { id: 'shelf-1', type: 'shelf' }))
  await expect(page.getByTestId('shelf-panel')).toBeVisible()
  await page.getByTestId('close').click()

  await page.evaluate(() => window.__bridge.emit('interact', { id: 'info-1', type: 'info' }))
  await expect(page.getByTestId('store-info')).toBeVisible()
})
```

- [ ] **Step 2: 安裝瀏覽器並執行**

Run: `npx playwright install chromium`
Run: `npm run assets && npm run content && npm run e2e`
Expected: 6 passed（3 tests × 2 projects）

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "test: playwright e2e for bridge-to-ui wiring on desktop and mobile viewports"
```

---

### Task 12: 部署設定與 README

**Files:**
- Create: `README.md`

**Interfaces:**
- Consumes: 全部前置 task

- [ ] **Step 1: 確認完整 build**

Run: `npm run build`
Expected: assets → content → validate → vite build 依序成功，產出 `dist/`

Run: `npx vite preview` → 手動開 http://localhost:4173 走一次 Task 9 的檢查清單
Expected: 與 dev 行為一致

- [ ] **Step 2: 寫 README**

`README.md`：

```markdown
# 書店虛擬展示空間

2D 遊戲化書店逛展網站。角色走動、展示櫃翻書、書櫃書單、實體店資訊。
設計文件：`docs/superpowers/specs/2026-07-19-bookstore-virtual-space-design.md`

## 開發

​```bash
npm install
npm run assets    # 產生佔位素材與地圖（首次必跑）
npm run content   # 產生 content.json（無 token 用 sample）
npm run dev
​```

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
```

（README 中 code fence 前的 `​` 為佔位示意，實際寫檔用正常三反引號。）

- [ ] **Step 3: 手機真機驗收（手動）**

用手機連同網段開 dev server（`npm run dev -- --host`）：
1. 虛擬搖桿出現且可走動
2. 走到互動點 → 點「點擊翻閱」→ 翻書可左右滑動翻頁
3. 直橫向切換版面不破

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "docs: readme with deploy, storyblok model, and asset-swap guide"
```

---

## Self-Review 紀錄

- **Spec coverage**：架構（T6/T9）、元件拆解（T6/T7/T8）、CMS 模型（T2/T10）、build 驗證（T4）、lazy load 與預載（T7 watch 預載；場景素材與商品圖分離——商品圖只在 overlay 開啟時載入）、錯誤處理表全數對應（id 比對 T4、圖片失敗重試 T7、必填欄位 T2/T4、WebGL fallback T6 `Phaser.AUTO`、直橫切換 T6 `Scale.FIT`＋T12 手動驗收）、測試策略（單元 T2-T10、E2E T11、手動 T9/T12）、部署與 webhook（T12）
- **圖片 URL 可達性檢查**：spec 列於 build 驗證。第一階段 Storyblok Asset 欄位保證 URL 來自其 CDN，well-formed 由 zod `.url()` 把關；HTTP 可達性檢查延後（YAGNI，避免 build 打數十個 HEAD 拖慢＋誤殺）。此為 spec 的有意識縮減。
- **Type consistency**：`Zone`/`ZoneType` 單一定義於 `src/game/zones.ts`；bridge 事件 payload 全計畫一致；`creatorLink` optional 貫穿 schema→mapping→UI→測試；sample content ids（showcase-1/2、shelf-1）與 generate-map 互動點（另含 info-1，不需內容）與 validate 測試一致
- **Placeholder scan**：無 TBD/TODO；所有測試與實作皆含完整程式碼
