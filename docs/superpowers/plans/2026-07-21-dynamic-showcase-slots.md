# Dynamic Showcase Slots Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render and activate only the configured CMS showcases in ten fixed, right-to-left bookcase slots.

**Architecture:** `sceneLayout` owns the ten visual slot centres and builds showcase interaction zones from the CMS array at runtime. It combines those zones with the permanent shelf and information zones. Content parsing limits the array to ten items; `App` creates the runtime zone list after loading content and passes it through `createGame` to `StoreScene`.

**Tech Stack:** Vue 3, TypeScript, Phaser 3, Zod, Vitest, Playwright.

## Global Constraints

- The first CMS showcase occupies the rightmost bookcase slot; later entries fill leftward.
- The ten slot centres are `1057, 981, 905, 828, 746, 668, 590, 512, 434, 356` at marker height `163`.
- Each active showcase zone is 72×64 at `y: 270`; inactive slots create neither a marker nor a zone.
- CMS accepts zero through ten showcases and rejects eleven or more.
- Shelf and information interaction zones remain unchanged.

---

### Task 1: Build runtime showcase interaction zones

**Files:**
- Modify: `src/game/sceneLayout.ts`
- Modify: `tests/sceneLayout.test.ts`

**Interfaces:**
- Consumes: `Zone` from `src/game/zones.ts`.
- Produces: `MAX_SHOWCASE_SLOTS: 10`, `SHOWCASE_SLOT_ANCHORS`, `STATIC_INTERACTION_ZONES`, and `buildInteractionZones(showcases)`.
- Later tasks consume `buildInteractionZones(content.showcases)` to create the scene’s complete zone list.

- [ ] **Step 1: Write the failing layout tests**

```ts
import {
  buildInteractionZones,
  MAX_SHOWCASE_SLOTS,
  SHOWCASE_SLOT_ANCHORS,
} from '../src/game/sceneLayout'

it('由右至左為三筆 Showcase 建立置中的書櫃互動點', () => {
  const zones = buildInteractionZones([
    { id: 'first' }, { id: 'second' }, { id: 'third' },
  ])
  expect(zones.filter((zone) => zone.type === 'showcase')).toEqual([
    { id: 'first', type: 'showcase', x: 1021, y: 270, width: 72, height: 64, anchorX: 1057, anchorY: 163 },
    { id: 'second', type: 'showcase', x: 945, y: 270, width: 72, height: 64, anchorX: 981, anchorY: 163 },
    { id: 'third', type: 'showcase', x: 869, y: 270, width: 72, height: 64, anchorX: 905, anchorY: 163 },
  ])
})

it('沒有 Showcase 時不建立 Showcase 互動點', () => {
  expect(buildInteractionZones([]).filter((zone) => zone.type === 'showcase')).toEqual([])
})

it('十個 Showcase 一一使用十個書櫃中心點', () => {
  const zones = buildInteractionZones(
    Array.from({ length: MAX_SHOWCASE_SLOTS }, (_, index) => ({ id: `item-${index}` })),
  ).filter((zone) => zone.type === 'showcase')
  expect(zones.map((zone) => zone.anchorX)).toEqual(SHOWCASE_SLOT_ANCHORS)
  expect(zones.every((zone) => zone.anchorY === 163)).toBe(true)
})
```

- [ ] **Step 2: Run the new tests and verify they fail**

Run: `npm test -- tests/sceneLayout.test.ts -t "Showcase"`

Expected: FAIL because `buildInteractionZones`, `MAX_SHOWCASE_SLOTS`, and `SHOWCASE_SLOT_ANCHORS` do not exist.

- [ ] **Step 3: Implement the fixed slots and runtime zone factory**

Replace the hard-coded `showcase-1` through `showcase-5` entries with the following exported definitions, retaining the existing shelf and information objects as `STATIC_INTERACTION_ZONES`:

```ts
export const MAX_SHOWCASE_SLOTS = 10
export const SHOWCASE_SLOT_ANCHORS = [
  1057, 981, 905, 828, 746, 668, 590, 512, 434, 356,
] as const

type ShowcaseReference = Readonly<{ id: string }>

export const STATIC_INTERACTION_ZONES: readonly Zone[] = [
  {
    id: 'shelf-1', type: 'shelf',
    x: 1020, y: 360, width: 170, height: 160,
    anchorX: 950, anchorY: 412,
  },
  {
    id: 'info-1', type: 'info',
    x: 1208, y: 285, width: 92, height: 285,
    anchorX: 1324, anchorY: 300,
  },
] as const

export function buildInteractionZones(
  showcases: readonly ShowcaseReference[],
): readonly Zone[] {
  if (showcases.length > MAX_SHOWCASE_SLOTS) {
    throw new RangeError(`Showcase 最多只能設定 ${MAX_SHOWCASE_SLOTS} 筆`)
  }
  return [
    ...showcases.map((showcase, index) => ({
      id: showcase.id,
      type: 'showcase' as const,
      x: SHOWCASE_SLOT_ANCHORS[index] - 36,
      y: 270,
      width: 72,
      height: 64,
      anchorX: SHOWCASE_SLOT_ANCHORS[index],
      anchorY: 163,
    })),
    ...STATIC_INTERACTION_ZONES,
  ]
}
```

