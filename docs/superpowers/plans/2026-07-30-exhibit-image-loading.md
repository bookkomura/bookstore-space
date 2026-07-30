# 展示圖片逐張載入 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓展示櫃與本月選書的每張圖片在載入期間顯示同一款細框描繪動畫，而不留下空白。

**Architecture:** 以單一 Vue `ImageFrame` 元件管理每一張圖片的 `loading`、`loaded` 與 `error` 狀態。展示櫃與選書只提供各自的尺寸與物件填充方式；兩者共享視覺、載入事件與減少動態支援，但不共享版面規則。

**Tech Stack:** Vue 3 Composition API、TypeScript、Vue Test Utils、Vitest、scoped CSS。

## Global Constraints

- 本月選書和展示櫃必須使用同一套細框描繪 Loading，且不顯示載入文案或通用轉圈。
- 每張圖片獨立切換狀態；一張圖片載入完成不得等待或改變其他圖片。
- Loading 使用既有深棕黑、米白與暖金色視覺語言。
- `prefers-reduced-motion: reduce` 時停用描繪與呼吸動畫，保留靜態細框。
- 展示櫃的圖片載入失敗須維持現有的「圖片載入失敗／重試」行為。
- 本月選書封面框維持 80×112px，避免載入前後的版面跳動。

---

### Task 1: 建立可重用的作品圖片框

**Files:**
- Create: `src/ui/ImageFrame.vue`
- Create: `tests/ImageFrame.test.ts`

**Interfaces:**
- Consumes: `src` 與 `alt` 字串；可選 `fit: 'contain' | 'cover'`，預設為 `'contain'`。
- Produces: `data-testid="image-frame"` 容器、載入時的 `data-testid="image-loader"`、完成圖片的 `data-testid="image"`，`error` event 與 `#error` 插槽。

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ImageFrame from '../src/ui/ImageFrame.vue'

