export type Facing = 'down' | 'left' | 'right' | 'up'

const ROW_START: Record<Facing, number> = {
  down: 0,
  left: 4,
  right: 8,
  up: 12,
}

export function facingFromVelocity(
  vx: number,
  vy: number,
  previous: Facing,
): Facing {
  if (vx === 0 && vy === 0) return previous
  if (Math.abs(vx) > Math.abs(vy)) return vx < 0 ? 'left' : 'right'
  return vy < 0 ? 'up' : 'down'
}

export function idleFrame(facing: Facing): number {
  return ROW_START[facing]
}

export function walkAnimation(facing: Facing): string {
  return `walk-${facing}`
}

export function walkFrames(facing: Facing): number[] {
  const start = ROW_START[facing]
  return [start + 1, start + 2, start + 3, start + 2]
}
