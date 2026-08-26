import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('privacy policy', () => {
  const policy = readFileSync(resolve(process.cwd(), 'public/privacy.html'), 'utf8')

  it('identifies the OAuth application and its public contact', () => {
    expect(policy).toContain('Bookstore Space Newsletter Sync')
    expect(policy).toContain('bookkomura@gmail.com')
  })

  it('discloses Gmail access, use, storage, sharing, and deletion', () => {
    expect(policy).toContain('存取的 Google 使用者資料')
    expect(policy).toContain('資料用途')
    expect(policy).toContain('資料保存與刪除')
    expect(policy).toContain('資料分享')
    expect(policy).toContain('gmail.readonly')
  })

  it('includes the Google API Limited Use disclosure', () => {
    expect(policy).toContain('Limited Use')
    expect(policy).toContain('https://developers.google.com/terms/api-services-user-data-policy')
  })
})
