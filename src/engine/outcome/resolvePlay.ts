import type { Player } from '../../domain/player'
import type { Team } from '../../domain/team'
import type { Rng } from '../rng'
import { clamp, pick, randInt, randNormalish } from '../rng'
import type { DefensePlay, OffensePlay } from '../playbook/types'
import { defenseRatingFor, logisticAdvantage, MATCHUP_MULTIPLIER, offenseRatingFor, pressureRating } from './ratingsMath'
import type { PlayOutcome, PlaySituation } from './types'

function byPos(team: Team, ...positions: string[]): Player[] {
  return team.roster.filter((p) => positions.includes(p.position))
}

function fumbleChance(advantage: number): number {
  return clamp(0.025 - advantage * 0.015, 0.006, 0.03)
}

/** Caps yards at the goal line and flips the result to a touchdown if reached. */
function applyGoalLine(type: 'run' | 'pass', yards: number, opponentGoalDistance: number): { type: PlayOutcome['type']; yards: number } {
  if (yards >= opponentGoalDistance) {
    return { type: 'touchdown', yards: opponentGoalDistance }
  }
  return { type, yards }
}

export interface ResolvePlayOptions {
  /** Force the pass target to a specific player (e.g. the receiver the user drew as the target) instead of a random pick. */
  preferredTargetId?: string
}