- [ ] **Step 4: Run the layout tests and verify they pass**

Run: `npm test -- tests/sceneLayout.test.ts`

Expected: new zero, three, and ten-slot tests pass. If the existing spawn-point expectation still fails, record it as the pre-existing `{ x: 270, y: 300 }` vs `{ x: 1205, y: 250 }` mismatch; do not alter it in this feature.

- [ ] **Step 5: Commit the layout factory**

```bash
git add src/game/sceneLayout.ts tests/sceneLayout.test.ts
git commit -m "feat: build showcase zones from configured slots"
```

### Task 2: Enforce the CMS capacity and validate generated zones

**Files:**
- Modify: `src/content/schema.ts`
- Modify: `scripts/validate-content.ts`
- Modify: `tests/schema.test.ts`
- Modify: `tests/validate.test.ts`

**Interfaces:**
- Consumes: `MAX_SHOWCASE_SLOTS` and `buildInteractionZones` from `src/game/sceneLayout.ts`.
- Produces: a parsed `ContentBundle` with at most ten showcases, and build-time validation against only active showcase zones plus permanent zones.
- Later tasks rely on parsed content being safe to pass to `buildInteractionZones`.

- [ ] **Step 1: Write the failing schema and validation tests**

```ts
it('接受零到十筆 Showcase，但拒絕第十一筆', () => {
  const empty = { ...content, showcases: [] }
  expect(ContentBundleSchema.safeParse(empty).success).toBe(true)

  const eleven = {
    ...content,
    showcases: Array.from({ length: 11 }, (_, index) => ({
      ...content.showcases[0], id: `showcase-${index}`,
    })),
  }
  expect(ContentBundleSchema.safeParse(eleven).success).toBe(false)
})

it('空 Showcase 內容與生成的場景互動點完全對應', () => {
  const empty = { ...content, showcases: [] }
  expect(validateContent(buildInteractionZones(empty.showcases), empty)).toEqual([])
})
```

- [ ] **Step 2: Run the tests and verify they fail**

Run: `npm test -- tests/schema.test.ts tests/validate.test.ts`

Expected: the eleven-item schema case succeeds before the `.max(10)` constraint, and the generated-zone helper import is unavailable.

- [ ] **Step 3: Apply the capacity and build-time zone generation**

```ts
// src/content/schema.ts
export const ContentBundleSchema = z.object({
  showcases: z.array(ShowcaseSchema).max(10),
  shelves: z.array(ShelfSchema),
  storeInfo: StoreInfoSchema,
})

// scripts/validate-content.ts
import { buildInteractionZones } from '../src/game/sceneLayout'

const errors = validateContent(
  buildInteractionZones(parsed.data.showcases),
  parsed.data,
)
```

Update existing validation tests to import `buildInteractionZones` and pass `buildInteractionZones(content.showcases)` instead of a static showcase-zone list. Preserve their duplicate-id and shelf/info assertions.

- [ ] **Step 4: Run the schema and validation suites and verify they pass**

Run: `npm test -- tests/schema.test.ts tests/validate.test.ts`

Expected: PASS with the new zero and eleven showcase cases included.

- [ ] **Step 5: Commit the content capacity change**

```bash
git add src/content/schema.ts scripts/validate-content.ts tests/schema.test.ts tests/validate.test.ts
git commit -m "feat: limit showcase content to ten slots"
```

### Task 3: Pass runtime zones from content into Phaser

**Files:**
- Modify: `src/App.vue`
- Modify: `src/game/createGame.ts`
- Modify: `src/game/StoreScene.ts`
- Modify: `tests/App.test.ts`
- Modify: `tests/StoreScene.test.ts`

**Interfaces:**
- Consumes: `buildInteractionZones(content.showcases): readonly Zone[]`.
- Produces: `createGame(parent, labels, zones)` and `new StoreScene(labels, zones)`.
- `StoreScene` uses its injected zones for marker creation and proximity detection.

- [ ] **Step 1: Write the failing integration tests**

