import type { Player } from './player'

export interface Team {
  id: string
  name: string
  abbreviation: string
  roster: Player[]
}

export function starterAt(team: Team, position: Player['position'], index = 0): Player {
  const players = team.roster.filter((p) => p.position === position)
  const player = players[index]
  if (!player) {
    throw new Error(`No player at position ${position}[${index}] on team ${team.name}`)
  }
  return player
}
