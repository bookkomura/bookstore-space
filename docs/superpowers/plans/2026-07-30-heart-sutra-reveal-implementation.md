# Heart Sutra Fog Reveal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a quiet “抄寫心經” interaction at the left end of the central table, where touch, mouse, or keyboard input reveals one session-stable excerpt from the Xuanzang Heart Sutra through a fog-covered paper.

**Architecture:** Keep Phaser responsible for the tabletop art, proximity zone, and generic `interact` event. Keep Vue responsible for excerpt selection, the full-screen paper overlay, fog rendering, responsive behavior, accessibility, and closing. Put session selection and reveal-progress math in small pure TypeScript modules so they can be tested without Phaser or canvas.

**Tech Stack:** Vue 3 Composition API, TypeScript 5.9, Phaser 3.80, HTML Canvas 2D, `sessionStorage`, Vitest 2.1 with Vue Test Utils, Playwright 1.61.

## Global Constraints

- The interaction ID is exactly `sutra-1`, its `ZoneType` is exactly `sutra`, and its visible label is exactly `抄寫心經`.
- Place the tabletop paper and brush at the user-approved empty spot on the left end of the central long table.
- Keep the existing `store-background.png` unchanged; render a separate transparent `96×64` PNG at native scale.
- Use exactly the seven reviewed Xuanzang excerpts in Task 1; never slice arbitrary substrings from the full sutra.
- Keep one excerpt for the lifetime of one browser tab with `sessionStorage`; refresh keeps it, closing the tab ends it, and a later draw may coincidentally repeat it.
- Reopening in the same tab resets fog progress but keeps the excerpt.
- Reveal the remaining fog when coverage reaches exactly `70%`.
- Normal touch or mouse completion should take about `10–15` seconds without showing a timer or enforcing a deadline.
- The experience is silent and contains no score, countdown, progress bar, success animation, upload, analytics, promotional copy, store directions, hours, or reservation action.
- Mobile copy is exactly `以指尖輕拂紙面`; desktop copy is exactly `以游標輕拂紙面`.
- Show one initial finger demonstration and replay it once after four seconds of inactivity; stop all hints after the first interaction.
- Preserve excerpt, reveal progress, and completion state across viewport resize or device rotation.
- Respect `prefers-reduced-motion`; keep real DOM text for assistive technology; Enter and Space reveal the excerpt; Escape and the close button exit.
- If canvas setup fails, show the complete excerpt and close control instead of a broken or blank state.
- Do not add dependencies, CMS fields, backend services, accounts, audio, or changes to existing interaction behavior.

---

## File Structure

### Create

- `src/content/heartSutra.ts` — reviewed excerpt list and tab-session selection.
- `src/game/sceneArt.ts` — tabletop texture key, URL, position, and required/optional asset policy.
- `src/ui/heartSutraFog.ts` — normalized points, deterministic coverage tracking, fog painting, and fog clearing.
- `src/ui/HeartSutraReveal.vue` — accessible responsive reveal overlay.
- `src/assets/heart-sutra-desk.png` — transparent `96×64` pixel-art paper-and-brush overlay.
- `tests/heartSutra.test.ts` — excerpt and session-selection tests.
- `tests/sceneArt.test.ts` — optional asset-policy tests.
- `tests/heartSutraFog.test.ts` — reveal-model tests.
- `tests/HeartSutraReveal.test.ts` — Vue interaction and fallback tests.

### Modify

- `src/game/zones.ts` — add the `sutra` zone type.
- `src/game/sceneLayout.ts` — add the approved approach zone and tabletop marker anchor.
- `src/game/interactionLabels.ts` — add the fixed `抄寫心經` label.
- `src/game/BootScene.ts` — preload the optional tabletop art without failing the whole scene.
- `src/game/StoreScene.ts` — render tabletop art when the texture exists.
- `src/App.vue` — route the `sutra` event to the Vue overlay and preserve session excerpt state.
- `scripts/validate-scene-assets.ts` — validate tabletop PNG size and transparency.
- `tests/sceneLayout.test.ts` — verify coordinates, reachability, and separation from adjacent zones.
- `tests/interactionLabels.test.ts` — verify the fixed label.
- `tests/sceneAssets.test.ts` — verify tabletop PNG contract.
- `tests/StoreScene.test.ts` — verify optional tabletop art rendering.
- `tests/App.test.ts` — verify bridge integration, closing, Escape, and session stability.
- `e2e/basic.spec.ts` — verify real walking, mobile hinting, gesture completion, rotation, and closing.
- `README.md` — document the new interaction and updated scene acceptance.

---

### Task 1: Reviewed Excerpts and Tab-Session Selection

**Files:**

- Create: `src/content/heartSutra.ts`
- Create: `tests/heartSutra.test.ts`

**Interfaces:**

- Consumes: Web Storage methods `getItem(key)` and `setItem(key, value)`, plus an injectable `random(): number`.
- Produces: `HEART_SUTRA_EXCERPTS`, `HEART_SUTRA_SESSION_KEY`, `chooseHeartSutraExcerpt(random)`, and `getSessionHeartSutraExcerpt(storage, random)`.

- [ ] **Step 1: Write the failing tests for the exact content contract**

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  chooseHeartSutraExcerpt,
  getSessionHeartSutraExcerpt,
  HEART_SUTRA_EXCERPTS,
  HEART_SUTRA_SESSION_KEY,
} from '../src/content/heartSutra'

