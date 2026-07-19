import Phaser from 'phaser'
import { formatMarkerLabel } from './interactionLabels'

export class InteractionMarker {
  private readonly container: Phaser.GameObjects.Container
  private readonly glow: Phaser.GameObjects.Arc
  private readonly label: Phaser.GameObjects.Text
  private active = false

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    title: string,
    onInteract: () => void,
  ) {
    const shadow = scene.add.circle(0, 2, 10, 0x000000, 0.28)
    this.glow = scene.add.circle(0, 0, 13, 0xffffff, 0.28).setVisible(false)
    const bubble = scene.add
      .circle(0, 0, 10, 0xffffff)
      .setStrokeStyle(1.5, 0x9ca3af)
    const bang = scene.add
      .text(0, -1, '!', {
        color: '#616161',
        fontFamily: 'Arial, sans-serif',
        fontSize: '14px',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
    this.label = scene.add
      .text(18, 0, formatMarkerLabel(title), {
        color: '#4b5563',
        backgroundColor: '#ffffff',
        fontFamily: 'Arial, sans-serif',
        fontSize: '16px',
        lineSpacing: 2,
        padding: { x: 10, y: 7 },
      })
      .setOrigin(0, 0.5)
      .setVisible(false)

    this.container = scene.add
      .container(x, y, [shadow, this.glow, bubble, bang, this.label])
      .setDepth(30)
      .setSize(240, 56)
      .setInteractive(
        new Phaser.Geom.Rectangle(-24, -28, 240, 56),
        Phaser.Geom.Rectangle.Contains,
      )
      .on('pointerdown', () => {
        if (this.active) onInteract()
      })
  }

  setActive(active: boolean) {
    this.active = active
    this.glow.setVisible(active)
    this.label.setVisible(active)
    this.container.setScale(active ? 1.08 : 1)
  }

  destroy() {
    this.container.destroy(true)
  }
}
