import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { mapStoriesToBundle } from '../src/content/storyblok'

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

const { stories } = (await response.json()) as { stories: unknown[] }
const bundle = mapStoriesToBundle(stories)
writeFileSync('public/content.json', JSON.stringify(bundle, null, 2))
console.log(`✓ 已從 Storyblok 抓取 ${bundle.showcases.length} 個展示櫃、${bundle.shelves.length} 個書櫃`)
