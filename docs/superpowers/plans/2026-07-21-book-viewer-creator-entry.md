# Book Viewer Creator Entry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep a `認識創作者` link in the BookViewer header on every page and emphasize it on the last page without moving any viewer content.

**Architecture:** Keep the existing optional `Showcase.creatorLink` data flow unchanged. Render one semantic anchor in the BookViewer header whenever that URL exists, and let the existing `isLast` computed value toggle only an emphasis class. Verify behavior at the component level and geometry at the browser level.

**Tech Stack:** Vue 3 Composition API, TypeScript, scoped CSS, Vitest, Vue Test Utils, Playwright

## Global Constraints

- The visible link copy is exactly `認識創作者 ↗`.
- The anchor appears on every page when `showcase.creatorLink` exists and never appears when it is absent.
- The ordinary and last-page states have identical width, height, padding, border width, and grid position.
- The last page may run one short fade but must not animate continuously; `prefers-reduced-motion: reduce` must result in no emphasis animation.
- The link opens in a new tab with `rel="noopener"`, has a visible keyboard focus treatment, and exposes that it opens a new page through its accessible name.
- At a 320-pixel viewport, the title truncates before the creator link or close control shrinks, overlaps, or causes horizontal scrolling.
- Do not change the content schema, Storyblok mapping, image sizing, captions, paging behavior, or other overlay components.

---

## File Structure

- Modify `tests/BookViewer.test.ts` to specify persistent rendering, last-page emphasis, stable DOM identity, link security attributes, and the absent-link case.
- Modify `src/ui/BookViewer.vue` to move the creator anchor into the header and provide stable ordinary, emphasized, responsive, focus, and reduced-motion styles.
- Modify `e2e/basic.spec.ts` to measure layout stability between the first and last pages and verify the 320-pixel header layout.

### Task 1: Persistent creator link and last-page emphasis

**Files:**
- Modify: `tests/BookViewer.test.ts:32-43`
- Modify: `src/ui/BookViewer.vue:55-58,81-88,104-121,173-177`

**Interfaces:**
- Consumes: `Showcase.creatorLink?: string` and the existing `isLast: ComputedRef<boolean>` inside `BookViewer`.
- Produces: one `[data-testid="creator-link"]` anchor with class `creator`, conditional class `creator--emphasized`, copy `認識創作者 ↗`, and an accessible name indicating new-page behavior.

- [ ] **Step 1: Replace the last-page-only tests with failing persistence and emphasis tests**

Replace the two creator-link tests in `tests/BookViewer.test.ts` with:

```ts
  it('每一頁顯示同一個創作者連結，最後一頁只切換強調狀態', async () => {
    const w = mount(BookViewer, { props: { showcase } })
    const firstPageLink = w.get('[data-testid="creator-link"]')

    expect(firstPageLink.text()).toBe('認識創作者 ↗')
    expect(firstPageLink.attributes()).toMatchObject({
      href: 'https://instagram.com/creator',
      target: '_blank',
      rel: 'noopener',
      'aria-label': '認識創作者（在新分頁開啟）',
    })
    expect(firstPageLink.classes()).not.toContain('creator--emphasized')

    await w.get('[data-testid="next"]').trigger('click')

    const lastPageLink = w.get('[data-testid="creator-link"]')
    expect(lastPageLink.element).toBe(firstPageLink.element)
    expect(lastPageLink.classes()).toContain('creator--emphasized')

    await w.get('[data-testid="prev"]').trigger('click')
    expect(w.get('[data-testid="creator-link"]').classes()).not.toContain(
      'creator--emphasized',
    )
  })

  it('無 creatorLink 時所有頁面都不渲染創作者連結', async () => {
    const w = mount(BookViewer, {
      props: { showcase: { ...showcase, creatorLink: undefined } },
    })

    expect(w.find('[data-testid="creator-link"]').exists()).toBe(false)
    await w.get('[data-testid="next"]').trigger('click')
    expect(w.find('[data-testid="creator-link"]').exists()).toBe(false)
  })
```

