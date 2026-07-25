export type Position =
  | 'QB' | 'RB' | 'WR' | 'TE'
  | 'LT' | 'LG' | 'C' | 'RG' | 'RT'
  | 'DE' | 'DT' | 'LB' | 'CB' | 'S'

export const OFFENSE_POSITIONS: Position[] = [
  'QB', 'RB', 'WR', 'WR', 'WR', 'TE', 'LT', 'LG', 'C', 'RG', 'RT',
]

export const DEFENSE_POSITIONS: Position[] = [
  'DE', 'DT', 'DT', 'DE', 'LB', 'LB', 'LB', 'CB', 'CB', 'S', 'S',
]

/** 0-99 scale, Retro-Bowl style. Not every rating applies to every position. */
export interface PlayerRatings {
  speed: number
  acceleration: number
  agility: number
  strength: number
  awareness: number
  throwPower: number
  throwAccuracy: number
  catching: number
  carrying: number
  blocking: number
  passRush: number
  runDefense: number
  coverage: number
  tackling: number
}

export interface Player {
  id: string
  name: string
  position: Position
  number: number
  age: number
  ratings: PlayerRatings
  overall: number
}

const POSITION_WEIGHTS: Partial<Record<keyof PlayerRatings, number>> & Record<string, number> = {}

/** Which ratings matter for computing `overall`, per position. */
function weightsFor(position: Position): Partial<Record<keyof PlayerRatings, number>> {
  switch (position) {
    case 'QB':
      return { throwPower: 0.25, throwAccuracy: 0.35, awareness: 0.25, agility: 0.15 }
    case 'RB':
      return { speed: 0.25, acceleration: 0.2, carrying: 0.3, agility: 0.15, strength: 0.1 }
    case 'WR':
    case 'TE':
      return { speed: 0.25, catching: 0.35, agility: 0.2, awareness: 0.1, blocking: 0.1 }
    case 'LT':
    case 'LG':
    case 'C':
    case 'RG':
    case 'RT':
      return { blocking: 0.5, strength: 0.3, awareness: 0.2 }
    case 'DE':
    case 'DT':
      return { passRush: 0.35, runDefense: 0.35, strength: 0.2, awareness: 0.1 }
    case 'LB':
      return { runDefense: 0.3, tackling: 0.3, coverage: 0.2, awareness: 0.2 }
    case 'CB':
    case 'S':
      return { coverage: 0.4, speed: 0.3, tackling: 0.2, awareness: 0.1 }
    default:
      return POSITION_WEIGHTS
  }
}

export function computeOverall(position: Position, ratings: PlayerRatings): number {
  const weights = weightsFor(position)
  let total = 0
  let weightSum = 0
  for (const [key, weight] of Object.entries(weights)) {
    total += ratings[key as keyof PlayerRatings] * (weight ?? 0)
    weightSum += weight ?? 0
  }
  return Math.round(weightSum > 0 ? total / weightSum : 50)
}
