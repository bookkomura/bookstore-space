import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import BootLoading from '../src/ui/BootLoading.vue'

describe('BootLoading', () => {
  it('renders the 小村閱讀 wordmark and an accessible progressbar', () => {
    const wrapper = mount(BootLoading, { props: { progress: 0 } })
    expect(wrapper.find('[data-testid="boot-loading"]').exists()).toBe(true)
    expect(wrapper.get('[aria-label="小村閱讀 載入中"]').text()).toBe('小村閱讀')
    expect(wrapper.get('[data-testid="boot-loading-bar"]').attributes()).toMatchObject({
      role: 'progressbar',
      'aria-valuemin': '0',
      'aria-valuemax': '100',
      'aria-valuenow': '0',
    })
  })

  it('drives aria-valuenow from the progress prop', () => {
    const wrapper = mount(BootLoading, { props: { progress: 0.5 } })
    expect(wrapper.get('[data-testid="boot-loading-bar"]').attributes('aria-valuenow')).toBe('50')
  })

  it('shows the status copy and swaps to the zh-TW error copy on error', async () => {
    const wrapper = mount(BootLoading, { props: { progress: 1 } })
    const copy = wrapper.get('[data-testid="boot-loading-copy"]')
    expect(copy.text()).toContain('正在整理書架')

    await wrapper.setProps({ error: true })

    expect(wrapper.get('[data-testid="boot-loading-copy"]').text()).toBe('場景素材載入失敗，請重新整理再試一次。')
  })
})
