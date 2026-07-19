import { readFileSync } from 'node:fs'
import { PNG } from 'pngjs'

function readPng(path: string): PNG {
  try {
    return PNG.sync.read(readFileSync(path))
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`${path} 無法讀取：${message}`)
  }
}

function assertSize(path: string, width: number, height: number): PNG {
  const png = readPng(path)
  if (png.width !== width || png.height !== height) {
    throw new Error(
      `${path} 尺寸必須是 ${width}×${height}，實際為 ${png.width}×${png.height}`,
    )
  }
  return png
}

function assertFrameRegistration(player: PNG): void {
  for (let row = 0; row < 4; row += 1) {
    for (let column = 0; column < 4; column += 1) {
      let left = 256
      let right = -1
      let bottom = -1

      for (let y = 0; y < 256; y += 1) {
        for (let x = 0; x < 256; x += 1) {
          const alpha = player.data[
            ((row * 256 + y) * player.width + column * 256 + x) * 4 + 3
          ]
          if (alpha === 0) continue

          left = Math.min(left, x)
          right = Math.max(right, x)
          bottom = Math.max(bottom, y)
        }
      }

      const frame = `第 ${row + 1} 列、第 ${column + 1} 欄`
      if (bottom === -1) {
        throw new Error(`src/assets/player-visitor.png ${frame} 不可為空白`)
      }
      if (bottom !== 232) {
        throw new Error(
          `src/assets/player-visitor.png ${frame} 腳底基準必須為 y=232，實際為 y=${bottom}`,
        )
      }

      const center = (left + right) / 2
      if (center !== 127.5 && center !== 128) {
        throw new Error(
          `src/assets/player-visitor.png ${frame} 水平中心必須為 x=127.5 或 x=128，實際為 x=${center}`,
        )
      }
    }
  }
}

const background = assertSize('src/assets/store-background.png', 1572, 1001)
const player = assertSize('src/assets/player-visitor.png', 1024, 1024)

const corners = [
  player.data[3],
  player.data[(player.width - 1) * 4 + 3],
  player.data[((player.height - 1) * player.width) * 4 + 3],
  player.data[(player.width * player.height - 1) * 4 + 3],
]
if (corners.some((alpha) => alpha !== 0)) {
  throw new Error('src/assets/player-visitor.png 四個外角必須完全透明')
}

assertFrameRegistration(player)

console.log(
  `✓ 場景素材通過：背景 ${background.width}×${background.height}，玩家 4×4 sprite sheet`,
)