describe('heartSutra', () => {
  beforeEach(() => sessionStorage.clear())

  it('uses only the seven reviewed Xuanzang excerpts', () => {
    expect(HEART_SUTRA_EXCERPTS).toEqual([
      '照見五蘊皆空，度一切苦厄',
      '色不異空，空不異色',
      '色即是空，空即是色',
      '不生不滅，不垢不淨，不增不減',
      '心無罣礙，無有恐怖',
      '遠離顛倒夢想，究竟涅槃',
      '能除一切苦，真實不虛',
    ])
  })

  it('maps random values to a reviewed excerpt', () => {
    expect(chooseHeartSutraExcerpt(() => 0)).toBe(HEART_SUTRA_EXCERPTS[0])
    expect(chooseHeartSutraExcerpt(() => 0.999999)).toBe(HEART_SUTRA_EXCERPTS[6])
  })

  it('keeps a valid excerpt for the browser-tab session', () => {
    sessionStorage.setItem(HEART_SUTRA_SESSION_KEY, HEART_SUTRA_EXCERPTS[4])
    const random = vi.fn(() => 0)
    expect(getSessionHeartSutraExcerpt(sessionStorage, random)).toBe(HEART_SUTRA_EXCERPTS[4])
    expect(random).not.toHaveBeenCalled()
  })

  it('replaces an obsolete stored value with a reviewed excerpt', () => {
    sessionStorage.setItem(HEART_SUTRA_SESSION_KEY, 'obsolete')
    expect(getSessionHeartSutraExcerpt(sessionStorage, () => 0)).toBe(HEART_SUTRA_EXCERPTS[0])
    expect(sessionStorage.getItem(HEART_SUTRA_SESSION_KEY)).toBe(HEART_SUTRA_EXCERPTS[0])
  })

  it('still returns an excerpt when storage is unavailable', () => {
    const storage = {
      getItem: vi.fn(() => { throw new DOMException('blocked') }),
      setItem: vi.fn(),
    }
    expect(getSessionHeartSutraExcerpt(storage, () => 0)).toBe(HEART_SUTRA_EXCERPTS[0])
  })
})
```

- [ ] **Step 2: Run the focused test and verify the missing module failure**

Run: `npx vitest run tests/heartSutra.test.ts`

Expected: FAIL because `src/content/heartSutra.ts` does not exist.

- [ ] **Step 3: Implement the reviewed list and defensive session selection**

```ts
export const HEART_SUTRA_EXCERPTS = [
  '照見五蘊皆空，度一切苦厄',
  '色不異空，空不異色',
  '色即是空，空即是色',
  '不生不滅，不垢不淨，不增不減',
  '心無罣礙，無有恐怖',
  '遠離顛倒夢想，究竟涅槃',
  '能除一切苦，真實不虛',
] as const

export type HeartSutraExcerpt = typeof HEART_SUTRA_EXCERPTS[number]
export const HEART_SUTRA_SESSION_KEY = 'bookstore:heart-sutra-excerpt'

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>

export function chooseHeartSutraExcerpt(
  random: () => number = Math.random,
): HeartSutraExcerpt {
  const index = Math.min(
    Math.floor(Math.max(0, random()) * HEART_SUTRA_EXCERPTS.length),
    HEART_SUTRA_EXCERPTS.length - 1,
  )
  return HEART_SUTRA_EXCERPTS[index]
}

export function getSessionHeartSutraExcerpt(
  storage: StorageLike = window.sessionStorage,
  random: () => number = Math.random,
): HeartSutraExcerpt {
  try {
    const saved = storage.getItem(HEART_SUTRA_SESSION_KEY)
    if (HEART_SUTRA_EXCERPTS.includes(saved as HeartSutraExcerpt)) {
      return saved as HeartSutraExcerpt
    }
    const selected = chooseHeartSutraExcerpt(random)
    storage.setItem(HEART_SUTRA_SESSION_KEY, selected)
    return selected
  } catch {
    return chooseHeartSutraExcerpt(random)
  }
}
```

- [ ] **Step 4: Run the focused test**

Run: `npx vitest run tests/heartSutra.test.ts`

Expected: PASS with 5 tests.

- [ ] **Step 5: Commit the content boundary**

```bash
git add src/content/heartSutra.ts tests/heartSutra.test.ts
git commit -m "feat: add heart sutra session excerpts"
```

---

### Task 2: Scene Zone and Fixed Interaction Label

**Files:**

- Modify: `src/game/zones.ts`
- Modify: `src/game/sceneLayout.ts`
- Modify: `src/game/interactionLabels.ts`
- Modify: `tests/sceneLayout.test.ts`
- Modify: `tests/interactionLabels.test.ts`

**Interfaces:**

- Consumes: existing `Zone`, `ZoneType`, `STATIC_INTERACTION_ZONES`, and `InteractionLabels`.
- Produces: `ZoneType` member `sutra`, `HEART_SUTRA_DESK_POSITION`, the `sutra-1` static zone, and label `抄寫心經`.

- [ ] **Step 1: Add failing scene-layout and label assertions**

Add this exact assertion to `tests/sceneLayout.test.ts`:

```ts
it('places the heart sutra interaction at the reachable left end of the central table', () => {
  const sutra = STATIC_INTERACTION_ZONES.find((item) => item.id === 'sutra-1')!
  expect(sutra).toEqual({
    id: 'sutra-1',
    type: 'sutra',
    x: 280,
    y: 360,
    width: 127,
    height: 175,
    anchorX: 485,
    anchorY: 455,
  })

  const table = COLLISION_RECTS.find((item) => item.id === 'table-center')!
  expect(sutra.x + sutra.width).toBeLessThanOrEqual(table.x)

  type StaticZone = typeof STATIC_INTERACTION_ZONES[number]
  const overlaps = (a: StaticZone, b: StaticZone) =>
    a.x < b.x + b.width
    && a.x + a.width > b.x
    && a.y < b.y + b.height
    && a.y + a.height > b.y

  for (const other of STATIC_INTERACTION_ZONES.filter((item) => item.id !== 'sutra-1')) {
    expect(overlaps(sutra, other)).toBe(false)
  }
})
```

Rename the existing static-zone test to `定義五商品、店長選書、營業資訊、檔案室、詩集桌與心經共十區`, then update its ID expectation so it ends with:

```ts
'archive-1',
'poem-upload-1',
'sutra-1',
```

Add this test to `tests/interactionLabels.test.ts`:

```ts
it('labels the heart sutra table', () => {
  expect(buildInteractionLabels(content)['sutra-1']).toBe('抄寫心經')
})
```

- [ ] **Step 2: Run both focused test files and verify failure**

Run: `npx vitest run tests/sceneLayout.test.ts tests/interactionLabels.test.ts`

Expected: FAIL because `sutra-1` and its label do not exist.

- [ ] **Step 3: Add the zone type, coordinates, and label**

Change `ZoneType` in `src/game/zones.ts`:

```ts
export type ZoneType =
  | 'showcase'
  | 'shelf'
  | 'info'
  | 'archive'
  | 'poemUpload'
  | 'sutra'
```

Add to `src/game/sceneLayout.ts`:

```ts
export const HEART_SUTRA_DESK_POSITION: Point = { x: 485, y: 455 }
```

Append to `STATIC_INTERACTION_ZONES`:

```ts
{
  id: 'sutra-1',
  type: 'sutra',
  x: 280,
  y: 360,
  width: 127,
  height: 175,
  anchorX: HEART_SUTRA_DESK_POSITION.x,
  anchorY: HEART_SUTRA_DESK_POSITION.y,
},
```

Add to the frozen label object in `src/game/interactionLabels.ts`:

```ts
'sutra-1': '抄寫心經',
```

- [ ] **Step 4: Run the focused tests**

Run: `npx vitest run tests/sceneLayout.test.ts tests/interactionLabels.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the scene contract**

```bash
git add src/game/zones.ts src/game/sceneLayout.ts src/game/interactionLabels.ts tests/sceneLayout.test.ts tests/interactionLabels.test.ts
git commit -m "feat: add heart sutra interaction zone"
```

