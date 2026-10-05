import type { CropPosition } from '../types/index.ts'

export const defaultCropPosition = (): CropPosition => ({ x: 0.5, y: 0.5 })
export function normalizeCropPosition(position?: CropPosition): CropPosition {
  const clamp = (value: number | undefined) => value !== undefined && Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0.5
  return { x: clamp(position?.x), y: clamp(position?.y) }
}
