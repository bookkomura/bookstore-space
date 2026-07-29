# 拾字成詩手寫字體 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓「拾字成詩」載入動畫的主字與等待文案套用與「小村碎碎念」一致的手寫字體。

**Architecture:** 在既有 `PoemUploadOverlay` 的兩個載入文字區塊加入專責的 CSS class，並以與 `NewsletterArchive` 相同的字體堆疊設定。iframe、載入事件與動畫結構均維持不變。

**Tech Stack:** Vue 3、scoped CSS、Vue Test Utils、Vitest。

## Global Constraints

- 僅調整 `PoemUploadOverlay` 載入層字體。
- 「拾、字、成、詩」與「正在鋪開詩頁⋯⋯」使用 `"LXGW WenKai TC", "Noto Serif TC", serif`。
- 不新增網路請求、字型檔、套件或 Canvas。
- 關閉按鈕、iframe URL、無 `sandbox`、載入流程與動畫時序不得改變。

---

### Task 1: 為載入文字套用碎碎念手寫字體

**Files:**
- Modify: `src/ui/PoemUploadOverlay.vue`
- Modify: `tests/PoemUploadOverlay.test.ts`

**Interfaces:**
- Consumes: 既有 `.poem-characters` 載入主字與 iframe `load` 事件。
- Produces: `data-testid="poem-upload-loading-copy"` 的等待文案元素；載入行為與關閉事件不變。

- [ ] **Step 1: 寫出描述等待文案字體鉤子的失敗測試**

  在既有載入層測試中加入對等待文案元素的檢查：

  ```ts
  const copy = wrapper.get('[data-testid="poem-upload-loading-copy"]')
  expect(copy.text()).toBe('正在鋪開詩頁⋯⋯')
  expect(copy.classes()).toContain('loading-copy')
  ```

- [ ] **Step 2: 執行測試確認先失敗**

  Run: `npm test -- tests/PoemUploadOverlay.test.ts`

  Expected: FAIL，因等待文案尚未提供 `poem-upload-loading-copy` 測試識別與 `loading-copy` class。

- [ ] **Step 3: 加入最小模板與 CSS 調整**

  將等待文案改為：

  ```vue
  <p class="loading-copy" data-testid="poem-upload-loading-copy">正在鋪開詩頁⋯⋯</p>
  ```

  將 `.poem-characters` 的現有 `font-family: serif` 改為：

  ```css
  font-family: "LXGW WenKai TC", "Noto Serif TC", serif;
  ```

  在 `.loading-copy` 加入同一個 `font-family`；其餘 `.loading p` 的尺寸與字距保留，以維持動畫版面與時序。不要修改按鈕、iframe、`isFrameLoading`、`handleFrameLoad`、transition、動畫 keyframes 或 reduced-motion 規則。

- [ ] **Step 4: 執行元件測試確認通過**

  Run: `npm test -- tests/PoemUploadOverlay.test.ts`

  Expected: PASS；載入文字、iframe 載入後移除、原有 URL／無 sandbox／關閉事件合約皆通過。

- [ ] **Step 5: 執行相關整合測試**

  Run: `npm test -- tests/App.test.ts tests/PoemUploadOverlay.test.ts`

  Expected: PASS；從遊戲互動開啟與關閉「拾字成詩」仍正常。

- [ ] **Step 6: 手動驗收字體範圍**

  Run: `npm run dev`

  Expected: 載入中的四個主字與等待文案為手寫字感；關閉鍵維持原字體，iframe 內容與載入／淡出節奏不變。

- [ ] **Step 7: 提交功能調整**

  ```bash
  git add src/ui/PoemUploadOverlay.vue tests/PoemUploadOverlay.test.ts
  git commit -m "style: use handwriting font for poem loading"
  ```
