import { readFileSync } from 'node:fs'
import { PNG } from 'pngjs'
import { describe, expect, it } from 'vitest'

function readPng(path: string): PNG {
  return PNG.sync.read(readFileSync(path))
}

function opaqueBounds(png: PNG, originX: number, originY: number) {
  let left = 256
  let right = -1
  let bottom = -1

  for (let y = 0; y < 256; y += 1) {
    for (let x = 0; x < 256; x += 1) {
      const alpha = png.data[((originY + y) * png.width + originX + x) * 4 + 3]
      if (alpha === 0) continue

      left = Math.min(left, x)
      right = Math.max(right, x)
      bottom = Math.max(bottom, y)
    }
  }

  return { left, right, bottom }
}

describe('scene artwork', () => {
  it('keeps the approved background dimensions', () => {
    const background = readPng('src/assets/store-background.png')
    expect({ width: background.width, height: background.height }).toEqual({
      width: 1572,
      height: 1001,
    })
  })

  it('uses a transparent 4×4 1024px player sprite sheet', () => {
    const player = readPng('src/assets/player-visitor.png')
    expect({ width: player.width, height: player.height }).toEqual({
      width: 1024,
      height: 1024,
    })

    const cornerAlpha = [
      player.data[3],
      player.data[(player.width - 1) * 4 + 3],
      player.data[((player.height - 1) * player.width) * 4 + 3],
      player.data[(player.width * player.height - 1) * 4 + 3],
    ]
    expect(cornerAlpha).toEqual([0, 0, 0, 0])
  })

  it('keeps every player frame centered on a common foot baseline', () => {
    const player = readPng('src/assets/player-visitor.png')

    for (let row = 0; row < 4; row += 1) {
      for (let column = 0; column < 4; column += 1) {
        const bounds = opaqueBounds(player, column * 256, row * 256)
        expect(bounds.bottom).toBe(232)
        expect(bounds.right).toBeGreaterThanOrEqual(bounds.left)
        expect([127.5, 128]).toContain((bounds.left + bounds.right) / 2)
      }
    }
  })
})
