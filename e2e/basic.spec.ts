import { test, expect, type Page } from '@playwright/test'

declare global {
  interface Window {
    __bridge: {
      emit: (event: string, payload?: unknown) => void
      on: (event: string, handler: (payload: { id: string }) => void) => () => void
    }
    __interactionRequests?: number
    __observedZoneIds?: string[]
    __stopZoneObserver?: () => void
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

async function waitForZone(page: Page, id: string) {
  await expect.poll(
    () => page.evaluate((zoneId) => window.__observedZoneIds?.includes(zoneId), id),
    { timeout: 4_000, intervals: [50, 100, 200] },
  ).toBe(true)
}

async function walkUntilZone(
  page: Page,
  key: 'ArrowDown' | 'ArrowLeft' | 'ArrowRight' | 'ArrowUp',
  id: string,
) {
  await page.keyboard.down(key)
  try {
    await waitForZone(page, id)
  } finally {
    await page.keyboard.up(key)
  }
}

test('從入口實際步行到全部七個互動點並開啟正確內容', async ({ page, isMobile }) => {
  test.skip(isMobile, 'all-seven keyboard walkthrough is desktop acceptance coverage')
  await page.goto('/')
  await expect(page.locator('canvas')).toBeVisible({ timeout: 10_000 })
  // Canvas allocation precedes Phaser's scene setup; wait for the scene to
  // subscribe before starting the deterministic entrance route under parallel E2E load.
  await page.waitForTimeout(1_200)
  await page.evaluate(() => {
    window.__stopZoneObserver?.()
    window.__observedZoneIds = []
    window.__stopZoneObserver = window.__bridge.on('zone:enter', ({ id }) => {
      window.__observedZoneIds?.push(id)
    })
  })

  try {
    // The entrance route passes around the central table, then reaches the
    // leftmost showcase through collision-aware keyboard movement only.
    await page.keyboard.down('ArrowRight')
    await page.waitForTimeout(900)
    await page.keyboard.down('ArrowUp')
    await page.waitForTimeout(600)
    await page.keyboard.up('ArrowUp')
    await waitForZone(page, 'showcase-5')
    await page.keyboard.up('ArrowRight')
    await page.screenshot({
      path: '/private/tmp/bookstore-task20-evidence/desktop-showcase-5-proximity.png',
    })

    await page.keyboard.press('Space')
    const viewer = page.getByTestId('book-viewer')
    await expect(viewer).toBeVisible()
    await expect(viewer).toContainText('獨立刊物選集')
    await page.screenshot({
      path: '/private/tmp/bookstore-task20-evidence/desktop-showcase-5-overlay.png',
    })

    // Holding movement during an overlay must not advance the player; closing
    // it then permits the same keyboard route to continue to showcase-4.
    const eventCountWhileFrozen = await page.evaluate(
      () => window.__observedZoneIds?.length,
    )
    await page.keyboard.down('ArrowRight')
    await page.waitForTimeout(350)
    await expect.poll(
      () => page.evaluate(() => window.__observedZoneIds?.length),
    ).toBe(eventCountWhileFrozen)
    await page.keyboard.up('ArrowRight')
    await page.getByTestId('close').click()
    await expect(viewer).not.toBeVisible()

    await walkUntilZone(page, 'ArrowRight', 'showcase-4')
    await page.keyboard.press('Space')
    await expect(viewer).toContainText('植物染布品')
    await page.screenshot({
      path: '/private/tmp/bookstore-task20-evidence/desktop-showcase-4-overlay.png',
    })
    await page.getByTestId('close').click()

    await walkUntilZone(page, 'ArrowRight', 'showcase-3')
    await page.keyboard.press('Space')
    await expect(viewer).toContainText('手作陶器')
    await page.screenshot({
      path: '/private/tmp/bookstore-task20-evidence/desktop-showcase-3-overlay.png',
    })
    await page.getByTestId('close').click()

    await walkUntilZone(page, 'ArrowRight', 'showcase-2')
    await page.keyboard.press('Space')
    await expect(viewer).toContainText('插畫明信片')
    await page.screenshot({
      path: '/private/tmp/bookstore-task20-evidence/desktop-showcase-2-overlay.png',
    })
    await page.getByTestId('close').click()

    await walkUntilZone(page, 'ArrowRight', 'showcase-1')
    await page.keyboard.press('Space')
    await expect(viewer).toContainText('手工蠟燭系列')
    await page.screenshot({
      path: '/private/tmp/bookstore-task20-evidence/desktop-showcase-1-overlay.png',
    })
    await page.getByTestId('close').click()

    await walkUntilZone(page, 'ArrowDown', 'shelf-1')
    const shelf = page.getByTestId('shelf-panel')
    await page.keyboard.press('Space')
    await expect(shelf).toBeVisible()
    await expect(shelf).toContainText('店主精選')
    await page.screenshot({
      path: '/private/tmp/bookstore-task20-evidence/desktop-shelf-1-overlay.png',
    })
    await page.keyboard.press('Escape')
    await expect(shelf).not.toBeVisible()

    await walkUntilZone(page, 'ArrowRight', 'info-1')
    const info = page.getByTestId('store-info')
    await page.keyboard.press('Space')
    await expect(info).toBeVisible()
    await expect(info).toContainText('來實體店逛逛')
    await page.screenshot({
      path: '/private/tmp/bookstore-task20-evidence/desktop-info-1-overlay.png',
    })
    await page.getByTestId('close').click()

    await expect(page.evaluate(() => window.__observedZoneIds)).resolves.toEqual([
      'showcase-5',
      'showcase-4',
      'showcase-3',
      'showcase-2',
      'showcase-1',
      'shelf-1',
      'info-1',
    ])
  } finally {
    await Promise.all([
      page.keyboard.up('ArrowDown'),
      page.keyboard.up('ArrowLeft'),
      page.keyboard.up('ArrowRight'),
      page.keyboard.up('ArrowUp'),
    ])
    await page.evaluate(() => window.__stopZoneObserver?.())
  }
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