- [ ] **Step 2: Run the focused tests and verify the new persistence test fails**

Run:

```bash
npm run test -- tests/BookViewer.test.ts
```

Expected: FAIL because the creator link is absent on page 1 and still uses the old `創作者 IG →` copy.

- [ ] **Step 3: Move the creator link into the header**

Replace the current `<header>` and remove the creator anchor below `<footer>`. The header portion of `src/ui/BookViewer.vue` becomes:

```vue
    <header>
      <h2>{{ showcase.title }}</h2>
      <a
        v-if="showcase.creatorLink"
        data-testid="creator-link"
        class="creator"
        :class="{ 'creator--emphasized': isLast }"
        :href="showcase.creatorLink"
        target="_blank"
        rel="noopener"
        aria-label="認識創作者（在新分頁開啟）"
      >認識創作者 <span aria-hidden="true">↗</span></a>
      <button data-testid="close" aria-label="關閉" @click="emit('close')">✕</button>
    </header>
```

Keep the existing `.page` and `<footer>` markup unchanged. Delete this old block entirely:

```vue
    <a
      v-if="isLast && showcase.creatorLink"
      data-testid="creator-link"
      class="creator"
      :href="showcase.creatorLink"
      target="_blank"
      rel="noopener"
    >創作者 IG →</a>
```

- [ ] **Step 4: Implement fixed header geometry and the two creator-link states**

Replace the current `header`, `header h2`, `header button`, and `.creator` rules in `src/ui/BookViewer.vue` with:

```css
header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 8.5rem 44px;
  gap: 12px;
  align-items: center;
}

header h2 {
  grid-column: 1;
  min-width: 0;
  margin: 0;
  overflow: hidden;
  font-size: 1.2rem;
  white-space: nowrap;
  text-overflow: ellipsis;
}

header button {
  grid-column: 3;
  width: 44px;
  height: 44px;
  padding: 0;
  color: inherit;
  font-size: 1.5rem;
  background: none;
  border: none;
}

.creator {
  grid-column: 2;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 8.5rem;
  height: 44px;
  padding: 0 12px;
  box-sizing: border-box;
  color: #f0b860;
  font-size: 0.875rem;
  font-weight: 600;
  white-space: nowrap;
  text-decoration: none;
  background: transparent;
  border: 1px solid #f0b860;
  border-radius: 999px;
  transition: color 180ms ease, background-color 180ms ease, box-shadow 180ms ease;
}

.creator--emphasized {
  color: #21170a;
  background: #f0b860;
  box-shadow: 0 0 0 4px rgba(240, 184, 96, 0.18);
}

.creator:focus-visible {
  outline: 3px solid #fff4d6;
  outline-offset: 3px;
}

@media (prefers-reduced-motion: no-preference) {
  .creator--emphasized {
    animation: creator-emphasis 240ms ease-out both;
  }

  @keyframes creator-emphasis {
    from { opacity: 0.72; }
    to { opacity: 1; }
  }
}

@media (max-width: 480px) {
  header {
    gap: 8px;
  }
}
```

The grid explicitly assigns the close button to column 3, so the close control remains right-aligned even when the optional creator link is absent.

- [ ] **Step 5: Run the focused test and static build checks**

Run:

```bash
npm run test -- tests/BookViewer.test.ts
npm run build
```

Expected: all `BookViewer` tests PASS; the build completes without Vue, TypeScript, content, or asset validation errors.

- [ ] **Step 6: Commit the component behavior**

```bash
git add tests/BookViewer.test.ts src/ui/BookViewer.vue
git commit -m "feat: keep creator entry visible in book viewer"
```

### Task 2: Browser-level layout and 320-pixel acceptance coverage

**Files:**
- Modify: `e2e/basic.spec.ts:39`

