export type ZoneType = 'showcase' | 'shelf' | 'info' | 'archive'

export interface Zone {
  id: string
  type: ZoneType
  x: number
  y: number
  width: number
  height: number
  anchorX: number
  anchorY: number
}

function contains(px: number, py: number, zone: Zone): boolean {
  return px >= zone.x
    && px <= zone.x + zone.width
    && py >= zone.y
    && py <= zone.y + zone.height
}

export function findNearestZone(
  px: number,
  py: number,
  zones: readonly Zone[],
): Zone | null {
  let nearest: Zone | null = null
  let nearestDistance = Number.POSITIVE_INFINITY

  for (const zone of zones) {
    if (!contains(px, py, zone)) continue
    const distance = (px - zone.anchorX) ** 2 + (py - zone.anchorY) ** 2
    if (distance < nearestDistance) {
      nearest = zone
      nearestDistance = distance
    }
  }

  return nearest
}

export function findZone(px: number, py: number, zones: readonly Zone[]): Zone | null {
  return findNearestZone(px, py, zones)
}