---

### Task 3: Optional Tabletop Pixel Art

**Files:**

- Create: `src/assets/heart-sutra-desk.png`
- Create: `src/game/sceneArt.ts`
- Create: `tests/sceneArt.test.ts`
- Modify: `src/game/BootScene.ts`
- Modify: `src/game/StoreScene.ts`
- Modify: `tests/StoreScene.test.ts`
- Modify: `tests/sceneAssets.test.ts`
- Modify: `scripts/validate-scene-assets.ts`

**Interfaces:**

- Consumes: `HEART_SUTRA_DESK_POSITION` from `sceneLayout.ts`.
- Produces: texture key `heart-sutra-desk`, asset URL, `isRequiredSceneAsset(key)`, and a transparent `96×64` PNG.

- [ ] **Step 1: Write failing asset-policy and PNG-contract tests**

Create `tests/sceneArt.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  HEART_SUTRA_DESK_TEXTURE_KEY,
  isRequiredSceneAsset,
} from '../src/game/sceneArt'

describe('sceneArt', () => {
  it('treats the heart sutra tabletop art as optional', () => {
    expect(HEART_SUTRA_DESK_TEXTURE_KEY).toBe('heart-sutra-desk')
    expect(isRequiredSceneAsset('heart-sutra-desk')).toBe(false)
    expect(isRequiredSceneAsset('store-background')).toBe(true)
    expect(isRequiredSceneAsset('player-visitor')).toBe(true)
  })
})
```

Add to `tests/sceneAssets.test.ts`:

```ts
it('uses a transparent 96×64 heart sutra tabletop overlay', () => {
  const asset = readPng('src/assets/heart-sutra-desk.png')
  expect({ width: asset.width, height: asset.height }).toEqual({
    width: 96,
    height: 64,
  })
  const cornerAlpha = [
    asset.data[3],
    asset.data[(asset.width - 1) * 4 + 3],
    asset.data[((asset.height - 1) * asset.width) * 4 + 3],
    asset.data[(asset.width * asset.height - 1) * 4 + 3],
  ]
  expect(cornerAlpha).toEqual([0, 0, 0, 0])
  expect(asset.data.some((value, index) => index % 4 === 3 && value > 0)).toBe(true)
})
```

- [ ] **Step 2: Run the tests and verify missing file/module failures**

Run: `npx vitest run tests/sceneArt.test.ts tests/sceneAssets.test.ts`

Expected: FAIL because `sceneArt.ts` and `heart-sutra-desk.png` do not exist.

- [ ] **Step 3: Create and visually validate the tabletop asset**

Use the `imagegen` skill to generate a transparent pixel-art overlay with these exact constraints:

- Canvas: `96×64`, transparent background, all four outer corner pixels transparent.
- Contents: one warm off-white rectangular sutra paper, a few subtle vertical ink marks, and one slim dark-brown calligraphy brush.
- Perspective: the same slightly top-down view as `store-background.png`.
- Lighting: warm light from above, low saturation, dark pixel outline, no glow.
- Exclusions: no red annotation, no readable large text, no person, no furniture, no drop shadow outside the 96×64 canvas.

Inspect the result at native size and overlaid at `{ x: 485, y: 455 }` on `store-background.png`. Regenerate or crop with nearest-neighbor sampling until the paper and brush are legible without looking sharper, larger, or more saturated than the nearby books.

- [ ] **Step 4: Add the optional-asset module**

Create `src/game/sceneArt.ts`:

```ts
export const HEART_SUTRA_DESK_TEXTURE_KEY = 'heart-sutra-desk'
export const HEART_SUTRA_DESK_ASSET_URL =
  new URL('../assets/heart-sutra-desk.png', import.meta.url).href

export function isRequiredSceneAsset(key: string): boolean {
  return key !== HEART_SUTRA_DESK_TEXTURE_KEY
}
```

- [ ] **Step 5: Preload the optional texture without failing the scene**

In `src/game/BootScene.ts`, import the three `sceneArt` exports. Replace the generic load-error callback with:

```ts
this.load.on('loaderror', (file: Phaser.Loader.File) => {
  const key = String(file.key)
  if (isRequiredSceneAsset(key)) {
    this.assetFailed = true
  } else if (import.meta.env.DEV) {
    console.warn(`Optional scene asset failed to load: ${key}`)
  }
})
```

Add after the background load:

```ts
this.load.image(HEART_SUTRA_DESK_TEXTURE_KEY, HEART_SUTRA_DESK_ASSET_URL)
```

The required background and player sheets keep the existing fatal error behavior; only the tabletop overlay is optional.

- [ ] **Step 6: Render the texture only when Phaser has it**

In `src/game/StoreScene.ts`, import `HEART_SUTRA_DESK_POSITION` and `HEART_SUTRA_DESK_TEXTURE_KEY`. Immediately after adding the background, add:

```ts
if (this.textures.exists(HEART_SUTRA_DESK_TEXTURE_KEY)) {
  this.add
    .image(
      HEART_SUTRA_DESK_POSITION.x,
      HEART_SUTRA_DESK_POSITION.y,
      HEART_SUTRA_DESK_TEXTURE_KEY,
    )
    .setOrigin(0.5)
    .setDepth(1)
}
```

Add `textures: { exists: vi.fn(() => true) }` to the StoreScene fixture. Add this test:

```ts
it('renders the optional heart sutra paper at the approved table position', () => {
  const { scene } = createSceneFixture()
  scene.create()
  expect(scene.add.image).toHaveBeenCalledWith(485, 455, 'heart-sutra-desk')
})
```

Add a second test with `scene.textures.exists.mockReturnValue(false)` and assert that no `add.image` call uses `heart-sutra-desk`; `scene.create()` must not throw.

- [ ] **Step 7: Extend the command-line asset validator**

In `scripts/validate-scene-assets.ts`, validate the new PNG:

```ts
const heartSutraDesk = assertSize('src/assets/heart-sutra-desk.png', 96, 64)
const deskCornerAlpha = [
  heartSutraDesk.data[3],
  heartSutraDesk.data[(heartSutraDesk.width - 1) * 4 + 3],
  heartSutraDesk.data[((heartSutraDesk.height - 1) * heartSutraDesk.width) * 4 + 3],
  heartSutraDesk.data[(heartSutraDesk.width * heartSutraDesk.height - 1) * 4 + 3],
]
if (deskCornerAlpha.some((alpha) => alpha !== 0)) {
  throw new Error('src/assets/heart-sutra-desk.png 四個外角必須完全透明')
}
```

Update the success message to mention the `96×64` heart sutra tabletop asset.

- [ ] **Step 8: Run asset and focused tests**

