import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import BookViewer from '../src/ui/BookViewer.vue'
import type { Showcase } from '../src/content/schema'

const showcase: Showcase = {
  id: 'showcase-1',
  title: '手工蠟燭',
  creatorLink: 'https://instagram.com/creator',
  pages: [
    { image: 'https://example.com/1.jpg', caption: '第一頁描述' },
    { image: 'https://example.com/2.jpg', caption: '第二頁描述' },
  ],
}

describe('BookViewer', () => {
  it('顯示標題與第一頁', () => {
    const w = mount(BookViewer, { props: { showcase } })
    expect(w.text()).toContain('手工蠟燭')
    expect(w.text()).toContain('第一頁描述')
    expect(w.text()).toContain('1 / 2')
  })

  it('下一頁/上一頁切換，邊界時按鈕 disabled', async () => {
    const w = mount(BookViewer, { props: { showcase } })
    expect(w.get('[data-testid="prev"]').attributes('disabled')).toBeDefined()
    await w.get('[data-testid="next"]').trigger('click')
    expect(w.text()).toContain('第二頁描述')
    expect(w.get('[data-testid="next"]').attributes('disabled')).toBeDefined()
  })

  it('最後一頁才顯示創作者連結', async () => {
    const w = mount(BookViewer, { props: { showcase } })
    expect(w.find('[data-testid="creator-link"]').exists()).toBe(false)
    await w.get('[data-testid="next"]').trigger('click')
    expect(w.get('[data-testid="creator-link"]').attributes('href')).toBe('https://instagram.com/creator')
  })

  it('無 creatorLink 時最後一頁不渲染連結', async () => {
    const w = mount(BookViewer, { props: { showcase: { ...showcase, creatorLink: undefined } } })
    await w.get('[data-testid="next"]').trigger('click')
    expect(w.find('[data-testid="creator-link"]').exists()).toBe(false)
  })

  it('圖片載入失敗顯示重試，按重試恢復 img', async () => {
    const w = mount(BookViewer, { props: { showcase } })
    await w.get('img').trigger('error')
    expect(w.text()).toContain('圖片載入失敗')
    await w.get('[data-testid="retry"]').trigger('click')
    expect(w.find('img').exists()).toBe(true)
  })

  it('點關閉 emit close', async () => {
    const w = mount(BookViewer, { props: { showcase } })
    await w.get('[data-testid="close"]').trigger('click')
    expect(w.emitted('close')).toHaveLength(1)
  })
})