export function resolvePlay(
  rng: Rng,
  offense: Team,
  defense: Team,
  offensePlay: OffensePlay,
  defensePlay: DefensePlay,
  situation: PlaySituation,
  options?: ResolvePlayOptions,
): PlayOutcome {
  const isRun = offensePlay.type === 'run_inside' || offensePlay.type === 'run_outside'

  const offRating = offenseRatingFor(offense, offensePlay.type)
  const defRating = defenseRatingFor(defense, offensePlay.type, defensePlay.type)
  const matchupMult = MATCHUP_MULTIPLIER[offensePlay.type][defensePlay.type]
  const advantage = logisticAdvantage(offRating * matchupMult - defRating)

  const qb = byPos(offense, 'QB')[0]
  const rb = byPos(offense, 'RB')[0]
  const receivers = byPos(offense, 'WR', 'TE')
  const dline = byPos(defense, 'DE', 'DT')
  const lb = byPos(defense, 'LB')
  const db = byPos(defense, 'CB', 'S')

  if (isRun) {
    const meanYards = -1.5 + advantage * 7
    const spread = offensePlay.type === 'run_outside' ? 5.5 : 4
    let yards = Math.round(randNormalish(rng, meanYards, spread))

    // Breakaway chance for a big gain, scaled by advantage and RB speed.
    if (rng() < 0.025 + advantage * 0.035) {
      yards += randInt(rng, 8, 20)
    }
    yards = Math.max(yards, -8)

    const fumbled = rng() < fumbleChance(advantage)
    const animDurationSec = clamp(2 + Math.abs(yards) * 0.15, 2, 7)
    const tackler = yards > 12 ? pick(rng, db.length ? db : lb) : pick(rng, dline.concat(lb))

    if (fumbled) {
      return {
        type: 'fumble',
        yards: clamp(yards, 0, situation.opponentGoalDistance - 1),
        timeElapsedSec: randInt(rng, 30, 40),
        ballCarrierId: tackler.id,
        primaryDefenderId: tackler.id,
        breakdownEvents: [
          { atSec: 0, kind: 'snap' },
          { atSec: 0.5, kind: 'handoff' },
          { atSec: animDurationSec, kind: 'tackle' },
        ],
      }
    }

    const { type, yards: finalYards } = applyGoalLine('run', yards, situation.opponentGoalDistance)
    return {
      type,
      yards: finalYards,
      timeElapsedSec: randInt(rng, 32, 42),
      ballCarrierId: rb.id,
      primaryDefenderId: tackler.id,
      breakdownEvents: [
        { atSec: 0, kind: 'snap' },
        { atSec: 0.5, kind: 'handoff' },
        { atSec: type === 'touchdown' ? animDurationSec + 1 : animDurationSec, kind: 'tackle' },
      ],
    }
  }

  // Pass plays (pass_short / pass_medium / pass_deep / play_action).
  const pressure = pressureRating(offense, defense, defensePlay.type)
  const sackChance = clamp(0.03 + pressure * 0.0022, 0.02, 0.32)
  const rusher = pick(rng, dline.length ? dline : lb)

  if (rng() < sackChance) {
    const yards = -randInt(rng, 3, 9)
    return {
      type: 'sack',
      yards,
      timeElapsedSec: randInt(rng, 28, 38),
      ballCarrierId: qb.id,
      primaryDefenderId: rusher.id,
      breakdownEvents: [
        { atSec: 0, kind: 'snap' },
        { atSec: 1.8, kind: 'sack' },
      ],
    }
  }

  const difficulty = offensePlay.type === 'pass_deep' ? 0.18 : offensePlay.type === 'pass_medium' ? 0.06 : 0.0
  const preferredTarget = options?.preferredTargetId ? receivers.find((p) => p.id === options.preferredTargetId) : undefined
  const target = preferredTarget ?? pick(rng, receivers)
  const defender = pick(rng, db.length ? db : lb)

  const interceptionChance = clamp(0.018 + (0.5 - advantage) * 0.05 + (offensePlay.type === 'pass_deep' ? 0.02 : 0), 0.008, 0.11)
  if (rng() < interceptionChance) {
    return {
      type: 'interception',
      yards: randInt(rng, 0, 8),
      timeElapsedSec: randInt(rng, 8, 18),
      ballCarrierId: defender.id,
      targetReceiverId: target.id,
      primaryDefenderId: defender.id,
      breakdownEvents: [
        { atSec: 0, kind: 'snap' },
        { atSec: 1.6, kind: 'throw' },
        { atSec: 3, kind: 'catch' },
      ],
    }
  }

  const completionChance = clamp(0.4 + advantage * 0.45 - difficulty, 0.15, 0.93)
  if (rng() >= completionChance) {
    return {
      type: 'incomplete',
      yards: 0,
      timeElapsedSec: randInt(rng, 4, 8),
      ballCarrierId: qb.id,
      targetReceiverId: target.id,
      primaryDefenderId: defender.id,
      breakdownEvents: [
        { atSec: 0, kind: 'snap' },
        { atSec: 1.6, kind: 'throw' },
        { atSec: 2.8, kind: 'out_of_bounds' },
      ],
    }
  }

  const baseAirYards = offensePlay.type === 'pass_deep' ? 20 : offensePlay.type === 'pass_medium' ? 9 : 4
  const yacMean = -1 + advantage * 5
  let yards = Math.round(baseAirYards + randNormalish(rng, yacMean, 4))
  yards = Math.max(yards, 0)

  const fumbled = rng() < fumbleChance(advantage) * 0.6
  const animDurationSec = clamp(2.5 + yards * 0.12, 2.5, 7.5)

  if (fumbled) {
    return {
      type: 'fumble',
      yards: clamp(Math.round(yards * 0.6), 0, situation.opponentGoalDistance - 1),
      timeElapsedSec: randInt(rng, 20, 32),
      ballCarrierId: target.id,
      targetReceiverId: target.id,
      primaryDefenderId: defender.id,
      breakdownEvents: [
        { atSec: 0, kind: 'snap' },
        { atSec: 1.6, kind: 'throw' },
        { atSec: 2.8, kind: 'catch' },
        { atSec: animDurationSec, kind: 'tackle' },
      ],
    }
  }

  const { type, yards: finalYards } = applyGoalLine('pass', yards, situation.opponentGoalDistance)
  return {
    type,
    yards: finalYards,
    timeElapsedSec: randInt(rng, 30, 40),
    ballCarrierId: target.id,
    targetReceiverId: target.id,
    primaryDefenderId: defender.id,
    breakdownEvents: [
      { atSec: 0, kind: 'snap' },
      { atSec: 1.6, kind: 'throw' },
      { atSec: 2.8, kind: 'catch' },
      { atSec: type === 'touchdown' ? animDurationSec + 1 : animDurationSec, kind: 'tackle' },
    ],
  }
}

export type { PlaySituation }