Run: `npm run assets`

Expected: PASS and output mentions the `96×64` tabletop asset.

Run: `npx vitest run tests/sceneArt.test.ts tests/sceneAssets.test.ts tests/StoreScene.test.ts`

Expected: PASS.

- [ ] **Step 9: Commit the scene art**

```bash
git add src/assets/heart-sutra-desk.png src/game/sceneArt.ts src/game/BootScene.ts src/game/StoreScene.ts scripts/validate-scene-assets.ts tests/sceneArt.test.ts tests/sceneAssets.test.ts tests/StoreScene.test.ts
git commit -m "feat: add heart sutra tabletop art"
```

---

### Task 4: Deterministic Fog-Reveal Model

**Files:**

- Create: `src/ui/heartSutraFog.ts`
- Create: `tests/heartSutraFog.test.ts`

**Interfaces:**

- Consumes: normalized points in the inclusive range `[0, 1]`.
- Produces: `FOG_REVEAL_THRESHOLD`, `NormalizedPoint`, `FogRevealTracker`, `normalizePaperPoint`, `paintFog`, and `clearFogAt`.

- [ ] **Step 1: Write failing reveal-model tests**

```ts
import { describe, expect, it } from 'vitest'
import {
  FOG_REVEAL_THRESHOLD,
  FogRevealTracker,
  normalizePaperPoint,
} from '../src/ui/heartSutraFog'

describe('heartSutraFog', () => {
  it('uses the approved 70% completion threshold', () => {
    expect(FOG_REVEAL_THRESHOLD).toBe(0.7)
  })

  it('normalizes pointer coordinates and rejects points outside the paper', () => {
    const rect = { left: 100, top: 50, width: 200, height: 400 } as DOMRect
    expect(normalizePaperPoint(200, 250, rect)).toEqual({ x: 0.5, y: 0.5 })
    expect(normalizePaperPoint(99, 250, rect)).toBeNull()
    expect(normalizePaperPoint(301, 250, rect)).toBeNull()
  })

  it('preserves normalized samples for repaint after a resize', () => {
    const tracker = new FogRevealTracker(20, 28, 0.06)
    tracker.revealAt({ x: 0.25, y: 0.4 })
    tracker.revealAt({ x: 0.75, y: 0.6 })
    expect(tracker.samples).toEqual([
      { x: 0.25, y: 0.4 },
      { x: 0.75, y: 0.6 },
    ])
    expect(tracker.progress).toBeGreaterThan(0)
  })

  it('reaches completion only after at least 70% of grid cells are revealed', () => {
    const tracker = new FogRevealTracker(20, 28, 0.06)
    for (let row = 0; row < 28 && !tracker.complete; row += 1) {
      for (let column = 0; column < 20 && !tracker.complete; column += 1) {
        tracker.revealAt({
          x: (column + 0.5) / 20,
          y: (row + 0.5) / 28,
        })
      }
    }
    expect(tracker.progress).toBeGreaterThanOrEqual(FOG_REVEAL_THRESHOLD)
    expect(tracker.complete).toBe(true)
  })
})
```

- [ ] **Step 2: Run the focused test and verify missing module failure**

Run: `npx vitest run tests/heartSutraFog.test.ts`

Expected: FAIL because `heartSutraFog.ts` does not exist.

- [ ] **Step 3: Implement normalized coverage tracking**

```ts
export const FOG_REVEAL_THRESHOLD = 0.7

export interface NormalizedPoint {
  x: number
  y: number
}

export class FogRevealTracker {
  private readonly revealed = new Set<number>()
  private readonly recordedSamples: NormalizedPoint[] = []

  constructor(
    private readonly columns = 20,
    private readonly rows = 28,
    private readonly brushRadius = 0.06,
  ) {}

  get samples(): readonly NormalizedPoint[] {
    return this.recordedSamples
  }

  get progress(): number {
    return this.revealed.size / (this.columns * this.rows)
  }

  get complete(): boolean {
    return this.progress >= FOG_REVEAL_THRESHOLD
  }

  revealAt(point: NormalizedPoint): number {
    const normalized = {
      x: Math.min(1, Math.max(0, point.x)),
      y: Math.min(1, Math.max(0, point.y)),
    }
    this.recordedSamples.push(normalized)

    for (let row = 0; row < this.rows; row += 1) {
      for (let column = 0; column < this.columns; column += 1) {
        const cellX = (column + 0.5) / this.columns
        const cellY = (row + 0.5) / this.rows
        if (Math.hypot(cellX - normalized.x, cellY - normalized.y) <= this.brushRadius) {
          this.revealed.add(row * this.columns + column)
        }
      }
    }
    return this.progress
  }
}

export function normalizePaperPoint(
  clientX: number,
  clientY: number,
  rect: DOMRect,
): NormalizedPoint | null {
  if (
    rect.width <= 0
    || rect.height <= 0
    || clientX < rect.left
    || clientX > rect.right
    || clientY < rect.top
    || clientY > rect.bottom
  ) return null

  return {
    x: (clientX - rect.left) / rect.width,
    y: (clientY - rect.top) / rect.height,
  }
}
```

- [ ] **Step 4: Add deterministic canvas paint and clear helpers**

Append:

```ts
export function paintFog(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
): void {
  context.globalCompositeOperation = 'source-over'
  context.clearRect(0, 0, width, height)
  const gradient = context.createLinearGradient(0, 0, width, height)
  gradient.addColorStop(0, 'rgba(220, 218, 209, 0.88)')
  gradient.addColorStop(0.5, 'rgba(202, 204, 199, 0.78)')
  gradient.addColorStop(1, 'rgba(226, 221, 210, 0.86)')
  context.fillStyle = gradient
  context.fillRect(0, 0, width, height)
}

export function clearFogAt(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  point: NormalizedPoint,
  brushRadius = 0.06,
): void {
  context.save()
  context.globalCompositeOperation = 'destination-out'
  context.beginPath()
  context.arc(
    point.x * width,
    point.y * height,
    Math.min(width, height) * brushRadius,
    0,
    Math.PI * 2,
  )
  context.fill()
  context.restore()
}
```

- [ ] **Step 5: Run the focused test**

Run: `npx vitest run tests/heartSutraFog.test.ts`

Expected: PASS with 4 tests.

- [ ] **Step 6: Commit the reveal model**

```bash
git add src/ui/heartSutraFog.ts tests/heartSutraFog.test.ts
git commit -m "feat: add heart sutra fog reveal model"
```

---

### Task 5: Accessible Fog-Reveal Vue Overlay

**Files:**

- Create: `src/ui/HeartSutraReveal.vue`
- Create: `tests/HeartSutraReveal.test.ts`

**Interfaces:**

