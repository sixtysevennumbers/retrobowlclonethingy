export type OffensePlayType =
  | 'run_inside' | 'run_outside' | 'pass_short' | 'pass_medium' | 'pass_deep' | 'play_action'

export type DefensePlayType =
  | 'stacked_box' | 'balanced' | 'pass_shell' | 'blitz' | 'man_press'

export interface OffensePlay {
  id: string
  name: string
  type: OffensePlayType
  formation: string
  description: string
}

export interface DefensePlay {
  id: string
  name: string
  type: DefensePlayType
  description: string
}
