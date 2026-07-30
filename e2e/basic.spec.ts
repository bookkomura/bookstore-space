import { test, expect, type Page } from '@playwright/test'

declare global {
  interface Window {
    __bridge: {
      emit: (event: string, payload?: unknown) => void
      on: (event: string, handler: (payload: { id: string }) => void) => () => void
    }
    __interactionRequests?: number
    __observedZoneIds?: string[]
    __activeZoneId?: string
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

test('拾字成詩以同頁全螢幕介面開啟並可關閉', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('canvas')).toBeVisible({ timeout: 10_000 })
  await page.evaluate(() => window.__bridge.emit('interact', { id: 'poem-upload-1', type: 'poemUpload' }))
  const overlay = page.getByTestId('poem-upload-overlay')
  await expect(overlay).toBeVisible()
  await expect(page.getByTestId('poem-upload-frame')).toHaveAttribute('src', 'https://paiwh-poem-display.hf.space/')
  await page.getByTestId('close').click()
  await expect(overlay).not.toBeVisible()
})

test('創作者入口常駐，最後一頁與 320px 畫面都維持穩定版面', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('canvas')).toBeVisible({ timeout: 10_000 })

  await page.evaluate(() => {
    window.__bridge.emit('interact', { id: 'showcase-1', type: 'showcase' })
  })

  const viewer = page.getByTestId('book-viewer')
  const creatorLink = page.getByTestId('creator-link')
  const layout = () => viewer.evaluate((root) => {
    const rect = (selector: string) => {
      const element = root.querySelector<HTMLElement>(selector)
      if (!element) throw new Error(`Missing BookViewer element: ${selector}`)
      const { x, y, width, height } = element.getBoundingClientRect()
      return { x, y, width, height }
    }

    return {
      header: rect('header'),
      page: rect('.page'),
      footer: rect('footer'),
    }
  })

  await expect(creatorLink).toHaveText('認識創作者')
  await expect(creatorLink).not.toHaveClass(/creator--emphasized/)
  const firstPageLayout = await layout()

  await page.getByTestId('next').click()
  await page.getByTestId('next').click()
  await expect(viewer).toContainText('3 / 3')
  await expect(creatorLink).toHaveClass(/creator--emphasized/)
  expect(await layout()).toEqual(firstPageLayout)

  await page.setViewportSize({ width: 320, height: 568 })

  const mobileHeader = await viewer.evaluate((root) => {
    const bounds = (selector: string) => {
      const element = root.querySelector<HTMLElement>(selector)
      if (!element) throw new Error(`Missing BookViewer element: ${selector}`)
      const box = element.getBoundingClientRect()
      return { left: box.left, right: box.right, width: box.width }
    }
    const title = root.querySelector<HTMLElement>('header h2')
    if (!title) throw new Error('Missing BookViewer title')

    return {
      header: bounds('header'),
      title: { ...bounds('header h2'), scrollWidth: title.scrollWidth },
      creator: bounds('[data-testid="creator-link"]'),
      close: bounds('[data-testid="close"]'),
    }
  })

  expect(mobileHeader.header.left).toBeGreaterThanOrEqual(0)
  expect(mobileHeader.header.right).toBeLessThanOrEqual(320)
  expect(mobileHeader.title.right).toBeLessThanOrEqual(mobileHeader.creator.left)
  expect(mobileHeader.creator.right).toBeLessThanOrEqual(mobileHeader.close.left)
  expect(mobileHeader.title.scrollWidth).toBeGreaterThan(mobileHeader.title.width)
  await expect(creatorLink).toHaveText('認識創作者')
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

test('檔案室固定期刊列並在桌機與手機捲動內容', async ({ page, isMobile }) => {
  test.skip(isMobile, 'desktop browser verifies the required wheel gesture at a mobile viewport')
  await page.goto('/')
  await expect(page.locator('canvas')).toBeVisible({ timeout: 10_000 })

  await page.evaluate(() => {
    window.__bridge.emit('interact', { id: 'archive-1', type: 'archive' })
  })

  const archive = page.getByTestId('newsletter-archive')
  const navigation = archive.locator('.issue-nav')
  const content = page.getByTestId('newsletter-content')
  await expect(archive).toBeVisible()

  // The sample issue is deliberately concise; test scroll containment with
  // overflow local to the actual newsletter paper rather than altering it.
  await content.evaluate((element) => {
    element.style.paddingBottom = '1200px'
  })
  const navigationTop = await navigation.evaluate((element) => element.getBoundingClientRect().top)
  const documentTop = await page.evaluate(() => window.scrollY)
  await content.evaluate((element) => element.scrollBy({ top: 240, behavior: 'instant' }))
  await expect.poll(() => content.evaluate((element) => element.scrollTop)).toBeGreaterThan(0)
  expect(await navigation.evaluate((element) => element.getBoundingClientRect().top)).toBe(navigationTop)
  expect(await page.evaluate(() => window.scrollY)).toBe(documentTop)

  await page.setViewportSize({ width: 390, height: 844 })
  await content.evaluate((element) => element.scrollTo({ top: 0, behavior: 'instant' }))
  await content.hover()
  await page.mouse.wheel(0, 360)
  await expect.poll(() => content.evaluate((element) => element.scrollTop)).toBeGreaterThan(0)
  expect(await page.evaluate(() => window.scrollY)).toBe(documentTop)
})

