import type { ContentBundle } from '../content/schema'

export type InteractionLabels = Readonly<Record<string, string>>

export function buildInteractionLabels(
  content: ContentBundle,
): InteractionLabels {
  return Object.freeze({
    ...Object.fromEntries(
      content.showcases.map((showcase) => [showcase.id, showcase.title]),
    ),
    ...Object.fromEntries(
      content.shelves.map((shelf) => [shelf.id, shelf.title]),
    ),
    'info-1': '營業資訊',
    'archive-1': '小村碎碎念',
  })
}

export function formatMarkerLabel(title: string): string {
  const characters = Array.from(title.trim())
  if (characters.length <= 10) return characters.join('')
  const first = characters.slice(0, 10).join('')
  if (characters.length <= 20) {
    return `${first}\n${characters.slice(10).join('')}`
  }
  return `${first}\n${characters.slice(10, 19).join('')}…`
}
