# 拾字成詩中央方桌互動 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在中央方桌加入「拾字成詩」互動點，讓訪客在同頁全螢幕使用外部詩集上傳網站。

**Architecture:** Phaser 保留互動範圍偵測與橋接事件；新增 `poemUpload` 靜態區域與固定標籤。Vue 根元件收到事件後渲染專責的 `PoemUploadOverlay`，以未沙箱化的 iframe 載入外部網址，關閉時沿用既有 `ui:closed` 流程恢復場景。

**Tech Stack:** Vue 3、TypeScript、Phaser 3、Vitest、Vue Test Utils、Playwright。

## Global Constraints

- 固定互動 ID 為 `poem-upload-1`，固定顯示名稱為「拾字成詩」，`ZoneType` 值為 `poemUpload`。
- 互動點位於中間方桌（`table-lower-middle`）上方可行走通道：`x: 630, y: 570, width: 220, height: 64, anchorX: 742, anchorY: 630`；不得與桌或座椅碰撞區重疊。
- 桌機使用空白鍵 `Space`，手機沿用既有互動按鈕與標記點擊。
- iframe URL 固定為 `https://paiwh-poem-display.hf.space/`，不得使用 `sandbox`，不得提供另開分頁連結。
- 覆蓋層填滿 viewport，關閉鍵須為可聚焦的 `aria-label="關閉拾字成詩"`；iframe title 為「拾字成詩上傳工具」。
- 開啟送出 `ui:opened`、凍結角色；關閉鍵與 `Escape` 送出 `ui:closed`，不改變玩家位置。

---

## File Structure

- `src/game/zones.ts`：擴充 `ZoneType` 聯集。
- `src/game/sceneLayout.ts`：中央方桌上方新增靜態互動區。
- `src/game/interactionLabels.ts`：新增固定標籤。
- `src/ui/PoemUploadOverlay.vue`：全螢幕 iframe 與關閉控制；不含第三方網站邏輯。
- `src/App.vue`：管理覆蓋層狀態與 `poemUpload` 事件。
- `tests/zones.test.ts`、`tests/sceneLayout.test.ts`、`tests/interactionLabels.test.ts`：保護場景與標籤行為。
- `tests/PoemUploadOverlay.test.ts`：保護 URL、可近用性、無 sandbox 與 close 事件。
- `tests/App.test.ts`：保護事件到覆蓋層、關閉和 `Escape` 行為。
- `e2e/basic.spec.ts`：保護瀏覽器中全螢幕顯示與關閉。

### Task 1: 新增中央方桌互動的場景合約

**Files:**

- Modify: `src/game/zones.ts:1`
- Modify: `src/game/sceneLayout.ts:44-71`
- Modify: `src/game/interactionLabels.ts:5-16`
- Modify: `tests/zones.test.ts:1-25`
- Modify: `tests/sceneLayout.test.ts:18-35`
- Modify: `tests/interactionLabels.test.ts:10-25`

**Interfaces:**

- Consumes: `Zone` 的 `{ id, type, x, y, width, height, anchorX, anchorY }` 與 `ContentBundle`。
- Produces: `ZoneType` 成員 `'poemUpload'`；唯一詩集區與 `buildInteractionLabels(content)['poem-upload-1'] === '拾字成詩'`。

- [ ] **Step 1: 寫出失敗的區域與標籤測試**

```ts
it('accepts poemUpload as an interaction zone type', () => {
  const zone: Zone = { id: 'poem-upload-1', type: 'poemUpload', x: 630, y: 570, width: 220, height: 64, anchorX: 742, anchorY: 630 }
  expect(findNearestZone(742, 600, [zone])).toEqual(zone)
})

it('places poem upload above the middle square table', () => {
  expect(STATIC_INTERACTION_ZONES.find((zone) => zone.id === 'poem-upload-1')).toEqual(
    { id: 'poem-upload-1', type: 'poemUpload', x: 630, y: 570, width: 220, height: 64, anchorX: 742, anchorY: 630 },
  )
})

it('keeps poem upload reachable above the table collision', () => {
  const zone = STATIC_INTERACTION_ZONES.find((item) => item.id === 'poem-upload-1')!
  const table = COLLISION_RECTS.find((item) => item.id === 'table-lower-middle')!
  expect(zone.y + zone.height).toBeLessThanOrEqual(table.y)
})

it('labels the poem upload table', () => {
  expect(buildInteractionLabels(content)['poem-upload-1']).toBe('拾字成詩')
})
```

- [ ] **Step 2: 執行測試，確認它因功能不存在而失敗**

Run: `npm test -- tests/zones.test.ts tests/sceneLayout.test.ts tests/interactionLabels.test.ts`

Expected: FAIL；`poemUpload` 尚不是 `ZoneType`，且缺少固定區域與標籤。

