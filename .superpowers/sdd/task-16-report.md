# Task 16 Report — 圖片背景、透明碰撞與響應式鏡頭

## Implementation summary

- Replaced the placeholder tilemap boot and store scene with the approved bookstore background and player sprite sheet.
- Added collision bodies for every authoritative `COLLISION_RECTS` layout rectangle, player collision bounds, and layout-driven spawn/interaction zones.
- Added responsive cover-zoom calculation with desktop minimum zoom and touch viewport minimum zoom; resize updates camera zoom without recreating scene/player state.
- Changed build asset validation to use the approved scene assets and removed tilemap/placeholder generation and parsing.

## Files changed

- Modified: `package.json`
- Modified: `src/game/BootScene.ts`
- Modified: `src/game/StoreScene.ts`
- Modified: `src/game/createGame.ts`
- Added: `src/game/camera.ts`
- Added: `tests/camera.test.ts`
- Deleted: `scripts/generate-placeholder-assets.ts`
- Deleted: `scripts/generate-map.ts`
- Deleted: `src/game/mapParser.ts`
- Deleted: `tests/mapParser.test.ts`

## TDD evidence

### RED

Command:

```bash
npx vitest run tests/camera.test.ts
```

Result: exit 1. The test suite failed before test collection with the expected missing-module error:

```text
Error: Failed to resolve import "../src/game/camera" from "tests/camera.test.ts". Does the file exist?
```

This failed as expected because `src/game/camera.ts` had not yet been created.

### GREEN

After adding the minimal `calculateCameraZoom` implementation, command:

```bash
npx vitest run tests/camera.test.ts
```

Result: exit 0 — 1 test file passed, 4 tests passed.

## Verification

| Command | Result |
| --- | --- |
| `npx vitest run tests/camera.test.ts tests/sceneLayout.test.ts tests/zones.test.ts` | Exit 0 — 3 files passed, 12 tests passed. |
| `rg "generate-map\|generate-placeholder-assets\|mapParser\|tilemapTiledJSON\|tileset" src scripts tests package.json` | Exit 1 with no output (the required no-match gate). |
| `npm run build` | Exit 0. Asset validation confirmed background `1572×1001` and 4×4 player sprite sheet; content validation passed; Vite built successfully. Vite emitted only its existing chunk-size advisory. |
| `npm run test` | Exit 0 — 15 files passed, 63 tests passed. |
| `npx vue-tsc --noEmit --pretty false` | Exit 0 with no diagnostics. |
| `npx playwright test` | Exit 0 with elevated local-port permission — 6 tests passed across desktop and mobile projects. |
| `git diff --check` | Exit 0 with no whitespace errors. |

`npm run build` first failed in the sandbox because `tsx` could not create its IPC socket (`listen EPERM`); the same command passed once local IPC permission was granted. The first Playwright attempt similarly could not bind Vite to `::1:5173` in the sandbox; it passed with local-port permission.

## Browser smoke

Playwright completed the existing canvas and interaction smoke suite on both desktop and mobile projects: 6 passed. The dedicated visual browser tools were unavailable: `agent-browser` could not write `/Users/pai/.agent-browser`, and the `interceptor` executable is not installed. Therefore no direct screenshot/manual confirmation of the specified visual and movement details was captured; automated browser evidence confirms both viewport projects load the canvas and interaction panels.

## Self-review

- The approved background and 256×256 sprite frames are loaded by URL imports, with a user-visible load-error fallback.
- World bounds, collision rectangles, spawn, and interaction zones all consume the authoritative layout constants.
- The player body uses the specified opaque-footprint size/offset and collides with static invisible obstacle rectangles.
- Camera follow/bounds and responsive zoom are initialized once; resize adjusts zoom only, preserving player and scene state.
- Scene shutdown/destroy removes bridge, scale, and keyboard listeners and clears touch movement state.
- No Task 17 directional animation or Task 18 formal markers were added.
- The required obsolete-reference gate produced no matches.

## Concerns

- No implementation or plan/runtime mismatch found.
- Direct visual inspection was blocked by unavailable browser automation tooling; the Playwright desktop/mobile smoke passed.
