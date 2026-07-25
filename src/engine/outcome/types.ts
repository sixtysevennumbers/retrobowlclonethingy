export type PlayResultType =
  | 'run' | 'pass' | 'sack' | 'incomplete' | 'interception' | 'fumble' | 'touchdown' | 'penalty'

/** A timed cue the physics layer uses as a waypoint/trigger while animating the play. */
export interface PlayEvent {
  atSec: number
  kind: 'snap' | 'handoff' | 'throw' | 'catch' | 'tackle' | 'sack' | 'out_of_bounds'
}

export interface PlayOutcome {
  type: PlayResultType
  /** Net yards gained by the offense (negative for losses/sacks). */
  yards: number
  timeElapsedSec: number
  ballCarrierId: string
  targetReceiverId?: string
  primaryDefenderId?: string
  breakdownEvents: PlayEvent[]
}

export interface PlaySituation {
  down: 1 | 2 | 3 | 4
  distance: number
  ownGoalDistance: number
  opponentGoalDistance: number
}
