import Phaser from 'phaser'
import { bridge } from '../bridge/EventBridge'
import { touchInput } from './inputState'
import { parseInteractionZones } from './mapParser'
import { computeVelocity } from './movement'
import { findZone, type Zone } from './zones'

const SPEED = 160
const SPAWN = { x: 320, y: 240 }

export class StoreScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private zones: Zone[] = []
  private currentZone: Zone | null = null
  private hint!: Phaser.GameObjects.Text
  private uiOpen = false
  private bridgeUnsubscribers: (() => void)[] = []

  constructor() {
    super('store')
  }

  create() {
    this.removeBridgeListeners()
    this.currentZone = null
    this.uiOpen = false

    const map = this.make.tilemap({ key: 'map' })
    const tiles = map.addTilesetImage('tileset', 'tiles')!
    map.createLayer('ground', tiles)
    const walls = map.createLayer('walls', tiles)!
    walls.setCollision(2)

    this.player = this.physics.add.sprite(SPAWN.x, SPAWN.y, 'player')
    this.physics.add.collider(this.player, walls)
    this.cameras.main.startFollow(this.player)
    this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels)

    this.zones = parseInteractionZones(this.cache.tilemap.get('map')!.data)

    this.hint = this.add
      .text(0, 0, '點擊翻閱', { fontSize: '14px', backgroundColor: '#000000', padding: { x: 8, y: 4 } })
      .setOrigin(0.5, 1)
      .setDepth(10)
      .setVisible(false)
      .setInteractive({ useHandCursor: true })
    this.hint.on('pointerdown', () => this.triggerInteract())
    this.cursors = this.input.keyboard!.createCursorKeys()
    this.input.keyboard!.on('keydown-E', () => this.triggerInteract())

    this.bridgeUnsubscribers = [
      bridge.on('ui:opened', () => {
        this.uiOpen = true
      }),
      bridge.on('ui:closed', () => {
        this.uiOpen = false
      }),
    ]
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.removeBridgeListeners, this)
    this.events.once(Phaser.Scenes.Events.DESTROY, this.removeBridgeListeners, this)
  }

  private removeBridgeListeners() {
    this.bridgeUnsubscribers.forEach((unsubscribe) => unsubscribe())
    this.bridgeUnsubscribers = []
  }

  private triggerInteract() {
    if (!this.currentZone || this.uiOpen) return
    bridge.emit('interact', { id: this.currentZone.id, type: this.currentZone.type })
  }

  update() {
    if (this.uiOpen) {
      this.player.setVelocity(0, 0)
      return
    }

    const dir = {
      x: (this.cursors.left.isDown ? -1 : 0) + (this.cursors.right.isDown ? 1 : 0) + touchInput.x,
      y: (this.cursors.up.isDown ? -1 : 0) + (this.cursors.down.isDown ? 1 : 0) + touchInput.y,
    }
    const v = computeVelocity(dir, SPEED)
    this.player.setVelocity(v.x, v.y)

    const zone = findZone(this.player.x, this.player.y, this.zones)
    if (zone !== this.currentZone) {
      if (this.currentZone) bridge.emit('zone:exit', { id: this.currentZone.id })
      if (zone) {
        bridge.emit('zone:enter', { id: zone.id, type: zone.type })
        this.hint.setPosition(zone.x + zone.width / 2, zone.y - 8).setVisible(true)
      } else {
        this.hint.setVisible(false)
      }
      this.currentZone = zone
    }
  }
}
