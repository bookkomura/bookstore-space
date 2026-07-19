export function joystickVector(
  origin: { x: number; y: number },
  current: { x: number; y: number },
  radius: number,
): { x: number; y: number } {
  const dx = current.x - origin.x
  const dy = current.y - origin.y
  const len = Math.hypot(dx, dy)
  if (len === 0) return { x: 0, y: 0 }

  const clamped = Math.min(len, radius)
  return { x: (dx / len) * (clamped / radius), y: (dy / len) * (clamped / radius) }
}
