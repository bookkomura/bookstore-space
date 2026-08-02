import Phaser from 'phaser'
import { bridge } from '../bridge/EventBridge'
import { PLAYER_APPEARANCES, PLAYER_FRAME_SIZE } from './playerAppearance'

const backgroundUrl = new URL('../assets/store-background.png', import.meta.url).href

export class BootScene extends Phaser.Scene {
  private assetFailed = false

  constructor() {
    super('boot')
  }

  preload() {
    this.load.on('progress', (value: number) => {
      bridge.emit('boot:progress', value)
    })
    this.load.once('loaderror', () => {
      this.assetFailed = true
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
      bridge.emit('boot:error')
      return
    }

    bridge.emit('boot:complete')
    this.scene.start('store')
  }
}