async function waitForZone(page: Page, id: string) {
  await expect.poll(
    () => page.evaluate((zoneId) => window.__activeZoneId === zoneId, id),
    { timeout: 8_000, intervals: [50, 100, 200] },
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

async function moveFor(
  page: Page,
  key: 'ArrowDown' | 'ArrowLeft' | 'ArrowRight' | 'ArrowUp',
  duration: number,
) {
  await page.keyboard.down(key)
  await page.waitForTimeout(duration)
  await page.keyboard.up(key)
}

test('從入口實際步行到全部七個互動點並開啟正確內容', async ({ page, isMobile }) => {
  test.skip(isMobile, 'all-seven keyboard walkthrough is desktop acceptance coverage')
  test.setTimeout(45_000)
  await page.goto('/')
  await expect(page.locator('canvas')).toBeVisible({ timeout: 10_000 })
  const configuredShowcases = await page.evaluate(async () => {
    const response = await fetch('/content.json')
    const content = await response.json() as {
      showcases: Array<{ id: string; title: string }>
    }
    return content.showcases
  })
  const showcaseWalkthrough = configuredShowcases
  // Canvas allocation precedes Phaser's scene setup; wait for the scene to
  // subscribe before starting the deterministic entrance route under parallel E2E load.
  await page.waitForTimeout(1_200)
  await page.evaluate(() => {
    window.__stopZoneObserver?.()
    window.__observedZoneIds = []
    window.__activeZoneId = undefined
    const stopEnterObserver = window.__bridge.on('zone:enter', ({ id }) => {
      window.__activeZoneId = id
      window.__observedZoneIds?.push(id)
    })
    const stopExitObserver = window.__bridge.on('zone:exit', ({ id }) => {
      if (window.__activeZoneId === id) window.__activeZoneId = undefined
    })
    window.__stopZoneObserver = () => {
      stopEnterObserver()
      stopExitObserver()
    }
  })

  try {
    const viewer = page.getByTestId('book-viewer')
    if (showcaseWalkthrough.length > 0) {
      // The entrance is to the right of the configured showcase row, so the
      // route reaches the nearest (first configured) showcase by moving left.
      await walkUntilZone(page, 'ArrowLeft', showcaseWalkthrough[0].id)

      for (const [index, showcase] of showcaseWalkthrough.entries()) {
        if (index > 0) await walkUntilZone(page, 'ArrowLeft', showcase.id)

        await page.screenshot({
          path: `/private/tmp/bookstore-task20-evidence/desktop-${showcase.id}-proximity.png`,
        })
        await page.keyboard.press('Space')
        await expect(viewer).toBeVisible()
        await expect(viewer).toContainText(showcase.title)
        await page.screenshot({
          path: `/private/tmp/bookstore-task20-evidence/desktop-${showcase.id}-overlay.png`,
        })

        if (index === 0) {
          // Holding movement during an overlay must not advance the player;
          // closing it permits traversal to the next Showcase.
          const eventCountWhileFrozen = await page.evaluate(
            () => window.__observedZoneIds?.length,
          )
          await page.keyboard.down('ArrowLeft')
          await page.waitForTimeout(350)
          await expect.poll(
            () => page.evaluate(() => window.__observedZoneIds?.length),
          ).toBe(eventCountWhileFrozen)
          await page.keyboard.up('ArrowLeft')
        }

        await page.getByTestId('close').click()
        await expect(viewer).not.toBeVisible()
      }
    } else {
      // With no Showcase zones, route from the entrance directly to the shelf.
      await page.keyboard.down('ArrowLeft')
      await page.waitForTimeout(250)
      await page.keyboard.up('ArrowLeft')
    }

    // The shelf sits below the right end of the showcase row.  Return to the
    // clear aisle first, then descend into its interaction zone.
    await moveFor(page, 'ArrowRight', 1_950)
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

    // Move above the right-side NPC before crossing to the information zone.
    await moveFor(page, 'ArrowUp', 1_000)
    await walkUntilZone(page, 'ArrowRight', 'info-1')
    const info = page.getByTestId('store-info')
    await page.keyboard.press('Space')
    await expect(info).toBeVisible()
    await expect(info).toContainText('來實體店逛逛')
    await page.screenshot({
      path: '/private/tmp/bookstore-task20-evidence/desktop-info-1-overlay.png',
    })
    await page.getByTestId('close').click()

    await expect(page.evaluate(() => [...new Set(window.__observedZoneIds)])).resolves.toEqual([
      ...showcaseWalkthrough.map((showcase) => showcase.id),
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
