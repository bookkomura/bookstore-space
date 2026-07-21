# 小村碎碎念檔案室前台 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在書店場景加入「後頭村・碎碎念檔案室」互動點，並以固定信封列與獨立直向信紙閱讀器呈現已發布電子報。

**Architecture:** `schema.ts` 定義公開 newsletter JSON，`storyblok.ts` 只映射已發布 story 並依寄送時間由新到舊排序。固定的 Phaser `archive-1` zone 開啟 `NewsletterArchive`；overlay 的信封列橫向捲動、信紙區獨立直向捲動。

**Tech Stack:** Vue 3、TypeScript、Phaser 3、Zod、Vitest、Vue Test Utils、Playwright、Storyblok CDN API。

## Global Constraints

- 只輸出 `sentAt`、`subject`、`blocks`；`sourceMessageId` 絕不可出現在 `public/content.json`。
- 所有 newsletter 依 `sentAt` 由新到舊；標題取第一個 `～` 後文字，沒有時用完整主旨。
- 外部連結必須 HTTPS，且使用 `target="_blank" rel="noopener"`。
- `archive-1` 位於樓梯右側空間，不與既有碰撞區重疊。
- 信封列固定且只橫捲；信紙只直捲；切換期數時捲動位置重設。
- 控制項可鍵盤操作、焦點可見、觸控目標至少 44px；減少動態偏好時不播放封口動畫。
- 不改變 showcase、shelf、營業資訊的內容模型或互動。

---

## File structure

| File | Responsibility |
| --- | --- |
| `src/content/schema.ts` | 公開 newsletter / block 的 Zod schema。 |
| `src/content/storyblok.ts` | Storyblok newsletter 映射、驗證與排序。 |
| `src/game/zones.ts`, `src/game/sceneLayout.ts` | archive zone 類型及固定位置。 |
| `src/game/interactionLabels.ts`, `src/content/validate.ts` | 標記文字與唯一 archive 規則。 |
| `src/ui/NewsletterArchive.vue` | 信封導覽與雙捲動閱讀器。 |
| `src/App.vue` | interaction 與 overlay 生命週期。 |

### Task 1: Define the public newsletter contract

**Files:**
- Modify: `src/content/schema.ts`
- Modify: `src/content/storyblok.ts`
- Modify: `scripts/sample-content.json`
- Modify: `tests/schema.test.ts`
- Modify: `tests/storyblok.test.ts`
- Create: `docs/storyblok/newsletter-component.md`

**Interfaces:**
- Produces `Newsletter`, `NewsletterBlock`, `NewsletterSchema`, and `ContentBundle.newsletters: Newsletter[]`.
- Produces `mapStoriesToBundle(rawStories): ContentBundle`, sorted newest-first without source IDs.

- [ ] **Step 1: Write failing schema and mapping tests**

```ts
it('accepts safe newsletter blocks and rejects HTTP links', () => {
  const issue = { sentAt: '2026-07-19T05:40:00.000Z', subject: '小村碎碎念～總是會到', blocks: [
    { type: 'paragraph', text: '總是會到。' },
    { type: 'image', image: 'https://a.storyblok.com/f/1.jpg', alt: '市集', caption: '夏日市集' },
    { type: 'link', label: '報名活動', href: 'https://forms.gle/example' },
    { type: 'divider' },
  ] }
  expect(NewsletterSchema.safeParse(issue).success).toBe(true)
  expect(NewsletterSchema.safeParse({ ...issue, blocks: [{ type: 'link', label: 'x', href: 'http://bad.test' }] }).success).toBe(false)
})

it('maps newsletter stories in descending sentAt order without sourceMessageId', () => {
  const bundle = mapStoriesToBundle([...stories, olderNewsletter, newerNewsletter])
  expect(bundle.newsletters.map((item) => item.subject)).toEqual(['小村碎碎念～最新一期', '小村碎碎念～舊一期'])
  expect(bundle.newsletters[0]).not.toHaveProperty('sourceMessageId')
})
```

- [ ] **Step 2: Run the focused tests**

