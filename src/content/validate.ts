import { parseInteractionZones } from '../game/mapParser'
import type { ContentBundle } from './schema'

export function validateContent(mapJson: unknown, content: ContentBundle): string[] {
  const errors: string[] = []
  const zones = parseInteractionZones(mapJson)

  const showcaseIds = new Set(content.showcases.map((s) => s.id))
  const shelfIds = new Set(content.shelves.map((s) => s.id))

  for (const z of zones) {
    if (z.type === 'showcase' && !showcaseIds.has(z.id))
      errors.push(`地圖互動點 ${z.id}（showcase）在 CMS 找不到對應內容`)
    if (z.type === 'shelf' && !shelfIds.has(z.id))
      errors.push(`地圖互動點 ${z.id}（shelf）在 CMS 找不到對應內容`)
  }

  const zoneIds = new Set(zones.map((z) => z.id))
  for (const s of content.showcases)
    if (!zoneIds.has(s.id)) errors.push(`CMS Showcase「${s.title}」(${s.id}) 在地圖上沒有互動點`)
  for (const s of content.shelves)
    if (!zoneIds.has(s.id)) errors.push(`CMS Shelf「${s.title}」(${s.id}) 在地圖上沒有互動點`)

  return errors
}
