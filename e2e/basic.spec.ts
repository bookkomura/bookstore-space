import { test, expect } from '@playwright/test'

declare global {
  interface Window {
    __bridge: { emit: (event: string, payload?: unknown) => void }
  }
}

test('遊戲載入並渲染 canvas', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('canvas')).toBeVisible({ timeout: 10_000 })
})

test('interact 事件開啟翻書、翻頁、關閉', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('canvas')).toBeVisible({ timeout: 10_000 })

  await page.evaluate(() => {
    window.__bridge.emit('interact', { id: 'showcase-1', type: 'showcase' })
  })

  const viewer = page.getByTestId('book-viewer')
  await expect(viewer).toBeVisible()
  await expect(viewer).toContainText('手工蠟燭系列')

  await page.getByTestId('next').click()
  await expect(viewer).toContainText('2 / 3')

  await page.getByTestId('close').click()
  await expect(viewer).not.toBeVisible()
})

test('shelf 與 info 事件開啟對應面板', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('canvas')).toBeVisible({ timeout: 10_000 })

  await page.evaluate(() => window.__bridge.emit('interact', { id: 'shelf-1', type: 'shelf' }))
  await expect(page.getByTestId('shelf-panel')).toBeVisible()
  await page.getByTestId('close').click()

  await page.evaluate(() => window.__bridge.emit('interact', { id: 'info-1', type: 'info' }))
  await expect(page.getByTestId('store-info')).toBeVisible()
})
