import { computeOverall, DEFENSE_POSITIONS, OFFENSE_POSITIONS, type Player, type PlayerRatings, type Position } from '../domain/player'
import type { Team } from '../domain/team'
import { clamp, pick, randInt, randNormalish, type Rng } from '../engine/rng'
import { FIRST_NAMES, LAST_NAMES } from './names'

function randomRatings(rng: Rng, strength: number): PlayerRatings {
  const r = () => Math.round(clamp(randNormalish(rng, strength, 14), 20, 99))
  return {
    speed: r(),
    acceleration: r(),
    agility: r(),
    strength: r(),
    awareness: r(),
    throwPower: r(),
    throwAccuracy: r(),
    catching: r(),
    carrying: r(),
    blocking: r(),
    passRush: r(),
    runDefense: r(),
    coverage: r(),
    tackling: r(),
  }
}

function generatePlayer(rng: Rng, position: Position, number: number, teamStrength: number): Player {
  const ratings = randomRatings(rng, teamStrength)
  return {
    id: `${position}-${number}-${Math.floor(rng() * 1e9).toString(36)}`,
    name: `${pick(rng, FIRST_NAMES)} ${pick(rng, LAST_NAMES)}`,
    position,
    number,
    age: randInt(rng, 21, 34),
    ratings,
    overall: computeOverall(position, ratings),
  }
}

const usedNumbers = new Set<number>()

function nextJerseyNumber(rng: Rng, position: Position): number {
  const ranges: Partial<Record<Position, [number, number]>> = {
    QB: [1, 19], RB: [20, 49], WR: [10, 19], TE: [40, 49],
    LT: [70, 79], LG: [60, 69], C: [50, 59], RG: [60, 69], RT: [70, 79],
    DE: [90, 99], DT: [90, 99], LB: [50, 59], CB: [20, 39], S: [20, 39],
  }
  const [min, max] = ranges[position] ?? [1, 99]
  let n = randInt(rng, min, max)
  let guard = 0
  while (usedNumbers.has(n) && guard < 50) {
    n = randInt(rng, min, max)
    guard++
  }
  usedNumbers.add(n)
  return n
}

/** Generates a full 22-starter roster (11 offense + 11 defense). `strength` is a 20-90 team-quality baseline. */
export function generateTeam(rng: Rng, id: string, name: string, abbreviation: string, strength = 55): Team {
  usedNumbers.clear()
  const roster: Player[] = [
    ...OFFENSE_POSITIONS.map((pos) => generatePlayer(rng, pos, nextJerseyNumber(rng, pos), strength)),
    ...DEFENSE_POSITIONS.map((pos) => generatePlayer(rng, pos, nextJerseyNumber(rng, pos), strength)),
  ]
  return { id, name, abbreviation, roster }
}
