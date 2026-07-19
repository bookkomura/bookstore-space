import Phaser from 'phaser'
import { BootScene } from './BootScene'
import type { InteractionLabels } from './interactionLabels'
import { StoreScene } from './StoreScene'

export function createGame(
  parent: HTMLElement,
  labels: InteractionLabels,
): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: '#090909',
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    physics: { default: 'arcade' },
    scene: [BootScene, new StoreScene(labels)],
  })
}
