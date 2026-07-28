import type { DefensePlay, OffensePlay } from '../playbook/types'
import type { PlayOutcome } from '../outcome/types'
import { clamp } from '../rng'
import type { Actor } from './formations'
import { distance, type Vec2 } from './steering'
import {
  actorMaxSpeed,
  applyBlockingTargets,
  applyDefaultSecondaryTargets,
  applyDefaultSkillPlayerTargets,
  applyPassRushTargets,
  applyRunPursuitTargets,
  frontSevenOf,
  olineOf,
  secondaryOf,
  standoffTarget,
  type TargetFn,
} from './playHelpers'

/** Time-parametrizes a drawn path using the actor's max speed, so it fits the stateless TargetFn contract:
 *  "which waypoint should this actor be seeking right now" given how much of the path they'd have covered by tSec. */
export function pathTargetAtTime(path: Vec2[], speed: number, tSec: number): Vec2 {
  if (path.length === 0) return { x: 0, y: 0 }
  if (path.length === 1) return path[0]
  let elapsed = 0
  for (let i = 1; i < path.length; i++) {
    const segLen = distance(path[i - 1], path[i])
    const segTime = segLen / Math.max(0.5, speed)
    if (tSec <= elapsed + segTime) return path[i]
    elapsed += segTime
  }
  return path[path.length - 1]
}

/** Scales a drawn path's depth so its endpoint lands near the resolved yardage, keeping the path's shape. */
function scalePathToTarget(path: Vec2[], targetY: number): Vec2[] {
  if (path.length === 0) return path
  const maxY = Math.max(...path.map((p) => p.y), 0.1)
  const scale = clamp(targetY / maxY, 0.3, 2.5)
  return path.map((p) => ({ x: p.x * scale, y: p.y * scale }))
}

/** Builds targets for a user-drawn offensive play. Ball carrier on a run is always the RB (kept consistent
 *  with playDirector's snapFinalPosition, which snaps the RB's final spot to the resolved yardage). */
export function setupCustomOffensePlay(offensePlay: OffensePlay, offense: Actor[], defense: Actor[], outcome: PlayOutcome): Map<string, TargetFn> {
  const data = offensePlay.custom!
  const targets = new Map<string, TargetFn>()
  const bySlot = new Map(offense.map((a) => [a.slotKey, a]))
  const routeBySlot = new Map(data.routes.map((r) => [r.slotKey, r]))

  const qb = offense.find((a) => a.position === 'QB')!
  const dropback: Vec2 = { x: qb.start.x, y: qb.start.y - 2 }
  targets.set(qb.id, (tSec) => (tSec < 1.8 ? dropback : { x: dropback.x + 1, y: dropback.y }))

  const frontSeven = frontSevenOf(defense)
  const blockablePool = data.kind === 'run' && offensePlay.type === 'run_inside' ? [...olineOf(offense), ...offense.filter((a) => a.position === 'TE')] : olineOf(offense)
  applyBlockingTargets(targets, blockablePool, frontSeven)

  if (data.kind === 'run') {
    const rb = offense.find((a) => a.position === 'RB')
    const drawnRoute = routeBySlot.get('RB:0')
    if (rb) {
      const path = drawnRoute && drawnRoute.points.length > 0 ? scalePathToTarget(drawnRoute.points, outcome.yards) : [{ x: 0, y: outcome.yards }]
      targets.set(rb.id, (tSec) => pathTargetAtTime(path, actorMaxSpeed(rb), tSec))
      applyRunPursuitTargets(targets, defense, rb, path[path.length - 1])
    }
  } else {
    const targetActor = data.targetSlot ? bySlot.get(data.targetSlot) : undefined
    const targetRoute = data.targetSlot ? routeBySlot.get(data.targetSlot) : undefined
    const catchEvent = outcome.breakdownEvents.find((e) => e.kind === 'catch')
    const catchAt = catchEvent?.atSec ?? 3
    if (targetActor && targetRoute && targetRoute.points.length > 0) {
      const lastPt = targetRoute.points[targetRoute.points.length - 1]
      const yacTarget: Vec2 = { x: lastPt.x, y: outcome.yards }
      targets.set(targetActor.id, (tSec) => {
        if (tSec < catchAt || outcome.type === 'interception') return pathTargetAtTime(targetRoute.points, actorMaxSpeed(targetActor), tSec)
        return yacTarget
      })
    }
    applyPassRushTargets(targets, frontSeven, qb, dropback)
    const secondary = secondaryOf(defense)
    const coverDefender = defense.find((a) => a.id === outcome.primaryDefenderId) ?? secondary[0]
    applyDefaultSecondaryTargets(targets, secondary, targetActor, coverDefender?.id)
  }

  // Other drawn routes (decoys / additional receivers not chosen as the target) follow their path as-is.
  for (const [slotKey, route] of routeBySlot) {
    const actor = bySlot.get(slotKey)
    if (actor && !targets.has(actor.id) && route.points.length > 0) {
      targets.set(actor.id, (tSec) => pathTargetAtTime(route.points, actorMaxSpeed(actor), tSec))
    }
  }

  applyDefaultSkillPlayerTargets(targets, offense, 6)

  return targets
}

/** Overrides specific defenders' targets per the user's drawn assignments; defenders left undrawn keep
 *  whatever default reaction the offense-side setup already gave them (rush/pursue/zone fallback). */
export function setupCustomDefensePlay(
  defensePlay: DefensePlay,
  offense: Actor[],
  defense: Actor[],
  outcome: PlayOutcome,
  targets: Map<string, TargetFn>,
): void {
  const data = defensePlay.custom!
  const bySlotOffense = new Map(offense.map((a) => [a.slotKey, a]))
  const bySlotDefense = new Map(defense.map((a) => [a.slotKey, a]))
  const qb = offense.find((a) => a.position === 'QB')

  for (const assignment of data.assignments) {
    const defender = bySlotDefense.get(assignment.slotKey)
    if (!defender) continue

    if (assignment.kind === 'rush' && qb) {
      targets.set(defender.id, (_t, positions) => {
        const qbPos = positions.get(qb.id) ?? defender.start
        const selfPos = positions.get(defender.id) ?? defender.start
        return standoffTarget(selfPos, qbPos)
      })
    } else if (assignment.kind === 'cover' && assignment.coverSlot) {
      const coveredActor = bySlotOffense.get(assignment.coverSlot)
      if (coveredActor) {
        targets.set(defender.id, (_t, positions) => {
          const coveredPos = positions.get(coveredActor.id) ?? defender.start
          const selfPos = positions.get(defender.id) ?? defender.start
          return standoffTarget(selfPos, coveredPos)
        })
      }
    } else if (assignment.kind === 'zone' && assignment.points.length > 0) {
      const path = assignment.points
      const last = path[path.length - 1]
      targets.set(defender.id, (tSec, positions) => {
        if (tSec < 2.2) return pathTargetAtTime(path, actorMaxSpeed(defender), tSec)
        const ballPos = positions.get(outcome.ballCarrierId)
        if (!ballPos) return last
        return { x: last.x + (ballPos.x - last.x) * 0.3, y: last.y + (ballPos.y - last.y) * 0.3 }
      })
    }
  }
}
