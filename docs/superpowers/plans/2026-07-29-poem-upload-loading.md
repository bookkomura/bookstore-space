# 拾字成詩載入動畫 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓「拾字成詩」的第三方上傳頁載入期間顯示可存取的「墨跡成詩」轉場，直到 iframe 完成載入。

**Architecture:** `PoemUploadOverlay` 在 iframe 建立後立即顯示一個由 Vue 管理的載入層，並以 iframe 的 `load` 事件結束載入狀態。載入層完全以 scoped CSS 繪製墨暈、四字與細墨線；`<Transition>` 只負責它離開時的淡出，iframe 本身維持既有網址與即刻請求。

**Tech Stack:** Vue 3 `<script setup>`、Vue Test Utils、Vitest、scoped CSS。

## Global Constraints

- iframe URL 固定為 `https://paiwh-poem-display.hf.space/`，不得加入 `sandbox`。
- 保留全螢幕覆蓋層、`title="拾字成詩上傳工具"` 與 `aria-label="關閉拾字成詩"`。
- 初始載入文案固定為「正在鋪開詩頁⋯⋯」。
- 動畫只使用 CSS；不新增套件、影像素材或 Canvas。
- 關閉鍵必須高於 iframe 與載入層，且在等待期間可操作。
- `@media (prefers-reduced-motion: reduce)` 必須移除位移、顯影與循環動畫。

---

### Task 1: 墨跡成詩載入層與元件合約

**Files:**
- Modify: `src/ui/PoemUploadOverlay.vue`
- Modify: `tests/PoemUploadOverlay.test.ts`

**Interfaces:**
- Consumes: iframe `load` DOM event。
- Produces: `data-testid="poem-upload-loading"` 載入層；`data-testid="poem-upload-frame"` 在完成載入時移除該載入層；既有 `close` emit 不變。

- [ ] **Step 1: 擴充元件測試，描述初始載入與載入完成狀態**

  在 `tests/PoemUploadOverlay.test.ts` 的既有關閉測試前加入：

  ```ts
  it('shows the 墨跡成詩 loading layer until the upload frame has loaded', async () => {
    const wrapper = mount(PoemUploadOverlay)

    expect(wrapper.get('[data-testid="poem-upload-loading"]').text()).toContain('正在鋪開詩頁⋯⋯')
    expect(wrapper.get('[data-testid="poem-upload-loading"]').text()).toContain('拾')
    expect(wrapper.get('[data-testid="poem-upload-loading"]').text()).toContain('詩')

    await wrapper.get('[data-testid="poem-upload-frame"]').trigger('load')

    expect(wrapper.find('[data-testid="poem-upload-loading"]').exists()).toBe(false)
  })
  ```

- [ ] **Step 2: 執行測試確認它先失敗**

  Run: `npm test -- tests/PoemUploadOverlay.test.ts`

  Expected: FAIL，因目前元件沒有 `poem-upload-loading` 元素。

- [ ] **Step 3: 在 `PoemUploadOverlay.vue` 建立載入狀態與轉場模板**

  將 script 改為以 `ref(true)` 維護 `isFrameLoading`，並使用 `handleFrameLoad`：

  ```ts
  import { ref } from 'vue'

  const isFrameLoading = ref(true)

  function handleFrameLoad() {
    isFrameLoading.value = false
  }
  ```

  在 iframe 前插入下列 `Transition`；iframe 加上 `@load="handleFrameLoad"`。四字分別以獨立 span 讓 CSS 可依序顯影：

  ```vue
  <Transition name="ink-loading">
    <div v-if="isFrameLoading" class="loading" data-testid="poem-upload-loading" aria-live="polite">
      <div class="ink-bloom" aria-hidden="true" />
      <div class="poem-characters" aria-hidden="true">
        <span>拾</span><span>字</span><span>成</span><span>詩</span>
      </div>
      <div class="ink-line" aria-hidden="true" />
      <p>正在鋪開詩頁⋯⋯</p>
    </div>
  </Transition>
  <iframe data-testid="poem-upload-frame" :src="poemUploadUrl" title="拾字成詩上傳工具" @load="handleFrameLoad" />
  ```

  設定分層：`.overlay` 為 stacking context，`iframe { position: relative; z-index: 0; }`、`.loading { position: absolute; inset: 0; z-index: 1; }`、`button { z-index: 2; }`。`loading` 用深褐黑底與暖米白字，`.ink-bloom` 用柔和 radial gradient，`.poem-characters span` 以短暫的 opacity/transform 顯影並設定 staggered delay；首輪不超過 1.2 秒，完成後只讓 `.ink-bloom` 以低幅度 pulse 持續。

  加入離場規則：

  ```css
  .ink-loading-leave-active { transition: opacity 180ms ease-out; }
  .ink-loading-leave-to { opacity: 0; }
  ```

  加入減少動態效果規則：

  ```css
  @media (prefers-reduced-motion: reduce) {
    .ink-bloom,
    .poem-characters span { animation: none; transform: none; }
    .ink-loading-leave-active { transition: none; }
  }
  ```

- [ ] **Step 4: 執行元件測試確認合約與既有行為都通過**

  Run: `npm test -- tests/PoemUploadOverlay.test.ts`

  Expected: PASS，包含原本的 iframe 安全合約、關閉事件與新增的載入／完成狀態。

- [ ] **Step 5: 執行相關整合測試**

  Run: `npm test -- tests/App.test.ts tests/PoemUploadOverlay.test.ts`

  Expected: PASS；`App` 仍可從 `poemUpload` 互動開啟覆蓋層並正常關閉。

- [ ] **Step 6: 進行視覺與可存取性手動檢查**

  Run: `npm run dev`

  Expected: 開啟「拾字成詩」時立即可見墨跡、四字與文案；關閉鍵可點；iframe 完成後載入層淡出；在作業系統減少動態效果下保持靜態。

- [ ] **Step 7: 提交完成的功能**

  ```bash
  git add src/ui/PoemUploadOverlay.vue tests/PoemUploadOverlay.test.ts
  git commit -m "feat: animate poem upload loading state"
  ```

### Task 2: 完整回歸驗證

**Files:**
- Modify: none
- Test: existing test suite and production build

**Interfaces:**
- Consumes: Task 1 已完成的 `PoemUploadOverlay`。
- Produces: 對可測行為與可部署 build 的驗證結果。

- [ ] **Step 1: 執行所有單元測試**

  Run: `npm test`

  Expected: PASS；所有現有與新增測試通過。

- [ ] **Step 2: 建立正式版本**

  Run: `npm run build`

  Expected: PASS；內容驗證、場景素材驗證與 Vite build 均成功。

- [ ] **Step 3: 檢查最終工作目錄差異**

  Run: `git diff --check && git status --short`

  Expected: `git diff --check` 無輸出；只存在這次功能預期的已提交檔案，且不包含 `.superpowers/brainstorm/` 的視覺草稿。
