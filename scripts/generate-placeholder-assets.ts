import { PNG } from 'pngjs'
import { mkdirSync, writeFileSync } from 'node:fs'

function fillRect(png: PNG, x0: number, y0: number, w: number, h: number, [r, g, b]: number[]) {
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      const i = (png.width * y + x) << 2
      png.data[i] = r; png.data[i + 1] = g; png.data[i + 2] = b; png.data[i + 3] = 255
    }
  }
}

mkdirSync('public/assets', { recursive: true })

// tileset.png：tile 1 = 地板(淺米), tile 2 = 牆(深棕)
const tileset = new PNG({ width: 64, height: 32 })
fillRect(tileset, 0, 0, 32, 32, [216, 201, 163])
fillRect(tileset, 32, 0, 32, 32, [107, 79, 42])
writeFileSync('public/assets/tileset.png', PNG.sync.write(tileset))

// player.png：紅色方塊＋深色邊框
const player = new PNG({ width: 32, height: 32 })
fillRect(player, 0, 0, 32, 32, [90, 40, 40])
fillRect(player, 2, 2, 28, 28, [224, 85, 85])
writeFileSync('public/assets/player.png', PNG.sync.write(player))

console.log('✓ 佔位素材已產生：public/assets/{tileset,player}.png')
