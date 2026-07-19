import Phaser from 'phaser'
import { bridge } from '../bridge/EventBridge'
import { calculateCameraZoom } from './camera'
import { touchInput } from './inputState'
import { computeVelocity } from './movement'
import {
  facingFromVelocity,
  idleFrame,
  walkAnimation,
  walkFrames,
  type Facing,
} from './playerAnimation'
import {
  COLLISION_RECTS,
  INTERACTION_ZONES,
  PLAYER_SPAWN,
  WORLD_SIZE,
} from './sceneLayout'
import { findNearestZone, type Zone } from './zones'

const SPEED = 160
// Pai approved 0.72 from the true-size scene comparison.
const PLAYER_SCALE = 0.72

export class StoreScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private currentZone: Zone | null = null
  private hint!: Phaser.GameObjects.Text
  private uiOpen = false
  private facing: Facing = 'down'
  private bridgeUnsubscribers: (() => void)[] = []

  constructor() {
    super('store')
  }

  create() {
    this.removeListeners()
    this.currentZone = null
    this.uiOpen = false

    this.add.image(0, 0, 'store-background').setOrigin(0).setDepth(0)
    this.physics.world.setBounds(0, 0, WORLD_SIZE.width, WORLD_SIZE.height)

    const obstacles = this.physics.add.staticGroup()
    for (const rect of COLLISION_RECTS) {
      const obstacle = this.add
        .rectangle(
          rect.x + rect.width / 2,
          rect.y + rect.height / 2,
          rect.width,
          rect.height,
          0x000000,
          0,
        )
        .setVisible(false)
      this.physics.add.existing(obstacle, true)
      obstacles.add(obstacle)
    }

    this.player = this.physics.add
      .sprite(PLAYER_SPAWN.x, PLAYER_SPAWN.y, 'player', 0)
      .setScale(PLAYER_SCALE)
      .setDepth(10)
      .setCollideWorldBounds(true)
    this.createPlayerAnimations()
    this.player.setFrame(idleFrame(this.facing))

    const body = this.player.body as Phaser.Physics.Arcade.Body
    body.setSize(64, 40)
    body.setOffset(96, 196)
    this.physics.add.collider(this.player, obstacles)

    this.cameras.main
      .startFollow(this.player, true, 0.12, 0.12)
      .setBounds(0, 0, WORLD_SIZE.width, WORLD_SIZE.height)
    this.resizeCamera()
    this.scale.on('resize', this.resizeCamera, this)

    this.hint = this.add
      .text(0, 0, '按 E 互動', {
        fontSize: '14px',
        color: '#4b5563',
        backgroundColor: '#ffffff',
        padding: { x: 8, y: 4 },
      })
      .setOrigin(0.5, 1)
      .setDepth(20)
      .setVisible(false)
      .setInteractive({ useHandCursor: true })
    this.hint.on('pointerdown', this.triggerInteract, this)

    this.cursors = this.input.keyboard!.createCursorKeys()
    this.input.keyboard!.on('keydown-E', this.triggerInteract, this)
    this.bridgeUnsubscribers = [
      bridge.on('ui:opened', () => {
        this.uiOpen = true
        touchInput.x = 0
        touchInput.y = 0
      }),
      bridge.on('ui:closed', () => {
        this.uiOpen = false
      }),
    ]

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.removeListeners, this)
    this.events.once(Phaser.Scenes.Events.DESTROY, this.removeListeners, this)
  }

  private resizeCamera() {
    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0
    this.cameras.main.setZoom(
      calculateCameraZoom(this.scale.width, this.scale.height, isTouch),
    )
  }

  private removeListeners() {
    this.bridgeUnsubscribers.forEach((unsubscribe) => unsubscribe())
    this.bridgeUnsubscribers = []
    this.scale.off('resize', this.resizeCamera, this)
    this.input.keyboard?.off('keydown-E', this.triggerInteract, this)
    touchInput.x = 0
    touchInput.y = 0
  }

  private triggerInteract() {
    if (!this.currentZone || this.uiOpen) return
    bridge.emit('interact', {
      id: this.currentZone.id,
      type: this.currentZone.type,
    })
  }

  private createPlayerAnimations() {
    for (const facing of ['down', 'left', 'right', 'up'] as const) {
      const key = walkAnimation(facing)
      if (this.anims.exists(key)) continue
      this.anims.create({
        key,
        frames: walkFrames(facing).map((frame) => ({ key: 'player', frame })),
        frameRate: 8,
        repeat: -1,
      })
    }
  }

  private updatePlayerAnimation(vx: number, vy: number) {
    this.facing = facingFromVelocity(vx, vy, this.facing)
    if (vx === 0 && vy === 0) {
      this.player.anims.stop()
      this.player.setFrame(idleFrame(this.facing))
      return
    }
    this.player.anims.play(walkAnimation(this.facing), true)
  }

  update() {
    if (this.uiOpen) {
      this.player.setVelocity(0, 0)
      this.updatePlayerAnimation(0, 0)
      return
    }

    const direction = {
      x: (this.cursors.left.isDown ? -1 : 0)
        + (this.cursors.right.isDown ? 1 : 0)
        + touchInput.x,
      y: (this.cursors.up.isDown ? -1 : 0)
        + (this.cursors.down.isDown ? 1 : 0)
        + touchInput.y,
    }
    const velocity = computeVelocity(direction, SPEED)
    this.player.setVelocity(velocity.x, velocity.y)
    this.updatePlayerAnimation(velocity.x, velocity.y)

    const body = this.player.body as Phaser.Physics.Arcade.Body
    const zone = findNearestZone(
      body.center.x,
      body.center.y,
      INTERACTION_ZONES,
    )

    if (zone?.id === this.currentZone?.id) return
    if (this.currentZone) {
      bridge.emit('zone:exit', { id: this.currentZone.id })
    }
    if (zone) {
      bridge.emit('zone:enter', { id: zone.id, type: zone.type })
      this.hint.setPosition(zone.anchorX, zone.anchorY).setVisible(true)
    } else {
      this.hint.setVisible(false)
    }
    this.currentZone = zone
  }
}