**Interfaces:**
- Consumes: `BookViewer` selectors `[data-testid="book-viewer"]`, `[data-testid="creator-link"]`, `[data-testid="next"]`, plus `.page`, `header`, `header h2`, and `footer` layout elements.
- Produces: Playwright acceptance coverage proving page transitions preserve geometry and the header remains contained at 320 pixels.

- [ ] **Step 1: Add the layout-stability acceptance test**

Insert the following test after `interact 事件開啟翻書、翻頁、關閉` in `e2e/basic.spec.ts`:

```ts
test('創作者入口常駐，最後一頁與 320px 畫面都維持穩定版面', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('canvas')).toBeVisible({ timeout: 10_000 })

  await page.evaluate(() => {
    window.__bridge.emit('interact', { id: 'showcase-1', type: 'showcase' })
  })

  const viewer = page.getByTestId('book-viewer')
  const creatorLink = page.getByTestId('creator-link')
  const layout = () => viewer.evaluate((root) => {
    const rect = (selector: string) => {
      const element = root.querySelector<HTMLElement>(selector)
      if (!element) throw new Error(`Missing BookViewer element: ${selector}`)
      const { x, y, width, height } = element.getBoundingClientRect()
      return { x, y, width, height }
    }

    return {
      header: rect('header'),
      page: rect('.page'),
      footer: rect('footer'),
    }
  })

  await expect(creatorLink).toHaveText('認識創作者 ↗')
  await expect(creatorLink).not.toHaveClass(/creator--emphasized/)
  const firstPageLayout = await layout()

  await page.getByTestId('next').click()
  await page.getByTestId('next').click()
  await expect(viewer).toContainText('3 / 3')
  await expect(creatorLink).toHaveClass(/creator--emphasized/)
  expect(await layout()).toEqual(firstPageLayout)

  await page.setViewportSize({ width: 320, height: 568 })

  const mobileHeader = await viewer.evaluate((root) => {
    const bounds = (selector: string) => {
      const element = root.querySelector<HTMLElement>(selector)
      if (!element) throw new Error(`Missing BookViewer element: ${selector}`)
      const box = element.getBoundingClientRect()
      return { left: box.left, right: box.right, width: box.width }
    }
    const title = root.querySelector<HTMLElement>('header h2')
    if (!title) throw new Error('Missing BookViewer title')

    return {
      header: bounds('header'),
      title: { ...bounds('header h2'), scrollWidth: title.scrollWidth },
      creator: bounds('[data-testid="creator-link"]'),
      close: bounds('[data-testid="close"]'),
    }
  })

  expect(mobileHeader.header.left).toBeGreaterThanOrEqual(0)
  expect(mobileHeader.header.right).toBeLessThanOrEqual(320)
  expect(mobileHeader.title.right).toBeLessThanOrEqual(mobileHeader.creator.left)
  expect(mobileHeader.creator.right).toBeLessThanOrEqual(mobileHeader.close.left)
  expect(mobileHeader.title.scrollWidth).toBeGreaterThan(mobileHeader.title.width)
  await expect(creatorLink).toHaveText('認識創作者 ↗')
})
```

- [ ] **Step 2: Run the focused desktop acceptance test**

Run:

```bash
npm run e2e -- e2e/basic.spec.ts --project=desktop --grep "創作者入口常駐"
```

Expected: 1 test PASS. The assertion must observe identical header, page, and footer rectangles on the first and last pages, then confirm non-overlapping header controls at 320×568.

- [ ] **Step 3: Run the complete verification suite**

Run:

```bash
npm run test
npm run e2e -- e2e/basic.spec.ts
npm run build
```

Expected: all Vitest tests PASS; all desktop and mobile tests in `e2e/basic.spec.ts` PASS with only their declared project skips; the production build succeeds.

- [ ] **Step 4: Commit the acceptance coverage**

```bash
git add e2e/basic.spec.ts
git commit -m "test: verify stable creator entry layout"
```
