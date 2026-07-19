import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { mapStoriesToBundle } from '../src/content/storyblok'
import type { ContentBundle } from '../src/content/schema'

mkdirSync('public', { recursive: true })
const token = process.env.STORYBLOK_TOKEN

if (!token) {
  copyFileSync('scripts/sample-content.json', 'public/content.json')
  console.log('✓ 無 STORYBLOK_TOKEN，使用 sample content')
  process.exit(0)
}

const url = `https://api.storyblok.com/v2/cdn/stories?version=published&per_page=100&token=${token}`
const response = await fetch(url)
if (!response.ok) {
  console.error(`✗ Storyblok API 失敗：${response.status}`)
  process.exit(1)
}

const payload: unknown = await response.json()
const stories =
  typeof payload === 'object' && payload !== null && !Array.isArray(payload)
    ? (payload as Record<string, unknown>).stories
    : undefined

let bundle: ContentBundle
try {
  bundle = mapStoriesToBundle(stories as unknown[])
} catch (error) {
  const message = error instanceof Error ? error.message : '未知 CMS 內容錯誤'
  console.error(`✗ ${message}`)
  process.exit(1)
}

writeFileSync('public/content.json', JSON.stringify(bundle, null, 2))
console.log(`✓ 已從 Storyblok 抓取 ${bundle.showcases.length} 個展示櫃、${bundle.shelves.length} 個書櫃`)
