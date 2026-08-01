# Showcase Creator Social Links Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single showcase creator text link with independently configured Facebook, Instagram, Threads, and website icon links.

**Architecture:** Normalize four optional Storyblok Link fields into an optional `Showcase.creatorLinks` object validated by Zod. A focused `CreatorLinks.vue` component owns platform order, inline SVGs, accessibility, and responsive geometry; `BookViewer` only places that component in its header. The old `creator_link`/`creatorLink` path is removed without fallback.

**Tech Stack:** Vue 3 `<script setup>`, TypeScript 5, Zod 3, Vitest, Vue Test Utils, Playwright, Storyblok build-time mapping.

## Global Constraints

- Storyblok fields are exactly `facebook`, `instagram`, `threads`, and `website`; all four are optional Link fields.
- Do not read, map, display, migrate, or document the old `creator_link` field.
- Render configured links in this exact order: Facebook, Instagram, Threads, personal website.
- Missing links render no anchor; when every link is missing, render no creator-links wrapper.
- Link buttons are `36 × 36px` with `8px` radius; at `max-width: 480px` they are `34 × 34px`.
- Each SVG uses one consistent square canvas and is horizontally and vertically centered.
- Links open in a new tab with `rel="noopener noreferrer"`, platform-specific accessible labels, and visible keyboard focus.
- Keep the icon row stable on every showcase page; do not add final-page emphasis.
- Support all four links at a 320-pixel viewport without horizontal overflow.
- Add no icon package or runtime network dependency; keep SVGs inline in the component.

## File Structure

- Modify `src/content/schema.ts`: define/export `CreatorLinksSchema` and `CreatorLinks`; replace `Showcase.creatorLink` with optional `Showcase.creatorLinks`.
- Modify `scripts/sample-content.json`: exercise all four normalized links in the local fixture.
- Modify `tests/schema.test.ts`: verify optional subsets, absence, and malformed URLs.
- Modify `src/content/storyblok.ts`: map only the four new Storyblok fields.
- Modify `tests/storyblok.test.ts`: verify complete, partial, empty, and legacy-ignored mapping.
- Modify `README.md`: document the four Storyblok Link fields and remove `creator_link`.
- Create `src/ui/CreatorLinks.vue`: render ordered accessible icon anchors and own their responsive styling.
- Create `tests/CreatorLinks.test.ts`: unit-test rendering, order, attributes, and empty output.
- Modify `src/ui/BookViewer.vue`: integrate `CreatorLinks` and remove the old creator anchor/styles.
- Modify `tests/BookViewer.test.ts`: verify stable integration across pages and absent links.
- Modify `e2e/basic.spec.ts`: verify four-link responsive geometry and icon centering.

---

### Task 1: Normalize creator links in the content schema and sample fixture

**Files:**
- Modify: `src/content/schema.ts:9-14,57-64`
- Modify: `scripts/sample-content.json:3-11`
- Test: `tests/schema.test.ts:25-40`

**Interfaces:**
- Produces: `CreatorLinksSchema`, `type CreatorLinks`, and `Showcase.creatorLinks?: CreatorLinks`.
- Produces: sample showcase 1 with all four normalized creator URLs for UI and E2E consumers.

- [ ] **Step 1: Replace the legacy schema test with failing normalized-link tests**

In `tests/schema.test.ts`, replace `creatorLink 可省略` with:

```ts
  it('接受任意組合的四種創作者連結，也接受完全省略', () => {
    const partial = structuredClone(sample) as any
    partial.showcases[0].creatorLinks = {
      instagram: 'https://www.instagram.com/example_creator',
      website: 'https://example.com/creator',
    }
    const parsed = ContentBundleSchema.parse(partial)
    expect(parsed.showcases[0].creatorLinks).toEqual({
      instagram: 'https://www.instagram.com/example_creator',
      website: 'https://example.com/creator',
    })

    delete partial.showcases[0].creatorLinks
    expect(ContentBundleSchema.safeParse(partial).success).toBe(true)
  })

  it('拒絕格式錯誤的創作者連結', () => {
    const bad = structuredClone(sample) as any
    bad.showcases[0].creatorLinks = { threads: 'not-a-url' }
    expect(ContentBundleSchema.safeParse(bad).success).toBe(false)
  })
```