Run: `npm test -- tests/schema.test.ts tests/storyblok.test.ts`

Expected: FAIL because `NewsletterSchema` and `newsletters` do not exist.

- [ ] **Step 3: Implement the schema, mapper, fixture, and CMS contract**

Add this to `src/content/schema.ts`, then add `newsletters: z.array(NewsletterSchema)` to `ContentBundleSchema` and export its inferred types:

```ts
const HttpsUrl = z.string().url().refine((value) => new URL(value).protocol === 'https:', '必須使用 HTTPS')
export const NewsletterBlockSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('paragraph'), text: z.string().min(1) }).strict(),
  z.object({ type: z.literal('image'), image: HttpsUrl, alt: z.string().min(1), caption: z.string().min(1).optional() }).strict(),
  z.object({ type: z.literal('link'), label: z.string().min(1), href: HttpsUrl }).strict(),
  z.object({ type: z.literal('divider') }).strict(),
])
export const NewsletterSchema = z.object({
  sentAt: z.string().datetime(),
  subject: z.string().min(1),
  blocks: z.array(NewsletterBlockSchema).min(1),
}).strict()
export type NewsletterBlock = z.infer<typeof NewsletterBlockSchema>
export type Newsletter = z.infer<typeof NewsletterSchema>
```

In `mapStoriesToBundle`, filter `component === 'newsletter'`; map `newsletter_paragraph`, `newsletter_image`, `newsletter_link`, and `newsletter_divider` to the four public discriminants. Read Storyblok assets via existing `assetFilename` and Link values via existing `optionalUrl`. Build the final value with `ContentBundleSchema.safeParse({ showcases, shelves, storeInfo, newsletters })`, and sort exactly with:

```ts
newsletters.sort((a, b) => Date.parse(b.sentAt) - Date.parse(a.sentAt))
```

Add a single 2026-07-19 sample issue with only HTTPS assets/links. Create `docs/storyblok/newsletter-component.md`: `newsletter` has `sent_at` (Date/Time), `subject` (Text), `blocks` (Blocks); allowed blocks are `newsletter_paragraph(text: Textarea)`, `newsletter_image(image: Asset, alt: Text, caption: Textarea optional)`, `newsletter_link(label: Text, href: Link)`, and `newsletter_divider` (no fields). State that Message-ID is service-only and never stored in Storyblok.

- [ ] **Step 4: Verify the contract**

Run: `npm test -- tests/schema.test.ts tests/storyblok.test.ts && npm run content && npm run validate`

Expected: PASS; sample content validates and generated JSON has no source ID.

- [ ] **Step 5: Commit**

```bash
git add src/content/schema.ts src/content/storyblok.ts scripts/sample-content.json tests/schema.test.ts tests/storyblok.test.ts docs/storyblok/newsletter-component.md
git commit -m "feat: add newsletter content contract"
```

### Task 2: Add the permanent archive scene entry

**Files:**
- Modify: `src/game/zones.ts`
- Modify: `src/game/sceneLayout.ts`
- Modify: `src/game/interactionLabels.ts`
- Modify: `src/content/validate.ts`
- Modify: `tests/zones.test.ts`
- Modify: `tests/sceneLayout.test.ts`
- Modify: `tests/interactionLabels.test.ts`
- Modify: `tests/validate.test.ts`

**Interfaces:**
- Produces `ZoneType = 'showcase' | 'shelf' | 'info' | 'archive'` and exactly one `archive-1` zone.
- `App.vue` consumes an `archive` interaction to open the reader.

- [ ] **Step 1: Write failing location and label tests**

```ts
it('has one archive entry beside, not inside, the stairs', () => {
  const archive = STATIC_INTERACTION_ZONES.find((zone) => zone.id === 'archive-1')
  expect(archive).toEqual({ id: 'archive-1', type: 'archive', x: 245, y: 105, width: 68, height: 135, anchorX: 279, anchorY: 171 })
  const stairs = COLLISION_RECTS.find((rect) => rect.id === 'stairs')!
  expect(archive!.x).toBeGreaterThanOrEqual(stairs.x + stairs.width)
})
it('labels the archive entry', () => {
  expect(buildInteractionLabels(content)['archive-1']).toBe('後頭村・碎碎念檔案室')
})
```