- [ ] **Step 3: 寫最小場景實作**

在 `src/game/zones.ts` 將型別改為：

```ts
export type ZoneType = 'showcase' | 'shelf' | 'info' | 'archive' | 'poemUpload'
```

在 `STATIC_INTERACTION_ZONES` 加入：

```ts
{ id: 'poem-upload-1', type: 'poemUpload', x: 630, y: 570, width: 220, height: 64, anchorX: 742, anchorY: 630 },
```

在 `buildInteractionLabels` 加入：

```ts
'poem-upload-1': '拾字成詩',
```

- [ ] **Step 4: 執行測試，確認通過**

Run: `npm test -- tests/zones.test.ts tests/sceneLayout.test.ts tests/interactionLabels.test.ts`

Expected: PASS；詩集區可被 proximity 查找、位置不碰撞中央方桌、標籤正確。

- [ ] **Step 5: 提交場景合約**

```bash
git add src/game/zones.ts src/game/sceneLayout.ts src/game/interactionLabels.ts tests/zones.test.ts tests/sceneLayout.test.ts tests/interactionLabels.test.ts
git commit -m "feat: add poem upload interaction zone"
```

### Task 2: 建立全螢幕詩集上傳覆蓋層

**Files:**

- Create: `src/ui/PoemUploadOverlay.vue`
- Create: `tests/PoemUploadOverlay.test.ts`

**Interfaces:**

- Consumes: 無 props。
- Produces: `close` 事件；根元素 `data-testid="poem-upload-overlay"`、iframe `data-testid="poem-upload-frame"`、關閉鍵 `data-testid="close"`。

- [ ] **Step 1: 寫出失敗的元件測試**

```ts
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PoemUploadOverlay from '../src/ui/PoemUploadOverlay.vue'

describe('PoemUploadOverlay', () => {
  it('loads the poem upload site in a full-screen accessible frame', () => {
    const wrapper = mount(PoemUploadOverlay)
    const frame = wrapper.get('[data-testid="poem-upload-frame"]')
    expect(frame.attributes()).toMatchObject({ src: 'https://paiwh-poem-display.hf.space/', title: '拾字成詩上傳工具' })
    expect(frame.attributes('sandbox')).toBeUndefined()
    expect(wrapper.get('[data-testid="close"]').attributes('aria-label')).toBe('關閉拾字成詩')
    expect(getComputedStyle(wrapper.get('[data-testid="poem-upload-overlay"]').element).position).toBe('fixed')
  })

  it('emits close when its close button is clicked', async () => {
    const wrapper = mount(PoemUploadOverlay)
    await wrapper.get('[data-testid="close"]').trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(1)
  })
})
```

- [ ] **Step 2: 執行測試，確認它因元件不存在而失敗**

Run: `npm test -- tests/PoemUploadOverlay.test.ts`

Expected: FAIL，無法解析 `../src/ui/PoemUploadOverlay.vue`。

- [ ] **Step 3: 寫最小覆蓋層元件**

建立下列結構；不要為 iframe 加 `sandbox` 屬性：

```vue
<script setup lang="ts">
const emit = defineEmits<{ close: [] }>()
const poemUploadUrl = 'https://paiwh-poem-display.hf.space/'
</script>

<template>
  <section class="overlay" data-testid="poem-upload-overlay">
    <button data-testid="close" aria-label="關閉拾字成詩" @click="emit('close')">✕</button>
    <iframe data-testid="poem-upload-frame" :src="poemUploadUrl" title="拾字成詩上傳工具" />
  </section>
</template>
```

在 scoped CSS：`.overlay` 使用 `position: fixed; inset: 0; z-index: 100`；iframe 寬高 100%、無邊框；按鈕採 absolute 右上定位與 `z-index: 1`，保持在 iframe 上方。

- [ ] **Step 4: 執行測試，確認通過**

Run: `npm test -- tests/PoemUploadOverlay.test.ts`

Expected: PASS；URL、title、無 sandbox、關閉事件與 fixed overlay 全都符合合約。

- [ ] **Step 5: 提交覆蓋層**

```bash
git add src/ui/PoemUploadOverlay.vue tests/PoemUploadOverlay.test.ts
git commit -m "feat: add poem upload overlay"
```

### Task 3: 連接橋接事件與 Vue 狀態

**Files:**

- Modify: `src/App.vue:1-121`
- Modify: `tests/App.test.ts:1-190`

**Interfaces:**

- Consumes: `{ id: 'poem-upload-1', type: 'poemUpload' }` 與 Task 2 的 `close` 事件。
- Produces: `showPoemUpload: Ref<boolean>`；`uiOpen` 包含新狀態；`closeAll()` 也清除詩集介面。

