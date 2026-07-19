import type { Zone, ZoneType } from './zones'

const ZONE_TYPES: ZoneType[] = ['showcase', 'shelf', 'info']

interface TiledObject {
  name: string
  x: number
  y: number
  width: number
  height: number
  properties?: { name: string; value: unknown }[]
}

export function parseInteractionZones(mapJson: unknown): Zone[] {
  const map = mapJson as { layers?: { type: string; name: string; objects?: TiledObject[] }[] }
  const layer = map.layers?.find((l) => l.type === 'objectgroup' && l.name === 'interactions')
  if (!layer) throw new Error('地圖缺少 interactions object layer')

  return (layer.objects ?? []).map((obj) => {
    const typeProp = obj.properties?.find((p) => p.name === 'type')?.value
    if (!ZONE_TYPES.includes(typeProp as ZoneType)) {
      throw new Error(`互動點 ${obj.name} 缺少合法的 type 屬性（showcase/shelf/info）`)
    }
    return {
      id: obj.name,
      type: typeProp as ZoneType,
      x: obj.x,
      y: obj.y,
      width: obj.width,
      height: obj.height,
    }
  })
}