- [ ] **Step 2: Run focused tests**

Run: `npm test -- tests/zones.test.ts tests/sceneLayout.test.ts tests/interactionLabels.test.ts tests/validate.test.ts`

Expected: FAIL because `archive` and `archive-1` are absent.

- [ ] **Step 3: Implement the zone, label, and validator rule**

Add `'archive'` to `ZoneType`. Add this object to `STATIC_INTERACTION_ZONES`:

```ts
{ id: 'archive-1', type: 'archive', x: 245, y: 105, width: 68, height: 135, anchorX: 279, anchorY: 171 },
```

Add `'archive-1': '後頭村・碎碎念檔案室'` to the labels. After the existing info rule, add:

```ts
const archiveZones = zones.filter((zone) => zone.type === 'archive')
if (archiveZones.length !== 1 || archiveZones[0]?.id !== 'archive-1') {
  errors.push('場景必須包含唯一的 archive-1 碎碎念檔案室互動點')
}
```

Do not make archive conditional on issue count; it is one stable doorway.

- [ ] **Step 4: Verify**

Run: `npm test -- tests/zones.test.ts tests/sceneLayout.test.ts tests/interactionLabels.test.ts tests/validate.test.ts && npm run build`

Expected: PASS and Vite writes a valid bundle.

- [ ] **Step 5: Commit**

```bash
git add src/game/zones.ts src/game/sceneLayout.ts src/game/interactionLabels.ts src/content/validate.ts tests/zones.test.ts tests/sceneLayout.test.ts tests/interactionLabels.test.ts tests/validate.test.ts
git commit -m "feat: add newsletter archive interaction point"
```

### Task 3: Build the envelope reader

**Files:**
- Create: `src/ui/NewsletterArchive.vue`
- Create: `tests/NewsletterArchive.test.ts`

**Interfaces:**
- Consumes `newsletters: Newsletter[]`, emits `close`.
- Provides test IDs `newsletter-archive`, `envelope-issue`, `newsletter-content`, `newsletter-link`, and `close`.

- [ ] **Step 1: Write failing component tests**

```ts
it('switches an issue and resets only the paper scroll', async () => {
  const wrapper = mount(NewsletterArchive, { props: { newsletters: issues } })
  const paper = wrapper.get('[data-testid="newsletter-content"]').element as HTMLElement
  Object.defineProperty(paper, 'scrollTop', { value: 88, writable: true })
  await wrapper.getAll('[data-testid="envelope-issue"]')[1].trigger('click')
  expect(wrapper.text()).toContain('舊一期')
  expect(paper.scrollTop).toBe(0)
})
it('uses safe external links and useful image alt text', () => {
  const wrapper = mount(NewsletterArchive, { props: { newsletters: issues } })
  expect(wrapper.get('[data-testid="newsletter-link"]').attributes()).toMatchObject({ href: 'https://example.com/event', target: '_blank', rel: 'noopener' })
  expect(wrapper.get('img').attributes('alt')).toBe('活動海報')
})
```

- [ ] **Step 2: Run the new test**

Run: `npm test -- tests/NewsletterArchive.test.ts`

Expected: FAIL because the component is missing.

- [ ] **Step 3: Implement the two-scroll accessible overlay**

Use `selectedIndex = ref(0)`, `paper = ref<HTMLElement>()`, and reset with:

```ts
watch(selectedIndex, () => paper.value?.scrollTo({ top: 0, behavior: 'auto' }))
function displayTitle(subject: string) {
  const separator = subject.indexOf('～')
  return separator === -1 ? subject : subject.slice(separator + 1).trim() || subject
}
```

