import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ImageFrame from '../src/ui/ImageFrame.vue'

describe('ImageFrame', () => {
  it('keeps the fine-frame loader visible until its image loads', async () => {
    const wrapper = mount(ImageFrame, {
      props: { src: 'https://example.com/work.jpg', alt: '作品' },
    })

    expect(wrapper.get('[data-testid="image-loader"]').attributes('aria-hidden')).toBe('true')
    expect(wrapper.get('[data-testid="image"]').classes()).toContain('image--loading')

    await wrapper.get('[data-testid="image"]').trigger('load')

    expect(wrapper.find('[data-testid="image-loader"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="image"]').classes()).not.toContain('image--loading')
  })

  it('replaces a failed image with its error slot and emits an error', async () => {
    const wrapper = mount(ImageFrame, {
      props: { src: 'https://example.com/missing.jpg', alt: '遺失作品' },
      slots: { error: '<button data-testid="retry">重試</button>' },
    })

    await wrapper.get('[data-testid="image"]').trigger('error')

    expect(wrapper.find('[data-testid="image-loader"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="image"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="retry"]').text()).toBe('重試')
    expect(wrapper.emitted('error')).toHaveLength(1)
  })
})
