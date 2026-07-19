import type { Zone } from '../game/zones'
import type { ContentBundle } from './schema'

function duplicates(ids: readonly string[]): string[] {
  const seen = new Set<string>()
  const repeated = new Set<string>()
  for (const id of ids) {
    if (seen.has(id)) repeated.add(id)
    seen.add(id)
  }
  return [...repeated]
}

export function validateContent(
  zones: readonly Zone[],
  content: ContentBundle,
): string[] {
  const errors: string[] = []
  const zoneIds = zones.map((zone) => zone.id)
  const showcaseZoneIds = zones
    .filter((zone) => zone.type === 'showcase')
    .map((zone) => zone.id)
  const shelfZoneIds = zones
    .filter((zone) => zone.type === 'shelf')
    .map((zone) => zone.id)
  const showcaseIds = content.showcases.map((item) => item.id)
  const shelfIds = content.shelves.map((item) => item.id)

  for (const id of duplicates(zoneIds)) errors.push(`場景互動點 id 重複：${id}`)
  for (const id of duplicates(showcaseIds)) errors.push(`CMS Showcase id 重複：${id}`)
  for (const id of duplicates(shelfIds)) errors.push(`CMS Shelf id 重複：${id}`)

  const showcaseSet = new Set(showcaseIds)
  const shelfSet = new Set(shelfIds)
  const showcaseZoneSet = new Set(showcaseZoneIds)
  const shelfZoneSet = new Set(shelfZoneIds)

  for (const zone of zones) {
    if (zone.type === 'showcase' && !showcaseSet.has(zone.id)) {
      errors.push(`場景互動點 ${zone.id}（showcase）在 CMS 找不到對應內容`)
    }
    if (zone.type === 'shelf' && !shelfSet.has(zone.id)) {
      errors.push(`場景互動點 ${zone.id}（shelf）在 CMS 找不到對應內容`)
    }
  }

  for (const showcase of content.showcases) {
    if (!showcaseZoneSet.has(showcase.id)) {
      errors.push(`CMS Showcase「${showcase.title}」(${showcase.id}) 在場景沒有互動點`)
    }
  }
  for (const shelf of content.shelves) {
    if (!shelfZoneSet.has(shelf.id)) {
      errors.push(`CMS Shelf「${shelf.title}」(${shelf.id}) 在場景沒有互動點`)
    }
  }

  const infoZones = zones.filter((zone) => zone.type === 'info')
  if (infoZones.length !== 1 || infoZones[0]?.id !== 'info-1') {
    errors.push('場景必須包含唯一的 info-1 營業資訊互動點')
  }

  return errors
}
