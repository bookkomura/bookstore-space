import { test, expect } from '@playwright/test'

declare global {
  interface Window {
    __bridge: {
      emit: (event: string, payload?: unknown) => void
      on: (event: string, handler: () => void) => () => void
    }
    __interactionRequests?: number
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

test('從入口實際走到最左商品並按 E 開啟 showcase-5', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('canvas')).toBeVisible({ timeout: 10_000 })
  await page.waitForTimeout(500)
  await page.evaluate(() => {
    window.__interactionRequests = 0
    window.__bridge.on('zone:enter', () => {
      window.__interactionRequests = (window.__interactionRequests ?? 0) + 1
    })
  })

  await page.keyboard.down('ArrowRight')
  await page.waitForTimeout(900)
  await page.keyboard.down('ArrowUp')
  await page.waitForTimeout(600)
  await page.keyboard.up('ArrowUp')
  await expect.poll(
    () => page.evaluate(() => window.__interactionRequests),
    { timeout: 4_000 },
  ).toBe(1)
  await page.keyboard.up('ArrowRight')
  await page.keyboard.press('e')

  const viewer = page.getByTestId('book-viewer')
  await expect(viewer).toBeVisible()
  await expect(viewer).toContainText('獨立刊物選集')
})

test('手機 action 在 zone 外停用，zone 內送出 request', async ({ page, isMobile }) => {
  test.skip(!isMobile, '只在 mobile project 執行')
  await page.goto('/')
  await expect(page.locator('canvas')).toBeVisible({ timeout: 10_000 })

  const action = page.getByTestId('interact-button')
  await expect(action).toBeDisabled()

  await page.evaluate(() => {
    window.__interactionRequests = 0
    window.__bridge.on('interact:request', () => {
      window.__interactionRequests = (window.__interactionRequests ?? 0) + 1
    })
    window.__bridge.emit('zone:enter', {
      id: 'showcase-1',
      type: 'showcase',
    })
  })

  await expect(action).toBeEnabled()
  await action.click()
  await expect.poll(
    () => page.evaluate(() => window.__interactionRequests),
  ).toBe(1)

  await page.evaluate(() => {
    window.__bridge.emit('zone:exit', { id: 'showcase-1' })
  })
  await expect(action).toBeDisabled()
})

test('手機直橫旋轉後 canvas 與控制仍在 viewport 內', async ({ page, isMobile }) => {
  test.skip(!isMobile, '只在 mobile project 執行')
  await page.goto('/')
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.locator('canvas')).toBeVisible()
  await expect(page.getByTestId('joystick')).toBeInViewport()
  await expect(page.getByTestId('interact-button')).toBeInViewport()

  await page.setViewportSize({ width: 844, height: 390 })
  await expect(page.locator('canvas')).toBeVisible()
  await expect(page.getByTestId('joystick')).toBeInViewport()
  await expect(page.getByTestId('interact-button')).toBeInViewport()
})
