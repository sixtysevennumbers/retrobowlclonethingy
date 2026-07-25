import type { Vec2 } from '../physics/steering'

export type OffensePlayType =
  | 'run_inside' | 'run_outside' | 'pass_short' | 'pass_medium' | 'pass_deep' | 'play_action'

export type DefensePlayType =
  | 'stacked_box' | 'balanced' | 'pass_shell' | 'blitz' | 'man_press'

/** A freehand-drawn path for one formation slot, in play-local yards (LOS at y=0). */
export interface DrawnRoute {
  slotKey: string
  points: Vec2[]
}

export interface CustomOffenseData {
  kind: 'run' | 'pass'
  routes: DrawnRoute[]
  /** run: which drawn route carries the ball, defaults to 'RB:0' */
  ballCarrierSlot?: string
  /** pass: which drawn route is the throw target (required to save a pass play) */
  targetSlot?: string
}

export interface DefenseAssignment {
  slotKey: string
  kind: 'rush' | 'cover' | 'zone'
  points: Vec2[]
  /** cover: which offensive slot this defender tracks man-to-man */
  coverSlot?: string
}

export interface CustomDefenseData {
  assignments: DefenseAssignment[]
}

export interface OffensePlay {
  id: string
  name: string
  type: OffensePlayType
  formation: string
  description: string
  custom?: CustomOffenseData
}

export interface DefensePlay {
  id: string
  name: string
  type: DefensePlayType
  description: string
  custom?: CustomDefenseData
}
