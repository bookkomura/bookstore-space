import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ShelfPanel from '../src/ui/ShelfPanel.vue'
import type { Shelf } from '../src/content/schema'

const shelf: Shelf = {
  id: 'shelf-1',
  title: '店主精選',
  books: [
    { cover: 'https://example.com/b1.jpg', title: '我可能錯了', note: '最平靜的一本書' },
    { cover: 'https://example.com/b2.jpg', title: '射鵰英雄傳', note: '江湖入門' },
  ],
}

describe('ShelfPanel', () => {
  it('顯示書單標題與所有書', () => {
    const w = mount(ShelfPanel, { props: { shelf } })
    expect(w.text()).toContain('店主精選')
    expect(w.text()).toContain('我可能錯了')
    expect(w.text()).toContain('江湖入門')
    expect(w.findAll('img')).toHaveLength(2)
    expect(w.findAll('img')[0].attributes('loading')).toBe('lazy')
  })

  it('點關閉 emit close', async () => {
    const w = mount(ShelfPanel, { props: { shelf } })
    await w.get('[data-testid="close"]').trigger('click')
    expect(w.emitted('close')).toHaveLength(1)
  })

  it('每本封面獨立完成載入，不等待其他封面', async () => {
    const w = mount(ShelfPanel, { props: { shelf } })

    expect(w.findAll('[data-testid="image-loader"]')).toHaveLength(2)
    await w.findAll('[data-testid="image"]')[0].trigger('load')

    expect(w.findAll('[data-testid="image-loader"]')).toHaveLength(1)
    expect(w.findAll('[data-testid="image"]')[0].classes()).not.toContain('image--loading')
  })
})
