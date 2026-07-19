# Task 18 Report — 白底灰字互動標記與 CMS 動態名稱

## Implementation summary

Implemented seven persistent Phaser interaction markers with white bubbles, gray borders/text, shadows, active glow/label expansion, and active-only pointer handling. CMS showcase and shelf titles now create the marker-label map, with fixed `營業資訊`; labels are Unicode-aware, two lines maximum, and truncate after 19 characters plus an ellipsis. `interact:request`, keyboard E, and active marker clicks all use the existing guarded `triggerInteract` path.

Files changed:

- `src/game/interactionLabels.ts` (new)
- `src/game/InteractionMarker.ts` (new)
- `src/game/StoreScene.ts`
- `src/game/createGame.ts`
- `src/bridge/EventBridge.ts`
- `src/App.vue`
- `tests/interactionLabels.test.ts` (new)
- `tests/EventBridge.test.ts`
- `tests/App.test.ts`

## TDD evidence

### RED

After adding the three required test changes first, ran:

```bash
npx vitest run tests/interactionLabels.test.ts tests/EventBridge.test.ts tests/App.test.ts
```

Result: exit 1. `tests/interactionLabels.test.ts` failed to resolve `../src/game/interactionLabels` because the helper did not yet exist; `tests/App.test.ts` failed because `createGame` had been called with only its parent element rather than the required labels argument. The bridge test passed because the generic payload-free bridge mechanism already supported the event shape. This was the expected RED for the absent production label module and CMS injection.

### GREEN

After adding the minimal production implementation, reran the same command:

```bash
npx vitest run tests/interactionLabels.test.ts tests/EventBridge.test.ts tests/App.test.ts
```

Result: exit 0 — 3 test files passed, 11/11 tests passed.

## Verification

```bash
npm run test
```

Exit 0 — 18 test files passed, 73/73 tests passed.

```bash
npx vue-tsc --noEmit --pretty false
```

Exit 0 — no type errors.

```bash
git diff --check
```

Exit 0 — no whitespace errors. The scoped diff review contained only the Task 18 implementation, tests, and this report.

```bash
npm run e2e
```

The first sandboxed attempt could not bind Vite to `::1:5173` (`listen EPERM`). The approved localhost rerun exited 0 — 6/6 Playwright desktop/mobile integration tests passed, covering canvas startup and showcase, shelf, and info overlays.

## Browser evidence

The mandatory Interceptor real-browser tool was unavailable: `interceptor status` returned `zsh: command not found: interceptor`. Therefore no manual real-browser pointer-walk evidence is claimed.

Using the approved local Playwright browser instead, a 1572×1001 screenshot showed all seven inactive `!` markers simultaneously at the five showcase anchors, shelf anchor, and information anchor. They rendered as persistent white circles with a thin gray outline, dark-gray exclamation marks, and shadows. The existing Playwright suite also confirmed the canvas and interaction overlays on desktop and mobile. Active-label expansion, inactive click rejection, and direct marker clicks were not manually driven because the required Interceptor extension was unavailable.

## Self-review

- The label map covers all five CMS showcases, CMS shelves, and `info-1`; supplied incomplete maps throw the exact `互動點 ${zone.id} 缺少顯示名稱` error.
- `Array.from` makes formatting Unicode-aware: up to ten characters on one line, eleven to twenty across two lines, and over twenty as ten plus nine plus `…`.
- Every marker is constructed once per scene create, remains visible while inactive, and only the nearest zone marker receives `setActive(true)`.
- Pointer callbacks additionally check both marker activity and that the marker is still the current zone; bridge and E route through the existing guarded `triggerInteract` method.
- Restart/destroy cleanup unsubscribes bridge/keyboard/resize listeners, destroys every marker, and clears the map. Existing collision, camera, visitor-animation, and overlay-freeze logic is preserved.

Concern: manual browser checks requested by the brief are partially blocked by the absent Interceptor CLI; automated Playwright coverage and visual screenshot evidence are recorded above.
