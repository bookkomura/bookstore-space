import type { Zone } from './zones'

export interface Point {
  x: number
  y: number
}

export interface CollisionRect {
  id: string
  x: number
  y: number
  width: number
  height: number
}

export const WORLD_SIZE = { width: 1572, height: 1001 } as const
export const PLAYER_SPAWN: Point = { x: 1205, y: 250 }

export const COLLISION_RECTS: readonly CollisionRect[] = [
  { id: 'wall-top', x: 40, y: 17, width: 1492, height: 40 },
  { id: 'wall-bottom', x: 40, y: 944, width: 1492, height: 40 },
  { id: 'wall-left', x: 40, y: 17, width: 32, height: 967 },
  { id: 'wall-right', x: 1494, y: 17, width: 38, height: 967 },
  { id: 'stairs', x: 68, y: 54, width: 169, height: 284 },
  { id: 'shelves-top', x: 322, y: 55, width: 794, height: 216 },
  { id: 'shelves-left', x: 65, y: 333, width: 124, height: 611 },
  { id: 'counter-right', x: 1300, y: 278, width: 190, height: 666 },
  { id: 'table-center', x: 407, y: 334, width: 585, height: 205 },
  { id: 'chairs-center', x: 454, y: 510, width: 506, height: 78 },
  { id: 'table-lower-left', x: 235, y: 651, width: 240, height: 232 },
  { id: 'table-lower-middle', x: 612, y: 651, width: 260, height: 258 },
  { id: 'table-lower-right', x: 981, y: 651, width: 253, height: 232 },
  { id: 'npc-left', x: 198, y: 400, width: 75, height: 126 },
  { id: 'npc-right', x: 1228, y: 401, width: 68, height: 137 },
] as const

export const MAX_SHOWCASE_SLOTS = 10
export const SHOWCASE_SLOT_ANCHORS = [
  1057, 981, 905, 828, 746, 668, 590, 512, 434, 356,
] as const

type ShowcaseReference = Readonly<{ id: string }>

export const STATIC_INTERACTION_ZONES: readonly Zone[] = [
  {
    id: 'shelf-1', type: 'shelf',
    x: 1020, y: 360, width: 170, height: 160,
    anchorX: 950, anchorY: 412,
  },
  {
    id: 'info-1', type: 'info',
    x: 1208, y: 285, width: 92, height: 285,
    anchorX: 1324, anchorY: 300,
  },
  {
    id: 'archive-1', type: 'archive',
    x: 200, y: 510, width: 72, height: 160,
    anchorX: 140, anchorY: 550,
  },
] as const

export function buildInteractionZones(
  showcases: readonly ShowcaseReference[],
): readonly Zone[] {
  if (showcases.length > MAX_SHOWCASE_SLOTS) {
    throw new RangeError(`Showcase 最多只能設定 ${MAX_SHOWCASE_SLOTS} 筆`)
  }

  return [
    ...showcases.map((showcase, index) => ({
      id: showcase.id,
      type: 'showcase' as const,
      x: SHOWCASE_SLOT_ANCHORS[index] - 36,
      y: 270,
      width: 72,
      height: 64,
      anchorX: SHOWCASE_SLOT_ANCHORS[index],
      anchorY: 163,
    })),
    ...STATIC_INTERACTION_ZONES,
  ]
}

export const INTERACTION_ZONES = buildInteractionZones([
  { id: 'showcase-1' },
  { id: 'showcase-2' },
  { id: 'showcase-3' },
  { id: 'showcase-4' },
  { id: 'showcase-5' },
])
