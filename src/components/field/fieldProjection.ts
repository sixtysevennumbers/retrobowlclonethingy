import { FIELD_WIDTH_YD } from '../../engine/physics/world'

/** Shared play-local-yards <-> canvas-pixels mapping, used by both the live FieldCanvas
 *  renderer and the play editor, so routes drawn in the editor land exactly where the
 *  physics engine will actually simulate them (LOS at y=0, offense advances toward +y). */
export const PX_PER_YARD = 9
export const LOCAL_Y_MIN = -8
export const LOCAL_Y_MAX = 48
export const CANVAS_WIDTH = Math.round(FIELD_WIDTH_YD * PX_PER_YARD)
export const CANVAS_HEIGHT = Math.round((LOCAL_Y_MAX - LOCAL_Y_MIN) * PX_PER_YARD)

export function toCanvas(x: number, y: number): [number, number] {
  const cx = (x + FIELD_WIDTH_YD / 2) * PX_PER_YARD
  const cy = CANVAS_HEIGHT - (y - LOCAL_Y_MIN) * PX_PER_YARD
  return [cx, cy]
}

export function fromCanvas(cx: number, cy: number): { x: number; y: number } {
  const x = cx / PX_PER_YARD - FIELD_WIDTH_YD / 2
  const y = (CANVAS_HEIGHT - cy) / PX_PER_YARD + LOCAL_Y_MIN
  return { x, y }
}
