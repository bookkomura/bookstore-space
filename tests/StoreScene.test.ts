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
  },
}))

import { StoreScene } from '../src/game/StoreScene'

function chain() {
  const value = {
    on: vi.fn(),
    setCollideWorldBounds: vi.fn(),
    setDepth: vi.fn(),
    setFrame: vi.fn(),
    setInteractive: vi.fn(),
    setOrigin: vi.fn(),
    setPosition: vi.fn(),
    setScale: vi.fn(),
    setVelocity: vi.fn(),
    setVisible: vi.fn(),
  }
  Object.values(value).forEach((method) => method.mockReturnValue(value))
  return value
}

function createSceneFixture() {
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
  const scene = new StoreScene() as any
  Object.assign(scene, {
    add: {
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

  return { cursors, player, playerAnimations, scene }
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
})
