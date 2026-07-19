import { WORLD_SIZE } from './sceneLayout'

export function calculateCameraZoom(
  viewportWidth: number,
  viewportHeight: number,
  isTouch: boolean,
): number {
  if (
    !Number.isFinite(viewportWidth)
    || !Number.isFinite(viewportHeight)
    || viewportWidth <= 0
    || viewportHeight <= 0
  ) return 1

  const cover = Math.max(
    viewportWidth / WORLD_SIZE.width,
    viewportHeight / WORLD_SIZE.height,
  )

  return isTouch ? Math.max(1, cover) : Math.max(0.65, cover)
}
