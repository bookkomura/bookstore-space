import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import App from '../src/App.vue'
import { bridge } from '../src/bridge/EventBridge'
import type { ContentBundle } from '../src/content/schema'

const mocks = vi.hoisted(() => ({
  createGame: vi.fn(),
  loadContent: vi.fn(),
}))

vi.mock('../src/game/createGame', () => ({ createGame: mocks.createGame }))
vi.mock('../src/content/loadContent', () => ({ loadContent: mocks.loadContent }))

const content: ContentBundle = {
  showcases: [{
    id: 'showcase-1',
    title: '手工蠟燭系列',
    pages: [{ image: 'https://example.com/candle.jpg', caption: '手工澆製' }],
  }],
  shelves: [{
    id: 'shelf-1',
    title: '店主精選',
    books: [{ cover: 'https://example.com/book.jpg', title: '我可能錯了', note: '最平靜的一本書' }],
  }],
  storeInfo: {
    address: '台東市中山路 123 號',
    hours: '週三至週日 11:00–19:00',
    instagram: 'https://instagram.com/store',
    mapLink: 'https://maps.google.com/?q=store',
  },
}

const wrappers: VueWrapper[] = []

async function mountApp() {
  const wrapper = mount(App)
  wrappers.push(wrapper)
  await flushPromises()
  return wrapper
}

describe('App', () => {
  beforeEach(() => {
    mocks.createGame.mockReset()
    mocks.loadContent.mockReset()
    mocks.createGame.mockReturnValue({ destroy: vi.fn() })
  })

  afterEach(() => {
    wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  })

  it('starts Phaser after loading content and opens the matching overlay from bridge interaction', async () => {
    mocks.loadContent.mockResolvedValue(content)
    const opened = vi.fn()
    const offOpened = bridge.on('ui:opened', opened)
    const wrapper = await mountApp()

    expect(mocks.createGame).toHaveBeenCalledOnce()
    expect(mocks.createGame).toHaveBeenCalledWith(
      expect.any(HTMLElement),
      expect.objectContaining({
        'showcase-1': '手工蠟燭系列',
        'shelf-1': '店主精選',
        'info-1': '營業資訊',
      }),
      expect.arrayContaining([
        expect.objectContaining({ id: 'showcase-1', type: 'showcase' }),
      ]),
    )
    bridge.emit('interact', { id: 'showcase-1', type: 'showcase' })
    await flushPromises()

    expect(wrapper.get('[data-testid="book-viewer"]').text()).toContain('手工蠟燭系列')
    expect(opened).toHaveBeenCalledOnce()
    offOpened()
  })

  it('emits the UI-close flow when an opened overlay closes', async () => {
    mocks.loadContent.mockResolvedValue(content)
    const closed = vi.fn()
    const offClosed = bridge.on('ui:closed', closed)
    const wrapper = await mountApp()
    bridge.emit('interact', { id: 'shelf-1', type: 'shelf' })
    await flushPromises()

    await wrapper.get('[data-testid="shelf-panel"] [data-testid="close"]').trigger('click')

    expect(wrapper.find('[data-testid="shelf-panel"]').exists()).toBe(false)
    expect(closed).toHaveBeenCalledOnce()
    offClosed()
  })

  it('closes an opened interaction overlay when Escape is pressed', async () => {
    mocks.loadContent.mockResolvedValue(content)
    const closed = vi.fn()
    const offClosed = bridge.on('ui:closed', closed)
    const wrapper = await mountApp()
    bridge.emit('interact', { id: 'showcase-1', type: 'showcase' })
    await flushPromises()

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await flushPromises()

    expect(wrapper.find('[data-testid="book-viewer"]').exists()).toBe(false)
    expect(closed).toHaveBeenCalledOnce()
    offClosed()
  })

  it('renders the zh-TW load error and does not start Phaser when loading fails', async () => {
    mocks.loadContent.mockRejectedValue(new Error('network unavailable'))
    const wrapper = await mountApp()

    expect(wrapper.text()).toBe('內容載入失敗，請重新整理再試一次。')
    expect(mocks.createGame).not.toHaveBeenCalled()
  })

  it('removes its bridge listener and destroys the game when unmounted', async () => {
    mocks.loadContent.mockResolvedValue(content)
    const opened = vi.fn()
    const offOpened = bridge.on('ui:opened', opened)
    const wrapper = await mountApp()
    const game = mocks.createGame.mock.results[0].value

    wrapper.unmount()
    bridge.emit('interact', { id: 'showcase-1', type: 'showcase' })

    expect(opened).not.toHaveBeenCalled()
    expect(game.destroy).toHaveBeenCalledWith(true)
    offOpened()
  })

  it('unmount 後忽略 zone 與 interact 事件', async () => {
    mocks.loadContent.mockResolvedValue(content)
    const wrapper = await mountApp()
    wrapper.unmount()

    bridge.emit('zone:enter', { id: 'showcase-1', type: 'showcase' })
    bridge.emit('interact', { id: 'showcase-1', type: 'showcase' })
    await flushPromises()

    expect(wrapper.find('[data-testid="book-viewer"]').exists()).toBe(false)
  })

  it('只把已設定 Showcase 的互動區傳給 Phaser', async () => {
    mocks.loadContent.mockResolvedValue({ ...content, showcases: [] })
    await mountApp()

    expect(mocks.createGame).toHaveBeenCalledWith(
      expect.any(HTMLElement),
      expect.any(Object),
      expect.not.arrayContaining([
        expect.objectContaining({ type: 'showcase' }),
      ]),
    )
  })
})
