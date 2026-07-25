import type { Player, PlayerRatings } from '../../domain/player'
import type { Team } from '../../domain/team'
import type { DefensePlayType, OffensePlayType } from '../playbook/types'

export function avgRating(players: Player[], keys: Array<keyof PlayerRatings>): number {
  if (players.length === 0) return 50
  let total = 0
  for (const p of players) {
    for (const k of keys) total += p.ratings[k]
  }
  return total / (players.length * keys.length)
}

function byPosition(team: Team, ...positions: string[]): Player[] {
  return team.roster.filter((p) => positions.includes(p.position))
}

/** Rating in ~20-99 space representing how well the offense executes this play type. */
export function offenseRatingFor(offense: Team, playType: OffensePlayType): number {
  const oline = byPosition(offense, 'LT', 'LG', 'C', 'RG', 'RT')
  const rb = byPosition(offense, 'RB')
  const qb = byPosition(offense, 'QB')
  const receivers = byPosition(offense, 'WR', 'TE')

  const olineBlock = avgRating(oline, ['blocking', 'strength'])
  const rbRun = avgRating(rb, ['carrying', 'agility', 'speed'])
  const qbThrow = avgRating(qb, ['throwAccuracy', 'throwPower', 'awareness'])
  const receiverRun = avgRating(receivers, ['catching', 'agility', 'speed'])

  switch (playType) {
    case 'run_inside':
      return olineBlock * 0.65 + rbRun * 0.35
    case 'run_outside':
      return olineBlock * 0.35 + rbRun * 0.65
    case 'pass_short':
      return qbThrow * 0.4 + receiverRun * 0.4 + olineBlock * 0.2
    case 'pass_medium':
      return qbThrow * 0.5 + receiverRun * 0.35 + olineBlock * 0.15
    case 'pass_deep':
      return qbThrow * 0.55 + receiverRun * 0.35 + olineBlock * 0.1
    case 'play_action':
      return qbThrow * 0.35 + receiverRun * 0.3 + rbRun * 0.15 + olineBlock * 0.2
  }
}

/** Rating in ~20-99 space representing how well the defense stops this play type. */
export function defenseRatingFor(defense: Team, playType: OffensePlayType, defenseType: DefensePlayType): number {
  const dline = byPosition(defense, 'DE', 'DT')
  const lb = byPosition(defense, 'LB')
  const db = byPosition(defense, 'CB', 'S')

  const runStop = avgRating(dline, ['runDefense', 'strength']) * 0.5 + avgRating(lb, ['runDefense', 'tackling']) * 0.5
  const passStop = avgRating(db, ['coverage', 'speed']) * 0.6 + avgRating(lb, ['coverage']) * 0.4

  const isRun = playType === 'run_inside' || playType === 'run_outside'
  let base = isRun ? runStop : passStop

  // Scheme bonuses layered on top of raw personnel ratings.
  if (defenseType === 'stacked_box' && isRun) base += 8
  if (defenseType === 'stacked_box' && !isRun) base -= 6
  if (defenseType === 'pass_shell' && !isRun) base += 8
  if (defenseType === 'pass_shell' && isRun) base -= 6
  if (defenseType === 'man_press' && !isRun) base += 4
  if (defenseType === 'blitz') base += isRun ? 2 : 3 // pressure helps both, but comes with variance elsewhere

  return base
}

/** How much pass-rush pressure the defense generates (drives sack chance). */
export function pressureRating(offense: Team, defense: Team, defenseType: DefensePlayType): number {
  const oline = avgRating(byPosition(offense, 'LT', 'LG', 'C', 'RG', 'RT'), ['blocking', 'strength'])
  const rush = avgRating(byPosition(defense, 'DE', 'DT'), ['passRush', 'strength'])
  let pressure = rush - oline
  if (defenseType === 'blitz') pressure += 18
  return pressure
}

/** Squashes a rating differential into a 0-1 "advantage" for the attacking side. */
export function logisticAdvantage(diff: number, steepness = 0.07): number {
  return 1 / (1 + Math.exp(-diff * steepness))
}

/** How favorable the offensive play call is against the chosen defensive call, independent of personnel. */
export const MATCHUP_MULTIPLIER: Record<OffensePlayType, Record<DefensePlayType, number>> = {
  run_inside: { stacked_box: 0.62, balanced: 1.0, pass_shell: 1.35, blitz: 0.9, man_press: 1.05 },
  run_outside: { stacked_box: 0.88, balanced: 1.0, pass_shell: 1.25, blitz: 1.1, man_press: 1.05 },
  pass_short: { stacked_box: 1.2, balanced: 1.0, pass_shell: 0.82, blitz: 1.1, man_press: 0.85 },
  pass_medium: { stacked_box: 1.15, balanced: 1.0, pass_shell: 0.78, blitz: 0.95, man_press: 0.9 },
  pass_deep: { stacked_box: 1.3, balanced: 1.0, pass_shell: 0.6, blitz: 0.85, man_press: 1.15 },
  play_action: { stacked_box: 1.35, balanced: 1.1, pass_shell: 0.9, blitz: 0.8, man_press: 1.0 },
}
