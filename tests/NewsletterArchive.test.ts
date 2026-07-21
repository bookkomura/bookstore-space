import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { readFileSync } from 'node:fs'
import NewsletterArchive from '../src/ui/NewsletterArchive.vue'
import type { Newsletter } from '../src/content/schema'

const issues: Newsletter[] = [
  {
    sentAt: '2026-07-19T05:40:00.000Z',
    subject: '小村碎碎念～最新一期',
    blocks: [
      { type: 'paragraph', text: '最新一期內容。' },
      { type: 'image', image: 'https://example.com/poster.jpg', alt: '活動海報', caption: '夏日活動' },
      { type: 'link', label: '報名活動', href: 'https://example.com/event' },
      { type: 'divider' },
    ],
  },
  {
    sentAt: '2026-07-12T05:40:00.000Z',
    subject: '小村碎碎念～舊一期',
    blocks: [{ type: 'paragraph', text: '舊一期內容。' }],
  },
]

describe('NewsletterArchive', () => {
  it('shows the newest supplied issue first', () => {
    const wrapper = mount(NewsletterArchive, { props: { newsletters: issues } })

    expect(wrapper.get('[data-testid="newsletter-content"]').text()).toContain('最新一期內容。')
    expect(wrapper.findAll('[data-testid="envelope-issue"]')[0].text()).toContain('最新一期')
  })

  it('switches an issue and resets only the paper scroll', async () => {
    const wrapper = mount(NewsletterArchive, { props: { newsletters: issues } })
    const paper = wrapper.get('[data-testid="newsletter-content"]').element as HTMLElement
    Object.defineProperty(paper, 'scrollTop', { value: 88, writable: true })
    Object.defineProperty(paper, 'scrollTo', {
      value: ({ top }: ScrollToOptions) => { paper.scrollTop = top ?? 0 },
    })

    await wrapper.findAll('[data-testid="envelope-issue"]')[1].trigger('click')

    expect(wrapper.text()).toContain('舊一期')
    expect(paper.scrollTop).toBe(0)
  })

  it('renders an empty state when there are no published issues', () => {
    const wrapper = mount(NewsletterArchive, { props: { newsletters: [] } })

    expect(wrapper.get('[data-testid="newsletter-content"]').text()).toContain('目前沒有可閱讀的電子報。')
    expect(wrapper.find('[data-testid="envelope-issue"]').exists()).toBe(false)
  })

  it('emits close from the archive controls', async () => {
    const wrapper = mount(NewsletterArchive, { props: { newsletters: issues } })

    await wrapper.get('[data-testid="close"]').trigger('click')

    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('isolates horizontal issue navigation from vertical paper scrolling', () => {
    const source = readFileSync('src/ui/NewsletterArchive.vue', 'utf8')

    expect(source).toMatch(/\.issue-nav\s*\{[^}]*overflow-y:\s*hidden;/s)
    expect(source).toMatch(/main\s*\{[^}]*overflow-x:\s*hidden;/s)
  })

  it('falls back to the complete subject when its title suffix is empty', () => {
    const wrapper = mount(NewsletterArchive, {
      props: { newsletters: [{ ...issues[0], subject: '小村碎碎念～' }] },
    })

    expect(wrapper.get('[data-testid="envelope-issue"]').text()).toContain('小村碎碎念～')
  })

  it('uses safe external links and useful image alt text', () => {
    const wrapper = mount(NewsletterArchive, { props: { newsletters: issues } })

    expect(wrapper.get('[data-testid="newsletter-link"]').attributes()).toMatchObject({
      href: 'https://example.com/event',
      target: '_blank',
      rel: 'noopener',
    })
    expect(wrapper.get('img').attributes('alt')).toBe('活動海報')
  })
})
