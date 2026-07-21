import { readFileSync } from 'node:fs'
import { ContentBundleSchema } from '../src/content/schema'
import { validateContent } from '../src/content/validate'
import { buildInteractionZones } from '../src/game/sceneLayout'

const raw = JSON.parse(readFileSync('public/content.json', 'utf8'))
const parsed = ContentBundleSchema.safeParse(raw)

if (!parsed.success) {
  console.error('✗ content.json 格式錯誤：')
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join('.')}: ${issue.message}`)
  }
  process.exit(1)
}

const errors = validateContent(
  buildInteractionZones(parsed.data.showcases),
  parsed.data,
)
if (errors.length > 0) {
  console.error('✗ 內容驗證失敗：')
  for (const error of errors) console.error(`  - ${error}`)
  process.exit(1)
}

console.log('✓ 內容驗證通過')