```ts
it('只把已設定 Showcase 的互動區傳給 Phaser', async () => {
  mocks.loadContent.mockResolvedValue({ ...content, showcases: [] })
  await mountApp()

  expect(mocks.createGame).toHaveBeenCalledWith(
    expect.any(HTMLElement),
    expect.any(Object),
    expect.not.arrayContaining([
      expect.objectContaining({ type: 'showcase' }),
    ]),
  )
})

it('以注入的互動區建立標記與 proximity 判定', () => {
  const zones = buildInteractionZones([{ id: 'dynamic-showcase' }])
  const scene = createSceneFixture(new StoreScene({ 'dynamic-showcase': '動態展示' }, zones))
  scene.create()
  expect(scene.markers.has('dynamic-showcase')).toBe(true)
})
```

Adjust `createSceneFixture` so it accepts the `StoreScene` instance supplied by the test instead of always constructing `new StoreScene()`.

- [ ] **Step 2: Run the tests and verify they fail**

Run: `npm test -- tests/App.test.ts tests/StoreScene.test.ts`

Expected: FAIL because `createGame` accepts two arguments and `StoreScene` still reads the static showcase list.

- [ ] **Step 3: Inject runtime zones through the game boundary**

```ts
// src/App.vue
import { buildInteractionZones } from './game/sceneLayout'

game = createGame(
  container.value,
  buildInteractionLabels(content.value),
  buildInteractionZones(content.value.showcases),
)

// src/game/createGame.ts
import type { Zone } from './zones'

export function createGame(
  parent: HTMLElement,
  labels: InteractionLabels,
  zones: readonly Zone[],
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
    scene: [BootScene, new StoreScene(labels, zones)],
  })
}

// src/game/StoreScene.ts
constructor(
  private readonly labels: InteractionLabels,
  private readonly interactionZones: readonly Zone[],
) {
  super('store')
}

// Replace every INTERACTION_ZONES reference with this.interactionZones.
```

Use `this.interactionZones` both when constructing `InteractionMarker` instances and when calling `findNearestZone`. Keep the existing shelf and information marker behaviour unchanged.

- [ ] **Step 4: Run the integration tests and verify they pass**

Run: `npm test -- tests/App.test.ts tests/StoreScene.test.ts`

Expected: PASS, including the empty-showcase `createGame` argument assertion and dynamic marker assertion.

- [ ] **Step 5: Commit the runtime zone wiring**

```bash
git add src/App.vue src/game/createGame.ts src/game/StoreScene.ts tests/App.test.ts tests/StoreScene.test.ts
git commit -m "feat: render only configured showcase markers"
```

### Task 4: Keep desktop acceptance coverage content-driven

**Files:**
- Modify: `e2e/basic.spec.ts`

**Interfaces:**
- Consumes: the sample `content.json` response and the runtime showcase zones from `App`.
- Produces: desktop acceptance coverage whose expected showcase ids are derived from the configured CMS content rather than a fixed five-item list.


- [ ] **Step 1: Write the content-driven acceptance expectation**

At the start of the desktop walkthrough, load the configured showcase ids from the same content endpoint that the app uses:

```ts
const configuredShowcaseIds = await page.evaluate(async () => {
  const response = await fetch('/content.json')
  const content = await response.json() as {
    showcases: Array<{ id: string }>
  }
  return content.showcases.map((showcase) => showcase.id)
})

expect(await page.evaluate(() => window.__observedZoneIds)).toEqual([
  ...configuredShowcaseIds.slice().reverse(),
  'shelf-1',
  'info-1',
])
```

- [ ] **Step 2: Run the updated acceptance test**

Run: `npm run e2e -- --project=desktop -g "Showcase|從入口實際步行到全部七個互動點"`

Expected: PASS after Task 3. The walkthrough retains Space to interact and Escape to close the shelf panel.

- [ ] **Step 3: Commit acceptance coverage**

```bash
git add e2e/basic.spec.ts
git commit -m "test: cover dynamic showcase slots"
```

### Task 5: Final verification

**Files:**
- Verify: `src/game/sceneLayout.ts`, `src/content/schema.ts`, `src/App.vue`, `src/game/createGame.ts`, `src/game/StoreScene.ts`
- Verify: `tests/sceneLayout.test.ts`, `tests/schema.test.ts`, `tests/validate.test.ts`, `tests/App.test.ts`, `tests/StoreScene.test.ts`, `e2e/basic.spec.ts`

- [ ] **Step 1: Run unit and integration verification**

Run: `npm test`

Expected: all showcase-slot tests pass. If `tests/sceneLayout.test.ts` still reports the unrelated player-spawn assertion mismatch, report that exact existing failure separately instead of changing the spawn coordinates.

- [ ] **Step 2: Run production validation and build**

Run: `npm run build`

Expected: content validation accepts zero through ten showcases, then Vite exits 0.

- [ ] **Step 3: Review the final diff**

Run: `git diff --check && git status --short`

Expected: no whitespace errors and only the intended showcase-slot implementation changes are unstaged or committed.
