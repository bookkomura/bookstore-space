export function computeVelocity(dir: { x: number; y: number }, speed: number): { x: number; y: number } {
  const len = Math.hypot(dir.x, dir.y)
  if (len === 0) return { x: 0, y: 0 }

  const magnitude = Math.min(len, 1)
  return { x: (dir.x / len) * magnitude * speed, y: (dir.y / len) * magnitude * speed }
}
