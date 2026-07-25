import type { Player, Position } from '../../domain/player'
import type { Team } from '../../domain/team'
import type { DefensePlayType } from '../playbook/types'
import type { Vec2 } from './steering'

export type TeamSide = 'offense' | 'defense'

export interface Actor {
  id: string
  side: TeamSide
  position: Position
  start: Vec2
  player: Player
}

/** Base offensive slot layout (play-local yards, LOS at y=0, offense advances toward +y). */
const OFFENSE_SLOTS: Array<{ position: Position; occurrence: number; x: number; y: number }> = [
  { position: 'QB', occurrence: 0, x: 0, y: -2.2 },
  { position: 'RB', occurrence: 0, x: -3, y: -4.5 },
  { position: 'WR', occurrence: 0, x: -22, y: 0 },
  { position: 'WR', occurrence: 1, x: 14, y: 0 },
  { position: 'WR', occurrence: 2, x: 20, y: 0 },
  { position: 'TE', occurrence: 0, x: 11, y: 0 },
  { position: 'LT', occurrence: 0, x: -8, y: 0 },
  { position: 'LG', occurrence: 0, x: -4, y: 0 },
  { position: 'C', occurrence: 0, x: 0, y: 0 },
  { position: 'RG', occurrence: 0, x: 4, y: 0 },
  { position: 'RT', occurrence: 0, x: 8, y: 0 },
]

function defenseSlots(scheme: DefensePlayType): Array<{ position: Position; occurrence: number; x: number; y: number }> {
  const lbDepth = scheme === 'stacked_box' ? 3.5 : scheme === 'pass_shell' ? 8 : 5
  const safetyDepth = scheme === 'stacked_box' ? 7 : scheme === 'pass_shell' ? 15 : 11
  const cbDepth = scheme === 'man_press' ? 0.8 : scheme === 'pass_shell' ? 9 : 6
  const safety0X = scheme === 'stacked_box' ? 0 : -8

  return [
    { position: 'DE', occurrence: 0, x: -6, y: 1.2 },
    { position: 'DT', occurrence: 0, x: -2, y: 1.2 },
    { position: 'DT', occurrence: 1, x: 2, y: 1.2 },
    { position: 'DE', occurrence: 1, x: 6, y: 1.2 },
    { position: 'LB', occurrence: 0, x: -6, y: lbDepth },
    { position: 'LB', occurrence: 1, x: 0, y: lbDepth },
    { position: 'LB', occurrence: 2, x: 6, y: lbDepth },
    { position: 'CB', occurrence: 0, x: scheme === 'man_press' ? -22 : -20, y: cbDepth },
    { position: 'CB', occurrence: 1, x: scheme === 'man_press' ? 20 : 20, y: cbDepth },
    { position: 'S', occurrence: 0, x: safety0X, y: safetyDepth },
    { position: 'S', occurrence: 1, x: 8, y: safetyDepth },
  ]
}

function assignSlots(
  team: Team,
  side: TeamSide,
  slots: Array<{ position: Position; occurrence: number; x: number; y: number }>,
): Actor[] {
  const occurrenceCounters = new Map<Position, number>()
  const actors: Actor[] = []
  for (const slot of slots) {
    const count = occurrenceCounters.get(slot.position) ?? 0
    const candidates = team.roster.filter((p) => p.position === slot.position)
    const player = candidates[slot.occurrence] ?? candidates[0]
    occurrenceCounters.set(slot.position, count + 1)
    if (!player) continue
    actors.push({ id: player.id, side, position: slot.position, start: { x: slot.x, y: slot.y }, player })
  }
  return actors
}

export function buildOffenseActors(offense: Team): Actor[] {
  return assignSlots(offense, 'offense', OFFENSE_SLOTS)
}

export function buildDefenseActors(defense: Team, scheme: DefensePlayType): Actor[] {
  return assignSlots(defense, 'defense', defenseSlots(scheme))
}

/** Greedily pairs each blocker with the nearest (by x) not-yet-assigned front defender. */
export function pairBlockers(blockers: Actor[], defenders: Actor[]): Map<string, string> {
  const remaining = [...defenders]
  const pairs = new Map<string, string>()
  for (const blocker of [...blockers].sort((a, b) => a.start.x - b.start.x)) {
    if (remaining.length === 0) break
    let closest = remaining[0]
    let closestDist = Math.abs(closest.start.x - blocker.start.x)
    for (const d of remaining) {
      const dist = Math.abs(d.start.x - blocker.start.x)
      if (dist < closestDist) {
        closest = d
        closestDist = dist
      }
    }
    pairs.set(blocker.id, closest.id)
    remaining.splice(remaining.indexOf(closest), 1)
  }
  return pairs
}
