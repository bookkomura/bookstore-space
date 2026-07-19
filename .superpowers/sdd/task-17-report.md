# Task 17 Report — 四方向玩家待機與走路動畫

## Implementation summary

Implemented four-direction player idle/walk animation selection using the approved 4×4 player-sheet mapping. Added pure animation helpers, their focused unit test, and `StoreScene` integration. The scene registers the four stable animation keys idempotently, preserves the previous direction at rest, switches to the mapped idle frame when stationary or a UI overlay is open, and plays the appropriate directional walk animation while moving.

Files changed:

- `src/game/playerAnimation.ts` (new)
- `src/game/StoreScene.ts`
- `tests/playerAnimation.test.ts` (new)

## TDD evidence

1. RED — after writing `tests/playerAnimation.test.ts` first:

   ```bash
   npx vitest run tests/playerAnimation.test.ts
   ```

   Result: exit 1; one failed suite and zero collected tests. Vite reported `Failed to resolve import "../src/game/playerAnimation" ... Does the file exist?`, which is the expected missing-module failure.

2. GREEN — after adding the minimal `src/game/playerAnimation.ts` helper:

   ```bash
   npx vitest run tests/playerAnimation.test.ts
   ```

   Result: exit 0; `tests/playerAnimation.test.ts` passed with 3/3 tests.

The test covers dominant-axis direction selection, stationary-facing retention, all four idle-row starts, and the walk-key contract.

## Verification

```bash
npx vitest run tests/playerAnimation.test.ts
```

Exit 0 — 1 test file passed, 3/3 tests passed.

```bash
npm run test
```

Exit 0 — 16 test files passed, 66/66 tests passed.

```bash
npx vue-tsc --noEmit --pretty false
```

Exit 0 — no type errors.

```bash
git diff --check
```

Exit 0 — no whitespace errors. The subsequent scoped diff review showed only the intended `StoreScene` integration plus the two new Task 17 files.

## Browser visual validation

Blocked by the direct visual automation environment: the mandatory Interceptor visual-check tool is not installed or available in PATH. `interceptor status` returned `zsh: command not found: interceptor`; therefore I could not truthfully inspect the canvas while pressing right, left, up, down, releasing keys, and opening an overlay. No browser evidence is claimed.

## Self-review

- Frame mapping is exact: down 0–3, left 4–7, right 8–11, up 12–15; walking uses frames 1/2/3/2 within each row and idle uses each row's first frame.
- Diagonal ties intentionally select the vertical axis (`Math.abs(vx) > Math.abs(vy)`), consistent with the supplied contract.
- `this.anims.exists(key)` makes per-scene animation registration idempotent and safe across scene restarts.
- Each movement update drives animation from the same computed velocity sent to the physics body. Overlay updates zero velocity and explicitly stop/set idle, preventing sliding and preserving facing.
- Scale, collision body/offset, camera, interaction zones, and content behavior were not changed.

Concern: visual confirmation remains unavailable solely because the required Interceptor CLI was absent.

## Review-fix addendum

### Changes made

- Updated the `ui:opened` bridge listener in `src/game/StoreScene.ts` to synchronously call `this.player.setVelocity(0, 0)` and `this.updatePlayerAnimation(0, 0)`. The existing `update()` guard remains as the defensive steady-state check.
- Added the missing pure animation contracts to `tests/playerAnimation.test.ts`: equal non-zero diagonal magnitudes use the vertical direction, and every direction has the exact four-frame walk sequence.
- Added `tests/StoreScene.test.ts`, a focused Phaser-scene mock regression that creates a moving right-facing visitor, emits `ui:opened`, and verifies immediate `(0, 0)` velocity, animation stop, and stable right idle frame `8`.

### RED → GREEN evidence

RED command:

```bash
npx vitest run tests/playerAnimation.test.ts tests/StoreScene.test.ts
```

RED result: exit 1; `tests/playerAnimation.test.ts` passed (5 tests), while `tests/StoreScene.test.ts` failed (1 test). The expected assertion failure was `expected "spy" to be called with arguments: [ +0, +0 ]` with `Number of calls: 0` after `bridge.emit('ui:opened')`. This proves the prior bridge handler did not synchronously reset player velocity. The pure additions passed immediately because their implementation already met the specified contracts.

GREEN command:

```bash
npx vitest run tests/playerAnimation.test.ts tests/StoreScene.test.ts
```

GREEN result: exit 0; 2 test files passed and 6/6 tests passed.

### Covering tests and final verification

Covering test files:

- `tests/playerAnimation.test.ts`
- `tests/StoreScene.test.ts`

```bash
npx vitest run tests/playerAnimation.test.ts tests/StoreScene.test.ts
```

Exit 0 — 2 test files passed, 6/6 tests passed.

```bash
npm run test
```

Exit 0 — 17 test files passed, 69/69 tests passed.

```bash
npx vue-tsc --noEmit --pretty false
```

Exit 0 — no type errors.

```bash
git diff --check
```

Exit 0 — no whitespace errors.

### Self-review and concerns

- The synchronous handler uses the same existing idle-selection method as the frame update path, so it preserves the active facing while stopping both movement and walking animation before the next scene update.
- The scene regression exercises the actual bridge subscription established by `create()`; it does not expose or add test-only production APIs.
- No concerns remain for the review findings. Browser visual validation remains unavailable as previously documented because the required Interceptor CLI is absent.
