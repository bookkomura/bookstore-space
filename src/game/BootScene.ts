import Phaser from 'phaser'
import { PLAYER_APPEARANCES, PLAYER_FRAME_SIZE } from './playerAppearance'

const backgroundUrl = new URL('../assets/store-background.png', import.meta.url).href

export class BootScene extends Phaser.Scene {
  private assetFailed = false

  constructor() {
    super('boot')
  }

  preload() {
    const { width, height } = this.scale
    const barBg = this.add.rectangle(width / 2, height / 2, 204, 16, 0x444444)
    const bar = this.add
      .rectangle(width / 2 - 100, height / 2, 0, 12, 0xd8c9a3)
      .setOrigin(0, 0.5)

    this.load.on('progress', (value: number) => {
      bar.width = 200 * value
    })
    this.load.once('loaderror', () => {
      this.assetFailed = true
    })
    this.load.once('complete', () => {
      bar.destroy()
      barBg.destroy()
    })

    this.load.image('store-background', backgroundUrl)
    for (const appearance of PLAYER_APPEARANCES) {
      this.load.spritesheet(appearance.textureKey, appearance.assetUrl, {
        frameWidth: PLAYER_FRAME_SIZE,
        frameHeight: PLAYER_FRAME_SIZE,
      })
    }
  }

  create() {
    if (this.assetFailed) {
      this.add
        .text(
          this.scale.width / 2,
          this.scale.height / 2,
          '場景素材載入失敗，請重新整理再試一次。',
          { color: '#f5efe0', fontSize: '18px', align: 'center' },
        )
        .setOrigin(0.5)
      return
    }

    this.scene.start('store')
  }
}