Render a `role="dialog" aria-modal="true" aria-label="小村碎碎念檔案室"` root. The nav is `aria-label="選擇電子報期數"`; each envelope is a 44px-or-larger button with `aria-pressed`, date, title, and `.envelope--open` for the selected issue. Render `<main ref="paper" data-testid="newsletter-content" tabindex="0">` with a discriminated `v-for`: paragraphs as `p`, images in `figure/img/figcaption`, link blocks as `a data-testid="newsletter-link" target="_blank" rel="noopener"`, dividers as `hr`, and an empty state.

The root CSS must be `position: fixed; inset: 0; display: grid; grid-template-rows: auto auto minmax(0, 1fr); overflow: hidden`; the nav alone gets `overflow-x: auto; overscroll-behavior-x: contain`; main alone gets `overflow-y: auto; scrollbar-gutter: stable`. Make a pseudo-element flap for the envelope and include:

```css
@media (prefers-reduced-motion: reduce) {
  .envelope, .envelope::before { transition: none; }
}
```

- [ ] **Step 4: Verify reader behavior**

Run: `npm test -- tests/NewsletterArchive.test.ts`

Expected: PASS for newest-first display, scroll reset, empty state, close event, title fallback, link attributes, and image alt.

- [ ] **Step 5: Commit**

```bash
git add src/ui/NewsletterArchive.vue tests/NewsletterArchive.test.ts
git commit -m "feat: add envelope newsletter reader"
```

### Task 4: Integrate archive lifecycle and browser acceptance coverage

**Files:**
- Modify: `src/App.vue`
- Modify: `tests/App.test.ts`
- Modify: `e2e/basic.spec.ts`
- Modify: `README.md`

**Interfaces:**
- Consumes bridge events `{ id: 'archive-1', type: 'archive' }`.
- Produces the same `ui:opened` / `ui:closed` lifecycle as existing overlays.

- [ ] **Step 1: Write failing app and E2E tests**

```ts
it('opens archive-1 and releases the scene on close', async () => {
  mocks.loadContent.mockResolvedValue(content)
  const wrapper = await mountApp()
  bridge.emit('interact', { id: 'archive-1', type: 'archive' })
  await flushPromises()
  expect(wrapper.get('[data-testid="newsletter-archive"]').text()).toContain('總是會到')
  await wrapper.get('[data-testid="newsletter-archive"] [data-testid="close"]').trigger('click')
  expect(wrapper.find('[data-testid="newsletter-archive"]').exists()).toBe(false)
})
```

Add a Playwright test that emits the archive bridge event, records the navigation strip top, scrolls `newsletter-content`, asserts the strip top is unchanged, changes to mobile `390×844`, wheel-scrolls the content, and asserts `scrollTop > 0`.

- [ ] **Step 2: Run tests**

Run: `npm test -- tests/App.test.ts && npm run e2e -- --grep "檔案室"`

Expected: FAIL because App does not handle archive interactions.

- [ ] **Step 3: Implement app wiring and documentation**

Import `Newsletter` and `NewsletterArchive`; add `const showArchive = ref(false)`, include it in `uiOpen`, set it for `type === 'archive'`, clear it in `closeAll`, and render:

```vue
<NewsletterArchive
  v-if="showArchive && content"
  :newsletters="content.newsletters"
  @close="closeAll"
/>
```

In README, link the CMS contract and state that only published newsletter stories appear after the next build; local development uses the sample fixture without `STORYBLOK_TOKEN`.

- [ ] **Step 4: Run full frontend verification**

Run: `npm test && npm run build && npm run e2e`

Expected: all current and new tests pass; no test observes document-body scrolling while archive is open.

- [ ] **Step 5: Commit**

```bash
git add src/App.vue tests/App.test.ts e2e/basic.spec.ts README.md
git commit -m "feat: open newsletter archive from bookstore"
```

## Spec coverage self-review

- Scene location and permanent entry: Task 2.
- Storyblok build output, sorting, safe content, no Message-ID leak: Task 1.
- Envelope design, fixed horizontal navigation, vertical paper, a11y, motion preference: Task 3.
- Game lock/release, desktop keyboard, mobile scrolling, production validation: Task 4.
