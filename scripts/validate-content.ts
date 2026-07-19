import { readFileSync } from 'node:fs'
import { ContentBundleSchema } from '../src/content/schema'
import { validateContent } from '../src/content/validate'

const map = JSON.parse(readFileSync('public/assets/map.json', 'utf8'))
const raw = JSON.parse(readFileSync('public/content.json', 'utf8'))

const parsed = ContentBundleSchema.safeParse(raw)
if (!parsed.success) {
  console.error('✗ content.json 格式錯誤：')
  for (const issue of parsed.error.issues) console.error(`  - ${issue.path.join('.')}: ${issue.message}`)
  process.exit(1)
}

const errors = validateContent(map, parsed.data)
if (errors.length > 0) {
  console.error('✗ 內容驗證失敗：')
  for (const e of errors) console.error(`  - ${e}`)
  process.exit(1)
}
console.log('✓ 內容驗證通過')
