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

  it('emits close when its close button is clicked', async () => {
    const wrapper = mount(PoemUploadOverlay)
    await wrapper.get('[data-testid="close"]').trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(1)
  })
})
