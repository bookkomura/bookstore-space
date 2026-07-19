import { writeFileSync, mkdirSync } from 'node:fs'

const W = 20, H = 15, TILE = 32
const FLOOR = 1, WALL = 2

const ground = Array(W * H).fill(FLOOR)
const walls = Array.from({ length: W * H }, (_, i) => {
  const x = i % W, y = Math.floor(i / W)
  return x === 0 || y === 0 || x === W - 1 || y === H - 1 ? WALL : 0
})

const prop = (value: string) => [{ name: 'type', type: 'string', value }]

const map = {
  type: 'map', version: '1.10', orientation: 'orthogonal', renderorder: 'right-down',
  width: W, height: H, tilewidth: TILE, tileheight: TILE, infinite: false,
  tilesets: [{
    firstgid: 1, name: 'tileset', image: 'tileset.png',
    imagewidth: 64, imageheight: 32, tilewidth: TILE, tileheight: TILE,
    tilecount: 2, columns: 2, margin: 0, spacing: 0,
  }],
  layers: [
    { type: 'tilelayer', name: 'ground', width: W, height: H, x: 0, y: 0, opacity: 1, visible: true, data: ground },
    { type: 'tilelayer', name: 'walls', width: W, height: H, x: 0, y: 0, opacity: 1, visible: true, data: walls },
    {
      type: 'objectgroup', name: 'interactions', x: 0, y: 0, opacity: 1, visible: true,
      objects: [
        { id: 1, name: 'showcase-1', x: 96, y: 96, width: 64, height: 64, rotation: 0, visible: true, properties: prop('showcase') },
        { id: 2, name: 'showcase-2', x: 480, y: 96, width: 64, height: 64, rotation: 0, visible: true, properties: prop('showcase') },
        { id: 3, name: 'shelf-1', x: 96, y: 320, width: 64, height: 64, rotation: 0, visible: true, properties: prop('shelf') },
        { id: 4, name: 'info-1', x: 480, y: 320, width: 64, height: 64, rotation: 0, visible: true, properties: prop('info') },
      ],
    },
  ],
}

mkdirSync('public/assets', { recursive: true })
writeFileSync('public/assets/map.json', JSON.stringify(map, null, 2))
console.log('✓ 地圖已產生：public/assets/map.json')