- [ ] **Step 2: Run the focused schema tests and verify RED**

Run: `npm test -- tests/schema.test.ts`

Expected: FAIL because parsed output does not preserve `creatorLinks`, and the
malformed nested URL is currently ignored as an unknown field.

- [ ] **Step 3: Add the normalized schema and update the sample fixture**

In `src/content/schema.ts`, add this before `ShowcaseSchema` and replace the legacy field:

```ts
export const CreatorLinksSchema = z.object({
  facebook: z.string().url().optional(),
  instagram: z.string().url().optional(),
  threads: z.string().url().optional(),
  website: z.string().url().optional(),
})

export const ShowcaseSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  pages: z.array(PageSchema).min(1),
  creatorLinks: CreatorLinksSchema.optional(),
})
```

Export the inferred type with the existing content types:

```ts
export type CreatorLinks = z.infer<typeof CreatorLinksSchema>
export type Showcase = z.infer<typeof ShowcaseSchema>
```

In showcase 1 of `scripts/sample-content.json`, replace `creatorLink` with:

```json
"creatorLinks": {
  "facebook": "https://www.facebook.com/example.creator",
  "instagram": "https://www.instagram.com/example_creator",
  "threads": "https://www.threads.net/@example_creator",
  "website": "https://example.com/creator"
}
```

- [ ] **Step 4: Run the focused tests and typecheck**

Run: `npm test -- tests/schema.test.ts`

Expected: PASS.

Run: `npx vue-tsc --noEmit`

Expected: FAIL only in known legacy consumers (`storyblok.ts`, `BookViewer` tests/component) that later tasks intentionally migrate; record the exact failures and confirm no unrelated type errors.

- [ ] **Step 5: Commit the schema contract**

```bash
git add src/content/schema.ts scripts/sample-content.json tests/schema.test.ts
git commit -m "feat: model showcase creator social links"
```

---

### Task 2: Map the four Storyblok fields and remove the old CMS contract

**Files:**
- Modify: `src/content/storyblok.ts:52-70`
- Modify: `tests/storyblok.test.ts:4-15,83-100`
- Modify: `README.md:30-37`

**Interfaces:**
- Consumes: `Showcase.creatorLinks?: CreatorLinks` from Task 1.
- Produces: `mapStoriesToBundle()` output containing only non-empty `facebook`, `instagram`, `threads`, and `website` values.
- Produces: no output from a raw `creator_link` field.

- [ ] **Step 1: Change the Storyblok fixture and add failing mapping cases**

Replace the showcase content fields at the top of `tests/storyblok.test.ts` with:

```ts
      facebook: { url: 'https://www.facebook.com/c' },
      instagram: { url: 'https://www.instagram.com/c' },
      threads: { url: 'https://www.threads.net/@c' },
      website: { url: 'https://creator.example.com' },
      creator_link: { url: 'https://legacy.example.com' },
```

Update the showcase assertion to expect:

```ts
    expect(bundle.showcases[0]).toEqual({
      id: 'showcase-1',
      title: '手工蠟燭',
      creatorLinks: {
        facebook: 'https://www.facebook.com/c',
        instagram: 'https://www.instagram.com/c',
        threads: 'https://www.threads.net/@c',
        website: 'https://creator.example.com',
      },
      pages: [{ image: 'https://a.storyblok.com/f/1.jpg', caption: '描述一' }],
    })
```

Replace the old empty-link test with:

```ts
  it('省略空白新欄位，四欄皆空時不建立 creatorLinks', () => {
    const noLinks = structuredClone(stories) as any
    noLinks[0].content.facebook = { url: '' }
    noLinks[0].content.instagram = { url: '' }
    noLinks[0].content.threads = { url: '' }
    noLinks[0].content.website = { url: '' }

    const bundle = mapStoriesToBundle(noLinks)
    expect(bundle.showcases[0].creatorLinks).toBeUndefined()
  })

  it('忽略舊 creator_link，不作為 website 備援', () => {
    const legacyOnly = structuredClone(stories) as any
    delete legacyOnly[0].content.facebook
    delete legacyOnly[0].content.instagram
    delete legacyOnly[0].content.threads
    delete legacyOnly[0].content.website
    legacyOnly[0].content.creator_link = { url: 'https://legacy.example.com' }

    const bundle = mapStoriesToBundle(legacyOnly)
    expect(bundle.showcases[0].creatorLinks).toBeUndefined()
  })
```

