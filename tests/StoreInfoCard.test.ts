import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import StoreInfoCard from '../src/ui/StoreInfoCard.vue'
import type { StoreInfo } from '../src/content/schema'

const info: StoreInfo = {
  address: '台東市中山路 123 號',
  hours: '週三至週日 11:00–19:00',
  instagram: 'https://instagram.com/store',
  mapLink: 'https://maps.google.com/?q=x',
}

describe('StoreInfoCard', () => {
  it('顯示地址、時間與連結', () => {
    const w = mount(StoreInfoCard, { props: { info } })
    expect(w.text()).toContain('台東市中山路 123 號')
    expect(w.text()).toContain('11:00–19:00')
    expect(w.get('[data-testid="ig-link"]').attributes('href')).toBe(info.instagram)
    expect(w.get('[data-testid="map-link"]').attributes('href')).toBe(info.mapLink)
  })

  it('點關閉 emit close', async () => {
    const w = mount(StoreInfoCard, { props: { info } })
    await w.get('[data-testid="close"]').trigger('click')
    expect(w.emitted('close')).toHaveLength(1)
  })

  it('在窄版直式視窗以 border-box 保持卡片在 overlay 內', () => {
    const w = mount(StoreInfoCard, { props: { info } })
    expect(getComputedStyle(w.get('.card').element).boxSizing).toBe('border-box')
  })
})