describe('ImageFrame', () => {
  it('在圖片載入前顯示細框 Loading，完成後只顯示圖片', async () => {
    const wrapper = mount(ImageFrame, {
      props: { src: 'https://example.com/work.jpg', alt: '作品' },
    })

    expect(wrapper.get('[data-testid="image-loader"]').attributes('aria-hidden')).toBe('true')
    expect(wrapper.get('[data-testid="image"]').classes()).toContain('image--loading')

    await wrapper.get('[data-testid="image"]').trigger('load')

    expect(wrapper.find('[data-testid="image-loader"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="image"]').classes()).not.toContain('image--loading')
  })

  it('在載入失敗時顯示 error 插槽並發出 error', async () => {
    const wrapper = mount(ImageFrame, {
      props: { src: 'https://example.com/missing.jpg', alt: '遺失作品' },
      slots: { error: '<button data-testid="retry">重試</button>' },
    })

    await wrapper.get('[data-testid="image"]').trigger('error')

    expect(wrapper.find('[data-testid="image-loader"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="image"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="retry"]').text()).toBe('重試')
    expect(wrapper.emitted('error')).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ImageFrame.test.ts`

Expected: FAIL because `src/ui/ImageFrame.vue` does not yet exist.

- [ ] **Step 3: Write minimal implementation**

```vue
<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const props = withDefaults(defineProps<{
  src: string
  alt: string
  fit?: 'contain' | 'cover'
}>(), { fit: 'contain' })
const emit = defineEmits<{ error: [] }>()
const status = ref<'loading' | 'loaded' | 'error'>('loading')
const imageClass = computed(() => [
  'image',
  `image--${props.fit}`,
  { 'image--loading': status.value === 'loading' },
])
watch(() => props.src, () => { status.value = 'loading' })
function fail() { status.value = 'error'; emit('error') }
</script>

<template>
  <div class="frame" data-testid="image-frame">
    <span v-if="status === 'loading'" class="loader" data-testid="image-loader" aria-hidden="true" />
    <img
      v-if="status !== 'error'"
      :src="src"
      :alt="alt"
      :class="imageClass"
      data-testid="image"
      @load="status = 'loaded'"
      @error="fail"
    >
    <slot v-else name="error" />
  </div>
</template>

<style scoped>
.frame { position: relative; overflow: hidden; background: #21170a; }
.image { display: block; width: 100%; height: 100%; opacity: 1; transition: opacity 180ms ease; }
.image--contain { object-fit: contain; }
.image--cover { object-fit: cover; }
.image--loading { opacity: 0; }
.loader { position: absolute; inset: 0; border: 1px solid rgba(240, 184, 96, .35); }
.loader::after { content: ''; position: absolute; inset: 7px; border: 2px solid transparent; border-top-color: #f0b860; border-right-color: #f0b860; animation: trace-frame 1.2s linear infinite; }
@keyframes trace-frame { to { transform: rotate(1turn); } }
@media (prefers-reduced-motion: reduce) { .loader::after { animation: none; } }
</style>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/ImageFrame.test.ts`

Expected: PASS; the loader is initially present, disappears only for its own loaded image, and the error slot replaces a failed image.

- [ ] **Step 5: Commit**

```bash
git add src/ui/ImageFrame.vue tests/ImageFrame.test.ts
git commit -m "feat: add framed image loader"
```

### Task 2: 將展示櫃與本月選書接到共用圖片框

**Files:**
- Modify: `src/ui/BookViewer.vue`
- Modify: `src/ui/ShelfPanel.vue`
- Modify: `tests/BookViewer.test.ts`
- Modify: `tests/ShelfPanel.test.ts`

**Interfaces:**
- Consumes: Task 1 的 `ImageFrame`，以 `src`、`alt`、`fit`、`@error` 與 `#error` 插槽使用。
- Produces: 展示櫃與每個本月選書封面都在載入前有 `image-loader`；BookViewer 將原本的 `failed` 狀態改交給 `ImageFrame` 的 `#error` 插槽，`retry()` 透過新的 key 重新建立 `ImageFrame`。

- [ ] **Step 1: Write the failing tests**

```ts
it('展示櫃在每一頁圖片載入前顯示細框 Loading，完成後隱藏', async () => {
  const wrapper = mount(BookViewer, { props: { showcase } })

  expect(wrapper.get('[data-testid="image-loader"]').exists()).toBe(true)
  await wrapper.get('[data-testid="image"]').trigger('load')
  expect(wrapper.find('[data-testid="image-loader"]').exists()).toBe(false)

  await wrapper.get('[data-testid="next"]').trigger('click')
  expect(wrapper.get('[data-testid="image-loader"]').exists()).toBe(true)
})

it('本月選書的封面各自完成載入，不等待其他封面', async () => {
  const wrapper = mount(ShelfPanel, { props: { shelf } })

  expect(wrapper.findAll('[data-testid="image-loader"]')).toHaveLength(2)
  await wrapper.findAll('[data-testid="image"]')[0].trigger('load')

  expect(wrapper.findAll('[data-testid="image-loader"]')).toHaveLength(1)
  expect(wrapper.findAll('[data-testid="image"]')[0].classes()).not.toContain('image--loading')
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/BookViewer.test.ts tests/ShelfPanel.test.ts`

Expected: FAIL because these components do not yet render `ImageFrame` or its loader.

- [ ] **Step 3: Write minimal integration**

```vue
<!-- BookViewer.vue：以 ImageFrame 取代 page 內的 img。 -->
<ImageFrame
  :key="`${pageIndex}-${retryKey}`"
  :src="page.image"
  :alt="page.caption"
  fit="contain"
  class="page-image"
>
  <template #error>
    <div class="placeholder">
      <p>圖片載入失敗</p>
      <button data-testid="retry" @click="retry">重試</button>
    </div>
  </template>
</ImageFrame>

<!-- ShelfPanel.vue：每本書以固定大小 ImageFrame 取代 img。 -->
<ImageFrame :src="book.cover" :alt="book.title" fit="cover" class="book-cover" />
```

Move the prior image sizing rules to `.page-image` and `.book-cover` without changing the 80×112px selection-cover dimensions. Keep the BookViewer image frame mounted on failure so the error slot can replace its image.
Remove `failed` from BookViewer because `ImageFrame` now owns the loaded/error state; retain `retryKey` so retry creates a fresh image request.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/ImageFrame.test.ts tests/BookViewer.test.ts tests/ShelfPanel.test.ts`

Expected: PASS; both overlays use the shared loader, page changes reset only the new work's loader, and a completed book cover does not wait for the other cover.

- [ ] **Step 5: Run regression verification**

Run: `npm test && npx vue-tsc --noEmit && npm run build`

Expected: PASS; all tests, TypeScript validation, CMS validation and production build complete successfully.

- [ ] **Step 6: Commit**

```bash
git add src/ui/BookViewer.vue src/ui/ShelfPanel.vue tests/BookViewer.test.ts tests/ShelfPanel.test.ts
git commit -m "feat: show loaders for exhibit images"
```

## Self-review

- Spec coverage: Task 1 supplies the shared fine-frame Loading, image state boundaries, error interface and reduced-motion fallback. Task 2 applies it to both requested surfaces, keeps the 80×112px cover footprint, preserves the showcase retry flow and validates independent image completion.
- Placeholder scan: no incomplete implementation steps, unbounded “appropriate” instructions or unresolved identifiers remain.
- Type consistency: `ImageFrame` consistently accepts `src`/`alt`/`fit`; Task 2 uses IDs produced in Task 1; the shared component owns the loaded/error state and the parent uses its error slot for the existing retry action.