- [ ] **Step 2: Run the mapper tests and verify RED**

Run: `npm test -- tests/storyblok.test.ts`

Expected: FAIL because the mapper still reads `creator_link` and emits `creatorLink`.

- [ ] **Step 3: Map only non-empty new fields**

Replace the legacy `link` mapping in `src/content/storyblok.ts` with:

```ts
      const facebook = optionalUrl(story.content.facebook)
      const instagram = optionalUrl(story.content.instagram)
      const threads = optionalUrl(story.content.threads)
      const website = optionalUrl(story.content.website)
      const creatorLinks = {
        ...(facebook ? { facebook } : {}),
        ...(instagram ? { instagram } : {}),
        ...(threads ? { threads } : {}),
        ...(website ? { website } : {}),
      }
```

Replace the old result spread with:

```ts
        ...(Object.keys(creatorLinks).length > 0 ? { creatorLinks } : {}),
```

Do not reference `story.content.creator_link` anywhere in production mapping code.

- [ ] **Step 4: Update the CMS documentation**

Change the `showcase` line in `README.md` to:

```md
- `showcase`：title (Text)、pages (Blocks：image (Asset)、caption (Textarea))、facebook、instagram、threads、website (Link，皆選填)
```

- [ ] **Step 5: Update the Storyblok `showcase` component model**

In Storyblok's component editor, add optional Link fields with technical names
`facebook`, `instagram`, `threads`, and `website`, then delete the technical
field `creator_link`. Save the component schema. Do not copy the old value into
`website`. If authenticated Storyblok management access is unavailable during
execution, stop before claiming this external step complete and give the user
these exact field operations as the remaining manual action.

- [ ] **Step 6: Run focused and schema tests**

Run: `npm test -- tests/storyblok.test.ts tests/schema.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit the CMS mapping**

```bash
git add src/content/storyblok.ts tests/storyblok.test.ts README.md
git commit -m "feat: map showcase creator platforms"
```

---

### Task 3: Build the accessible rounded-square icon component

**Files:**
- Create: `src/ui/CreatorLinks.vue`
- Create: `tests/CreatorLinks.test.ts`

**Interfaces:**
- Consumes: `links?: CreatorLinks`.
- Produces: optional `<nav data-testid="creator-links">` containing ordered anchors with `data-platform` and `data-testid="creator-link-<platform>"`.

- [ ] **Step 1: Write failing component behavior tests**

Create `tests/CreatorLinks.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import CreatorLinks from '../src/ui/CreatorLinks.vue'

describe('CreatorLinks', () => {
  it('只依固定順序顯示有填寫的平台', () => {
    const wrapper = mount(CreatorLinks, {
      props: {
        links: {
          website: 'https://creator.example.com',
          facebook: 'https://www.facebook.com/c',
          threads: 'https://www.threads.net/@c',
        },
      },
    })

    expect(wrapper.findAll('[data-platform]').map((item) => item.attributes('data-platform')))
      .toEqual(['facebook', 'threads', 'website'])
    expect(wrapper.find('[data-platform="instagram"]').exists()).toBe(false)
  })

  it('提供網址、新分頁安全屬性與平台 accessible name', () => {
    const wrapper = mount(CreatorLinks, {
      props: { links: { instagram: 'https://www.instagram.com/c' } },
    })
    const link = wrapper.get('[data-testid="creator-link-instagram"]')

    expect(link.attributes()).toMatchObject({
      href: 'https://www.instagram.com/c',
      target: '_blank',
      rel: 'noopener noreferrer',
      'aria-label': 'Instagram（在新分頁開啟）',
    })
    expect(link.get('svg').attributes('aria-hidden')).toBe('true')
  })

  it.each([undefined, {}])('沒有任何連結時不渲染 wrapper', (links) => {
    const wrapper = mount(CreatorLinks, { props: { links } })
    expect(wrapper.find('[data-testid="creator-links"]').exists()).toBe(false)
  })
})
```

- [ ] **Step 2: Run the new unit test and verify RED**

Run: `npm test -- tests/CreatorLinks.test.ts`

Expected: FAIL because `src/ui/CreatorLinks.vue` does not exist.

- [ ] **Step 3: Implement the ordered component data and template**

Create `src/ui/CreatorLinks.vue` with this script and anchor structure:

```vue
<script setup lang="ts">
import { computed } from 'vue'
import type { CreatorLinks } from '../content/schema'

