import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PoemUploadOverlay from '../src/ui/PoemUploadOverlay.vue'

describe('PoemUploadOverlay', () => {
  it('loads the poem upload site in a full-screen accessible frame', () => {
    const wrapper = mount(PoemUploadOverlay)
    const frame = wrapper.get('[data-testid="poem-upload-frame"]')
    expect(frame.attributes()).toMatchObject({ src: 'https://paiwh-poem-display.hf.space/', title: '拾字成詩上傳工具' })
    expect(frame.attributes('sandbox')).toBeUndefined()
    expect(wrapper.get('[data-testid="close"]').attributes('aria-label')).toBe('關閉拾字成詩')
    expect(getComputedStyle(wrapper.get('[data-testid="poem-upload-overlay"]').element).position).toBe('fixed')
  })

  it('shows the 墨跡成詩 loading layer until the upload frame has loaded', async () => {
    const wrapper = mount(PoemUploadOverlay)

    expect(wrapper.get('[data-testid="poem-upload-loading"]').text()).toContain('正在鋪開詩頁⋯⋯')
    expect(wrapper.get('[data-testid="poem-upload-loading"]').text()).toContain('拾')
    expect(wrapper.get('[data-testid="poem-upload-loading"]').text()).toContain('詩')

    await wrapper.get('[data-testid="poem-upload-frame"]').trigger('load')

    expect(wrapper.find('[data-testid="poem-upload-loading"]').exists()).toBe(false)
  })

  it('emits close when its close button is clicked', async () => {
    const wrapper = mount(PoemUploadOverlay)
    await wrapper.get('[data-testid="close"]').trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(1)
  })
})
