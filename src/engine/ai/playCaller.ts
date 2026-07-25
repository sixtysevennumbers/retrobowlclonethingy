import { DEFENSE_PLAYBOOK } from '../playbook/defensePlays'
import { OFFENSE_PLAYBOOK } from '../playbook/offensePlays'
import type { DefensePlay, OffensePlay } from '../playbook/types'
import type { PlaySituation } from '../outcome/types'
import { pick, type Rng } from '../rng'

const byId = <T extends { id: string }>(list: T[], id: string) => list.find((p) => p.id === id)!

/** Simple down/distance-aware heuristic play-caller for the AI-controlled coordinator. */
export function pickAiOffensePlay(rng: Rng, situation: PlaySituation): OffensePlay {
  const { down, distance } = situation
  if (distance <= 2) {
    return pick(rng, [byId(OFFENSE_PLAYBOOK, 'iso'), byId(OFFENSE_PLAYBOOK, 'stretch')])
  }
  if ((down === 3 || down === 4) && distance >= 8) {
    return pick(rng, [byId(OFFENSE_PLAYBOOK, 'crossers'), byId(OFFENSE_PLAYBOOK, 'shot')])
  }
  if (situation.opponentGoalDistance <= 12 && distance >= 5) {
    return byId(OFFENSE_PLAYBOOK, 'shot')
  }
  return pick(rng, OFFENSE_PLAYBOOK)
}

export type FourthDownDecision = 'go' | 'punt' | 'field_goal'

/** Simple 4th-down heuristic: go for it when short or deep in opponent territory, else kick. */
export function pickAiFourthDownDecision(situation: PlaySituation): FourthDownDecision {
  const { distance, opponentGoalDistance } = situation
  if (opponentGoalDistance <= 5) return 'go'
  if (opponentGoalDistance <= 38) return 'field_goal'
  if (distance <= 2) return 'go'
  return 'punt'
}

export function pickAiDefensePlay(rng: Rng, situation: PlaySituation): DefensePlay {
  const { down, distance } = situation
  if (distance <= 3 && down <= 2) {
    return byId(DEFENSE_PLAYBOOK, 'stack')
  }
  if ((down === 3 || down === 4) && distance >= 8) {
    return pick(rng, [byId(DEFENSE_PLAYBOOK, 'shell'), byId(DEFENSE_PLAYBOOK, 'blitz')])
  }
  return pick(rng, DEFENSE_PLAYBOOK)
}
