import Phaser from 'phaser'

export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot')
  }

  preload() {
    const { width, height } = this.scale
    const barBg = this.add.rectangle(width / 2, height / 2, 204, 16, 0x444444)
    const bar = this.add.rectangle(width / 2 - 100, height / 2, 0, 12, 0xd8c9a3).setOrigin(0, 0.5)
    this.load.on('progress', (v: number) => {
      bar.width = 200 * v
    })
    this.load.on('complete', () => {
      bar.destroy()
      barBg.destroy()
    })

    this.load.image('tiles', '/assets/tileset.png')
    this.load.image('player', '/assets/player.png')
    this.load.tilemapTiledJSON('map', '/assets/map.json')
  }

  create() {
    this.scene.start('store')
  }
}
