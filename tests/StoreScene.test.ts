import { describe, expect, it, vi } from 'vitest'
import { bridge } from '../src/bridge/EventBridge'

vi.mock('phaser', () => ({
  default: {
    Scene: class {
      constructor(_key?: string) {}
    },
    Scenes: {
      Events: {
        SHUTDOWN: 'shutdown',
        DESTROY: 'destroy',
      },
    },
    Geom: {
      Rectangle: Object.assign(
        class Rectangle {
          constructor(
            _x: number,
            _y: number,
            _width: number,
            _height: number,
          ) {}
        },
        { Contains: vi.fn() },
      ),
    },
  },
}))

import { StoreScene } from '../src/game/StoreScene'
import { PLAYER_APPEARANCES } from '../src/game/playerAppearance'
import { buildInteractionZones } from '../src/game/sceneLayout'

function chain() {
  const value = {
    destroy: vi.fn(),
    on: vi.fn(),
    setCollideWorldBounds: vi.fn(),
    setDepth: vi.fn(),
    setFrame: vi.fn(),
    setInteractive: vi.fn(),
    setOrigin: vi.fn(),
    setPosition: vi.fn(),
    setScale: vi.fn(),
    setSize: vi.fn(),
    setStrokeStyle: vi.fn(),
    setVelocity: vi.fn(),
    setVisible: vi.fn(),
  }
  Object.values(value).forEach((method) => method.mockReturnValue(value))
  return value
}

function createSceneFixture(scene = new StoreScene({}, [])) {
  const player = chain()
  const body = {
    center: { x: 0, y: 0 },
    setOffset: vi.fn(),
    setSize: vi.fn(),
  }
  const playerAnimations = {
    play: vi.fn(),
    stop: vi.fn(),
  }
  Object.assign(player, { anims: playerAnimations, body })

  const rectangle = chain()
  const hint = chain()
  const obstacles = { add: vi.fn() }
  const cursors = {
    down: { isDown: false },
    left: { isDown: false },
    right: { isDown: false },
    up: { isDown: false },
  }
  const sceneFixture = scene as any
  Object.assign(sceneFixture, {
    add: {
      circle: vi.fn(() => chain()),
      container: vi.fn(() => chain()),
      image: vi.fn(() => chain()),
      rectangle: vi.fn(() => rectangle),
      text: vi.fn(() => hint),
    },
    anims: {
      create: vi.fn(),
      exists: vi.fn(() => false),
    },
    cameras: {
      main: {
        setBounds: vi.fn(),
        setZoom: vi.fn(),
        startFollow: vi.fn().mockReturnThis(),
      },
    },
    events: { once: vi.fn() },
    input: {
      keyboard: {
        createCursorKeys: vi.fn(() => cursors),
        off: vi.fn(),
        on: vi.fn(),
      },
    },
    physics: {
      add: {
        collider: vi.fn(),
        existing: vi.fn(),
        sprite: vi.fn(() => player),
        staticGroup: vi.fn(() => obstacles),
      },
      world: { setBounds: vi.fn() },
    },
    scale: {
      height: 600,
      off: vi.fn(),
      on: vi.fn(),
      width: 800,
    },
  })

  return { cursors, player, playerAnimations, scene: sceneFixture }
}

describe('StoreScene', () => {
  it('uses the space bar as the desktop interaction key', () => {
    const { scene } = createSceneFixture()

    scene.create()

    expect(scene.input.keyboard.on).toHaveBeenCalledWith(
      'keydown-SPACE',
      scene.triggerInteract,
      scene,
    )
    expect(scene.input.keyboard.on).not.toHaveBeenCalledWith(
      'keydown-E',
      scene.triggerInteract,
      scene,
    )

    scene.removeListeners()
    expect(scene.input.keyboard.off).toHaveBeenCalledWith(
      'keydown-SPACE',
      scene.triggerInteract,
      scene,
    )
  })

  it('immediately stops a moving visitor when an overlay opens', () => {
    const { cursors, player, playerAnimations, scene } = createSceneFixture()
    scene.create()
    cursors.right.isDown = true
    scene.update()
    player.setVelocity.mockClear()
    player.setFrame.mockClear()
    playerAnimations.stop.mockClear()

    try {
      bridge.emit('ui:opened')

      expect(player.setVelocity).toHaveBeenCalledWith(0, 0)
      expect(playerAnimations.stop).toHaveBeenCalledOnce()
      expect(player.setFrame).toHaveBeenCalledWith(8)
    } finally {
      scene.removeListeners()
    }
  })

  it('以注入的互動區建立標記與 proximity 判定', () => {
    const zones = buildInteractionZones([{ id: 'dynamic-showcase' }])
    const { scene } = createSceneFixture(
      new StoreScene({
        'dynamic-showcase': '動態展示',
        'shelf-1': '店主精選',
        'info-1': '營業資訊',
        'archive-1': '小村碎碎念',
        'poem-upload-1': '拾字成詩',
      }, zones),
    )

    scene.create()

    expect(scene.markers.has('dynamic-showcase')).toBe(true)
  })

  it('進入時只抽選一次外觀，重新建立場景時才重新抽選', () => {
    const selectAppearance = vi
      .fn()
      .mockReturnValueOnce(PLAYER_APPEARANCES[4])
      .mockReturnValueOnce(PLAYER_APPEARANCES[1])
    const sceneInstance = new StoreScene({}, [], selectAppearance)
    const { player, scene } = createSceneFixture(sceneInstance)

    scene.create()

    expect(selectAppearance).toHaveBeenCalledTimes(1)
    expect(scene.physics.add.sprite).toHaveBeenCalledWith(
      expect.any(Number),
      expect.any(Number),
      'player-orange-cat',
      0,
    )
    expect(player.setScale).toHaveBeenCalledWith(0.72)
    expect(player.body.setSize).toHaveBeenCalledWith(64, 40)
    expect(player.body.setOffset).toHaveBeenCalledWith(96, 196)

    scene.update()
    expect(selectAppearance).toHaveBeenCalledTimes(1)

    scene.create()
    expect(selectAppearance).toHaveBeenCalledTimes(2)
    expect(scene.physics.add.sprite).toHaveBeenLastCalledWith(
      expect.any(Number),
      expect.any(Number),
      'player-visitor-female',
      0,
    )
  })
})
