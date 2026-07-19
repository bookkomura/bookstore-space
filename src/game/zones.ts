export type ZoneType = 'showcase' | 'shelf' | 'info'

export interface Zone {
  id: string
  type: ZoneType
  x: number
  y: number
  width: number
  height: number
}

export function findZone(px: number, py: number, zones: Zone[]): Zone | null {
  for (const z of zones) {
    if (px >= z.x && px <= z.x + z.width && py >= z.y && py <= z.y + z.height) return z
  }
  return null
}