- Consumes: prop `excerpt: string`; `FogRevealTracker`, `normalizePaperPoint`, `paintFog`, and `clearFogAt`.
- Produces: `close` event and stable test IDs `heart-sutra-overlay`, `heart-sutra-paper`, `heart-sutra-text`, `heart-sutra-fog`, `heart-sutra-hint`, `heart-sutra-finger`, and `close`.

- [ ] **Step 1: Write failing component tests with deterministic canvas mocks**

Create `tests/HeartSutraReveal.test.ts` with:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import HeartSutraReveal from '../src/ui/HeartSutraReveal.vue'

const context = {
  arc: vi.fn(),
  beginPath: vi.fn(),
  clearRect: vi.fn(),
  createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
  fill: vi.fn(),
  fillRect: vi.fn(),
  restore: vi.fn(),
  save: vi.fn(),
  set fillStyle(_value: string | CanvasGradient) {},
  set globalCompositeOperation(_value: GlobalCompositeOperation) {},
} as unknown as CanvasRenderingContext2D

let resizeCallback: ResizeObserverCallback

class ResizeObserverMock {
  constructor(callback: ResizeObserverCallback) {
    resizeCallback = callback
  }
  observe() { resizeCallback([], this as unknown as ResizeObserver) }
  disconnect() {}
  unobserve() {}
}

