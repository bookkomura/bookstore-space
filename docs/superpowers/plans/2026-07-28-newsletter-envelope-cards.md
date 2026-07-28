# 小村碎碎念信封卡片 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 將小村碎碎念的期數按鈕呈現為附郵票的信封，並以三角封蓋標示已開啟期數。

**Architecture:** `NewsletterArchive.vue` 的期數按鈕新增兩個純裝飾的 span：每張卡的郵票與選取卡的封蓋。Scoped CSS 負責信封本體、郵票與封蓋視覺；既有 `selectedIndex`、ARIA 選取狀態與內容捲動邏輯不變。

**Tech Stack:** Vue 3、TypeScript、Vue Test Utils、Vitest。

## Global Constraints

- 郵票與封蓋必須有 `aria-hidden="true"`，不改變按鈕可存取名稱。
- 非選取卡不可顯示斜線封口折線或封蓋。
- 選取卡只以方形信封上方的三角形封蓋表示開啟。
- 不使用外部圖片、字型或新增相依套件。
- 維持水平期數列與垂直信紙閱讀區的既有捲動行為。

---

### Task 1: Render and style envelope card decorations

**Files:**
- Modify: `src/ui/NewsletterArchive.vue`
- Modify: `tests/NewsletterArchive.test.ts`

**Interfaces:**
- Consumes: existing `selectedIndex`, `Newsletter` issue data, and `.envelope--open` selected-state class.
- Produces: an `.envelope-stamp` in every issue button and an `.envelope-flap` visible only inside `.envelope--open`.

- [ ] **Step 1: Write the failing component and source-style tests**

```ts
it('renders a decorative stamp on every envelope and an open flap only on the selected issue', () => {
  const wrapper = mount(NewsletterArchive, { props: { newsletters: issues } })

  expect(wrapper.findAll('.envelope-stamp')).toHaveLength(issues.length)
  expect(wrapper.findAll('.envelope-stamp').every((stamp) => stamp.attributes('aria-hidden') === 'true')).toBe(true)
  expect(wrapper.findAll('.envelope--open .envelope-flap')).toHaveLength(1)
  expect(wrapper.find('.envelope--open .envelope-flap').attributes('aria-hidden')).toBe('true')
})

it('does not retain the diagonal envelope-fold style', () => {
  const source = readFileSync('src/ui/NewsletterArchive.vue', 'utf8')

  expect(source).toContain('.envelope-stamp')
  expect(source).toContain('.envelope--open .envelope-flap')
  expect(source).not.toContain('.envelope::before')
})
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npx vitest run tests/NewsletterArchive.test.ts`

Expected: FAIL because the envelope decoration elements and styles do not exist.

- [ ] **Step 3: Add decorative markup without changing issue selection**

Replace the date/title children in each `.envelope` button with the following structure; retain the current click handler and `aria-pressed` binding:

```vue
<span class="envelope-flap" aria-hidden="true" />
<span class="envelope-body">
  <span class="envelope-stamp" aria-hidden="true" />
  <time :datetime="issue.sentAt">{{ displayDate(issue.sentAt) }}</time>
  <span class="envelope-title">{{ displayTitle(issue.subject) }}</span>
</span>
```

- [ ] **Step 4: Replace the diagonal fold CSS with a stamp and selected flap**

Remove `.envelope::before` and `.envelope--open::before`. Keep `.envelope` as the interactive button, make `.envelope-body` the rectangular paper surface, and reserve a 32px upper area when selected. Style `.envelope-stamp` as a small dashed-border rectangle in the body’s upper-right corner. Keep `.envelope-flap` hidden by default and make `.envelope--open .envelope-flap` a centered, upward-pointing CSS triangle using transparent left/right borders and a solid `border-bottom` matching the paper color.

- [ ] **Step 5: Run focused behavior and type checks**

Run: `npx vitest run tests/NewsletterArchive.test.ts && npx vue-tsc --noEmit`

Expected: all `NewsletterArchive` tests pass and `vue-tsc` exits with code 0.

- [ ] **Step 6: Run the complete unit suite**

Run: `npm test`

Expected: all pre-existing passing tests remain green; report any unrelated pre-existing failure separately.

- [ ] **Step 7: Commit**

```bash
git add src/ui/NewsletterArchive.vue tests/NewsletterArchive.test.ts docs/superpowers/specs/2026-07-28-newsletter-envelope-cards-design.md docs/superpowers/plans/2026-07-28-newsletter-envelope-cards.md
git commit -m "feat: style newsletter issues as envelopes"
```
