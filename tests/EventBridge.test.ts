import { describe, expect, it, vi } from 'vitest'
import { EventBridge } from '../src/bridge/EventBridge'

describe('EventBridge', () => {
  it('emit 觸發已註冊的 handler 並帶 payload', () => {
    const b = new EventBridge()
    const fn = vi.fn()
    b.on('interact', fn)
    b.emit('interact', { id: 'showcase-1', type: 'showcase' })
    expect(fn).toHaveBeenCalledWith({ id: 'showcase-1', type: 'showcase' })
  })

  it('on 回傳的函式可取消訂閱', () => {
    const b = new EventBridge()
    const fn = vi.fn()
    const off = b.on('ui:closed', fn)
    off()
    b.emit('ui:closed')
    expect(fn).not.toHaveBeenCalled()
  })

  it('無 handler 時 emit 不丟錯', () => {
    const b = new EventBridge()
    expect(() => b.emit('ui:opened')).not.toThrow()
  })
})
