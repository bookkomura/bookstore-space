import { describe, it, expect } from 'vitest'
import { ContentBundleSchema } from '../src/content/schema'
import sample from '../scripts/sample-content.json'

describe('ContentBundleSchema', () => {
  it('接受合法的 sample content', () => {
    expect(() => ContentBundleSchema.parse(sample)).not.toThrow()
  })

  it('拒絕 pages 為空陣列的 showcase', () => {
    const bad = structuredClone(sample) as any
    bad.showcases[0].pages = []
    expect(() => ContentBundleSchema.parse(bad)).toThrow()
  })

  it('creatorLink 可省略', () => {
    const ok = structuredClone(sample) as any
    delete ok.showcases[0].creatorLink
    expect(() => ContentBundleSchema.parse(ok)).not.toThrow()
  })

  it('拒絕缺 storeInfo 的 bundle', () => {
    const bad = structuredClone(sample) as any
    delete bad.storeInfo
    expect(() => ContentBundleSchema.parse(bad)).toThrow()
  })
})
