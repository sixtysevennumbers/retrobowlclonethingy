import { describe, expect, it } from 'vitest'
import { generateTeam } from '../../data/rosterGenerator'
import { mulberry32 } from '../rng'
import { DEFENSE_PLAYBOOK } from '../playbook/defensePlays'
import { OFFENSE_PLAYBOOK } from '../playbook/offensePlays'
import { resolvePlay } from './resolvePlay'
import type { PlaySituation } from './types'

const situation: PlaySituation = { down: 1, distance: 10, ownGoalDistance: 50, opponentGoalDistance: 50 }

function play(id: string) {
  return OFFENSE_PLAYBOOK.find((p) => p.id === id)!
}
function defPlay(id: string) {
  return DEFENSE_PLAYBOOK.find((p) => p.id === id)!
}

function meanYards(offenseId: string, defenseId: string, trials = 400, seed = 1) {
  const rng = mulberry32(seed)
  const offense = generateTeam(rng, 'o', 'Offense', 'OFF', 55)
  const defense = generateTeam(rng, 'd', 'Defense', 'DEF', 55)
  let total = 0
  for (let i = 0; i < trials; i++) {
    const outcome = resolvePlay(rng, offense, defense, play(offenseId), defPlay(defenseId), situation)
    total += outcome.yards
  }
  return total / trials
}

describe('resolvePlay', () => {
  it('never throws and always returns a valid outcome shape', () => {
    const rng = mulberry32(42)
    const offense = generateTeam(rng, 'o', 'Offense', 'OFF', 55)
    const defense = generateTeam(rng, 'd', 'Defense', 'DEF', 55)
    for (let i = 0; i < 500; i++) {
      const off = OFFENSE_PLAYBOOK[i % OFFENSE_PLAYBOOK.length]
      const def = DEFENSE_PLAYBOOK[(i * 3) % DEFENSE_PLAYBOOK.length]
      const outcome = resolvePlay(rng, offense, defense, off, def, situation)
      expect(outcome.ballCarrierId).toBeTruthy()
      expect(Number.isFinite(outcome.yards)).toBe(true)
      expect(outcome.breakdownEvents.length).toBeGreaterThan(0)
    }
  })

  it('stacked box suppresses inside runs more than a pass-heavy shell defense', () => {
    const vsStack = meanYards('iso', 'stack')
    const vsShell = meanYards('iso', 'shell')
    expect(vsStack).toBeLessThan(vsShell)
  })

  it('pass shell suppresses deep shots more than a stacked box', () => {
    const vsShell = meanYards('shot', 'shell')
    const vsStack = meanYards('shot', 'stack')
    expect(vsShell).toBeLessThan(vsStack)
  })

  it('caps yardage at the goal line and scores a touchdown', () => {
    const rng = mulberry32(7)
    const offense = generateTeam(rng, 'o', 'Offense', 'OFF', 90)
    const defense = generateTeam(rng, 'd', 'Defense', 'DEF', 20)
    const goalLineSituation: PlaySituation = { down: 1, distance: 2, ownGoalDistance: 98, opponentGoalDistance: 2 }
    let sawTouchdown = false
    for (let i = 0; i < 200; i++) {
      const outcome = resolvePlay(rng, offense, defense, play('iso'), defPlay('base'), goalLineSituation)
      expect(outcome.yards).toBeLessThanOrEqual(2)
      if (outcome.type === 'touchdown') sawTouchdown = true
    }
    expect(sawTouchdown).toBe(true)
  })

  it('blitzing increases sack rate compared to a balanced defense', () => {
    const rng = mulberry32(3)
    const offense = generateTeam(rng, 'o', 'Offense', 'OFF', 50)
    const defense = generateTeam(rng, 'd', 'Defense', 'DEF', 50)
    let sacksBlitz = 0
    let sacksBase = 0
    const trials = 500
    for (let i = 0; i < trials; i++) {
      if (resolvePlay(rng, offense, defense, play('crossers'), defPlay('blitz'), situation).type === 'sack') sacksBlitz++
      if (resolvePlay(rng, offense, defense, play('crossers'), defPlay('base'), situation).type === 'sack') sacksBase++
    }
    expect(sacksBlitz).toBeGreaterThan(sacksBase)
  })
})