type Platform = keyof CreatorLinks

const props = defineProps<{ links?: CreatorLinks }>()

const definitions: ReadonlyArray<{ platform: Platform; label: string }> = [
  { platform: 'facebook', label: 'Facebook' },
  { platform: 'instagram', label: 'Instagram' },
  { platform: 'threads', label: 'Threads' },
  { platform: 'website', label: '個人網站' },
]

const configuredLinks = computed(() => definitions.flatMap((definition) => {
  const href = props.links?.[definition.platform]
  return href ? [{ ...definition, href }] : []
}))
</script>

<template>
  <nav v-if="configuredLinks.length" data-testid="creator-links" class="creator-links" aria-label="創作者連結">
    <a
      v-for="link in configuredLinks"
      :key="link.platform"
      :data-testid="`creator-link-${link.platform}`"
      :data-platform="link.platform"
      class="creator-link"
      :href="link.href"
      target="_blank"
      rel="noopener noreferrer"
      :aria-label="`${link.label}（在新分頁開啟）`"
    >
      <svg v-if="link.platform === 'facebook'" class="icon--filled" aria-hidden="true" viewBox="0 0 24 24">
        <path d="M14 8h3V4.2c-.5-.1-2.2-.2-4.1-.2C9 4 7 6.3 7 10.4V13H4v4h3v7h4v-7h3.3l.7-4h-4v-2.2C11 9.6 11.5 8 14 8Z" />
      </svg>
      <svg v-else-if="link.platform === 'instagram'" aria-hidden="true" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle class="icon-fill" cx="17.5" cy="6.5" r="1" />
      </svg>
      <svg v-else-if="link.platform === 'threads'" aria-hidden="true" viewBox="0 0 24 24" fill="none">
        <path d="M16.8 10.4C16.5 6.1 14 4 10.4 4 6 4 3.2 7.2 3.2 12s2.9 8 7.3 8c4 0 6.7-2.2 6.7-5.3 0-2.6-1.8-4.3-4.6-4.3-2.7 0-4.5 1.4-4.5 3.4 0 1.6 1.3 2.7 3 2.7 2.7 0 4.8-2.2 4.8-5.1 0-1.5-.4-2.7-1.3-3.8" />
      </svg>
      <svg v-else aria-hidden="true" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3c3 3.1 3 14.9 0 18M12 3c-3 3.1-3 14.9 0 18" />
      </svg>
    </a>
  </nav>
</template>
```

- [ ] **Step 4: Add exact rounded-square and centering styles**

Append to `CreatorLinks.vue`:

```vue
<style scoped>
.creator-links {
  display: flex;
  flex: none;
  align-items: center;
  gap: 7px;
}

.creator-link {
  display: grid;
  place-items: center;
  box-sizing: border-box;
  width: 36px;
  height: 36px;
  color: #f0b860;
  text-decoration: none;
  border: 1px solid rgba(240, 184, 96, 0.45);
  border-radius: 8px;
  transition: color 180ms ease, border-color 180ms ease, background-color 180ms ease;
}

.creator-link:hover {
  color: #fff4d6;
  background: rgba(240, 184, 96, 0.1);
  border-color: #f0b860;
}

.creator-link:focus-visible {
  outline: 3px solid #fff4d6;
  outline-offset: 2px;
}