- [ ] **Step 1: 寫出失敗的 App 整合測試**

```ts
it('opens 拾字成詩 in the overlay and releases the scene on close', async () => {
  mocks.loadContent.mockResolvedValue(content)
  const opened = vi.fn()
  const closed = vi.fn()
  const offOpened = bridge.on('ui:opened', opened)
  const offClosed = bridge.on('ui:closed', closed)
  const wrapper = await mountApp()
  bridge.emit('interact', { id: 'poem-upload-1', type: 'poemUpload' })
  await flushPromises()
  expect(wrapper.get('[data-testid="poem-upload-frame"]').attributes('src')).toBe('https://paiwh-poem-display.hf.space/')
  expect(opened).toHaveBeenCalledOnce()
  await wrapper.get('[data-testid="poem-upload-overlay"] [data-testid="close"]').trigger('click')
  expect(wrapper.find('[data-testid="poem-upload-overlay"]').exists()).toBe(false)
  expect(closed).toHaveBeenCalledOnce()
  offOpened()
  offClosed()
})

it('closes 拾字成詩 when Escape is pressed', async () => {
  mocks.loadContent.mockResolvedValue(content)
  const wrapper = await mountApp()
  bridge.emit('interact', { id: 'poem-upload-1', type: 'poemUpload' })
  await flushPromises()
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
  await flushPromises()
  expect(wrapper.find('[data-testid="poem-upload-overlay"]').exists()).toBe(false)
})
```

- [ ] **Step 2: 執行測試，確認它因 App 尚未處理新事件而失敗**

Run: `npm test -- tests/App.test.ts`

Expected: FAIL，找不到 `poem-upload-frame` 或 TypeScript 拒絕新互動類型。

- [ ] **Step 3: 寫最小 App 整合**

在 `App.vue` 加入：

```ts
import PoemUploadOverlay from './ui/PoemUploadOverlay.vue'
const showPoemUpload = ref(false)
```

將 `showPoemUpload.value` 納入 `uiOpen`，並在 `openInteraction` 加入：

```ts
} else if (type === 'poemUpload') {
  showPoemUpload.value = true
}
```

在 `closeAll` 設定 `showPoemUpload.value = false`，並在 template 的其他互動元件旁加入：

```vue
<PoemUploadOverlay v-if="showPoemUpload" @close="closeAll" />
```

- [ ] **Step 4: 執行測試，確認通過**

Run: `npm test -- tests/App.test.ts tests/PoemUploadOverlay.test.ts`

Expected: PASS；開啟觸發 `ui:opened`，按鈕與 `Escape` 皆關閉並觸發 `ui:closed`。

- [ ] **Step 5: 提交 App 整合**

```bash
git add src/App.vue tests/App.test.ts
git commit -m "feat: open poem upload from table"
```

### Task 4: 驗證真實瀏覽器互動與完整回歸

**Files:**

- Modify: `e2e/basic.spec.ts:1-120`

**Interfaces:**

- Consumes: `window.__bridge`、`poem-upload-1` 事件與覆蓋層 test IDs。
- Produces: 對全螢幕 iframe、可關閉性與關閉後場景恢復的 Playwright 回歸驗證。

- [ ] **Step 1: 寫出瀏覽器測試**

```ts
test('拾字成詩以同頁全螢幕介面開啟並可關閉', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('canvas')).toBeVisible({ timeout: 10_000 })
  await page.evaluate(() => window.__bridge.emit('interact', { id: 'poem-upload-1', type: 'poemUpload' }))
  const overlay = page.getByTestId('poem-upload-overlay')
  await expect(overlay).toBeVisible()
  await expect(page.getByTestId('poem-upload-frame')).toHaveAttribute('src', 'https://paiwh-poem-display.hf.space/')
  await page.getByTestId('close').click()
  await expect(overlay).not.toBeVisible()
})
```

- [ ] **Step 2: 執行新 E2E 並確認行為**

Run: `npm run e2e -- --grep "拾字成詩以同頁全螢幕"`

Expected: PASS（Task 1–3 已先完成）；若 iframe 的跨網域內容無法由 Playwright 讀取，不測其 DOM，只驗證本系統控制的 URL、可見性與關閉。

- [ ] **Step 3: 執行完整回歸**

Run: `npm test && npm run build && npm run e2e`

Expected: 所有單元測試、內容驗證、資產驗證、Vite production build 與 Playwright 測試皆 PASS。

- [ ] **Step 4: 提交 E2E 與完成驗收**

```bash
git add e2e/basic.spec.ts
git commit -m "test: cover poem upload interaction"
```

手動在部署版桌機與手機開啟「拾字成詩」，選擇檔案並執行網站原生上傳流程；確認關閉後人物停留在開啟前的位置。