describe('HeartSutraReveal', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context)
    vi.stubGlobal('ResizeObserver', ResizeObserverMock)
    vi.stubGlobal('matchMedia', vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })))
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('renders real vertical text and the desktop instruction', () => {
    const wrapper = mount(HeartSutraReveal, {
      props: { excerpt: '心無罣礙，無有恐怖' },
    })
    expect(wrapper.get('[data-testid="heart-sutra-text"]').text()).toBe('心無罣礙，無有恐怖')
    expect(wrapper.get('[data-testid="heart-sutra-hint"]').text()).toBe('以游標輕拂紙面')
    expect(wrapper.get('[data-testid="heart-sutra-paper"]').attributes('tabindex')).toBe('0')
  })

  it('shows touch copy when a coarse pointer is present', () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })))
    const wrapper = mount(HeartSutraReveal, {
      props: { excerpt: '色即是空，空即是色' },
    })
    expect(wrapper.get('[data-testid="heart-sutra-hint"]').text()).toBe('以指尖輕拂紙面')
  })

  it('hides all hints after the first pointer interaction', async () => {
    const wrapper = mount(HeartSutraReveal, {
      props: { excerpt: '色即是空，空即是色' },
    })
    await wrapper.get('[data-testid="heart-sutra-paper"]').trigger('pointerdown', {
      pointerId: 1,
      clientX: 10,
      clientY: 10,
    })
    expect(wrapper.find('[data-testid="heart-sutra-hint"]').exists()).toBe(false)
    vi.advanceTimersByTime(4_000)
    expect(wrapper.find('[data-testid="heart-sutra-hint"]').exists()).toBe(false)
  })

  it('replays the finger once after four seconds without interaction', async () => {
    const wrapper = mount(HeartSutraReveal, {
      props: { excerpt: '色即是空，空即是色' },
    })
    expect(wrapper.get('[data-testid="heart-sutra-finger"]').attributes('data-cycle')).toBe('0')
    await vi.advanceTimersByTimeAsync(4_000)
    expect(wrapper.get('[data-testid="heart-sutra-finger"]').attributes('data-cycle')).toBe('1')
    await vi.advanceTimersByTimeAsync(4_000)
    expect(wrapper.get('[data-testid="heart-sutra-finger"]').attributes('data-cycle')).toBe('1')
  })

  it.each(['Enter', ' '])('reveals the full excerpt with %s', async (key) => {
    const wrapper = mount(HeartSutraReveal, {
      props: { excerpt: '能除一切苦，真實不虛' },
    })
    await wrapper.get('[data-testid="heart-sutra-paper"]').trigger('keydown', { key })
    expect(wrapper.get('[data-testid="heart-sutra-paper"]').attributes('data-complete')).toBe('true')
    expect(wrapper.find('[data-testid="heart-sutra-fog"]').exists()).toBe(false)
  })

  it('replays normalized reveal samples when the paper resizes', async () => {
    const wrapper = mount(HeartSutraReveal, {
      props: { excerpt: '色不異空，空不異色' },
    })
    const paper = wrapper.get('[data-testid="heart-sutra-paper"]')
    vi.spyOn(paper.element, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      right: 200,
      bottom: 400,
      width: 200,
      height: 400,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    })
    await wrapper.vm.$nextTick()
    vi.mocked(context.arc).mockClear()

    await paper.trigger('pointerdown', {
      pointerId: 1,
      clientX: 50,
      clientY: 100,
    })
    const callsBeforeResize = vi.mocked(context.arc).mock.calls.length
    resizeCallback([], {} as ResizeObserver)

    expect(callsBeforeResize).toBeGreaterThan(0)
    expect(vi.mocked(context.arc).mock.calls.length).toBeGreaterThan(callsBeforeResize)
    expect(paper.attributes('data-complete')).toBe('false')
  })

  it('falls back to the full excerpt when canvas is unavailable', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
    const wrapper = mount(HeartSutraReveal, {
      props: { excerpt: '照見五蘊皆空，度一切苦厄' },
    })
    await wrapper.vm.$nextTick()
    expect(wrapper.get('[data-testid="heart-sutra-paper"]').attributes('data-complete')).toBe('true')
    expect(wrapper.get('[data-testid="heart-sutra-text"]').isVisible()).toBe(true)
  })

  it('emits close from the accessible close button', async () => {
    const wrapper = mount(HeartSutraReveal, {
      props: { excerpt: '心無罣礙，無有恐怖' },
    })
    expect(wrapper.get('[data-testid="close"]').attributes('aria-label')).toBe('關閉抄寫心經')
    await wrapper.get('[data-testid="close"]').trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run the component test and verify missing component failure**

Run: `npx vitest run tests/HeartSutraReveal.test.ts`

Expected: FAIL because `HeartSutraReveal.vue` does not exist.

- [ ] **Step 3: Implement the component state and pointer lifecycle**

Use this script structure in `HeartSutraReveal.vue`:

```vue
<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import {
  clearFogAt,
  FogRevealTracker,
  normalizePaperPoint,
  paintFog,
} from './heartSutraFog'

defineProps<{ excerpt: string }>()
const emit = defineEmits<{ close: [] }>()

const paper = ref<HTMLElement>()
const canvas = ref<HTMLCanvasElement>()
const interacted = ref(false)
const complete = ref(false)
const hintCycle = ref(0)
const draggingPointer = ref<number | null>(null)
const tracker = new FogRevealTracker()
const isTouch = window.matchMedia?.('(pointer: coarse)').matches
  || navigator.maxTouchPoints > 0
const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
const hintCopy = computed(() =>
  isTouch ? '以指尖輕拂紙面' : '以游標輕拂紙面',
)

let context: CanvasRenderingContext2D | null = null
let hintTimer = 0
let resizeObserver: ResizeObserver | null = null
let usesWindowResize = false

function completeReveal() {
  complete.value = true
  interacted.value = true
  window.clearTimeout(hintTimer)
}

function repaintFog() {
  const element = paper.value
  const layer = canvas.value
  if (!element || !layer || complete.value) return
  const rect = element.getBoundingClientRect()
  const scale = window.devicePixelRatio || 1
  layer.width = Math.max(1, Math.round(rect.width * scale))
  layer.height = Math.max(1, Math.round(rect.height * scale))
  layer.style.width = `${rect.width}px`
  layer.style.height = `${rect.height}px`
  context = layer.getContext('2d')
  if (!context) {
    completeReveal()
    return
  }
  paintFog(context, layer.width, layer.height)
  for (const point of tracker.samples) {
    clearFogAt(context, layer.width, layer.height, point)
  }
}

function revealAt(event: PointerEvent) {
  const element = paper.value
  if (!element || !context || complete.value) return
  const point = normalizePaperPoint(
    event.clientX,
    event.clientY,
    element.getBoundingClientRect(),
  )
  if (!point) return
  interacted.value = true
  window.clearTimeout(hintTimer)
  tracker.revealAt(point)
  clearFogAt(context, canvas.value!.width, canvas.value!.height, point)
  if (tracker.complete) completeReveal()
}

function handlePointerDown(event: PointerEvent) {
  interacted.value = true
  window.clearTimeout(hintTimer)
  draggingPointer.value = event.pointerId
  try {
    paper.value?.setPointerCapture(event.pointerId)
  } catch {
    // Synthetic and older-browser pointer events can continue without capture.
  }
  revealAt(event)
}

function handlePointerMove(event: PointerEvent) {
  if (draggingPointer.value === event.pointerId) revealAt(event)
}

function handlePointerEnd(event: PointerEvent) {
  if (draggingPointer.value === event.pointerId) draggingPointer.value = null
}

onMounted(async () => {
  hintTimer = window.setTimeout(() => {
    if (!interacted.value) hintCycle.value = 1
  }, 4_000)
  await nextTick()
  paper.value?.focus()
  if ('ResizeObserver' in window) {
    resizeObserver = new ResizeObserver(repaintFog)
    if (paper.value) resizeObserver.observe(paper.value)
  } else {
    usesWindowResize = true
    window.addEventListener('resize', repaintFog)
  }
  repaintFog()
})

onBeforeUnmount(() => {
  window.clearTimeout(hintTimer)
  resizeObserver?.disconnect()
  if (usesWindowResize) window.removeEventListener('resize', repaintFog)
})
</script>
```

- [ ] **Step 4: Add the accessible template**

```vue
<template>
  <section
    class="sutra-overlay"
    data-testid="heart-sutra-overlay"
    role="dialog"
    aria-modal="true"
    aria-label="抄寫心經"
  >
    <button
      class="close"
      data-testid="close"
      aria-label="關閉抄寫心經"
      @click="emit('close')"
    >✕</button>
    <article
      ref="paper"
      class="paper"
      data-testid="heart-sutra-paper"
      :data-complete="String(complete)"
      tabindex="0"
      aria-label="心經短句；按 Enter 或空白鍵可完整顯示"
      @keydown.enter.prevent="completeReveal"
      @keydown.space.prevent="completeReveal"
      @pointerdown.prevent="handlePointerDown"
      @pointermove.prevent="handlePointerMove"
      @pointerup="handlePointerEnd"
      @pointercancel="handlePointerEnd"
    >
      <blockquote data-testid="heart-sutra-text">{{ excerpt }}</blockquote>
      <Transition name="fog">
        <canvas
          v-if="!complete"
          ref="canvas"
          class="fog"
          data-testid="heart-sutra-fog"
          aria-hidden="true"
        />
      </Transition>
      <div
        v-if="!interacted"
        class="hint"
        data-testid="heart-sutra-hint"
      >
        <span>{{ hintCopy }}</span>
        <span
          v-if="!reducedMotion"
          :key="hintCycle"
          class="finger"
          data-testid="heart-sutra-finger"
          :data-cycle="hintCycle"
          aria-hidden="true"
        />
      </div>
    </article>
  </section>
</template>
```

- [ ] **Step 5: Add exact responsive and reduced-motion styles**

Use scoped styles with these concrete values:

```css
.sutra-overlay {
  position: fixed;
  inset: 0;
  z-index: 110;
  display: grid;
  place-items: center;
  padding: max(1rem, env(safe-area-inset-top))
    max(1rem, env(safe-area-inset-right))
    max(1rem, env(safe-area-inset-bottom))
    max(1rem, env(safe-area-inset-left));
  background: rgb(16 13 10 / 58%);
}

.close {
  position: fixed;
  top: max(1rem, env(safe-area-inset-top));
  right: max(1rem, env(safe-area-inset-right));
  z-index: 3;
  min-width: 44px;
  min-height: 44px;
}

.paper {
  position: relative;
  width: min(78vw, 34rem);
  height: min(78vh, 44rem);
  min-height: 24rem;
  overflow: hidden;
  touch-action: none;
  background:
    radial-gradient(circle at 28% 22%, rgb(255 255 255 / 34%), transparent 30%),
    repeating-linear-gradient(88deg, rgb(94 76 54 / 4%) 0 1px, transparent 1px 8px),
    #eee5d2;
  box-shadow: 0 1.4rem 4rem rgb(0 0 0 / 36%);
}

blockquote {
  position: absolute;
  inset: 9% 10%;
  display: block;
  margin: 0;
  color: #342f28;
  font-family: "LXGW WenKai TC", "Noto Serif TC", serif;
  font-size: clamp(1.55rem, 5vw, 2.6rem);
  line-height: 1.8;
  letter-spacing: 0.12em;
  writing-mode: vertical-rl;
}

.fog {
  position: absolute;
  inset: 0;
  z-index: 1;
}

.fog-leave-active { transition: opacity 320ms ease-out; }
.fog-leave-to { opacity: 0; }

.hint {
  position: absolute;
  inset: auto 0 8%;
  z-index: 2;
  display: grid;
  justify-items: center;
  gap: 0.75rem;
  color: #514b42;
  font-family: "LXGW WenKai TC", "Noto Serif TC", serif;
  letter-spacing: 0.12em;
  pointer-events: none;
}

.finger {
  width: 1.9rem;
  height: 1.9rem;
  border: 1px solid rgb(67 60 51 / 48%);
  border-radius: 999px;
  background: rgb(255 250 239 / 58%);
  animation: finger-sweep 1.8s ease-in-out 1;
}

@keyframes finger-sweep {
  0%, 100% { opacity: 0; transform: translateX(-2.5rem); }
  25%, 75% { opacity: 0.72; }
  75% { transform: translateX(2.5rem); }
}

@media (max-width: 600px) {
  .paper {
    width: min(88vw, 30rem);
    height: min(78dvh, 42rem);
    min-height: 20rem;
  }
}

@media (max-height: 520px) and (orientation: landscape) {
  .paper {
    width: min(68vw, 32rem);
    height: 84dvh;
    min-height: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .finger { display: none; }
  .fog-leave-active { transition-duration: 80ms; }
}
```

- [ ] **Step 6: Run the component and reveal-model tests**

Run: `npx vitest run tests/HeartSutraReveal.test.ts tests/heartSutraFog.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit the overlay**

```bash
git add src/ui/HeartSutraReveal.vue src/ui/heartSutraFog.ts tests/HeartSutraReveal.test.ts tests/heartSutraFog.test.ts
git commit -m "feat: add accessible heart sutra reveal"
```

---

### Task 6: App and Event-Bridge Integration

**Files:**

- Modify: `src/App.vue`
- Modify: `tests/App.test.ts`

**Interfaces:**

- Consumes: generic bridge payload `{ id: 'sutra-1', type: 'sutra' }`, `getSessionHeartSutraExcerpt()`, and `HeartSutraReveal` prop `excerpt`.
- Produces: overlay open/close behavior using existing `ui:opened` and `ui:closed` events.

- [ ] **Step 1: Add failing App integration tests**

In `beforeEach`, add:

```ts
sessionStorage.clear()
```

Add:

```ts
it('opens the session-stable heart sutra overlay and releases the scene on close', async () => {
  mocks.loadContent.mockResolvedValue(content)
  sessionStorage.setItem('bookstore:heart-sutra-excerpt', '心無罣礙，無有恐怖')
  const opened = vi.fn()
  const closed = vi.fn()
  const offOpened = bridge.on('ui:opened', opened)
  const offClosed = bridge.on('ui:closed', closed)
  const wrapper = await mountApp()

  bridge.emit('interact', { id: 'sutra-1', type: 'sutra' })
  await flushPromises()

  const overlay = wrapper.get('[data-testid="heart-sutra-overlay"]')
  expect(overlay.get('[data-testid="heart-sutra-text"]').text()).toBe('心無罣礙，無有恐怖')
  expect(opened).toHaveBeenCalledOnce()

  await overlay.get('[data-testid="close"]').trigger('click')
  expect(wrapper.find('[data-testid="heart-sutra-overlay"]').exists()).toBe(false)
  expect(closed).toHaveBeenCalledOnce()

  bridge.emit('interact', { id: 'sutra-1', type: 'sutra' })
  await flushPromises()
  expect(wrapper.get('[data-testid="heart-sutra-text"]').text()).toBe('心無罣礙，無有恐怖')

  offOpened()
  offClosed()
})

it('closes the heart sutra overlay with Escape', async () => {
  mocks.loadContent.mockResolvedValue(content)
  const wrapper = await mountApp()
  bridge.emit('interact', { id: 'sutra-1', type: 'sutra' })
  await flushPromises()
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
  await flushPromises()
  expect(wrapper.find('[data-testid="heart-sutra-overlay"]').exists()).toBe(false)
})
```

Extend the existing `createGame` label and zone assertions with:

```ts
'sutra-1': '抄寫心經',
```

and:

```ts
expect.objectContaining({ id: 'sutra-1', type: 'sutra' }),
```

- [ ] **Step 2: Run the App test and verify failure**

Run: `npx vitest run tests/App.test.ts`

Expected: FAIL because App does not route `sutra` interactions.

- [ ] **Step 3: Add App state and event routing**

Add imports:

```ts
import { getSessionHeartSutraExcerpt } from './content/heartSutra'
import type { HeartSutraExcerpt } from './content/heartSutra'
import HeartSutraReveal from './ui/HeartSutraReveal.vue'
```

Add state:

```ts
const showHeartSutra = ref(false)
const heartSutraExcerpt = ref<HeartSutraExcerpt | null>(null)
```

Include `showHeartSutra.value` in `uiOpen`.

Add to `openInteraction`:

```ts
} else if (type === 'sutra') {
  heartSutraExcerpt.value ??= getSessionHeartSutraExcerpt()
  showHeartSutra.value = true
}
```

Add to `closeAll`:

```ts
showHeartSutra.value = false
```

Do not clear `heartSutraExcerpt` in `closeAll`; this keeps the component input stable while reopening. The fog tracker lives inside the conditionally mounted component, so it starts clean each time.

- [ ] **Step 4: Mount the overlay**

Add after the other overlays:

```vue
<HeartSutraReveal
  v-if="showHeartSutra && heartSutraExcerpt"
  :excerpt="heartSutraExcerpt"
  @close="closeAll"
/>
```

- [ ] **Step 5: Run App, bridge, and scene tests**

Run: `npx vitest run tests/App.test.ts tests/EventBridge.test.ts tests/StoreScene.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit the integration**

```bash
git add src/App.vue tests/App.test.ts
git commit -m "feat: connect heart sutra interaction"
```

---

### Task 7: Browser Acceptance, Documentation, and Full Verification

**Files:**

- Modify: `e2e/basic.spec.ts`
- Modify: `README.md`

**Interfaces:**

- Consumes: development-only `window.__bridge`, stable heart-sutra test IDs, keyboard movement, and session key `bookstore:heart-sutra-excerpt`.
- Produces: desktop and mobile acceptance coverage plus updated visitor instructions.

- [ ] **Step 1: Add a desktop E2E for a stable excerpt and keyboard reveal**

```ts
test('抄寫心經在同一分頁保持經文並支援鍵盤揭示', async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem(
      'bookstore:heart-sutra-excerpt',
      '心無罣礙，無有恐怖',
    )
  })
  await page.goto('/')
  await expect(page.locator('canvas')).toBeVisible({ timeout: 10_000 })

  await page.evaluate(() => {
    window.__bridge.emit('interact', { id: 'sutra-1', type: 'sutra' })
  })

  const overlay = page.getByTestId('heart-sutra-overlay')
  const paper = page.getByTestId('heart-sutra-paper')
  await expect(overlay).toBeVisible()
  await expect(page.getByTestId('heart-sutra-text')).toHaveText('心無罣礙，無有恐怖')
  await expect(page.getByTestId('heart-sutra-hint')).toHaveText('以游標輕拂紙面')

  await paper.focus()
  await page.keyboard.press('Enter')
  await expect(paper).toHaveAttribute('data-complete', 'true')

  await page.getByTestId('close').click()
  await page.evaluate(() => {
    window.__bridge.emit('interact', { id: 'sutra-1', type: 'sutra' })
  })
  await expect(page.getByTestId('heart-sutra-text')).toHaveText('心無罣礙，無有恐怖')
  await expect(page.getByTestId('heart-sutra-paper')).toHaveAttribute('data-complete', 'false')
})
```

- [ ] **Step 2: Add a mobile E2E for touch copy, gesture completion, and rotation**

```ts
test('手機以指尖拂霧並在旋轉後保留完成狀態', async ({ page, isMobile }) => {
  test.skip(!isMobile, '只在 mobile project 執行')
  await page.goto('/')
  await expect(page.locator('canvas')).toBeVisible({ timeout: 10_000 })
  await page.evaluate(() => {
    window.__bridge.emit('interact', { id: 'sutra-1', type: 'sutra' })
  })

  const paper = page.getByTestId('heart-sutra-paper')
  await expect(page.getByTestId('heart-sutra-hint')).toHaveText('以指尖輕拂紙面')
  const box = await paper.boundingBox()
  if (!box) throw new Error('Heart sutra paper has no layout box')

  let pointerStarted = false
  for (let row = 1; row <= 9; row += 1) {
    const columns = row % 2 === 0
      ? [9, 8, 7, 6, 5, 4, 3, 2, 1]
      : [1, 2, 3, 4, 5, 6, 7, 8, 9]
    for (const column of columns) {
      const event = {
        pointerId: 1,
        pointerType: 'touch',
        clientX: box.x + box.width * column / 10,
        clientY: box.y + box.height * row / 10,
      }
      await paper.dispatchEvent(
        pointerStarted ? 'pointermove' : 'pointerdown',
        event,
      )
      pointerStarted = true
    }
  }
  await paper.dispatchEvent('pointerup', {
    pointerId: 1,
    pointerType: 'touch',
  })

  await expect(paper).toHaveAttribute('data-complete', 'true')
  await expect(page.getByTestId('heart-sutra-hint')).toHaveCount(0)

  await page.setViewportSize({ width: 844, height: 390 })
  await expect(paper).toHaveAttribute('data-complete', 'true')
  await expect(page.getByTestId('close')).toBeInViewport()
})
```

- [ ] **Step 3: Add a real-walking E2E for zone reachability**

Place this after the existing `moveFor` and `walkUntilZone` helpers:

```ts
test('從入口實際步行到中央長桌左端的抄寫心經', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard reachability is desktop acceptance coverage')
  test.setTimeout(25_000)
  await page.goto('/')
  await expect(page.locator('canvas')).toBeVisible({ timeout: 10_000 })
  await page.waitForTimeout(1_200)
  await page.evaluate(() => {
    window.__activeZoneId = undefined
    window.__bridge.on('zone:enter', ({ id }) => {
      window.__activeZoneId = id
    })
    window.__bridge.on('zone:exit', ({ id }) => {
      if (window.__activeZoneId === id) window.__activeZoneId = undefined
    })
  })

  await moveFor(page, 'ArrowLeft', 5_400)
  await walkUntilZone(page, 'ArrowDown', 'sutra-1')
  await page.keyboard.press('Space')

  await expect(page.getByTestId('heart-sutra-overlay')).toBeVisible()
  await expect(page.getByTestId('heart-sutra-text')).not.toBeEmpty()
  await page.getByTestId('close').click()
  await expect(page.getByTestId('heart-sutra-overlay')).not.toBeVisible()
})
```

If this exact deterministic route contacts a calibrated collision edge, change only the `5_400` millisecond horizontal duration until the player enters the approved left-side approach zone. Do not move the zone into the table collision and do not remove the real-walking assertion.

- [ ] **Step 4: Update visitor-facing README text**

In the operation section, add:

```md
- 中央長桌左端是「抄寫心經」：靠近後可用指尖或游標拂去薄霧，顯現一段心經短句。
```

In scene acceptance, change the generic interaction-count wording so it names the important points instead of preserving an obsolete number:

```md
部署前需在桌機、iOS Safari 與 Android Chrome 確認：所有已設定互動點可到達，
包含展示櫃、店長選書、營業資訊、小村碎碎念、拾字成詩與抄寫心經；
家具與 NPC 不可穿越，玩家四方向動畫正確，左右觸控可同時操作，
直橫旋轉不重置玩家或破壞版面。
```

- [ ] **Step 5: Run the complete unit suite**

Run: `npm test`

Expected: PASS with no skipped Vitest suites and no unhandled canvas or timer errors.

- [ ] **Step 6: Run asset validation and production build**

Run: `npm run assets`

Expected: PASS and report the background, five player sheets, and `96×64` heart sutra tabletop asset.

Run: `npm run build`

Expected: PASS; Vite produces `dist` and content validation remains unchanged.

- [ ] **Step 7: Run desktop and mobile browser acceptance**

Run: `npm run e2e`

Expected: PASS in both Playwright projects. The desktop project passes real walking and keyboard reveal; the mobile project passes touch copy, gesture completion, rotation, and close-button viewport checks.

- [ ] **Step 8: Perform the visual acceptance pass**

At native scene scale and at a `390×844` mobile viewport, verify all of these:

- The paper and brush sit on the approved empty tabletop spot at `{ x: 485, y: 455 }`.
- The overlay asset matches nearby pixel density, top-down perspective, warm light, and muted palette.
- The activation marker reads `抄寫心經` and does not fight with the table art.
- The fog reads as soft translucent breath or mist, not silver scratch-card coating, eraser debris, or game smoke.
- The complete excerpt is one or two vertical columns with generous whitespace.
- Normal serpentine finger movement completes in `10–15` seconds.
- No sound, score, countdown, progress bar, celebration, promotion, address, hours, or reservation action appears.

- [ ] **Step 9: Commit acceptance coverage and documentation**

```bash
git add e2e/basic.spec.ts README.md
git commit -m "test: cover heart sutra reveal journey"
```

---

## Final Verification Checklist

- [ ] `git diff --check` returns no output.
- [ ] `npm test` passes.
- [ ] `npm run assets` passes.
- [ ] `npm run build` passes.
- [ ] `npm run e2e` passes for desktop and mobile.
- [ ] `git status --short` contains no unexpected files; preserve the pre-existing untracked `docs/superpowers/plans/2026-07-30-exhibit-image-loading.md` unless its owner handles it separately.
- [ ] Review every requirement in `docs/superpowers/specs/2026-07-30-heart-sutra-reveal-design.md` against Tasks 1–7 before declaring completion.