.creator-link svg {
  display: block;
  width: 20px;
  height: 20px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.creator-link .icon--filled {
  fill: currentColor;
  stroke: none;
}

.creator-link .icon-fill {
  fill: currentColor;
  stroke: none;
}

@media (max-width: 480px) {
  .creator-links { gap: 5px; }
  .creator-link { width: 34px; height: 34px; }
  .creator-link svg { width: 18px; height: 18px; }
}
</style>
```

- [ ] **Step 5: Run component tests and typecheck**

Run: `npm test -- tests/CreatorLinks.test.ts`

Expected: PASS.

Run: `npx vue-tsc --noEmit`

Expected: legacy `BookViewer` consumers may still fail, but `CreatorLinks.vue` and its test introduce no type errors.

- [ ] **Step 6: Commit the isolated component**

```bash
git add src/ui/CreatorLinks.vue tests/CreatorLinks.test.ts
git commit -m "feat: add creator social icon links"
```

---

### Task 4: Integrate the icon row and verify responsive geometry

**Files:**
- Modify: `src/ui/BookViewer.vue:1-5,52-67,108-136,188-237`
- Modify: `tests/BookViewer.test.ts:5-64`
- Modify: `e2e/basic.spec.ts:51-112`

**Interfaces:**
- Consumes: `Showcase.creatorLinks?: CreatorLinks` and `CreatorLinks.vue` from Tasks 1 and 3.
- Produces: a stable creator icon row in the `BookViewer` header on every page.
- Produces: browser evidence that all anchor/SVG centers match and a 320-pixel viewport does not overflow.

- [ ] **Step 1: Rewrite BookViewer integration tests before changing production code**

Update the test showcase fixture:

```ts
  creatorLinks: {
    facebook: 'https://www.facebook.com/creator',
    instagram: 'https://www.instagram.com/creator',
    threads: 'https://www.threads.net/@creator',
    website: 'https://creator.example.com',
  },
```

Replace the two legacy creator-link tests with:

```ts
  it('每一頁維持同一組依固定順序排列的創作者 Icon', async () => {
    const w = mount(BookViewer, { props: { showcase } })
    const links = w.get('[data-testid="creator-links"]')

    expect(links.findAll('[data-platform]').map((item) => item.attributes('data-platform')))
      .toEqual(['facebook', 'instagram', 'threads', 'website'])

    await w.get('[data-testid="next"]').trigger('click')

    expect(w.get('[data-testid="creator-links"]').element).toBe(links.element)
    expect(w.find('.creator--emphasized').exists()).toBe(false)
    expect(w.text()).not.toContain('認識創作者')
  })

  it('沒有 creatorLinks 時所有頁面都不渲染 Icon 列', async () => {
    const w = mount(BookViewer, {
      props: { showcase: { ...showcase, creatorLinks: undefined } },
    })

    expect(w.find('[data-testid="creator-links"]').exists()).toBe(false)
    await w.get('[data-testid="next"]').trigger('click')
    expect(w.find('[data-testid="creator-links"]').exists()).toBe(false)
  })
```

- [ ] **Step 2: Rewrite the browser test for four anchors and exact centering**

Replace the creator-entry E2E test with a desktop-only test (skip the duplicate mobile Playwright project because the test sets its own viewport):

```ts
test('四個創作者 Icon 常駐，並在 320px 畫面置中且不溢位', async ({ page, isMobile }) => {
  test.skip(isMobile, 'desktop project performs explicit 320px responsive verification')
  await page.goto('/')
  await expect(page.locator('canvas')).toBeVisible({ timeout: 10_000 })
  await page.evaluate(() => window.__bridge.emit('interact', { id: 'showcase-1', type: 'showcase' }))

  const viewer = page.getByTestId('book-viewer')
  const links = page.getByTestId('creator-links')
  await expect(links.locator('a')).toHaveCount(4)
  expect(await links.locator('[data-platform]').evaluateAll((items) =>
    items.map((item) => item.getAttribute('data-platform')),
  )).toEqual(['facebook', 'instagram', 'threads', 'website'])
  await page.getByTestId('next').click()
  await page.getByTestId('next').click()
  await expect(viewer).toContainText('3 / 3')
  await expect(links.locator('a')).toHaveCount(4)
  await expect(viewer).not.toContainText('認識創作者')

  await page.setViewportSize({ width: 320, height: 568 })
  const geometry = await viewer.evaluate((root) => {
    const header = root.querySelector('header')!.getBoundingClientRect()
    const title = root.querySelector<HTMLElement>('header h2')!
    const close = root.querySelector<HTMLElement>('[data-testid="close"]')!.getBoundingClientRect()
    const items = [...root.querySelectorAll<HTMLElement>('[data-platform]')].map((anchor) => {
      const box = anchor.getBoundingClientRect()
      const icon = anchor.querySelector('svg')!.getBoundingClientRect()
      return {
        width: box.width,
        height: box.height,
        centerDeltaX: Math.abs((box.left + box.width / 2) - (icon.left + icon.width / 2)),
        centerDeltaY: Math.abs((box.top + box.height / 2) - (icon.top + icon.height / 2)),
      }
    })
    return {
      header: { left: header.left, right: header.right },
      titleTruncates: title.scrollWidth > title.clientWidth,
      closeRight: close.right,
      documentWidth: document.documentElement.scrollWidth,
      items,
    }
  })

  expect(geometry.header.left).toBeGreaterThanOrEqual(0)
  expect(geometry.header.right).toBeLessThanOrEqual(320)
  expect(geometry.closeRight).toBeLessThanOrEqual(320)
  expect(geometry.documentWidth).toBe(320)
  expect(geometry.titleTruncates).toBe(true)
  for (const item of geometry.items) {
    expect(item.width).toBe(34)
    expect(item.height).toBe(34)
    expect(item.centerDeltaX).toBeLessThanOrEqual(0.5)
    expect(item.centerDeltaY).toBeLessThanOrEqual(0.5)
  }
})
```

- [ ] **Step 3: Run focused tests and verify RED**

Run: `npm test -- tests/BookViewer.test.ts`

Expected: FAIL because `BookViewer` still expects `creatorLink` and renders the text anchor.

Run: `npm run content`

Expected: PASS and regenerate ignored `public/content.json` from the updated
four-link sample fixture so the browser test exercises the new content shape.

Run: `npx playwright test e2e/basic.spec.ts --project=desktop --grep "四個創作者"`

Expected: FAIL because `[data-testid="creator-links"]` is absent.

- [ ] **Step 4: Integrate `CreatorLinks` and remove the legacy UI**

Add the import in `src/ui/BookViewer.vue`:

```ts
import CreatorLinks from './CreatorLinks.vue'
```

Replace the legacy anchor in the header with:

```vue
      <CreatorLinks :links="showcase.creatorLinks" />
```

Delete all `.creator`, `.creator::after`, `.creator--emphasized`, creator focus,
creator animation, and `@keyframes creator-rule` CSS. Keep the existing `isLast`
computed value because page navigation still uses it to disable `next()`.

Keep the header responsive rule:

```css
@media (max-width: 480px) {
  header { gap: 8px; }
}
```

- [ ] **Step 5: Run focused unit and E2E tests and verify GREEN**

Run: `npm test -- tests/CreatorLinks.test.ts tests/BookViewer.test.ts`

Expected: PASS.

Run: `npx playwright test e2e/basic.spec.ts --project=desktop --grep "四個創作者"`

Expected: PASS with four 34 × 34 anchors at 320px and center deltas at or below 0.5px.

- [ ] **Step 6: Run full verification**

Run: `npx vue-tsc --noEmit`

Expected: PASS.

Run: `npm test`

Expected: all Vitest suites PASS without warnings or unhandled errors.

Run: `npm run build`

Expected: asset validation, sample content generation, content validation, and Vite production build all PASS.

Run: `npm run e2e`

Expected: desktop and mobile Playwright suites PASS.

Run: `rg -n "creatorLink|認識創作者|creator--emphasized" src tests e2e scripts README.md`

Expected: no matches.

Run: `rg -n "creator_link" src e2e scripts README.md`

Expected: no matches.

- [ ] **Step 7: Commit the viewer integration**

```bash
git add src/ui/BookViewer.vue tests/BookViewer.test.ts e2e/basic.spec.ts
git commit -m "feat: show creator platform icons in showcases"
```

---

## Final Review Checklist

- [ ] Every new behavior was introduced by a test that was observed failing for the expected reason.
- [ ] `creator_link` and `creatorLink` are absent from production code, sample
  content, and README; `creator_link` appears only in the regression test proving
  it is ignored.
- [ ] Partial and empty creator link sets render without blank anchors or wrappers.
- [ ] All four platform anchors preserve the required order and security/accessibility attributes.
- [ ] Button dimensions are exactly 36px normally and 34px at 480px or narrower.
- [ ] Browser geometry proves each SVG canvas shares its anchor center within 0.5px.
- [ ] A 320px viewport has no horizontal overflow and the title truncates first.
- [ ] `npx vue-tsc --noEmit`, `npm test`, `npm run build`, and `npm run e2e` pass.
